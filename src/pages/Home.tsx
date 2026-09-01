import { getFeaturedPublishedProperties, getTopNeighborhoodsFromProperties } from '../catalog/propertyCatalog';
import { BuyingJourney } from '../components/home/BuyingJourney';
import { FeaturedProperties } from '../components/home/FeaturedProperties';
import { FinalCta } from '../components/home/FinalCta';
import { HeroSearch } from '../components/home/HeroSearch';
import { InstitutionalPreview } from '../components/home/InstitutionalPreview';
import { NeedsNavigation } from '../components/home/NeedsNavigation';
import { NeighborhoodHighlights } from '../components/home/NeighborhoodHighlights';
import { TrustStrip } from '../components/home/TrustStrip';
import { brandAssets } from '../config/brandAssets';
import { getPageMetadata } from '../config/pageMetadata';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePropertyCatalog } from '../hooks/usePropertyCatalog';

export const Home = () => {
  usePageMeta(getPageMetadata('home'));
  const { properties } = usePropertyCatalog();
  const featured = getFeaturedPublishedProperties(properties, [], 3);
  const neighborhoods = getTopNeighborhoodsFromProperties(properties, 4);

  return (
    <>
      <HeroSearch />
      <TrustStrip propertyCount={properties.length} />
      <FeaturedProperties properties={featured} />
      <NeedsNavigation />
      <NeighborhoodHighlights neighborhoods={neighborhoods} />
      <BuyingJourney />
      <InstitutionalPreview image={brandAssets.institutionalPortrait} />
      <FinalCta />
    </>
  );
};
