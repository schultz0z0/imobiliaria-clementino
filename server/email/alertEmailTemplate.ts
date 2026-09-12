export interface OperationalAlertItem {
  id?: string;
  contractId: string;
  contractNumber: string;
  category?: string;
  amount?: number;
  date: string;
  tenantName: string;
  landlordName: string;
  propertyRef: string;
  details?: string;
}

export interface OperationalAlertsSummary {
  asOfDate: string;
  overduePayments: OperationalAlertItem[];
  dueSoonPayments: OperationalAlertItem[];
  pendingForwardings: OperationalAlertItem[];
  expiringContracts: OperationalAlertItem[];
  upcomingAdjustments: OperationalAlertItem[];
}

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatBrDate = (val: string): string => {
  if (!val) return '—';
  const parts = val.slice(0, 10).split('-');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return val;
};

const categoryLabels: Record<string, string> = {
  rent: 'Aluguel',
  condominium: 'Condomínio',
  iptu: 'IPTU',
  water: 'Água',
  fire_insurance: 'Seguro Incêndio',
  maintenance: 'Manutenção',
};

export const buildAlertEmailSubject = (data: OperationalAlertsSummary): string => {
  const totalAlerts =
    data.overduePayments.length +
    data.dueSoonPayments.length +
    data.pendingForwardings.length +
    data.expiringContracts.length +
    data.upcomingAdjustments.length;

  if (totalAlerts === 0) {
    return `[Clementino Imóveis] Resumo Operacional de Locações - Tudo em dia (${data.asOfDate})`;
  }

  const urgentParts: string[] = [];
  if (data.overduePayments.length > 0) {
    urgentParts.push(`${data.overduePayments.length} atraso(s)`);
  }
  if (data.pendingForwardings.length > 0) {
    urgentParts.push(`${data.pendingForwardings.length} repasse(s) pendente(s)`);
  }

  const tag = urgentParts.length > 0 ? ` [Atenção: ${urgentParts.join(', ')}]` : '';
  return `[Clementino Imóveis] Alertas Operacionais de Locação - ${data.asOfDate}${tag}`;
};

