import type { RawPropertyRecord } from './sourceTypes';

export const makeRawRecord = (): RawPropertyRecord => ({
  dados_gerais: {
    titulo: 'Casa Duplex em Coelho Neto',
    subtitulo: 'Casa · 140m² · 2 quartos · 2 vagas',
    codigo_imovel: '0085',
    id_imovelweb: '3042851381',
    preco: 'R$ 1.500',
    condominio: 'Não informado / Isento',
    endereco_completo: 'Rua Parnaíba, Coelho Neto, Rio de Janeiro, RJ',
    bairro: 'Coelho Neto',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
  },
  caracteristicas_principais: {
    CFT2: { featureId: 'CFT2', label: 'quartos', measure: null, value: '2', icon: 'dormitorio' },
    CFT3: { featureId: 'CFT3', label: 'banheiros', measure: null, value: '4', icon: 'bano' },
    CFT4: { featureId: 'CFT4', label: 'suítes', measure: null, value: '2', icon: 'toilete' },
    CFT7: { featureId: 'CFT7', label: 'vagas', measure: null, value: '2', icon: 'cochera' },
    CFT101: { featureId: 'CFT101', label: 'útil', measure: 'm²', value: '140', icon: 'scubierta' },
  },
  descricao: 'Imóvel disponível para aluguel.',
  total_fotos: 2,
  fotos: [
    {
      index: 1,
      filename: 'foto_01.jpg',
      relative_path: 'fotos/foto_01.jpg',
      title: 'Frente',
      size_bytes: 1_000,
      size_kb: 0.98,
      url: 'https://example.com/foto-1.jpg',
    },
    {
      index: 2,
      filename: 'foto_02.jpg',
      relative_path: 'fotos/foto_02.jpg',
      title: 'Sala',
      size_bytes: 900,
      size_kb: 0.88,
      url: 'https://example.com/foto-2.jpg',
    },
  ],
});
