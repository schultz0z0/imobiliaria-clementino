import type { WebsiteProperty } from '../../types/property';
import { getPropertyStructuredData, serializeStructuredData } from '../../config/structuredData';

export const propertyStructuredDataId = 'clementino-property-structured-data';

export const PropertyStructuredData = ({ property }: { property: WebsiteProperty }) => {
  const structuredData = getPropertyStructuredData(property);

  return (
    <script
      id={propertyStructuredDataId}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
    />
  );
};
