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
  condoPrice: number;
  beds: number;
  suites: number;
  baths: number;
  parkingSpaces: number;
  area: string;
  areaValue: number;
  propertyType: string;
  type: 'Venda' | 'Aluguel' | 'Ambos';
  desc: string;
  features: string[];
}
