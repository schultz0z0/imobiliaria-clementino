import type { WebsiteProperty } from '../types/property';
import { siteConfig } from './siteConfig';

export interface PageMetadata {
  title: string;
  description: string;
  path: string;
  canonical: string;
  image: string;
  imageAlt: string;
  openGraphType: 'website';
  robots: 'index, follow' | 'noindex, nofollow';
  property?: WebsiteProperty;
}

export type PublicPage = 'home' | 'properties' | 'property' | 'about' | 'services' | 'contact' | 'privacy' | 'cookies' | 'contactPrepared' | 'notFound';

interface StaticPageMetadata extends Pick<PageMetadata, 'title' | 'description' | 'path'> {
  image?: string;
  imageAlt?: string;
  robots?: PageMetadata['robots'];
}

const defaultSocialImage = '/images/brand/hero-rio-properties-desktop.webp';
const defaultSocialImageAlt = 'Vista do Rio de Janeiro com o Cristo Redentor';

const truncateAtWord = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const shortened = value.slice(0, maxLength - 1);
  const lastSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, lastSpace > maxLength * 0.7 ? lastSpace : undefined).trim()}…`;
};

const buildPropertyDescription = (property: WebsiteProperty): string => {
  const facts = [
    property.areaValue > 0 ? property.area : '',
    property.beds > 0 ? `${property.beds} ${property.beds === 1 ? 'quarto' : 'quartos'}` : '',
    property.baths > 0 ? `${property.baths} ${property.baths === 1 ? 'banheiro' : 'banheiros'}` : '',
    property.parkingSpaces > 0 ? `${property.parkingSpaces} ${property.parkingSpaces === 1 ? 'vaga' : 'vagas'}` : '',
  ].filter(Boolean).join(', ');
  const details = facts ? ` ${facts}.` : '';
  return truncateAtWord(
    `${property.type}: ${property.propertyType} em ${property.district}, ${property.city}.${details} ${property.price}. Veja fotos e fale com a Imobiliária Clementino.`,
    165,
  );
};

export const toAbsoluteSiteUrl = (path: string): string => new URL(path, `${siteConfig.url}/`).toString();

const staticMetadata: Record<Exclude<PublicPage, 'property'>, StaticPageMetadata> = {
  home: {
    title: 'Imobiliária Clementino | Imóveis no Rio de Janeiro',
    description: 'Encontre imóveis reais para comprar ou alugar no Rio de Janeiro e fale diretamente com a Imobiliária Clementino.',
    path: '/',
  },
  properties: {
    title: 'Imóveis à venda e para alugar | Clementino',
    description: 'Pesquise os imóveis disponíveis para venda e aluguel por bairro, tipo, preço e número de quartos.',
    path: '/imoveis',
  },
  about: {
    title: 'Sobre a Imobiliária Clementino',
    description: 'Conheça a atuação da Imobiliária Clementino no Rio de Janeiro desde 2010 e a forma como conduz cada atendimento.',
    path: '/sobre',
  },
  services: {
    title: 'Serviços imobiliários | Clementino',
    description: 'Compra, venda, locação, administração, avaliação e legalização de imóveis com a equipe Clementino.',
    path: '/servicos',
  },
  contact: {
    title: 'Fale com a Imobiliária Clementino',
    description: 'Fale diretamente com a equipe Clementino pelo WhatsApp sobre imóveis e serviços imobiliários.',
    path: '/contato',
  },
  privacy: {
    title: 'Aviso de Privacidade | Imobiliária Clementino',
    description: 'Entenda como a Imobiliária Clementino trata dados pessoais, quais são seus direitos e como entrar em contato sobre privacidade.',
    path: '/aviso-de-privacidade',
  },
  cookies: {
    title: 'Política de Cookies | Imobiliária Clementino',
    description: 'Conheça as tecnologias do site da Imobiliária Clementino e escolha como cookies e recursos opcionais podem ser utilizados.',
    path: '/politica-de-cookies',
  },
  contactPrepared: {
    title: 'Mensagem preparada | Imobiliária Clementino',
    description: 'Sua mensagem foi preparada para o WhatsApp; confira o conteúdo na conversa aberta e toque em enviar para concluir o contato.',
    path: '/contato/mensagem-preparada',
    robots: 'noindex, nofollow',
  },
  notFound: {
    title: 'Página não encontrada | Imobiliária Clementino',
    description: 'A página informada não foi encontrada; retorne ao início ou consulte os imóveis disponíveis da Imobiliária Clementino.',
    path: '/404',
    robots: 'noindex, nofollow',
  },
};

const completeMetadata = (metadata: StaticPageMetadata): PageMetadata => ({
  ...metadata,
  canonical: toAbsoluteSiteUrl(metadata.path),
  image: toAbsoluteSiteUrl(metadata.image ?? defaultSocialImage),
  imageAlt: metadata.imageAlt ?? defaultSocialImageAlt,
  openGraphType: 'website',
  robots: metadata.robots ?? 'index, follow',
});

export const getPageMetadata = (
  page: PublicPage,
  property?: WebsiteProperty,
): PageMetadata => {
  if (page === 'property' && property) {
    return {
      ...completeMetadata({
        title: truncateAtWord(`${property.type} · ${property.propertyType} em ${property.district} | ${property.reference}`, 75),
        description: buildPropertyDescription(property),
        path: `/imoveis/${property.slug}`,
        image: property.image,
        imageAlt: `Foto principal de ${property.title} em ${property.district}`,
      }),
      property,
    };
  }

  return page === 'property'
    ? completeMetadata(staticMetadata.properties)
    : completeMetadata(staticMetadata[page]);
};
