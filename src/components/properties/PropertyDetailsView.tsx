import { createContext, type ReactNode, useContext } from 'react';

import type { WebsiteProperty } from '../../types/property.ts';

type PropertyDetailsViewValue = {
  property: WebsiteProperty;
  related: WebsiteProperty[];
  preview: boolean;
};

const PropertyDetailsViewContext = createContext<PropertyDetailsViewValue | null>(null);

export const PropertyDetailsView = ({ property, related = [], preview = false, children }: {
  property: WebsiteProperty;
  related?: WebsiteProperty[];
  preview?: boolean;
  children?: ReactNode;
}) => (
  <PropertyDetailsViewContext.Provider value={{ property, related, preview }}>
    {children}
  </PropertyDetailsViewContext.Provider>
);

export const usePropertyDetailsView = (): PropertyDetailsViewValue | null =>
  useContext(PropertyDetailsViewContext);
