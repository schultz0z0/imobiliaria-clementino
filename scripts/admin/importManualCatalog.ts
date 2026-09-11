import { createHash } from 'node:crypto';
import { createReadStream, openAsBlob } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { COMMON_FEATURES, PRIVATE_FEATURES } from '../../shared/featureCatalog.ts';

type Operation = 'sale' | 'rent' | 'seasonal' | 'auction';
type PropertyType = 'apartment' | 'house' | 'commercial' | 'rural' | 'land';
type PropertySubtype = 'penthouse' | 'duplex' | 'flat' | 'garden' | 'studio' | 'loft' | 'standard' | 'room' | 'triplex';

type ParsedNote = {
  folder: string;
  reference: string;
  notePath: string;
  photoDirectory: string;
  title: string;
  description: string;
  addressSource: string;
  street: string;
  district: string;
  city: string;
  state: string;
  operations: Operation[];
  pricing: Partial<Record<Operation | 'condominium' | 'iptu', number>>;
  type: PropertyType;
  subtype: PropertySubtype;
  facts: {
    totalArea?: number;
    usableArea?: number;
    isNew: boolean;
    ageYears?: number;
    bedrooms: number;
    bathrooms: number;
    suites: number;
    parkingSpaces: number;
    floors?: number;
    position?: 'front' | 'back' | 'side' | 'middle';
  };
  features: {
    acceptsFgts: boolean;
    acceptsExchange: boolean;
    common: string[];
    private: string[];
  };
  photos: string[];
};

type AddressResolution = {
  postalCode: string;
  latitude?: number;
  longitude?: number;
};

type AdminProperty = {
  id: string;
  publicId: string;
  commercialReference: string;
  slug: string;
  status: 'draft' | 'published' | 'inactive';
  revisionNumber: number;
  draft: Record<string, any>;
};

type ApiPhoto = {
  id: string;
  checksumSha256: string;
  altText: string;
  position: number;
};

const ROOT = path.resolve('content/manual');
const API_BASE = process.env.CLEMENTINO_ADMIN_API ?? 'http://localhost:4176';
const SITE_BASE = process.env.CLEMENTINO_SITE_URL ?? 'http://localhost:4174';
const USERNAME = process.env.CLEMENTINO_ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.CLEMENTINO_ADMIN_PASSWORD;
const USER_AGENT = 'Imobiliaria Clementino manual catalog importer/1.0';
const EXTERNAL_FETCH_TIMEOUT_MS = 15_000;
const EXPECTED_FOLDERS = Array.from({ length: 52 }, (_, index) => String(index + 3).padStart(2, '0'));

const fetchWithTimeout = (input: string | URL, init: RequestInit = {}): Promise<Response> =>
  fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
const MODE = process.argv.includes('--import') ? 'import' : process.argv.includes('--verify') ? 'verify' : 'analyze';
const SHOULD_PUBLISH = process.argv.includes('--publish');
const SHOULD_VERIFY_PUBLIC = SHOULD_PUBLISH || process.argv.includes('--public');
const PUBLIC_ONLY = process.argv.includes('--public-only');
const SHOULD_RESOLVE = process.argv.includes('--resolve');
const ONLY_ARG = process.argv.find((argument) => argument.startsWith('--only='));
const ONLY = ONLY_ARG ? new Set(ONLY_ARG.slice('--only='.length).split(',').map((value) => value.padStart(2, '0'))) : undefined;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const money = (value: string): number => {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return Number(normalized);
};

const firstNumber = (text: string, expression: RegExp): number | undefined => {
  const match = expression.exec(text);
  return match ? Number(match[1]!.replace(',', '.')) : undefined;
};

const extractSection = (text: string, heading: string, nextHeading: RegExp): string => {
  const start = text.search(new RegExp(`^# ${heading}:?`, 'imu'));
  if (start < 0) return '';
  const afterHeading = text.slice(start).replace(new RegExp(`^# ${heading}:?\\s*`, 'iu'), '');
  const next = afterHeading.search(nextHeading);
  return (next < 0 ? afterHeading : afterHeading.slice(0, next)).trim();
};

