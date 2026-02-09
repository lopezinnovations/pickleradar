
import * as Location from 'expo-location';

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};

// Calculate bounding box for nearby search
export const calculateBoundingBox = (
  latitude: number,
  longitude: number,
  radiusMiles: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } => {
  // Approximate: 1 degree latitude ≈ 69 miles
  const latDelta = radiusMiles / 69;
  // Longitude varies by latitude
  const lngDelta = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));
  
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
};

// Check if location permission is granted
export const checkLocationPermission = async (): Promise<boolean> => {
  try {
    console.log('locationUtils: Checking location permission status');
    const { status } = await Location.getForegroundPermissionsAsync();
    const granted = status === 'granted';
    console.log('locationUtils: Permission status:', status, 'Granted:', granted);
    return granted;
  } catch (error) {
    console.error('locationUtils: Error checking location permission:', error);
    return false;
  }
};

// Request location permission and get current location
export const requestLocationPermission = async (): Promise<{
  granted: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}> => {
  try {
    console.log('locationUtils: Requesting foreground location permission');
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('locationUtils: Permission request result:', status);
    
    if (status !== 'granted') {
      console.log('locationUtils: Permission not granted');
      return {
        granted: false,
        error: 'Location permission denied',
      };
    }

    console.log('locationUtils: Permission granted, getting current position');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    console.log('locationUtils: Current position obtained:', location.coords.latitude, location.coords.longitude);
    return {
      granted: true,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('locationUtils: Error requesting location permission:', error);
    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Failed to get location',
    };
  }
};

// Geocode ZIP code to coordinates
export const geocodeZipCode = async (zipCode: string): Promise<{
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}> => {
  try {
    console.log('locationUtils: Geocoding ZIP code:', zipCode);
    const results = await Location.geocodeAsync(zipCode);
    
    if (results.length === 0) {
      console.log('locationUtils: No results found for ZIP code');
      return {
        success: false,
        error: 'ZIP code not found',
      };
    }

    console.log('locationUtils: Geocoding successful:', results[0].latitude, results[0].longitude);
    return {
      success: true,
      latitude: results[0].latitude,
      longitude: results[0].longitude,
    };
  } catch (error) {
    console.error('locationUtils: Error geocoding ZIP code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to geocode ZIP code',
    };
  }
};

// Open device's default map app with directions
export const openMapDirections = (latitude: number, longitude: number, label?: string) => {
  try {
    console.log('locationUtils: Opening map directions to:', latitude, longitude);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}${label ? `&destination_place_id=${encodeURIComponent(label)}` : ''}`;
    
    // This will open in the device's default browser, which will then redirect to the map app
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  } catch (error) {
    console.error('locationUtils: Error opening map directions:', error);
  }
};
