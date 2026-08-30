import React from 'react';

export type ReviewCheck = { id: string; label: string; points: number; passed: boolean; recommendation?: string };

export const QualityChecklist = ({ checks, score, recommendations = [] }: { checks: ReviewCheck[]; score: number; recommendations?: string[] }) => (
  <section className="quality-checklist" aria-labelledby="quality-checklist-title">
    <div className="quality-heading"><div><h3 id="quality-checklist-title">Qualidade do anúncio</h3><p className="field-hint">Pontuação editorial: {score}/100. Recomendações não impedem salvar o rascunho.</p></div><strong aria-label={`Pontuação ${score} de 100`}>{score}%</strong></div>
    <ul>{checks.map((check) => <li key={check.id} className={check.passed ? 'quality-pass' : 'quality-pending'}><span aria-hidden="true">{check.passed ? '✓' : '○'}</span><span><strong>{check.label}</strong>{!check.passed && check.recommendation ? <small>{check.recommendation}</small> : null}</span><em>{check.points} pts</em></li>)}</ul>
    {recommendations.length ? <p className="field-hint">Prioridade: {recommendations[0]}</p> : null}
  </section>
);

