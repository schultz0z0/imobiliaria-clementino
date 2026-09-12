import { AlertCircle, FileText, Upload, X } from 'lucide-react';
import React, { useState } from 'react';

import { adminApi, type RentalAdminApi } from '../../api/client.ts';
import { DOCUMENT_CATEGORIES, type ContractDocumentDto, type DocumentCategory } from '../../../../shared/rentalSchema.ts';

const documentCategoryLabel: Record<DocumentCategory, string> = {
  contract_pdf: 'Contrato Assinado (PDF)',
  inspection_report: 'Laudo de Vistoria',
  amendment: 'Termo Aditivo',
  payment_receipt: 'Comprovante de Pagamento',
  forwarding_receipt: 'Comprovante de Repasse',
  other: 'Outro Documento',
};

export interface DocumentUploadModalProps {
  isOpen: boolean;
  contractId: string;
  contractNumber?: string;
  onClose: () => void;
  onSuccess: (document: ContractDocumentDto) => void;
  api?: Pick<RentalAdminApi, 'uploadContractDocument'>;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  contractId,
  contractNumber,
  onClose,
  onSuccess,
  api,
}) => {
  const [category, setCategory] = useState<DocumentCategory>('contract_pdf');
  const [description, setDescription] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedFile) {
      setError('Selecione um arquivo para upload.');
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('O arquivo não pode exceder 25 MB.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const client = api ?? adminApi;
      const res = await client.uploadContractDocument(contractId, selectedFile, {
        category,
        description: description.trim() || undefined,
      });

      onSuccess(res.document);
      setSelectedFile(null);
      setDescription('');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar documento. Tente novamente.';
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
      aria-labelledby="upload-doc-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="modal-card"
        style={{
          backgroundColor: 'var(--admin-surface)',
          borderRadius: 'var(--admin-radius-md)',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--admin-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText style={{ width: '20px', height: '20px', color: 'var(--admin-primary)' }} aria-hidden="true" />
            <h3 id="upload-doc-modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
              Anexar Documento ao Contrato
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="button button-ghost"
            style={{ padding: '6px' }}
          >
            <X style={{ width: '18px', height: '18px' }} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {contractNumber ? (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--admin-text-muted)',
                background: 'var(--admin-surface-muted)',
                padding: '8px 12px',
                borderRadius: 'var(--admin-radius-sm)',
              }}
            >
              Contrato: <strong>{contractNumber}</strong>
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: 'var(--admin-radius-sm)',
                color: 'var(--admin-danger)',
                fontSize: '13px',
              }}
              role="alert"
            >
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Categoria */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Tipo / Categoria do Documento *</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="input-field"
              required
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {documentCategoryLabel[cat] || cat}
                </option>
              ))}
            </select>
          </label>

          {/* Descrição */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Descrição / Observação (Opcional)</span>
            <input
              type="text"
              placeholder="Ex.: Contrato com firma reconhecida no 2º Ofício"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              maxLength={200}
            />
          </label>

          {/* Seleção do Arquivo */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Arquivo (PDF ou Imagem) *</span>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              required
              className="input-field"
              style={{ padding: '8px' }}
            />
            {selectedFile ? (
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              </span>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                Tamanho máximo permitido: 25 MB.
              </span>
            )}
          </label>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--admin-border)',
            }}
          >
            <button type="button" onClick={onClose} className="button button-secondary" disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="button button-primary" disabled={isSubmitting || !selectedFile}>
              <Upload style={{ width: '14px', height: '14px' }} aria-hidden="true" />
              <span>{isSubmitting ? 'Enviando documento...' : 'Enviar Documento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
