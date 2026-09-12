import { AlertCircle, Download, FileSpreadsheet, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { adminApi, type FinancialSummaryDto, type ReportAdminApi } from '../../api/client.ts';

export interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  api?: Pick<ReportAdminApi, 'getFinancialSummary' | 'getExportCsvUrl'>;
}

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  api = adminApi,
}) => {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [fromMonth, setFromMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 7);
  });
  const [toMonth, setToMonth] = useState<string>(currentMonthStr);

  const [summary, setSummary] = useState<FinancialSummaryDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (fromM: string, toM: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFinancialSummary({
        fromMonth: fromM || undefined,
        toMonth: toM || undefined,
      });
      setSummary(res.summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar resumo financeiro.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isOpen) {
      void loadSummary(fromMonth, toMonth);
    }
  }, [isOpen, fromMonth, toMonth, loadSummary]);

  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    const url = api.getExportCsvUrl({
      fromMonth: fromMonth || undefined,
      toMonth: toMonth || undefined,
    });
    // Trigger download in browser
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'relatorio-financeiro-locacoes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-mark" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
              <FileSpreadsheet style={{ width: '18px', height: '18px' }} aria-hidden="true" />
            </div>
            <div>
              <h2 id="report-modal-title" style={{ margin: 0, fontSize: '18px' }}>
                Relatórios Financeiros de Locação
              </h2>
              <small style={{ color: 'var(--admin-text-muted)' }}>
                Consolidação financeira e exportação para CSV/Excel
              </small>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X style={{ width: '18px', height: '18px' }} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="form-alert" role="alert" style={{ marginBottom: '16px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px' }} />
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Filters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: 'var(--admin-radius-sm)',
              background: 'var(--admin-surface-subtle)',
              border: '1px solid var(--admin-border)',
            }}
          >
            <label style={{ display: 'grid', gap: '4px', fontSize: '13px', fontWeight: 500 }}>
              <span>Mês Inicial:</span>
              <input
                type="month"
                className="input"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '4px', fontSize: '13px', fontWeight: 500 }}>
              <span>Mês Final:</span>
              <input
                type="month"
                className="input"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px' }}
              />
            </label>
          </div>

          {/* Quick Metrics Summary */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--admin-radius-sm)',
              border: '1px solid var(--admin-border)',
              background: 'var(--admin-surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                Resumo Consolidado do Período
              </h3>
              {loading && <RefreshCw className="spin" style={{ width: '14px', height: '14px' }} />}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
              }}
            >
              <div style={{ padding: '8px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block' }}>
                  Total Previsto
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--admin-text)' }}>
                  {formatCurrency(summary?.totalExpected)}
                </strong>
              </div>

              <div style={{ padding: '8px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block' }}>
                  Total Recebido
                </span>
                <strong style={{ fontSize: '14px', color: '#16a34a' }}>
                  {formatCurrency(summary?.totalCollected)}
                </strong>
              </div>

              <div style={{ padding: '8px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block' }}>
                  Total Repassado
                </span>
                <strong style={{ fontSize: '14px', color: '#2563eb' }}>
                  {formatCurrency(summary?.totalForwarded)}
                </strong>
              </div>

              <div style={{ padding: '8px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block' }}>
                  Repasse Pendente
                </span>
                <strong style={{ fontSize: '14px', color: '#d97706' }}>
                  {formatCurrency(summary?.totalPendingForwarding)}
                </strong>
              </div>

              <div style={{ padding: '8px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block' }}>
                  Inadimplência
                </span>
                <strong style={{ fontSize: '14px', color: '#dc2626' }}>
                  {formatCurrency(summary?.totalOverdue)}
                </strong>
              </div>

              <div style={{ padding: '8px', background: 'var(--admin-surface-subtle)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block' }}>
                  Contratos Ativos
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--admin-text)' }}>
                  {summary ? summary.activeContractsCount : '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" className="button button-secondary" onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleDownloadCsv}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download style={{ width: '16px', height: '16px' }} aria-hidden="true" />
              <span>Exportar CSV (Excel)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
