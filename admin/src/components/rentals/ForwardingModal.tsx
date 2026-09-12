import { AlertCircle, ArrowUpRight, Check, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { adminApi, type PaymentAdminApi, type RentalAdminApi } from '../../api/client.ts';
import type { PaymentCategory, PaymentRecordDto } from '../../../../shared/rentalSchema.ts';

const paymentCategoryLabel: Record<PaymentCategory, string> = {
  rent: 'Aluguel',
  condominium: 'Condomínio',
  iptu: 'IPTU',
  water: 'Água',
  fire_insurance: 'Seguro Incêndio',
  maintenance: 'Manutenção',
};

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export interface ForwardingModalProps {
  payment: PaymentRecordDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: PaymentRecordDto) => void;
  api?: Pick<PaymentAdminApi, 'recordForwarding'> &
    Partial<Pick<RentalAdminApi, 'createContractDocument'>>;
  contractNumber?: string;
}

export const ForwardingModal: React.FC<ForwardingModalProps> = ({
  payment,
  isOpen,
  onClose,
  onSuccess,
  api,
  contractNumber,
}) => {
  const [forwardedAtDate, setForwardedAtDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && payment) {
      setForwardedAtDate(new Date().toISOString().slice(0, 10));
      setSelectedFile(null);
      setNotes(payment.notes ?? '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, payment]);

  if (!isOpen || !payment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let forwardedAtIso: string;
      try {
        forwardedAtIso = forwardedAtDate.includes('T')
          ? new Date(forwardedAtDate).toISOString()
          : new Date(`${forwardedAtDate}T12:00:00.000Z`).toISOString();
      } catch {
        forwardedAtIso = new Date().toISOString();
      }

      let forwardedReceiptId: string | undefined = undefined;
      const client = api ?? adminApi;

      if (selectedFile && client.createContractDocument && payment.contractId) {
        try {
          const docRes = await client.createContractDocument(payment.contractId, {
            category: 'forwarding_receipt',
            filename: selectedFile.name,
            storageKey: `receipts/${payment.contractId}/${selectedFile.name}`,
            mimeType: selectedFile.type || 'application/octet-stream',
            byteSize: selectedFile.size,
            description: `Comprovante de repasse - ${payment.referenceMonth}`,
          });
          forwardedReceiptId = docRes.document.id;
        } catch {
          // If document upload fails, continue with forwarding registration
        }
      }

      const res = await client.recordForwarding(payment.id, {
        forwardedAt: forwardedAtIso,
        forwardedReceiptId,
        notes: notes.trim() || undefined,
      });

      onSuccess(res.payment);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Falha ao registrar repasse. Tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forwarding-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              className="brand-mark"
              style={{
                width: '32px',
                height: '32px',
                fontSize: '14px',
                background: '#1d4ed8',
              }}
            >
              <ArrowUpRight style={{ width: '18px', height: '18px' }} aria-hidden="true" />
            </div>
            <div>
              <h2 id="forwarding-modal-title" style={{ margin: 0, fontSize: '18px' }}>
                Dar baixa em repasse
              </h2>
              <small style={{ color: 'var(--admin-text-muted)' }}>
                {contractNumber ? `Contrato ${contractNumber} · ` : ''}
                {paymentCategoryLabel[payment.category] || payment.category} (Mês {payment.referenceMonth})
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

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--admin-radius-sm)',
              background: 'var(--admin-surface-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Valor a Repassar</span>
              <div style={{ fontSize: '18px', fontWeight: 800 }}>{formatCurrency(payment.amount)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Pago pelo Inquilino em</span>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {payment.paidAt ? payment.paidAt.slice(0, 10) : '—'}
              </div>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="forwardedAt">Data do Repasse *</label>
            <input
              id="forwardedAt"
              type="date"
              name="forwardedAt"
              required
              value={forwardedAtDate}
              onChange={(e) => setForwardedAtDate(e.target.value)}
              onInput={(e) => setForwardedAtDate((e.target as HTMLInputElement).value)}
            />
            <span className="field-hint">Data em que o valor foi transferido ao proprietário/locador.</span>
          </div>

          <div className="field-group">
            <label htmlFor="forwardingReceipt">Comprovante de Transferência / TED (opcional)</label>
            <input
              id="forwardingReceipt"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
              }}
            />
            {selectedFile && (
              <span style={{ fontSize: '12px', color: 'var(--admin-info)' }}>
                Arquivo selecionado: {selectedFile.name}
              </span>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="forwardingNotes">Observações</label>
            <textarea
              id="forwardingNotes"
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
              placeholder="Ex.: TED confirmada para conta corrente do locador..."
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={isSubmitting}
            >
              <Check style={{ width: '16px', height: '16px' }} aria-hidden="true" />
              {isSubmitting ? 'Registrando...' : 'Confirmar Repasse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
