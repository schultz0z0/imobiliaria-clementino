import { siteConfig } from '../config/siteConfig';

interface PropertyInquiry {
  reference: string;
  slug: string;
  title: string;
}

interface VisitInquiry extends PropertyInquiry {
  name: string;
  phone: string;
  email: string;
  date: string;
  period: string;
}

interface GeneralInquiry {
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
}

export const buildWhatsAppUrl = (message: string): string => {
  const url = new URL(`https://wa.me/${siteConfig.whatsapp.e164}`);
  url.searchParams.set('text', message.trim());
  return url.toString();
};

export const buildPropertyInquiry = (property: PropertyInquiry, origin: string): string => {
  const propertyUrl = new URL(`/imoveis/${property.slug}`, origin).toString();
  return buildWhatsAppUrl(
    `Olá! Tenho interesse no imóvel ${property.title} (ref. ${property.reference}). ${propertyUrl}`,
  );
};

const formatBrazilianDate = (date: string): string => {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
};

export const buildVisitInquiry = (inquiry: VisitInquiry, origin: string): string => {
  const propertyUrl = new URL(`/imoveis/${inquiry.slug}`, origin).toString();
  return buildWhatsAppUrl([
    `Olá! Quero agendar uma visita ao imóvel ${inquiry.title} (ref. ${inquiry.reference}).`,
    `Nome: ${inquiry.name}`,
    `Telefone: ${inquiry.phone}`,
    `E-mail: ${inquiry.email}`,
    `Data: ${formatBrazilianDate(inquiry.date)}`,
    `Período: ${inquiry.period}`,
    propertyUrl,
  ].join('\n'));
};

export const buildGeneralInquiry = (inquiry: GeneralInquiry): string =>
  buildWhatsAppUrl([
    'Olá! Entrei em contato pelo site da Imobiliária Clementino.',
    `Nome: ${inquiry.name}`,
    `Telefone: ${inquiry.phone}`,
    `E-mail: ${inquiry.email}`,
    `Assunto: ${inquiry.subject}`,
    `Mensagem: ${inquiry.message}`,
  ].join('\n'));

export const buildServiceInquiry = (service: string): string =>
  buildWhatsAppUrl(
    `Olá! Entrei em contato pelo site da Imobiliária Clementino e quero informações sobre ${service}.`,
  );
