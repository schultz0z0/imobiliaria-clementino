import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { adminApi, ApiError, type MediaPhotoDto, type PropertyAdminDto, type PropertyEditorApi } from '../api/client.ts';
import { createAutosaveController, type AutosaveController, type AutosaveState } from './autosave.ts';
import { EMPTY_WIZARD_VALUES, mergeWizardValues, patchForPath, type WizardValues } from './types.ts';

type EditorContextValue = {
  form: UseFormReturn<WizardValues>;
  api: PropertyEditorApi;
  property?: PropertyAdminDto;
  propertyId?: string;
  publicId?: string;
  revision: number;
  loading: boolean;
  loadError?: string;
  autosave: AutosaveState;
  retrySave: () => Promise<void>;
  flushSave: () => Promise<void>;
  photos: Record<string, MediaPhotoDto>;
  uploadPhotos: (files: File[]) => Promise<void>;
  reorderPhotos: (orderedIds: string[], coverId: string) => Promise<void>;
  editPhotoAlt: (photoId: string, altText: string) => Promise<void>;
  removePhoto: (photoId: string) => Promise<void>;
  mediaBusy: boolean;
  mediaError?: string;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export const usePropertyEditor = () => {
  const value = useContext(EditorContext);
  if (!value) throw new Error('usePropertyEditor must be used inside PropertyEditorProvider');
  return value;
};

const setServerIssues = (form: UseFormReturn<WizardValues>, error: unknown) => {
  if (!(error instanceof ApiError)) return;
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (path) form.setError(path as never, { type: 'server', message: issue.message });
  }
};

