import { getBusinessStructuredData, serializeStructuredData } from '../../config/structuredData';

export { getBusinessStructuredData } from '../../config/structuredData';

export const businessStructuredDataId = 'clementino-business-structured-data';

export const BusinessStructuredData = () => {
  if (typeof document !== 'undefined' && document.getElementById(businessStructuredDataId)) return null;
  return (
    <script
      id={businessStructuredDataId}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(getBusinessStructuredData()) }}
    />
  );
};
