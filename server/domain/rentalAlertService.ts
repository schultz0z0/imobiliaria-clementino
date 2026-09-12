import type { SqlExecutor } from '../db/client.ts';
import {
  buildAlertEmailHtml,
  buildAlertEmailSubject,
  type OperationalAlertItem,
  type OperationalAlertsSummary,
} from '../email/alertEmailTemplate.ts';

export type AlertType =
  | 'payment_overdue'
  | 'payment_due_soon'
  | 'forwarding_pending'
  | 'contract_expiring'
  | 'contract_adjustment';

export interface AlertCandidate {
  contractId: string;
  contractNumber: string;
  alertType: AlertType;
  referenceDate: string;
  item: OperationalAlertItem;
}

export interface OperationalAlertsResult {
  overduePayments: OperationalAlertItem[];
  dueSoonPayments: OperationalAlertItem[];
  pendingForwardings: OperationalAlertItem[];
  expiringContracts: OperationalAlertItem[];
  upcomingAdjustments: OperationalAlertItem[];
  allCandidates: AlertCandidate[];
}

export interface DispatchAlertsOptions {
  resendApiKey?: string;
  recipientEmail?: string;
  senderEmail?: string;
  asOfDate?: Date;
}

export interface DispatchAlertsResult {
  dispatchedCount: number;
  skippedCount: number;
  emailSent: boolean;
  alerts: AlertCandidate[];
}

const formatDateStr = (val: unknown): string => {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
};

const formatBrDate = (val: string): string => {
  const parts = val.slice(0, 10).split('-');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return val;
};

