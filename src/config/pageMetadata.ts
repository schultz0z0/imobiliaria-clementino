import type { WebsiteProperty } from '../types/property';

export interface PageMetadata {
  title: string;
  description: string;
}

export type PublicPage = 'home' | 'properties' | 'property' | 'about' | 'services' | 'contact';

const staticMetadata: Record<Exclude<PublicPage, 'property'>, PageMetadata> = {
  home: {
    title: 'Imobiliária Clementino | Imóveis no Rio de Janeiro',
    description: 'Encontre imóveis reais para comprar ou alugar no Rio de Janeiro e fale diretamente com a Imobiliária Clementino.',
  },
  properties: {
    title: 'Imóveis à venda e para alugar | Clementino',
    description: 'Pesquise os imóveis disponíveis para venda e aluguel por bairro, tipo, preço e número de quartos.',
  },
  about: {
    title: 'Sobre a Imobiliária Clementino',
    description: 'Conheça a atuação da Imobiliária Clementino no Rio de Janeiro desde 2010 e a forma como conduz cada atendimento.',
  },
  services: {
    title: 'Serviços imobiliários | Clementino',
    description: 'Compra, venda, locação, administração, avaliação e legalização de imóveis com a equipe Clementino.',
  },
  contact: {
    title: 'Fale com a Imobiliária Clementino',
    description: 'Fale diretamente com a equipe Clementino pelo WhatsApp sobre imóveis e serviços imobiliários.',
  },
};

export const getPageMetadata = (
  page: PublicPage,
  property?: WebsiteProperty,
): PageMetadata => {
  if (page === 'property' && property) {
    return {
      title: `${property.title} | ${property.reference} | Clementino`,
      description: `${property.propertyType} em ${property.district}, ${property.city}. Consulte detalhes e fale com a Imobiliária Clementino.`,
    };
  }

  return page === 'property'
    ? staticMetadata.properties
    : staticMetadata[page];
};