const featureIdByLabel = (label: string, scope: 'common' | 'private'): string | undefined => {
  const catalog = scope === 'common' ? COMMON_FEATURES : PRIVATE_FEATURES;
  const clean = normalize(label.replace(/\([^)]*\)/g, ''));
  const aliases: Record<string, string> = {
    academia: 'gym',
    'sala de ginastica': 'gym',
    'area de lazer': 'leisure-area',
    'cameras de seguranca': 'security-cameras',
    'estacionamento para visitantes': 'visitor-parking',
    'portaria 24 horas': 'concierge-24h',
    'quadra esportiva': 'multisport-court',
    'quadra poliesportiva': 'multisport-court',
    'vigilancia 24 horas': 'security-24h',
    'area de servico': 'service-area',
    'cozinha gourmet': 'gourmet-kitchen',
    'cozinha independente': 'independent-kitchen',
    'dependencia de empregados': 'staff-quarters',
    'dependencia completa': 'staff-quarters',
    'entrada independente': 'service-entrance',
    'entrada de servico': 'service-entrance',
    'internet wireless': 'wi-fi',
    'internet sem fio': 'wi-fi',
    'permite animais': 'pets-allowed',
    'sala de jantar': 'dining-room',
    suites: 'suites',
    quintal: 'backyard',
    garagem: 'garage',
    'vaga de garagem': 'garage',
  };
  if (aliases[clean]) return aliases[clean];
  return catalog.find((entry) => normalize(entry.label) === clean)?.id;
};

const inferClassification = (title: string, description: string): { type: PropertyType; subtype: PropertySubtype } => {
  const normalizedTitle = normalize(title);
  const fallback = normalize(description);
  const text = normalizedTitle || fallback;
  if (/\bgalpao\b|\bsala comercial\b|\blojao\b|\bloja\b/.test(normalizedTitle)) {
    return { type: 'commercial', subtype: 'standard' };
  }
  if (/\bapartamento\b|\bapto\b|\bkitnet\b|\bstudio\b|\bflat\b|\bcobertura\b/.test(normalizedTitle)) {
    if (normalizedTitle.includes('cobertura')) return { type: 'apartment', subtype: 'penthouse' };
    if (normalizedTitle.includes('duplex')) return { type: 'apartment', subtype: 'duplex' };
    if (/\bkitnet\b|\bstudio\b/.test(normalizedTitle)) return { type: 'apartment', subtype: 'studio' };
    if (/\bflat\b/.test(normalizedTitle)) return { type: 'apartment', subtype: 'flat' };
    if (/\bloft\b/.test(normalizedTitle)) return { type: 'apartment', subtype: 'loft' };
    return { type: 'apartment', subtype: 'standard' };
  }
  if (/\bcasa\b/.test(normalizedTitle)) {
    if (normalizedTitle.includes('duplex')) return { type: 'house', subtype: 'duplex' };
    if (normalizedTitle.includes('triplex')) return { type: 'house', subtype: 'triplex' };
    return { type: 'house', subtype: 'standard' };
  }
  if (/\bterreno\b|\blotes?\b/.test(normalizedTitle)) return { type: 'land', subtype: 'standard' };
  if (/\bsitio\b|\bfazenda\b|\bchacara\b/.test(normalizedTitle)) return { type: 'rural', subtype: 'standard' };
  if (/\bgalpao\b|\bsala comercial\b|\bloja\b|\bcomercial\b|\bindustrial\b/.test(fallback)) return { type: 'commercial', subtype: 'standard' };
  if (/\bapartamento\b|\bapto\b/.test(fallback)) return { type: 'apartment', subtype: 'standard' };
  if (/\bterreno\b|\blotes?\b/.test(fallback)) return { type: 'land', subtype: 'standard' };
  if (text.includes('duplex')) return { type: 'house', subtype: 'duplex' };
  if (text.includes('triplex')) return { type: 'house', subtype: 'triplex' };
  return { type: 'house', subtype: 'standard' };
};

