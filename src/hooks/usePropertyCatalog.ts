import { getAllProperties } from '../catalog/propertyCatalog';

export const usePropertyCatalog = () => ({
  properties: getAllProperties(),
});
