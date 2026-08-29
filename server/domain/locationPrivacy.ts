import { createHmac } from 'node:crypto';

import {
  formatPublicLocationLabel,
  haversineDistanceMeters,
  isPublicLocationDistanceWithinBounds,
  PUBLIC_LOCATION_DISTANCE_TOLERANCE_METERS,
  PUBLIC_LOCATION_MAX_DISTANCE_METERS,
  PUBLIC_LOCATION_MIN_DISTANCE_METERS,
} from '../../shared/propertySchema.ts';

export { haversineDistanceMeters } from '../../shared/propertySchema.ts';

export const LOCATION_PRIVACY_MIN_DISTANCE_METERS = PUBLIC_LOCATION_MIN_DISTANCE_METERS;
export const LOCATION_PRIVACY_MAX_DISTANCE_METERS = PUBLIC_LOCATION_MAX_DISTANCE_METERS;
const GENERATED_MIN_DISTANCE_METERS = 150;
const GENERATED_MAX_DISTANCE_METERS = 350;
const DEVELOPMENT_LOCATION_PRIVACY_SECRET = 'development-only-location-privacy-secret';

type Coordinates = { latitude: number; longitude: number };

export type PrivateLocation = {
  postalCode: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  complement?: string;
  latitude?: number;
  longitude?: number;
};

export type PublicLocation = {
  label: string;
  latitude?: number;
  longitude?: number;
  precision: 'approximate';
};

export class LocationPrivacyError extends Error {}

export const resolveLocationPrivacySecret = ({
  environment = process.env.NODE_ENV ?? 'development',
  secret = process.env.LOCATION_PRIVACY_SECRET,
}: {
  environment?: string;
  secret?: string;
} = {}): string => {
  if (secret?.trim()) {
    return secret;
  }
  if (environment === 'production') {
    throw new Error('LOCATION_PRIVACY_SECRET is required in production.');
  }
  return DEVELOPMENT_LOCATION_PRIVACY_SECRET;
};

const normalizeLongitude = (longitude: number): number => {
  const normalized = ((longitude + 540) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
};

const toRadians = (value: number): number => (value * Math.PI) / 180;
const toDegrees = (value: number): number => (value * 180) / Math.PI;

const destinationPoint = (
  origin: Coordinates,
  bearingRadians: number,
  distanceMeters: number,
): Coordinates => {
  const angularDistance = distanceMeters / 6_371_008.8;
  const latitude = toRadians(origin.latitude);
  const longitude = toRadians(origin.longitude);
  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const nextLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude),
    );
  return {
    latitude: Math.max(-89.999999, Math.min(89.999999, toDegrees(nextLatitude))),
    longitude: normalizeLongitude(toDegrees(nextLongitude)),
  };
};

const deterministicOffset = (publicId: string, exact: Coordinates, secret: string): Coordinates => {
  const digest = createHmac('sha256', secret)
    .update(`${publicId}:${exact.latitude}:${exact.longitude}`, 'utf8')
    .digest();
  const bearingUnit = digest.readUInt32BE(0) / 0x1_0000_0000;
  const radiusUnit = digest.readUInt32BE(4) / 0x1_0000_0000;
  // Sample uniformly by area inside the annulus, never at the private marker.
  const distance = Math.sqrt(
    GENERATED_MIN_DISTANCE_METERS ** 2 +
      radiusUnit * (GENERATED_MAX_DISTANCE_METERS ** 2 - GENERATED_MIN_DISTANCE_METERS ** 2),
  );
  return destinationPoint(exact, bearingUnit * Math.PI * 2, distance);
};

const coordinatePair = (location: PrivateLocation): Coordinates | undefined => {
  if (location.latitude === undefined && location.longitude === undefined) {
    return undefined;
  }
  if (location.latitude === undefined || location.longitude === undefined) {
    throw new LocationPrivacyError('Private coordinates must be supplied together.');
  }
  return { latitude: location.latitude, longitude: location.longitude };
};

export const derivePublicLocation = ({
  publicId,
  privateAddress,
  secret,
  manualCoordinates,
}: {
  publicId: string;
  privateAddress: PrivateLocation;
  secret: string;
  manualCoordinates?: Coordinates;
}): PublicLocation => {
  const exact = coordinatePair(privateAddress);
  const label = formatPublicLocationLabel(privateAddress);
  if (!exact) {
    if (manualCoordinates) {
      throw new LocationPrivacyError('Manual public coordinates require private exact coordinates.');
    }
    return { label, precision: 'approximate' };
  }
  const coordinates = manualCoordinates ?? deterministicOffset(publicId, exact, secret);
  const distance = haversineDistanceMeters(exact, coordinates);
  if (manualCoordinates && !isPublicLocationDistanceWithinBounds(distance)) {
    if (distance < LOCATION_PRIVACY_MIN_DISTANCE_METERS - PUBLIC_LOCATION_DISTANCE_TOLERANCE_METERS) {
      throw new LocationPrivacyError('The public marker must be at least 100 m from the exact location.');
    }
    throw new LocationPrivacyError('The public marker must be within 1.000 m of the exact location.');
  }
  return { label, ...coordinates, precision: 'approximate' };
};