const parseAddress = (source: string, title: string): Pick<ParsedNote, 'street' | 'district' | 'city' | 'state'> => {
  const parts = source.split(',').map((part) => part.trim()).filter(Boolean);
  const street = parts[0]!.replace(/,?\s*\d+[A-Za-z-]*\s*$/, '').trim();
  if (normalize(title).includes('araruama') && normalize(source).includes('araruama')) {
    return { street, district: 'Praia Seca', city: 'Araruama', state: 'RJ' };
  }
  if (parts.length >= 3) {
    return { street, district: parts.at(-2)!, city: parts.at(-1)!, state: 'RJ' };
  }
  return { street, district: parts[1] ?? parts[0]!, city: 'Rio de Janeiro', state: 'RJ' };
};

const parseFeatures = (text: string): ParsedNote['features'] => {
  const more = extractSection(text, 'Saiba mais sobre este imóvel', /^Link:|^# Referência Clementino:/imu);
  const commonStart = more.search(/^Áreas comuns?:/imu);
  const privateStart = more.search(/^Áreas privativas?:/imu);
  const environmentsStart = more.search(/^Ambientes?:/imu);
  const extrasStart = more.search(/^Extras?:/imu);
  const othersStart = more.search(/^Outros?:/imu);
  const linesFor = (start: number, endCandidates: number[]) => {
    if (start < 0) return [];
    const validEnds = endCandidates.filter((end) => end > start);
    const end = validEnds.length ? Math.min(...validEnds) : more.length;
    return more
      .slice(start, end)
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean);
  };
  const boundaries = [commonStart, privateStart, environmentsStart, extrasStart, othersStart];
  const commonLines = linesFor(commonStart, boundaries);
  const privateLines = [
    ...linesFor(privateStart, boundaries),
    ...linesFor(environmentsStart, boundaries),
  ];
  const allLines = more.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    acceptsFgts: allLines.some((line) => normalize(line).includes('aceita fgts')),
    acceptsExchange: allLines.some((line) => normalize(line).includes('aceita permuta')),
    common: [...new Set(commonLines.map((line) => featureIdByLabel(line, 'common')).filter((id): id is string => Boolean(id)))],
    private: [...new Set(privateLines.map((line) => featureIdByLabel(line, 'private')).filter((id): id is string => Boolean(id)))],
  };
};

