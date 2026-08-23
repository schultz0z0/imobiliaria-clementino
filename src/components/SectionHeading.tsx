interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
}

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = 'left',
}: SectionHeadingProps) => (
  <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
    {eyebrow && <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">{eyebrow}</p>}
    <h2 className="text-3xl font-semibold leading-tight text-white md:text-5xl">{title}</h2>
    {description && <p className="mt-5 text-base leading-relaxed text-white/60 md:text-lg">{description}</p>}
  </div>
);
