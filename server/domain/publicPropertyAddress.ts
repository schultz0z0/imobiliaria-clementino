export type PublicPropertyAddressSource = {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  complement?: string;
};

const clean = (value: string | undefined): string => value?.trim() ?? '';

export const formatPublicPropertyAddress = (address: PublicPropertyAddressSource | undefined): string => {
  const street = clean(address?.street);
  const number = clean(address?.number);
  const district = clean(address?.district);
  const city = clean(address?.city);
  const state = clean(address?.state).toUpperCase();

  const streetAndNumber = [street, number].filter(Boolean).join(', ');
  const cityAndState = city && state ? `${city} - ${state}` : city || state;
  const locality = [district, cityAndState].filter(Boolean).join(', ');

  return [streetAndNumber, locality].filter(Boolean).join(' - ');
};
