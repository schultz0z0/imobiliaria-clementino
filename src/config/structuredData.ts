import { siteConfig } from './siteConfig';

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

export const serializeStructuredData = (data: object): string => JSON.stringify(data)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026');
