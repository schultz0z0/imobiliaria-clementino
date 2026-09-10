import { getBusinessStructuredData, getWebsiteStructuredData, serializeStructuredData } from '../../config/structuredData';

export { getBusinessStructuredData, getWebsiteStructuredData } from '../../config/structuredData';

export const businessStructuredDataId = 'clementino-business-structured-data';
export const websiteStructuredDataId = 'clementino-website-structured-data';

export const BusinessStructuredData = () => {
  const hasBusinessData = typeof document !== 'undefined' && document.getElementById(businessStructuredDataId);
  const hasWebsiteData = typeof document !== 'undefined' && document.getElementById(websiteStructuredDataId);

  return (
    <>
      {!hasBusinessData && (
        <script
          id={businessStructuredDataId}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(getBusinessStructuredData()) }}
        />
      )}
      {!hasWebsiteData && (
        <script
          id={websiteStructuredDataId}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(getWebsiteStructuredData()) }}
        />
      )}
    </>
  );
};

