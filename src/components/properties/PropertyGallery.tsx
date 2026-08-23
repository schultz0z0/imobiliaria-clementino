import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { useEffect, useState } from 'react';

export const PropertyGallery = ({ images, title }: { images: string[]; title: string }) => {
  const [index, setIndex] = useState(0);
  const safeImages = images.length > 0 ? images : [];
  useEffect(() => {
    setIndex(0);
  }, [images]);
  if (safeImages.length === 0) return null;

  const select = (next: number) => setIndex((next + safeImages.length) % safeImages.length);
  const start = Math.max(0, Math.min(index - 2, safeImages.length - 6));
  const thumbnails = safeImages.slice(start, start + 6);

  return (
    <div>
      <div className="group relative overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/5">
        <img key={safeImages[index]} src={safeImages[index]} alt={`${title} — foto ${index + 1}`} className="aspect-[16/10] w-full object-cover" onError={(event) => { if (event.currentTarget.src !== new URL(safeImages[0], window.location.origin).toString()) event.currentTarget.src = safeImages[0]; }} />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
        <div className="absolute right-5 top-5 flex items-center gap-2 rounded-[var(--radius-compact)] border border-white/10 bg-black/55 px-4 py-2 text-xs font-medium text-white backdrop-blur-md"><Images className="h-4 w-4 text-[#d7b661]" />{index + 1} de {safeImages.length}</div>
        {safeImages.length > 1 && <><button type="button" onClick={() => select(index - 1)} aria-label="Foto anterior" className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] border border-white/15 bg-black/45 text-white backdrop-blur-md hover:bg-[#d7b661] hover:text-[#18181b]"><ChevronLeft /></button><button type="button" onClick={() => select(index + 1)} aria-label="Próxima foto" className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] border border-white/15 bg-black/45 text-white backdrop-blur-md hover:bg-[#d7b661] hover:text-[#18181b]"><ChevronRight /></button></>}
      </div>
      {safeImages.length > 1 && <div className="mt-3 grid grid-cols-6 gap-2">{thumbnails.map((image, thumbnailIndex) => { const actualIndex = start + thumbnailIndex; return <button type="button" key={`${image}-${actualIndex}`} onClick={() => setIndex(actualIndex)} aria-label={`Ver foto ${actualIndex + 1}`} aria-current={actualIndex === index} className={`overflow-hidden rounded-[var(--radius-control)] border ${actualIndex === index ? 'border-[#d7b661]' : 'border-white/10 opacity-55 hover:opacity-100'}`}><img src={image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" /></button>; })}</div>}
    </div>
  );
};