export const PropertyEditorProvider = ({
  mode,
  propertyId: initialPropertyId,
  api = adminApi,
  children,
}: {
  mode: 'create'|'edit';
  propertyId?: string;
  api?: PropertyEditorApi;
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const form = useForm<WizardValues>({ defaultValues: EMPTY_WIZARD_VALUES, mode: 'onBlur' });
  const [property, setProperty] = useState<PropertyAdminDto>();
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string>();
  const [autosave, setAutosave] = useState<AutosaveState>({ status: 'idle', revision: 1 });
  const [photos, setPhotos] = useState<Record<string, MediaPhotoDto>>({});
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string>();
  const idRef = useRef(initialPropertyId);
  const revisionRef = useRef(1);
  const creatingRef = useRef<Promise<void>>();
  const pendingCreateRef = useRef<WizardValues>({});
  const mediaQueueRef = useRef<Promise<void>>(Promise.resolve());
  const suppressWatch = useRef(false);
  const propertyRef = useRef<PropertyAdminDto>();

  const acceptProperty = useCallback((next: PropertyAdminDto) => {
    idRef.current = next.id;
    revisionRef.current = next.revisionNumber;
    propertyRef.current = next;
    setProperty(next);
  }, []);

  const controllerRef = useRef<AutosaveController>();
  if (!controllerRef.current) {
    controllerRef.current = createAutosaveController({
      initialRevision: 1,
      save: async (patch, revision, signal) => {
        const id = idRef.current;
        if (!id) throw new Error('O rascunho ainda não foi criado.');
        try {
          const result = await api.patchProperty(id, revision, patch, signal);
          acceptProperty(result.property);
          revisionRef.current = result.property.revisionNumber;
          return { revisionNumber: result.property.revisionNumber };
        } catch (error) {
          setServerIssues(form, error);
          throw error;
        }
      },
      onStateChange: setAutosave,
    });
  }
  const controller = controllerRef.current;

  useEffect(() => {
    if (mode !== 'edit' || !initialPropertyId) { setLoading(false); return; }
    const abort = new AbortController();
    setLoading(true);
    api.getProperty(initialPropertyId, abort.signal).then(({ property: loaded }) => {
      acceptProperty(loaded);
      controller.setRevision(loaded.revisionNumber);
      suppressWatch.current = true;
      form.reset(mergeWizardValues(EMPTY_WIZARD_VALUES, loaded.draft as WizardValues));
      queueMicrotask(() => { suppressWatch.current = false; });
      setLoadError(undefined);
      if (api.listPhotos) {
        void api.listPhotos(initialPropertyId, abort.signal).then(({ photos: loadedPhotos }) => {
          if (abort.signal.aborted) return;
          setPhotos(Object.fromEntries(loadedPhotos.map((photo) => [photo.id, photo])));
        }).catch(() => { /* metadata is optional; editor remains usable with placeholders */ });
      }
    }).catch((error) => {
      if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o imóvel.');
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [acceptProperty, api, controller, form, initialPropertyId, mode]);

  const createFromIntent = useCallback((patch: WizardValues) => {
    pendingCreateRef.current = mergeWizardValues(pendingCreateRef.current, patch);
    if (creatingRef.current) return creatingRef.current;
    const defaults = form.getValues();
    const initialPatch = mergeWizardValues({
      classification: { type: defaults.classification?.type, subtype: defaults.classification?.subtype },
      facts: defaults.facts,
      features: defaults.features,
      media: defaults.media,
    }, pendingCreateRef.current);
    pendingCreateRef.current = {};
    setAutosave({ status: 'saving', revision: 1 });
    const creation = api.createProperty(initialPatch).then(({ property: created }) => {
      acceptProperty(created);
      controller.setRevision(created.revisionNumber);
      setAutosave({ status: 'saved', revision: created.revisionNumber, savedAt: new Date() });
      navigate(`/imoveis/${created.id}/editar`, { replace: true });
      const remaining = pendingCreateRef.current;
      pendingCreateRef.current = {};
      if (Object.keys(remaining).length) controller.queue(remaining);
    }).catch((error) => {
      setServerIssues(form, error);
      setAutosave({ status: 'error', revision: 1, error: error instanceof Error ? error : new Error('Falha ao criar o rascunho.') });
      pendingCreateRef.current = mergeWizardValues(initialPatch, pendingCreateRef.current);
      throw error;
    }).finally(() => {
      if (creatingRef.current === creation) creatingRef.current = undefined;
    });
    creatingRef.current = creation;
    return creation;
  }, [acceptProperty, api, controller, form, navigate]);

  useEffect(() => {
    const subscription = form.watch((values, info) => {
      if (suppressWatch.current || !info.name) return;
      const patch = patchForPath(values as WizardValues, info.name);
      if (!Object.keys(patch).length) return;
      if (!idRef.current) void createFromIntent(patch).catch(() => undefined);
      else controller.queue(patch);
    });
    return () => subscription.unsubscribe();
  }, [controller, createFromIntent, form]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (controller.hasUnsavedChanges() || autosave.status === 'error' || autosave.status === 'conflict' || creatingRef.current) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [autosave.status, controller]);

  useEffect(() => {
    // React StrictMode mounts, cleans up and mounts effects once in
    // development. Re-activate the stable controller on the second mount so
    // that the cleanup probe does not permanently disable autosave.
    controller.resume();
    return () => controller.dispose();
  }, [controller]);

  const flushPersisted = useCallback(async () => {
    if (!idRef.current) {
      await (creatingRef.current ?? createFromIntent({}));
    }
    if (!idRef.current) throw new Error('Não foi possível criar o rascunho.');
    await controller.flush();
    let current = controller.getState();
    if (current.status === 'error') {
      await controller.retry();
      current = controller.getState();
    }
    if (current.status === 'error' || current.status === 'conflict') {
      throw current.error ?? new Error('Não foi possível salvar o rascunho.');
    }
  }, [controller, createFromIntent]);

  const runMediaMutation = useCallback((action: (id: string, revision: number) => Promise<{ property: PropertyAdminDto; photo?: MediaPhotoDto }>) => {
    const task = mediaQueueRef.current.then(async () => {
      if (!idRef.current) throw new Error('Preencha um campo para criar o rascunho antes de adicionar fotos.');
      await flushPersisted();
      const propertyId = idRef.current;
      setMediaBusy(true); setMediaError(undefined);
      try {
        const result = await action(propertyId, revisionRef.current);
        acceptProperty(result.property); controller.setRevision(result.property.revisionNumber);
        suppressWatch.current = true;
        form.setValue('media', mergeWizardValues({ media: form.getValues('media') }, { media: result.property.draft.media as WizardValues['media'] }).media, { shouldDirty: false });
        queueMicrotask(() => { suppressWatch.current = false; });
        if (result.photo) setPhotos((current) => ({ ...current, [result.photo!.id]: result.photo! }));
        else if (api.listPhotos) {
          const listed = await api.listPhotos(propertyId);
          setPhotos(Object.fromEntries(listed.photos.map((photo) => [photo.id, photo])));
        }
      } catch (error) {
        setServerIssues(form, error);
        setMediaError(error instanceof Error ? error.message : 'Não foi possível alterar as fotos.');
        throw error;
      } finally { setMediaBusy(false); }
    });
    mediaQueueRef.current = task.catch(() => undefined);
    return task;
  }, [acceptProperty, api, controller, flushPersisted, form]);

  const context = useMemo<EditorContextValue>(() => ({
    form, api, property, propertyId: property?.id ?? initialPropertyId, publicId: property?.publicId,
    revision: property?.revisionNumber ?? revisionRef.current, loading, loadError, autosave,
    retrySave: () => idRef.current ? controller.retry() : Promise.resolve(createFromIntent({})),
    flushSave: flushPersisted,
    photos, mediaBusy, mediaError,
    uploadPhotos: async (files) => {
      for (const file of files) {
        await runMediaMutation((id, revision) => api.uploadPhoto(id, revision, file, file.name.replace(/\.[^.]+$/, '').slice(0, 175) || 'Foto do imóvel'));
      }
    },
    reorderPhotos: (ids, cover) => runMediaMutation((id, revision) => api.reorderPhotos(id, revision, ids, cover)),
    editPhotoAlt: (photoId, alt) => runMediaMutation((id, revision) => api.editPhoto(id, photoId, revision, alt)),
    removePhoto: (photoId) => runMediaMutation((id, revision) => api.deletePhoto(id, photoId, revision)),
  }), [api, autosave, controller, createFromIntent, flushPersisted, form, initialPropertyId, loadError, loading, mediaBusy, mediaError, photos, property, runMediaMutation]);

  return <EditorContext.Provider value={context}><FormProvider {...form}>{children}</FormProvider></EditorContext.Provider>;
};
