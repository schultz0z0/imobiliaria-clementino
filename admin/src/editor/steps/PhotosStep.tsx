import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { usePropertyEditor } from '../PropertyEditorProvider.tsx';
import { reorderPhotoIds, validatePhotoFiles } from '../media.ts';
import type { WizardValues } from '../types.ts';

export const PhotosStep = () => {
  const { watch } = useFormContext<WizardValues>();
  const { uploadPhotos, reorderPhotos, editPhotoAlt, removePhoto, photos, mediaBusy, mediaError } = usePropertyEditor();
  const ids = watch('media.orderedPhotoIds') ?? [];
  const cover = watch('media.coverPhotoId');
  const altMap = watch('media.altTextByPhotoId') ?? {};
  const [validationError, setValidationError] = useState<string>();
  const dragged = useRef<string>();
  const choose = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const issue = validatePhotoFiles(files);
    if (issue) { setValidationError(issue); return; }
    setValidationError(undefined); await uploadPhotos(files);
  };
  const move = async (photoId: string, delta: number) => {
    const from = ids.indexOf(photoId); const to = Math.max(0, Math.min(ids.length - 1, from + delta));
    if (from === to) return;
    const next = [...ids]; next.splice(from, 1); next.splice(to, 0, photoId);
    await reorderPhotos(next, cover ?? next[0]!);
  };
  const drop = async (target: string) => {
    const source = dragged.current; dragged.current = undefined;
    if (!source || source === target) return;
    const next = reorderPhotoIds(ids, source, target);
    await reorderPhotos(next, cover ?? next[0]!);
  };
  return <section className="wizard-step-stack" aria-labelledby="photos-title">
    <div><h2 id="photos-title">Fotos do imÃ³vel</h2><p className="field-hint">Envie HEIC, TIFF, JPG, PNG ou WebP, atÃ© 20 MB cada. Recomendamos pelo menos 10 fotos.</p></div>
    <label className="photo-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files); }}>
      <ImagePlus aria-hidden="true" /><strong>Adicionar fotos</strong><span>Selecione ou arraste os arquivos</span>
      <input type="file" multiple accept=".heic,.heif,.tif,.tiff,.jpg,.jpeg,.png,.webp" onChange={(event) => event.currentTarget.files && void choose(event.currentTarget.files)} />
    </label>
    {validationError || mediaError ? <p className="form-alert" role="alert">{validationError ?? mediaError}</p> : null}
    <p aria-live="polite" className="field-hint">{mediaBusy ? 'Processando fotosâ€¦' : `${ids.length} foto(s) adicionada(s).`}</p>
    <ol className="photo-list">
      {ids.map((id, index) => <li key={id} draggable onDragStart={() => { dragged.current = id; }} onDragOver={(event) => event.preventDefault()} onDrop={() => void drop(id)}>
        <div className="photo-placeholder" aria-hidden="true">{index + 1}</div>
        <div className="photo-fields"><strong>{cover === id ? 'Foto de capa' : `Foto ${index + 1}`}</strong><label>Texto alternativo<input defaultValue={photos[id]?.altText ?? altMap[id] ?? ''} minLength={5} maxLength={180} onBlur={(event) => { if (event.currentTarget.value.trim().length >= 5) void editPhotoAlt(id, event.currentTarget.value); }} /></label></div>
        <div className="photo-actions">
          <button type="button" disabled={index === 0 || mediaBusy} aria-label={`Mover foto ${index + 1} para cima`} onClick={() => void move(id, -1)}><ArrowUp /></button>
          <button type="button" disabled={index === ids.length - 1 || mediaBusy} aria-label={`Mover foto ${index + 1} para baixo`} onClick={() => void move(id, 1)}><ArrowDown /></button>
          <button type="button" disabled={cover === id || mediaBusy} aria-label={`Definir foto ${index + 1} como capa`} onClick={() => void reorderPhotos(ids, id)}><Star /></button>
          <button type="button" disabled={mediaBusy} aria-label={`Remover foto ${index + 1}`} onClick={() => void removePhoto(id)}><Trash2 /></button>
        </div>
      </li>)}
    </ol>
  </section>;
};