export const findOperationalAlerts = async (
  sql: SqlExecutor,
  asOfDate?: Date,
): Promise<OperationalAlertsResult> => {
  const baseDate = asOfDate ?? new Date();
  const asOfDateStr = formatDateStr(baseDate);

  const d7 = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in7DaysStr = formatDateStr(d7);

  const d30 = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in30DaysStr = formatDateStr(d30);

  const [overdueRows, dueSoonRows, pendingForwardingRows, expiringRows, adjustmentRows] =
    await Promise.all([
      // 1. Overdue payments
      sql<
        {
          id: string;
          contract_id: string;
          contract_number: string;
          category: string;
          amount: string;
          due_date: string | Date;
          landlord_name: string;
          tenant_name: string;
          property_ref: string;
        }[]
      >`
        SELECT
          p.id,
          p.contract_id,
          c.contract_number,
          p.category,
          p.amount,
          p.due_date,
          landlord.full_name AS landlord_name,
          tenant.full_name AS tenant_name,
          COALESCE(prop.commercial_reference, prop.public_id) AS property_ref
        FROM payment_records p
        JOIN rental_contracts c ON c.id = p.contract_id
        JOIN people landlord ON landlord.id = c.landlord_id
        JOIN people tenant ON tenant.id = c.tenant_id
        JOIN properties prop ON prop.id = c.property_id
        WHERE p.paid_at IS NULL AND p.due_date < ${asOfDateStr}
        ORDER BY p.due_date ASC
      `,

      // 2. Due soon payments (within 7 days)
      sql<
        {
          id: string;
          contract_id: string;
          contract_number: string;
          category: string;
          amount: string;
          due_date: string | Date;
          landlord_name: string;
          tenant_name: string;
          property_ref: string;
        }[]
      >`
        SELECT
          p.id,
          p.contract_id,
          c.contract_number,
          p.category,
          p.amount,
          p.due_date,
          landlord.full_name AS landlord_name,
          tenant.full_name AS tenant_name,
          COALESCE(prop.commercial_reference, prop.public_id) AS property_ref
        FROM payment_records p
        JOIN rental_contracts c ON c.id = p.contract_id
        JOIN people landlord ON landlord.id = c.landlord_id
        JOIN people tenant ON tenant.id = c.tenant_id
        JOIN properties prop ON prop.id = c.property_id
        WHERE p.paid_at IS NULL AND p.due_date >= ${asOfDateStr} AND p.due_date <= ${in7DaysStr}
        ORDER BY p.due_date ASC
      `,

      // 3. Pending forwardings
      sql<
        {
          id: string;
          contract_id: string;
          contract_number: string;
          category: string;
          amount: string;
          paid_at: Date;
          due_date: string | Date;
          landlord_name: string;
          tenant_name: string;
          property_ref: string;
        }[]
      >`
        SELECT
          p.id,
          p.contract_id,
          c.contract_number,
          p.category,
          p.amount,
          p.paid_at,
          p.due_date,
          landlord.full_name AS landlord_name,
          tenant.full_name AS tenant_name,
          COALESCE(prop.commercial_reference, prop.public_id) AS property_ref
        FROM payment_records p
        JOIN rental_contracts c ON c.id = p.contract_id
        JOIN people landlord ON landlord.id = c.landlord_id
        JOIN people tenant ON tenant.id = c.tenant_id
        JOIN properties prop ON prop.id = c.property_id
        WHERE p.paid_at IS NOT NULL AND p.forwarded_at IS NULL
        ORDER BY p.paid_at ASC
      `,

      // 4. Expiring contracts (within 30 days)
      sql<
        {
          contract_id: string;
          contract_number: string;
          end_date: string | Date;
          rent_amount: string;
          landlord_name: string;
          tenant_name: string;
          property_ref: string;
        }[]
      >`
        SELECT
          c.id AS contract_id,
          c.contract_number,
          c.end_date,
          c.rent_amount,
          landlord.full_name AS landlord_name,
          tenant.full_name AS tenant_name,
          COALESCE(prop.commercial_reference, prop.public_id) AS property_ref
        FROM rental_contracts c
        JOIN people landlord ON landlord.id = c.landlord_id
        JOIN people tenant ON tenant.id = c.tenant_id
        JOIN properties prop ON prop.id = c.property_id
        WHERE c.status = 'active' AND c.end_date >= ${asOfDateStr} AND c.end_date <= ${in30DaysStr}
        ORDER BY c.end_date ASC
      `,

      // 5. Upcoming adjustments (within 30 days)
      sql<
        {
          contract_id: string;
          contract_number: string;
          adjustment_date: string | Date;
          adjustment_index: string | null;
          adjustment_percentage: string | null;
          rent_amount: string;
          landlord_name: string;
          tenant_name: string;
          property_ref: string;
        }[]
      >`
        SELECT
          c.id AS contract_id,
          c.contract_number,
          c.adjustment_date,
          c.adjustment_index,
          c.adjustment_percentage,
          c.rent_amount,
          landlord.full_name AS landlord_name,
          tenant.full_name AS tenant_name,
          COALESCE(prop.commercial_reference, prop.public_id) AS property_ref
        FROM rental_contracts c
        JOIN people landlord ON landlord.id = c.landlord_id
        JOIN people tenant ON tenant.id = c.tenant_id
        JOIN properties prop ON prop.id = c.property_id
        WHERE c.status = 'active'
          AND c.adjustment_date IS NOT NULL
          AND c.adjustment_date >= ${asOfDateStr}
          AND c.adjustment_date <= ${in30DaysStr}
        ORDER BY c.adjustment_date ASC
      `,
    ]);

  const allCandidates: AlertCandidate[] = [];

  const overduePayments: OperationalAlertItem[] = overdueRows.map((row) => {
    const dueDateStr = formatDateStr(row.due_date);
    const item: OperationalAlertItem = {
      id: row.id,
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      category: row.category,
      amount: Number(row.amount),
      date: dueDateStr,
      tenantName: row.tenant_name,
      landlordName: row.landlord_name,
      propertyRef: row.property_ref,
    };
    allCandidates.push({
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      alertType: 'payment_overdue',
      referenceDate: dueDateStr,
      item,
    });
    return item;
  });

  const dueSoonPayments: OperationalAlertItem[] = dueSoonRows.map((row) => {
    const dueDateStr = formatDateStr(row.due_date);
    const item: OperationalAlertItem = {
      id: row.id,
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      category: row.category,
      amount: Number(row.amount),
      date: dueDateStr,
      tenantName: row.tenant_name,
      landlordName: row.landlord_name,
      propertyRef: row.property_ref,
    };
    allCandidates.push({
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      alertType: 'payment_due_soon',
      referenceDate: dueDateStr,
      item,
    });
    return item;
  });

  const pendingForwardings: OperationalAlertItem[] = pendingForwardingRows.map((row) => {
    const paidAtStr = formatDateStr(row.paid_at);
    const item: OperationalAlertItem = {
      id: row.id,
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      category: row.category,
      amount: Number(row.amount),
      date: paidAtStr,
      tenantName: row.tenant_name,
      landlordName: row.landlord_name,
      propertyRef: row.property_ref,
    };
    allCandidates.push({
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      alertType: 'forwarding_pending',
      referenceDate: formatDateStr(row.due_date),
      item,
    });
    return item;
  });

  const expiringContracts: OperationalAlertItem[] = expiringRows.map((row) => {
    const endDateStr = formatDateStr(row.end_date);
    const item: OperationalAlertItem = {
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      amount: Number(row.rent_amount),
      date: endDateStr,
      tenantName: row.tenant_name,
      landlordName: row.landlord_name,
      propertyRef: row.property_ref,
    };
    allCandidates.push({
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      alertType: 'contract_expiring',
      referenceDate: endDateStr,
      item,
    });
    return item;
  });

  const upcomingAdjustments: OperationalAlertItem[] = adjustmentRows.map((row) => {
    const adjDateStr = formatDateStr(row.adjustment_date);
    const details = [
      row.adjustment_index,
      row.adjustment_percentage ? `${row.adjustment_percentage}%` : '',
    ]
      .filter(Boolean)
      .join(' / ');

    const item: OperationalAlertItem = {
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      amount: Number(row.rent_amount),
      date: adjDateStr,
      tenantName: row.tenant_name,
      landlordName: row.landlord_name,
      propertyRef: row.property_ref,
      details: details || undefined,
    };
    allCandidates.push({
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      alertType: 'contract_adjustment',
      referenceDate: adjDateStr,
      item,
    });
    return item;
  });

  return {
    overduePayments,
    dueSoonPayments,
    pendingForwardings,
    expiringContracts,
    upcomingAdjustments,
    allCandidates,
  };
};

