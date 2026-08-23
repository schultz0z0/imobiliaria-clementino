export type CatalogPurpose = 'Venda' | 'Aluguel';

export interface RawFeature {
  featureId?: string;
  label: string | null;
  measure: string | null;
  value: string;
  icon?: string;
}

export interface RawPhoto {
  index: number;
  filename: string;
  relative_path: string;
  title: string;
  size_bytes?: number;
  size_kb?: number;
  url?: string;
}

export interface RawPropertyRecord {
  dados_gerais: {
    titulo: string;
    subtitulo: string;
    codigo_imovel: string;
    id_imovelweb: string;
    preco: string;
    condominio: string;
    endereco_completo: string;
    bairro: string;
    cidade: string;
    estado: string | null;
  };
  caracteristicas_principais: Record<string, RawFeature>;
  descricao: string;
  total_fotos: number;
  fotos: RawPhoto[];
}

export interface CatalogOverrides {
  purposeById: Record<string, CatalogPurpose>;
}
