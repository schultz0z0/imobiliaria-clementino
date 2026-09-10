import type { WebsiteProperty } from '../types/property';
import { siteConfig } from './siteConfig';
import { toAbsoluteSiteUrl } from './pageMetadata';

export interface BusinessStructuredData {
  '@context': 'https://schema.org';
  '@type': 'RealEstateAgent';
  '@id': string;
  name: string;
  legalName: string;
  url: string;
  telephone: string;
  email: string;
  taxID: string;
  address: {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  areaServed: {
    '@type': 'City';
    name: string;
  };
  identifier: {
    '@type': 'PropertyValue';
    propertyID: string;
    value: string;
  };
}

export interface WebsiteStructuredData {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  '@id': string;
  name: string;
  url: string;
  description: string;
  publisher: {
    '@id': string;
  };
  potentialAction: {
    '@type': 'SearchAction';
    target: {
      '@type': 'EntryPoint';
      urlTemplate: string;
    };
    'query-input': string;
  };
}

export interface PropertyOffer {
  '@type': 'Offer';
  price: number;
  priceCurrency: 'BRL';
  availability: 'https://schema.org/InStock';
  businessFunction: string;
  url: string;
  seller: {
    '@id': string;
  };
}

export interface PropertyStructuredData {
  '@context': 'https://schema.org';
  '@type': 'Apartment' | 'SingleFamilyResidence' | 'Accommodation';
  '@id': string;
  name: string;
  description: string;
  url: string;
  image: string[];
  address: {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
    addressCountry: string;
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  numberOfRooms?: number;
  numberOfBedrooms?: number;
  numberOfBathroomsTotal?: number;
  floorSize?: {
    '@type': 'QuantitativeValue';
    value: number;
    unitCode: 'MTK';
  };
  offers: PropertyOffer[];
}

export const getBusinessStructuredData = (): BusinessStructuredData => ({
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  '@id': `${siteConfig.url}/#real-estate-agent`,
  name: siteConfig.legal.tradeName,
  legalName: siteConfig.legal.legalName,
  url: siteConfig.url,
  telephone: `+${siteConfig.whatsapp.e164}`,
  email: siteConfig.legal.email,
  taxID: siteConfig.legal.cnpj,
  address: {
    '@type': 'PostalAddress',
    streetAddress: siteConfig.legal.addressParts.streetAddress,
    addressLocality: siteConfig.legal.addressParts.city,
    addressRegion: siteConfig.legal.addressParts.state,
    postalCode: siteConfig.legal.addressParts.postalCode,
    addressCountry: siteConfig.legal.addressParts.country,
  },
  areaServed: {
    '@type': 'City',
    name: 'Rio de Janeiro',
  },
  identifier: {
    '@type': 'PropertyValue',
    propertyID: 'CRECI-RJ',
    value: '22953',
  },
});

export const getWebsiteStructuredData = (): WebsiteStructuredData => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${siteConfig.url}/#website`,
  name: siteConfig.name,
  url: siteConfig.url,
  description: 'Imobiliária no Rio de Janeiro especializada em compra, venda e locação de imóveis.',
  publisher: {
    '@id': `${siteConfig.url}/#real-estate-agent`,
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteConfig.url}/imoveis?busca={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
});

const resolvePropertySchemaType = (propertyType: string): 'Apartment' | 'SingleFamilyResidence' | 'Accommodation' => {
  const norm = propertyType.toLowerCase();
  if (norm.includes('apartamento') || norm.includes('studio') || norm.includes('kitnet') || norm.includes('loft')) {
    return 'Apartment';
  }
  if (norm.includes('casa') || norm.includes('cobertura') || norm.includes('sobrado') || norm.includes('mansão')) {
    return 'SingleFamilyResidence';
  }
  return 'Accommodation';
};

export const getPropertyStructuredData = (property: WebsiteProperty): PropertyStructuredData => {
  const propertyUrl = toAbsoluteSiteUrl(`/imoveis/${property.slug}`);
  const images = (property.images && property.images.length > 0 ? property.images : [property.image])
    .filter(Boolean)
    .map((img) => toAbsoluteSiteUrl(img));

  const offers: PropertyOffer[] = (
    property.prices && property.prices.length > 0
      ? property.prices
      : [{ type: property.type as 'Venda' | 'Aluguel', price: property.price, priceValue: property.priceValue }]
  )
    .filter((op) => op.priceValue > 0)
    .map((op) => ({
      '@type': 'Offer' as const,
      price: op.priceValue,
      priceCurrency: 'BRL' as const,
      availability: 'https://schema.org/InStock' as const,
      businessFunction: op.type === 'Aluguel'
        ? 'http://purl.org/goodrelations/v1#LeaseOut'
        : 'http://purl.org/goodrelations/v1#Sell',
      url: propertyUrl,
      seller: {
        '@id': `${siteConfig.url}/#real-estate-agent`,
      },
    }));

  const data: PropertyStructuredData = {
    '@context': 'https://schema.org',
    '@type': resolvePropertySchemaType(property.propertyType),
    '@id': `${propertyUrl}#property`,
    name: property.title,
    description: property.desc,
    url: propertyUrl,
    image: images,
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address || property.location || siteConfig.legal.addressParts.streetAddress,
      addressLocality: property.district || siteConfig.legal.addressParts.district,
      addressRegion: property.state || siteConfig.legal.addressParts.state,
      addressCountry: 'BR',
    },
    offers,
  };

  if (property.beds > 0) {
    data.numberOfRooms = property.beds;
    data.numberOfBedrooms = property.beds;
  }
  if (property.baths > 0) {
    data.numberOfBathroomsTotal = property.baths;
  }
  if (property.areaValue > 0) {
    data.floorSize = {
      '@type': 'QuantitativeValue',
      value: property.areaValue,
      unitCode: 'MTK',
    };
  }
  if (typeof property.latitude === 'number' && typeof property.longitude === 'number') {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: property.latitude,
      longitude: property.longitude,
    };
  }

  return data;
};

export const serializeStructuredData = (data: object): string => JSON.stringify(data)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026');