export const dispatchAlerts = async (
  sql: SqlExecutor,
  options: DispatchAlertsOptions = {},
): Promise<DispatchAlertsResult> => {
  const asOfDate = options.asOfDate ?? new Date();
  const asOfDateStr = formatDateStr(asOfDate);

  const { allCandidates } = await findOperationalAlerts(sql, asOfDate);

  // 1. Fetch existing alert_notifications for channel 'email'
  const existingRows = await sql<
    { contract_id: string; alert_type: string; reference_date: string | Date }[]
  >`
    SELECT contract_id, alert_type, reference_date
    FROM alert_notifications
    WHERE channel = 'email'
  `;

  const existingSet = new Set<string>();
  for (const row of existingRows) {
    existingSet.add(`${row.contract_id}:${row.alert_type}:${formatDateStr(row.reference_date)}`);
  }

  // 2. Filter candidates for deduplication
  const newAlerts: AlertCandidate[] = [];
  let skippedCount = 0;

  for (const candidate of allCandidates) {
    const key = `${candidate.contractId}:${candidate.alertType}:${candidate.referenceDate}`;
    if (existingSet.has(key)) {
      skippedCount++;
    } else {
      newAlerts.push(candidate);
    }
  }

  if (newAlerts.length === 0) {
    return {
      dispatchedCount: 0,
      skippedCount,
      emailSent: false,
      alerts: [],
    };
  }

  // 3. Build summary of new alerts for email dispatch
  const summary: OperationalAlertsSummary = {
    asOfDate: formatBrDate(asOfDateStr),
    overduePayments: newAlerts
      .filter((a) => a.alertType === 'payment_overdue')
      .map((a) => a.item),
    dueSoonPayments: newAlerts
      .filter((a) => a.alertType === 'payment_due_soon')
      .map((a) => a.item),
    pendingForwardings: newAlerts
      .filter((a) => a.alertType === 'forwarding_pending')
      .map((a) => a.item),
    expiringContracts: newAlerts
      .filter((a) => a.alertType === 'contract_expiring')
      .map((a) => a.item),
    upcomingAdjustments: newAlerts
      .filter((a) => a.alertType === 'contract_adjustment')
      .map((a) => a.item),
  };

  const emailSubject = buildAlertEmailSubject(summary);
  const emailHtml = buildAlertEmailHtml(summary);

  let emailSent = false;

  // 4. Send via Resend API if API key provided
  if (options.resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.resendApiKey}`,
      },
      body: JSON.stringify({
        from:
          options.senderEmail ||
          process.env.ALERT_SENDER_EMAIL ||
          'Imobiliária Clementino <locacoes@imobiliariaclementino.com.br>',
        to: options.recipientEmail ?? 'locacoes@imobiliariaclementino.com.br',
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Resend API failed (${res.status}): ${errText}`);
    }
    emailSent = true;
  }

  // 5. Record notifications in DB for deduplication
  for (const alert of newAlerts) {
    await sql`
      INSERT INTO alert_notifications (
        contract_id, alert_type, channel, reference_date
      ) VALUES (
        ${alert.contractId},
        ${alert.alertType},
        'email',
        ${alert.referenceDate}
      )
      ON CONFLICT (contract_id, alert_type, channel, reference_date) DO NOTHING
    `;
  }

  return {
    dispatchedCount: newAlerts.length,
    skippedCount,
    emailSent,
    alerts: newAlerts,
  };
};
