import { ArrowLeft, ClipboardPenLine } from 'lucide-react';
import React from 'react';
import { Link, useParams } from 'react-router-dom';

export const PropertyEditorBootstrap = ({ mode }: { mode: 'create' | 'edit' }) => {
  const { id } = useParams<{ id: string }>();
  const creating = mode === 'create';

  return (
    <section className="page-stack" aria-labelledby="editor-bootstrap-title">
      <div className="page-heading">
        <p className="eyebrow">Catálogo</p>
        <h1 id="editor-bootstrap-title">{creating ? 'Cadastro em preparação' : 'Editor em preparação'}</h1>
        <p>{creating ? 'O fluxo completo de cadastro será disponibilizado na próxima etapa.' : 'O fluxo completo de edição será disponibilizado na próxima etapa.'}</p>
      </div>
      <div className="content-card panel-state">
        <ClipboardPenLine aria-hidden="true" />
        {!creating && id ? <p>Imóvel solicitado: <code>{id}</code></p> : null}
        <p>Nenhum dado foi criado ou alterado nesta tela.</p>
        <Link className="button button-secondary" to="/imoveis"><ArrowLeft aria-hidden="true" />Voltar aos imóveis</Link>
      </div>
    </section>
  );
};
