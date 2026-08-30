import { ArrowLeft, ArrowRight, Check, CircleAlert, Cloud, CloudOff, LoaderCircle } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PropertyEditorProvider, usePropertyEditor } from '../editor/PropertyEditorProvider.tsx';
import { ClassificationStep } from '../editor/steps/ClassificationStep.tsx';
import { EditorialPricingStep } from '../editor/steps/EditorialPricingStep.tsx';
import { FactsStep } from '../editor/steps/FactsStep.tsx';
import { FeaturesStep } from '../editor/steps/FeaturesStep.tsx';
import { LocationStep } from '../editor/steps/LocationStep.tsx';
import { PhotosStep } from '../editor/steps/PhotosStep.tsx';
import { ReviewSeoStep } from '../editor/steps/ReviewSeoStep.tsx';
import type { WizardValues } from '../editor/types.ts';
import { validateWizardStep } from '../editor/validation.ts';

const STEPS = [
  { title: 'ClassificaÃ§Ã£o', component: ClassificationStep }, { title: 'LocalizaÃ§Ã£o', component: LocationStep },
  { title: 'Fotos', component: PhotosStep }, { title: 'Dados principais', component: FactsStep },
  { title: 'CaracterÃ­sticas', component: FeaturesStep }, { title: 'DescriÃ§Ã£o e valores', component: EditorialPricingStep },
  { title: 'SEO e revisÃ£o', component: ReviewSeoStep },
] as const;

const SaveIndicator = () => {
  const { autosave, retrySave } = usePropertyEditor();
  const labels = { idle: 'Rascunho local', pending: 'AlteraÃ§Ãµes pendentes', saving: 'Salvandoâ€¦', saved: 'Rascunho salvo', error: 'Falha ao salvar', conflict: 'Conflito de ediÃ§Ã£o' };
  const Icon = autosave.status === 'saving' ? LoaderCircle : autosave.status === 'saved' ? Check : autosave.status === 'error' || autosave.status === 'conflict' ? CloudOff : Cloud;
  return <div className={`save-indicator save-${autosave.status}`} role="status" aria-live="polite"><Icon className={autosave.status === 'saving' ? 'spin' : ''} aria-hidden="true" /><span>{labels[autosave.status]}</span>{autosave.status === 'error' || autosave.status === 'conflict' ? <button type="button" onClick={() => void retrySave()}>Tentar novamente</button> : null}</div>;
};

const EditorContents = () => {
  const { formState, getValues, setError, setFocus } = useFormContext<WizardValues>();
  const { loading, loadError, flushSave, property } = usePropertyEditor();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const requested = Number(search.get('etapa') ?? 1);
  const step = Number.isInteger(requested) && requested >= 1 && requested <= 7 ? requested : 1;
  const [stepMessage, setStepMessage] = useState<string>();
  const Step = STEPS[step - 1]!.component;
  const go = async (next: number) => {
    if (next > step) {
      const result = validateWizardStep(step, getValues());
      if (!result.success) {
        const first = result.issues[0];
        for (const issue of result.issues) {
          setError(issue.path.join('.') as never, { type: 'local', message: issue.message });
        }
        if (first) setFocus(first.path.join('.') as never);
        setStepMessage('Revise os campos destacados antes de continuar.');
        return;
      }
    }
    try {
      await flushSave();
    } catch (error) {
      setStepMessage(error instanceof Error ? error.message : 'Não foi possível salvar o rascunho. Tente novamente.');
      return;
    }
    setStepMessage(undefined);
    setSearch({ etapa: String(next) });
    document.querySelector<HTMLElement>('#wizard-step-title')?.focus();
  };
  const conclude = async () => {
    const result = validateWizardStep(7, getValues());
    if (!result.success) {
      for (const issue of result.issues) setError(issue.path.join('.') as never, { type: 'local', message: issue.message });
      const first = result.issues[0];
      if (first) setFocus(first.path.join('.') as never);
      setStepMessage('Revise os campos destacados antes de concluir o rascunho.');
      return;
    }
    try {
      await flushSave();
      navigate('/imoveis');
    } catch (error) {
      setStepMessage(error instanceof Error ? error.message : 'Não foi possível salvar o rascunho. Tente novamente.');
    }
  };
  if (loading) return <div className="panel-state" role="status"><LoaderCircle className="spin" />Carregando imÃ³velâ€¦</div>;
  if (loadError) return <div className="panel-state panel-state-error" role="alert"><CircleAlert /><h2>NÃ£o foi possÃ­vel abrir o imÃ³vel</h2><p>{loadError}</p><Link to="/imoveis" className="button button-secondary">Voltar</Link></div>;
  return <section className="property-editor" aria-labelledby="wizard-step-title">
    <header className="editor-heading"><div><p className="eyebrow">{property ? `Rascunho ${property.publicId}` : 'Novo imÃ³vel'}</p><h1>Cadastro de imÃ³vel</h1></div><SaveIndicator /></header>
    <nav className="wizard-progress" aria-label="Etapas do cadastro"><ol>{STEPS.map(({ title }, index) => <li key={title} aria-current={step === index + 1 ? 'step' : undefined}><button type="button" onClick={() => void go(index + 1)}><span>{index + 1}</span><small>{title}</small></button></li>)}</ol></nav>
    <div className="editor-card"><div className="step-heading"><span>Etapa {step} de 7</span><h2 id="wizard-step-title" tabIndex={-1}>{STEPS[step - 1]!.title}</h2></div>
      {stepMessage ? <p className="form-alert" role="alert">{stepMessage}</p> : null}
      {Object.keys(formState.errors).length ? <p className="field-hint">Os campos com erro precisam ser revisados.</p> : null}
      <Step />
      <footer className="wizard-actions"><button type="button" className="button button-secondary" disabled={step === 1} onClick={() => void go(step - 1)}><ArrowLeft />Anterior</button>{step < 7 ? <button type="button" className="button button-primary" onClick={() => void go(step + 1)}>Continuar<ArrowRight /></button> : <button type="button" className="button button-primary" onClick={() => void conclude()}>Concluir rascunho<Check /></button>}</footer>
    </div>
  </section>;
};

export const PropertyEditor = ({ mode }: { mode: 'create'|'edit' }) => {
  const { id } = useParams<{ id: string }>();
  return <PropertyEditorProvider mode={mode} propertyId={id}><EditorContents /></PropertyEditorProvider>;
};
