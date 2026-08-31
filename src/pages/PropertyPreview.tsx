import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { PropertyDetailsView } from '../components/properties/PropertyDetailsView.tsx';
import type { WebsiteProperty } from '../types/property.ts';
import { PropertyDetails } from './PropertyDetails.tsx';

type PreviewResponse = { property: WebsiteProperty; expiresAt: string };

export const PropertyPreview = () => {
  const { token = '' } = useParams();
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data?: PreviewResponse }>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch(`/api/property-previews?token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error('preview unavailable');
      return response.json() as Promise<PreviewResponse>;
    }).then((data) => setState({ status: 'ready', data }), (error) => {
      if ((error as Error).name !== 'AbortError') setState({ status: 'error' });
    });
    return () => controller.abort();
  }, [token]);

  if (state.status === 'loading') return <div className="relative z-10 flex min-h-screen items-center justify-center pt-24 text-white" role="status">Carregando prévia…</div>;
  if (state.status === 'error' || !state.data) return <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-24 text-center"><div><h1 className="text-3xl font-semibold text-white">Prévia indisponível</h1><p className="mt-4 text-white/55">O link expirou ou o rascunho foi alterado. Gere uma nova prévia no painel.</p><Link className="mt-7 inline-flex min-h-12 items-center rounded-[var(--radius-control)] bg-[#d7b661] px-6 font-semibold text-[#18181b]" to="/imoveis">Ver imóveis publicados</Link></div></div>;
  return <PropertyDetailsView property={state.data.property} related={[]} preview><PropertyDetails /></PropertyDetailsView>;
};