const parseNote = async (folder: string): Promise<ParsedNote> => {
  const notePath = path.join(ROOT, folder, `${folder}.txt`);
  const photoDirectory = path.join(ROOT, folder, 'fotos');
  const text = (await readFile(notePath, 'utf8')).replace(/^\uFEFF/, '');
  const title = text.match(/^# Titulo:\s*(.+)$/imu)?.[1]?.trim() ?? '';
  const description = extractSection(text, 'Descrição', /^# Endereço:/imu);
  const addressSource = text.match(/^# Endereço:\s*(.+)$/imu)?.[1]?.trim() ?? '';
  const characteristicText = extractSection(text, 'Características', /^# Saiba mais|^Link:|^# Referência Clementino:/imu);
  const detailText = extractSection(text, 'Saiba mais sobre este imóvel', /^Link:|^# Referência Clementino:/imu);
  const factText = `${characteristicText}\n${detailText}`;
  const pricing: ParsedNote['pricing'] = {};
  const operationLabels: Array<[RegExp, Operation | 'condominium' | 'iptu']> = [
    [/^#\s*venda\s+R\$\s*([\d.,]+)/imu, 'sale'],
    [/^#\s*aluguel\s+R\$\s*([\d.,]+)/imu, 'rent'],
    [/^#\s*temporada\s+R\$\s*([\d.,]+)/imu, 'seasonal'],
    [/^#\s*leil[aã]o\s+R\$\s*([\d.,]+)/imu, 'auction'],
    [/^#\s*condom[ií]nio\s+R\$\s*([\d.,]+)/imu, 'condominium'],
    [/^#\s*IPTU\s+R\$\s*([\d.,]+)/imu, 'iptu'],
  ];
  for (const [expression, key] of operationLabels) {
    const match = text.match(expression);
    if (match) pricing[key] = money(match[1]!);
  }
  const operations = (['sale', 'rent', 'seasonal', 'auction'] as const).filter((operation) => pricing[operation] !== undefined);
  const classification = inferClassification(title, description);
  const address = parseAddress(addressSource, title);
  const photoNames = (await readdir(photoDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(?:jpe?g|png|webp|heic|tiff?)$/i.test(name))
    .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true }));
  const positionText = normalize(factText);
  const position = positionText.includes('frente') ? 'front'
    : positionText.includes('fundos') ? 'back'
      : positionText.includes('lateral') ? 'side'
        : positionText.includes('meio') ? 'middle'
          : undefined;
  const totalArea = firstNumber(characteristicText, /([\d.,]+)\s*m(?:²|2)\s*(?:tot|total)/iu);
  const usableArea = firstNumber(characteristicText, /([\d.,]+)\s*m(?:²|2)\s*(?:útil|util|constru)/iu);
  const normalizedTotalArea = totalArea && usableArea && usableArea > totalArea ? usableArea : totalArea;
  const normalizedUsableArea = totalArea && usableArea && usableArea > totalArea ? usableArea : usableArea;
  return {
    folder,
    reference: `CLEM-${folder.padStart(4, '0')}`,
    notePath,
    photoDirectory,
    title,
    description,
    addressSource,
    ...address,
    operations,
    pricing,
    ...classification,
    facts: {
      totalArea: normalizedTotalArea,
      usableArea: normalizedUsableArea,
      isNew: /\bim[oó]vel novo\b/iu.test(characteristicText),
      ageYears: firstNumber(factText, /(\d+)\s*anos?/iu),
      bedrooms: firstNumber(factText, /(\d+)\s*(?:quartos?|qtos?)/iu) ?? 0,
      bathrooms: firstNumber(factText, /(\d+)\s*(?:banheiros?|banhs?|bnhs?)/iu) ?? 0,
      suites: firstNumber(factText, /(\d+)\s*su[ií]tes?/iu) ?? 0,
      parkingSpaces: firstNumber(factText, /(\d+)\s*(?:vagas?|vgs?)/iu) ?? 0,
      floors: firstNumber(factText, /(\d+)\s*(?:andares?|pavimentos?)/iu)
        ?? firstNumber(factText, /(?:andares?|pavimentos?)\s*:\s*(\d+)/iu),
      ...(position ? { position } : {}),
    },
    features: parseFeatures(text),
    photos: photoNames.map((name) => path.join(photoDirectory, name)),
  };
};

const validNote = (note: ParsedNote): string[] => {
  const issues: string[] = [];
  if (note.title.length < 10 || note.title.length > 120) issues.push(`título com ${note.title.length} caracteres`);
  if (note.description.length < 80 || note.description.length > 5_000) issues.push(`descrição com ${note.description.length} caracteres`);
  if (!note.street || !note.district || !note.city) issues.push('endereço incompleto');
  if (!note.operations.length) issues.push('nenhuma operação com preço explícito');
  if (!note.photos.length) issues.push('nenhuma foto');
  if (note.facts.totalArea && note.facts.usableArea && note.facts.usableArea > note.facts.totalArea) issues.push('área útil maior que total');
  if (note.facts.suites > note.facts.bedrooms) issues.push('suítes maiores que quartos');
  return issues;
};

class AdminApi {
  private cookie = '';
  private csrf = '';

  async login(): Promise<void> {
    if (!PASSWORD) throw new Error('Defina CLEMENTINO_ADMIN_PASSWORD no ambiente.');
    const response = await fetchWithTimeout(`${API_BASE}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    if (!response.ok) throw new Error(`Falha no login: HTTP ${response.status}`);
    const setCookies = response.headers.getSetCookie();
    this.cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
    this.csrf = /clementino_admin_csrf=([^;]+)/.exec(this.cookie)?.[1] ?? '';
    if (!this.csrf) throw new Error('Cookie CSRF ausente após login.');
  }

  private async request<T>(pathname: string, init: RequestInit = {}, mutation = false): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('cookie', this.cookie);
    if (mutation) headers.set('x-csrf-token', this.csrf);
    const response = await fetchWithTimeout(`${API_BASE}${pathname}`, { ...init, headers });
    const body = await response.text();
    if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname}: HTTP ${response.status} ${body.slice(0, 500)}`);
    return body ? JSON.parse(body) as T : (undefined as T);
  }

  async findByReference(reference: string): Promise<AdminProperty | undefined> {
    const result = await this.request<{ items: Array<{ id: string; reference: string }> }>(`/api/admin/properties?limit=100&search=${encodeURIComponent(reference)}`);
    const summary = result.items.find((property) => property.reference === reference);
    return summary ? this.detail(summary.id) : undefined;
  }

  async create(): Promise<AdminProperty> {
    const result = await this.request<{ property: AdminProperty }>('/api/admin/properties', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }, true);
    return result.property;
  }

  async detail(id: string): Promise<AdminProperty> {
    return (await this.request<{ property: AdminProperty }>(`/api/admin/properties/${id}`)).property;
  }

  async patch(property: AdminProperty, patch: Record<string, unknown>): Promise<AdminProperty> {
    return (await this.request<{ property: AdminProperty }>(`/api/admin/properties/${property.id}/draft`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': String(property.revisionNumber) },
      body: JSON.stringify(patch),
    }, true)).property;
  }

  async photos(id: string): Promise<ApiPhoto[]> {
    return (await this.request<{ photos: ApiPhoto[] }>(`/api/admin/properties/${id}/photos`)).photos;
  }

  async upload(property: AdminProperty, filePath: string, altText: string): Promise<AdminProperty> {
    const form = new FormData();
    const extension = path.extname(filePath).toLocaleLowerCase();
    const mime = extension === '.png' ? 'image/png'
      : extension === '.webp' ? 'image/webp'
        : extension === '.heic' ? 'image/heic'
          : extension === '.tif' || extension === '.tiff' ? 'image/tiff'
            : 'image/jpeg';
    form.append('altText', altText);
    form.append('file', await openAsBlob(filePath, { type: mime }), path.basename(filePath));
    return (await this.request<{ property: AdminProperty }>(`/api/admin/properties/${property.id}/photos`, {
      method: 'POST', headers: { 'if-match': String(property.revisionNumber) }, body: form,
    }, true)).property;
  }

  async previewLocation(publicId: string, privateAddress: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.request<{ publicLocation: Record<string, unknown> }>('/api/admin/location/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicId, privateAddress }),
    }, true)).publicLocation;
  }

  async validation(id: string): Promise<{ publishable: boolean; issues: Array<{ path: Array<string | number>; message: string }> }> {
    return this.request(`/api/admin/properties/${id}/validation`);
  }

  async publish(id: string): Promise<number> {
    const result = await this.request<{ job: { id: number } }>(`/api/admin/properties/${id}/publish`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }, true);
    return result.job.id;
  }

  async publication(id: number): Promise<{ publication: { status: string } }> {
    return this.request(`/api/admin/publications/${id}`);
  }
}

const resolveAddress = async (note: ParsedNote): Promise<AddressResolution> => {
  const lookupCity = normalize(note.city) === 'rio de janeiroo' ? 'Rio de Janeiro' : note.city;
  const streetAliases: Record<string, string> = {
    'rua georges bizer': 'Rua Georges Bizet',
    'rua george bizet': 'Rua Georges Bizet',
    'rua estrada do vigario geral': 'Estrada de Vigário Geral',
    'rua inhanga': 'Rua Inhangá',
    'rua padre manoel rodrigues': 'Rua Padre Manuel Rodrigues',
  };
  const lookupStreet = streetAliases[normalize(note.street)] ?? note.street;
  const nominatim = async (query: string) => {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('q', query);
    await sleep(1_100);
    const response = await fetchWithTimeout(url, { headers: { 'user-agent': USER_AGENT } });
    return response.ok
      ? await response.json() as Array<{ lat: string; lon: string; address?: { postcode?: string; road?: string; city?: string; town?: string; municipality?: string } }>
      : [];
  };
  const streetQuery = lookupStreet.replace(/\b(?:Rua|Avenida|Av\.|Travessa|Estrada)\b/iu, '').trim();
  const viaCepUrl = `https://viacep.com.br/ws/${note.state}/${encodeURIComponent(lookupCity)}/${encodeURIComponent(streetQuery)}/json/`;
  const viaResponse = await fetchWithTimeout(viaCepUrl, { headers: { 'user-agent': USER_AGENT } });
  const candidates = viaResponse.ok ? await viaResponse.json() as Array<{ cep?: string; logradouro?: string; bairro?: string; localidade?: string }> : [];
  const district = normalize(note.district);
  const street = normalize(lookupStreet);
  const scored = candidates
    .filter((candidate) => candidate.cep)
    .map((candidate) => ({
      ...candidate,
      score: (normalize(candidate.bairro ?? '') === district ? 4 : 0)
        + (normalize(candidate.logradouro ?? '').includes(street.replace(/^(rua|avenida|travessa|estrada) /, '')) ? 2 : 0),
    }))
    .sort((left, right) => right.score - left.score);
  const viaCandidate = scored[0];
  const geocodeQuery = viaCandidate
    ? `${viaCandidate.logradouro}, ${viaCandidate.bairro}, ${viaCandidate.localidade}, ${note.state}, ${viaCandidate.cep}, Brasil`
    : `${lookupStreet}, ${note.district}, ${lookupCity}, ${note.state}, Brasil`;
  let places = await nominatim(geocodeQuery);
  if (!places.length) places = await nominatim(`${lookupStreet}, ${lookupCity}, ${note.state}, Brasil`);
  const postalCode = viaCandidate?.cep ?? places[0]?.address?.postcode?.match(/\d{5}-?\d{3}/)?.[0];
  if (!postalCode) throw new Error(`${note.folder}: CEP não encontrado para ${note.addressSource}`);
  let latitude = places[0] ? Number(places[0].lat) : undefined;
  let longitude = places[0] ? Number(places[0].lon) : undefined;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const brasilApi = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${postalCode.replace(/\D/g, '')}`, {
      headers: { 'user-agent': USER_AGENT },
    });
    if (brasilApi.ok) {
      const result = await brasilApi.json() as { location?: { coordinates?: { latitude?: string; longitude?: string } } };
      latitude = Number(result.location?.coordinates?.latitude);
      longitude = Number(result.location?.coordinates?.longitude);
    }
  }
  return {
    postalCode,
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : {}),
  };
};

const fileSha256 = (filePath: string): Promise<string> => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const buildPatch = async (api: AdminApi, property: AdminProperty, note: ParsedNote, address: AddressResolution) => {
  const privateAddress = {
    postalCode: address.postalCode,
    state: note.state,
    city: note.city,
    district: note.district,
    street: note.street,
    ...(address.latitude !== undefined ? { latitude: address.latitude, longitude: address.longitude } : {}),
  };
  const storedPublicLocation = property.draft.publicLocation;
  const publicLocation = storedPublicLocation?.precision === 'approximate'
    && storedPublicLocation?.label
    && storedPublicLocation?.latitude !== undefined
    && storedPublicLocation?.longitude !== undefined
    ? storedPublicLocation
    : address.latitude === undefined
      ? { label: `${note.district}, ${note.city} - ${note.state}`, precision: 'approximate' }
      : await api.previewLocation(property.publicId, privateAddress);
  return {
    classification: { operations: note.operations, type: note.type, subtype: note.subtype },
    privateAddress,
    publicLocation,
    facts: note.facts,
    features: note.features,
    editorial: { title: note.title, description: note.description, reference: note.reference, featured: false },
    pricing: note.pricing,
    seo: {},
  };
};

const validateIdentity = async (api: AdminApi, note: ParsedNote, property: AdminProperty): Promise<string[]> => {
  const issues: string[] = [];
  const draft = property.draft;
  const compare = (label: string, actual: unknown, expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) issues.push(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  };
  compare('referência', property.commercialReference, note.reference);
  compare('título', draft.editorial?.title, note.title);
  compare('descrição', draft.editorial?.description, note.description);
  compare('operações', draft.classification?.operations, note.operations);
  compare('tipo', draft.classification?.type, note.type);
  compare('subtipo', draft.classification?.subtype, note.subtype);
  compare('logradouro', draft.privateAddress?.street, note.street);
  compare('bairro', draft.privateAddress?.district, note.district);
  compare('cidade', draft.privateAddress?.city, note.city);
  compare('UF', draft.privateAddress?.state, note.state);
  compare('dados principais', draft.facts, note.facts);
  compare('características', draft.features, note.features);
  compare('valores', draft.pricing, note.pricing);

  const sourceHashes = new Set<string>();
  for (const photo of note.photos) sourceHashes.add(await fileSha256(photo));
  const apiPhotos = await api.photos(property.id);
  const apiHashes = new Set(apiPhotos.map((photo) => photo.checksumSha256));
  const missing = [...sourceHashes].filter((hash) => !apiHashes.has(hash));
  const unexpected = [...apiHashes].filter((hash) => !sourceHashes.has(hash));
  if (missing.length || unexpected.length) issues.push(`fotos: ${missing.length} ausentes e ${unexpected.length} inesperadas`);
  if (draft.media?.orderedPhotoIds?.length !== apiPhotos.length) issues.push('ordem de mídia divergente da API');
  if (!draft.media?.coverPhotoId || draft.media.coverPhotoId !== apiPhotos[0]?.id) issues.push('capa não corresponde à primeira foto');
  return issues;
};

const importNote = async (api: AdminApi, note: ParsedNote): Promise<AdminProperty> => {
  let property = await api.findByReference(note.reference);
  if (!property) property = await api.create();
  const address = await resolveAddress(note);
  property = await api.patch(property, await buildPatch(api, property, note, address));

  const existing = await api.photos(property.id);
  const existingHashes = new Set(existing.map((photo) => photo.checksumSha256));
  for (const [index, photoPath] of note.photos.entries()) {
    const checksum = await fileSha256(photoPath);
    if (existingHashes.has(checksum)) continue;
    const altText = `${note.title} — foto ${index + 1}`.slice(0, 180);
    try {
      property = await api.upload(property, photoPath, altText);
      existingHashes.add(checksum);
    } catch (error) {
      if (String(error).includes('HTTP 409') && String(error).toLocaleLowerCase().includes('duplicate')) {
        existingHashes.add(checksum);
        continue;
      }
      throw error;
    }
  }
  return api.detail(property.id);
};

const waitForPublication = async (api: AdminApi, jobId: number): Promise<void> => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const { publication } = await api.publication(jobId);
    if (publication.status === 'succeeded') return;
    if (publication.status === 'failed') throw new Error(`Publicação ${jobId} falhou.`);
    await sleep(1_000);
  }
  throw new Error(`Publicação ${jobId} excedeu o tempo limite.`);
};

const main = async () => {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const numericFolders = entries
    .filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))
    .map((entry) => entry.name);
  const missingFolders = EXPECTED_FOLDERS.filter((folder) => !numericFolders.includes(folder));
  const unexpectedFolders = numericFolders.filter((folder) => Number(folder) >= 3 && !EXPECTED_FOLDERS.includes(folder));
  if (!ONLY && (missingFolders.length || unexpectedFolders.length)) {
    const problems = [
      missingFolders.length ? `pastas ausentes: ${missingFolders.join(', ')}` : '',
      unexpectedFolders.length ? `pastas fora do catálogo: ${unexpectedFolders.join(', ')}` : '',
    ].filter(Boolean);
    throw new Error(`Catálogo manual deve conter exatamente 03..54 (${problems.join('; ')}).`);
  }
  const folders = numericFolders
    .filter((folder) => EXPECTED_FOLDERS.includes(folder))
    .filter((folder) => !ONLY || ONLY.has(folder))
    .sort((left, right) => Number(left) - Number(right));
  const notes: ParsedNote[] = [];
  for (const folder of folders) notes.push(await parseNote(folder));
  const duplicateReferences = notes
    .map((note) => note.reference)
    .filter((reference, index, references) => references.indexOf(reference) !== index);
  if (duplicateReferences.length) throw new Error(`Referências duplicadas: ${[...new Set(duplicateReferences)].join(', ')}`);
  const invalid = notes.flatMap((note) => validNote(note).map((issue) => `${note.folder}: ${issue}`));
  console.log(`Notas=${notes.length} Fotos=${notes.reduce((sum, note) => sum + note.photos.length, 0)} Modo=${MODE}`);
  if (invalid.length) {
    console.error(invalid.join('\n'));
    process.exitCode = 1;
    return;
  }
  if (MODE === 'analyze') {
    for (const note of notes) {
      let resolution = '';
      if (SHOULD_RESOLVE) {
        try {
          const address = await resolveAddress(note);
          resolution = ` | CEP ${address.postalCode} | mapa=${address.latitude === undefined ? 'não' : 'sim'}`;
        } catch (error) {
          resolution = ` | ENDEREÇO_ERRO=${error instanceof Error ? error.message : String(error)}`;
          process.exitCode = 1;
        }
      }
      console.log(`${note.folder} ${note.reference} | ${note.operations.join('+')} | ${note.type}/${note.subtype} | ${note.photos.length} fotos | ${note.addressSource}${resolution}`);
    }
    return;
  }
  const api = new AdminApi();
  await api.login();
  const failures: string[] = [];
  for (const note of notes) {
    try {
      let property = MODE === 'import' ? await importNote(api, note) : await api.findByReference(note.reference);
      if (!property) throw new Error('cadastro não encontrado');
      const identityIssues = PUBLIC_ONLY ? [] : await validateIdentity(api, note, property);
      const validation = PUBLIC_ONLY ? { publishable: true, issues: [] } : await api.validation(property.id);
      if (identityIssues.length || !validation.publishable) {
        const messages = [
          ...identityIssues,
          ...validation.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        ];
        throw new Error(messages.join(' | '));
      }
      if (SHOULD_PUBLISH) {
        const jobId = await api.publish(property.id);
        await waitForPublication(api, jobId);
        property = await api.detail(property.id);
      }
      if (SHOULD_VERIFY_PUBLIC) {
        const publicApi = await fetchWithTimeout(`${API_BASE}/api/public/properties/${encodeURIComponent(property.slug)}`);
        const publicPage = await fetchWithTimeout(`${SITE_BASE}/imoveis/${encodeURIComponent(property.slug)}`);
        if (!publicApi.ok || !publicPage.ok) throw new Error(`página pública indisponível: API=${publicApi.status} site=${publicPage.status}`);
        const publicBody = await publicApi.json() as { property?: Record<string, any> };
        const published = publicBody.property;
        const expectedPhotoCount = (await api.photos(property.id)).length;
        const expectedPrices = note.operations.map((operation) => ({ type: operation === 'rent' || operation === 'seasonal' ? 'Aluguel' : 'Venda', priceValue: note.pricing[operation] }));
        if (
          published?.title !== note.title
          || published?.reference !== note.reference
          || published?.desc !== note.description
          || published?.beds !== note.facts.bedrooms
          || published?.baths !== note.facts.bathrooms
          || published?.suites !== note.facts.suites
          || published?.parkingSpaces !== note.facts.parkingSpaces
          || published?.totalAreaValue !== (note.facts.totalArea ?? 0)
          || published?.areaValue !== (note.facts.usableArea ?? note.facts.totalArea ?? 0)
          || published?.condoPrice !== (note.pricing.condominium ?? 0)
          || published?.iptuPrice !== (note.pricing.iptu ?? 0)
          || published?.images?.length !== expectedPhotoCount
          || JSON.stringify(published?.prices?.map(({ type, priceValue }: { type: string; priceValue: number }) => ({ type, priceValue }))) !== JSON.stringify(expectedPrices)
        ) {
          throw new Error('conteúdo público diverge do cadastro manual');
        }
      }
      console.log(`OK ${note.folder} ${note.reference} fotos=${(await api.photos(property.id)).length} status=${property.status} slug=${property.slug}`);
    } catch (error) {
      const message = `${note.folder}: ${error instanceof Error ? error.message : String(error)}`;
      failures.push(message);
      console.error(`ERRO ${message}`);
    }
  }
  if (failures.length) {
    console.error(`Falhas=${failures.length}\n${failures.join('\n')}`);
    process.exitCode = 1;
  }
};

await main();
