export interface WebsiteProperty {
  id: string;
  reference: string;
  slug: string;
  image: string;
  images: string[];
  title: string;
  location: string;
  address: string;
  city: string;
  district: string;
  state: string;
  price: string;
  priceValue: number;
  prices: Array<{
    type: 'Venda' | 'Aluguel';
    price: string;
    priceValue: number;
  }>;
  condoPrice: number;
  iptuPrice: number;
  beds: number;
  suites: number;
  baths: number;
  parkingSpaces: number;
  area: string;
  areaValue: number;
  totalArea: string;
  totalAreaValue: number;
  latitude?: number;
  longitude?: number;
  propertyType: string;
  type: 'Venda' | 'Aluguel' | 'Ambos';
  desc: string;
  featureGroups: Array<{
    category: string;
    items: Array<{
      label: string;
      value?: string;
    }>;
  }>;
  features: string[];
  /** Editorial flag used only to build the Home selection. */
  featured?: boolean;
}
