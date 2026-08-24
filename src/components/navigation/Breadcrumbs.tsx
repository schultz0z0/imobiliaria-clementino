import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toAbsoluteSiteUrl } from '../../config/pageMetadata';
import { serializeStructuredData } from '../../config/structuredData';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export const getBreadcrumbStructuredData = (items: BreadcrumbItem[], currentPath: string) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: toAbsoluteSiteUrl(item.path ?? currentPath),
  })),
});

export const Breadcrumbs = ({ items }: { items: BreadcrumbItem[] }) => {
  const location = useLocation();
  const structuredData = getBreadcrumbStructuredData(items, location.pathname);

  return (
    <>
      <nav aria-label="Migalhas de navegação" className="mb-6 overflow-x-auto hide-scrollbar">
        <ol className="flex min-w-max items-center gap-1.5 text-xs text-white/45">
          {items.map((item, index) => {
            const isCurrent = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-white/25" aria-hidden="true" /> : null}
                {item.path && !isCurrent ? (
                  <Link to={item.path} className="min-h-11 content-center transition-colors hover:text-[#d7b661]">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isCurrent ? 'page' : undefined} className={isCurrent ? 'text-white/70' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
    </>
  );
};
