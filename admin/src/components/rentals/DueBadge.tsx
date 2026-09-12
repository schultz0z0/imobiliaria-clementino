import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import React from 'react';

export type DueBadgeStatus = 'overdue' | 'due-soon' | 'paid' | 'forwarded' | 'pending';

export const computeDueStatus = (
  payment: {
    dueDate: string;
    paidAt?: string | null;
    forwardedAt?: string | null;
  },
  referenceDate = new Date(),
): DueBadgeStatus => {
  if (payment.forwardedAt) return 'forwarded';
  if (payment.paidAt) return 'paid';

  const todayStr = referenceDate.toISOString().slice(0, 10);
  const dueStr = payment.dueDate.slice(0, 10);

  if (dueStr < todayStr) return 'overdue';

  const refTime = new Date(`${todayStr}T00:00:00Z`).getTime();
  const dueTime = new Date(`${dueStr}T00:00:00Z`).getTime();
  const diffDays = Math.ceil((dueTime - refTime) / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) return 'due-soon';

  return 'pending';
};

const defaultLabels: Record<DueBadgeStatus, string> = {
  overdue: 'Atrasado',
  'due-soon': 'Vence em breve',
  paid: 'Aguardando repasse',
  forwarded: 'Concluído',
  pending: 'A vencer',
};

const icons: Record<DueBadgeStatus, React.ComponentType<{ className?: string; style?: React.CSSProperties; 'aria-hidden'?: boolean | 'true' | 'false' }>> = {
  overdue: AlertCircle,
  'due-soon': AlertTriangle,
  paid: ArrowUpRight,
  forwarded: CheckCircle2,
  pending: Clock,
};

export interface DueBadgeProps {
  status?: DueBadgeStatus;
  payment?: {
    dueDate: string;
    paidAt?: string | null;
    forwardedAt?: string | null;
  };
  referenceDate?: Date;
  label?: string;
  className?: string;
}

export const DueBadge: React.FC<DueBadgeProps> = ({
  status,
  payment,
  referenceDate,
  label,
  className = '',
}) => {
  const resolvedStatus: DueBadgeStatus =
    status ?? (payment ? computeDueStatus(payment, referenceDate) : 'pending');

  const Icon = icons[resolvedStatus] ?? Clock;
  const displayLabel = label || defaultLabels[resolvedStatus] || resolvedStatus;

  return (
    <span
      className={`due-badge due-badge-${resolvedStatus} ${className}`.trim()}
      data-status={resolvedStatus}
    >
      <Icon style={{ width: '13px', height: '13px' }} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
};