export const buildAlertEmailHtml = (data: OperationalAlertsSummary): string => {
  const totalAlerts =
    data.overduePayments.length +
    data.dueSoonPayments.length +
    data.pendingForwardings.length +
    data.expiringContracts.length +
    data.upcomingAdjustments.length;

  const renderPaymentTable = (
    title: string,
    items: OperationalAlertItem[],
    accentColor: string,
    dateColumnHeader: string,
  ) => {
    if (items.length === 0) return '';

    const rows = items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${item.contractNumber}</td>
          <td style="padding: 10px 12px; color: #475569;">${categoryLabels[item.category ?? ''] ?? item.category ?? '—'}</td>
          <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${formatCurrency(item.amount)}</td>
          <td style="padding: 10px 12px; color: #64748b;">${formatBrDate(item.date)}</td>
          <td style="padding: 10px 12px; color: #334155;">${item.tenantName}</td>
          <td style="padding: 10px 12px; color: #334155;">${item.landlordName}</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 12px;">${item.propertyRef}</td>
        </tr>`,
      )
      .join('');

    return `
      <div style="margin-bottom: 24px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="padding: 12px 16px; background: ${accentColor}10; border-bottom: 1px solid #e2e8f0; border-left: 4px solid ${accentColor};">
          <h3 style="margin: 0; font-size: 15px; color: #0f172a;">${title} (${items.length})</h3>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase;">
                <th style="padding: 8px 12px;">Contrato</th>
                <th style="padding: 8px 12px;">Categoria</th>
                <th style="padding: 8px 12px;">Valor</th>
                <th style="padding: 8px 12px;">${dateColumnHeader}</th>
                <th style="padding: 8px 12px;">Locatário</th>
                <th style="padding: 8px 12px;">Locador</th>
                <th style="padding: 8px 12px;">Imóvel</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  const renderContractTable = (
    title: string,
    items: OperationalAlertItem[],
    accentColor: string,
    dateColumnHeader: string,
    detailsHeader?: string,
  ) => {
    if (items.length === 0) return '';

    const rows = items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${item.contractNumber}</td>
          <td style="padding: 10px 12px; color: #64748b;">${formatBrDate(item.date)}</td>
          <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${formatCurrency(item.amount)}</td>
          ${detailsHeader ? `<td style="padding: 10px 12px; color: #2563eb; font-weight: 500;">${item.details ?? '—'}</td>` : ''}
          <td style="padding: 10px 12px; color: #334155;">${item.tenantName}</td>
          <td style="padding: 10px 12px; color: #334155;">${item.landlordName}</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 12px;">${item.propertyRef}</td>
        </tr>`,
      )
      .join('');

    return `
      <div style="margin-bottom: 24px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="padding: 12px 16px; background: ${accentColor}10; border-bottom: 1px solid #e2e8f0; border-left: 4px solid ${accentColor};">
          <h3 style="margin: 0; font-size: 15px; color: #0f172a;">${title} (${items.length})</h3>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase;">
                <th style="padding: 8px 12px;">Contrato</th>
                <th style="padding: 8px 12px;">${dateColumnHeader}</th>
                <th style="padding: 8px 12px;">Aluguel Atual</th>
                ${detailsHeader ? `<th style="padding: 8px 12px;">${detailsHeader}</th>` : ''}
                <th style="padding: 8px 12px;">Locatário</th>
                <th style="padding: 8px 12px;">Locador</th>
                <th style="padding: 8px 12px;">Imóvel</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumo Operacional de Locações</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 800px; margin: 24px auto; background-color: #f8fafc; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Brand Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; color: #ffffff;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <div style="font-size: 20px; font-weight: 700; letter-spacing: 0.5px; color: #ffffff;">
              IMOBILIÁRIA CLEMENTINO
            </div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
              Hub de Gestão de Locações · Resumo Operacional
            </div>
          </td>
          <td style="text-align: right; font-size: 13px; color: #cbd5e1;">
            Data: <strong>${data.asOfDate}</strong>
          </td>
        </tr>
      </table>
    </div>

    <!-- Alert Counters Grid -->
    <div style="padding: 24px 32px 12px;">
      <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 16px;">
        <tr>
          <td style="background: #ffffff; border: 1px solid #fee2e2; border-left: 4px solid #dc2626; border-radius: 8px; padding: 12px; width: 20%; text-align: center;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Atrasados</div>
            <div style="font-size: 20px; font-weight: 700; color: #dc2626; margin-top: 4px;">${data.overduePayments.length}</div>
          </td>
          <td style="background: #ffffff; border: 1px solid #fef3c7; border-left: 4px solid #d97706; border-radius: 8px; padding: 12px; width: 20%; text-align: center;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">A Vencer (7d)</div>
            <div style="font-size: 20px; font-weight: 700; color: #d97706; margin-top: 4px;">${data.dueSoonPayments.length}</div>
          </td>
          <td style="background: #ffffff; border: 1px solid #dbeafe; border-left: 4px solid #2563eb; border-radius: 8px; padding: 12px; width: 20%; text-align: center;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Repasses</div>
            <div style="font-size: 20px; font-weight: 700; color: #2563eb; margin-top: 4px;">${data.pendingForwardings.length}</div>
          </td>
          <td style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #64748b; border-radius: 8px; padding: 12px; width: 20%; text-align: center;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Vencendo (30d)</div>
            <div style="font-size: 20px; font-weight: 700; color: #475569; margin-top: 4px;">${data.expiringContracts.length}</div>
          </td>
          <td style="background: #ffffff; border: 1px solid #f3e8ff; border-left: 4px solid #9333ea; border-radius: 8px; padding: 12px; width: 20%; text-align: center;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Reajustes (30d)</div>
            <div style="font-size: 20px; font-weight: 700; color: #9333ea; margin-top: 4px;">${data.upcomingAdjustments.length}</div>
          </td>
        </tr>
      </table>

      ${
        totalAlerts === 0
          ? `<div style="padding: 24px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; color: #16a34a;">
              <h3 style="margin: 0 0 6px;">Nenhuma pendência operacional encontrada!</h3>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Todos os pagamentos, repasses e contratos estão em dia.</p>
            </div>`
          : ''
      }

      <!-- Detailed Sections -->
      ${renderPaymentTable('🚨 Boletos em Atraso', data.overduePayments, '#dc2626', 'Vencimento')}
      ${renderPaymentTable('⏳ Boletos a Vencer nos Próximos 7 Dias', data.dueSoonPayments, '#d97706', 'Vencimento')}
      ${renderPaymentTable('📤 Repasses Pendentes para Locadores', data.pendingForwardings, '#2563eb', 'Data Recebido')}
      ${renderContractTable('📑 Contratos Expirando nos Próximos 30 Dias', data.expiringContracts, '#475569', 'Término')}
      ${renderContractTable('📈 Reajustes Programados nos Próximos 30 Dias', data.upcomingAdjustments, '#9333ea', 'Data Reajuste', 'Índice / %')}
    </div>

    <!-- Footer -->
    <div style="padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
      Relatório gerado automaticamente pelo Hub de Locações da Imobiliária Clementino em ${data.asOfDate}.<br>
      Acesse o painel administrativo para gerenciar baixas e emissões.
    </div>

  </div>
</body>
</html>
  `.trim();
};
