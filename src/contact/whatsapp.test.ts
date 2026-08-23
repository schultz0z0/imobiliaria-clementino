import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeneralInquiry,
  buildPropertyInquiry,
  buildServiceInquiry,
  buildVisitInquiry,
  buildWhatsAppUrl,
} from './whatsapp';

test('builds an encoded WhatsApp URL for the configured number', () => {
  const url = new URL(buildWhatsAppUrl('Olá, quero informações.'));

  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/5521964023524');
  assert.equal(url.searchParams.get('text'), 'Olá, quero informações.');
});

test('property inquiry includes reference and public route', () => {
  const url = new URL(buildPropertyInquiry({
    reference: 'AP0016',
    slug: 'apartamento-exemplo-123',
    title: 'Apartamento em Jardim América',
  }, 'https://clementino.example'));
  const message = url.searchParams.get('text') ?? '';

  assert.match(message, /AP0016/);
  assert.match(message, /Apartamento em Jardim América/);
  assert.match(message, /https:\/\/clementino\.example\/imoveis\/apartamento-exemplo-123/);
});

test('visit inquiry carries the visitor data and requested period', () => {
  const url = new URL(buildVisitInquiry({
    reference: 'AP0016',
    slug: 'apartamento-exemplo-123',
    title: 'Apartamento em Jardim América',
    name: 'Maria Souza',
    phone: '(21) 99999-0000',
    email: 'maria@example.com',
    date: '2026-08-25',
    period: 'tarde',
  }, 'https://clementino.example'));
  const message = url.searchParams.get('text') ?? '';

  assert.match(message, /Maria Souza/);
  assert.match(message, /AP0016/);
  assert.match(message, /25\/08\/2026/);
  assert.match(message, /tarde/i);
  assert.match(message, /https:\/\/clementino\.example\/imoveis\/apartamento-exemplo-123/);
});

test('general inquiry carries every filled contact field', () => {
  const url = new URL(buildGeneralInquiry({
    name: 'João Silva',
    phone: '(21) 98888-7777',
    email: 'joao@example.com',
    subject: 'Quero comprar um imóvel',
    message: 'Procuro apartamento com dois quartos.',
  }));
  const message = url.searchParams.get('text') ?? '';

  assert.match(message, /João Silva/);
  assert.match(message, /\(21\) 98888-7777/);
  assert.match(message, /joao@example\.com/);
  assert.match(message, /Quero comprar um imóvel/);
  assert.match(message, /Procuro apartamento com dois quartos\./);
});

test('service inquiry identifies the selected service', () => {
  const url = new URL(buildServiceInquiry('Avaliação imobiliária'));
  const message = url.searchParams.get('text') ?? '';

  assert.match(message, /Avaliação imobiliária/);
  assert.match(message, /site da Imobiliária Clementino/);
});
