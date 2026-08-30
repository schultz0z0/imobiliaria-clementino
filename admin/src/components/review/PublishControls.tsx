import { CheckCircle2, Rocket } from 'lucide-react';
import React, { useState } from 'react';

export const PublishControls = ({ disabled = false, publishable, onPublish }: { disabled?: boolean; publishable: boolean; onPublish?: () => Promise<void> }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const publish = async () => {
    if (!onPublish || !publishable || busy) return;
    if (!window.confirm('Solicitar publicação deste imóvel?')) return;
    setBusy(true); setMessage(undefined);
    try { await onPublish(); setMessage('Publicação solicitada. O imóvel será disponibilizado após a fila de publicação.'); }
    catch { setMessage('Não foi possível solicitar a publicação. Revise os dados e tente novamente.'); }
    finally { setBusy(false); }
  };
  return <section className="publish-controls" aria-labelledby="publish-controls-title"><h3 id="publish-controls-title">Publicação</h3><p>{publishable ? 'Todos os requisitos obrigatórios foram atendidos.' : 'Há pendências obrigatórias. Corrija-as antes de publicar.'}</p>{onPublish ? <button className="button button-primary" type="button" disabled={disabled || !publishable || busy} onClick={() => void publish()}><Rocket aria-hidden="true" />{busy ? 'Solicitando…' : 'Solicitar publicação'}</button> : <span className="quality-ok"><CheckCircle2 aria-hidden="true" /> Publicação disponível na listagem</span>}{message ? <p className="field-hint" role="status">{message}</p> : null}</section>;
};

