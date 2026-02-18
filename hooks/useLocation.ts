
import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './useAuth';
import { requestLocationPermission, geocodeZipCode } from '@/utils/locationUtils';

export const useLocation = () => {
  const { user, updateUserProfile } = useAuth();
  const [requestingPermission, setRequestingPermission] = useState(false);
  const locationSuccessShownRef = useRef(false);

  // Only request location when user is authenticated. Never show alerts when !user (e.g. after sign out).
  const requestLocation = useCallback(async () => {
    if (!user) {
      console.log('useLocation: No user, skipping location request (no alert)');
      return;
    }

    console.log('useLocation: Requesting location permission');
    setRequestingPermission(true);

    try {
      const result = await requestLocationPermission();

      if (result.granted && result.latitude && result.longitude) {
        await updateUserProfile({
          latitude: result.latitude,
          longitude: result.longitude,
          locationEnabled: true,
          locationPermissionRequested: true,
        });
        if (!locationSuccessShownRef.current) {
          locationSuccessShownRef.current = true;
          console.log('useLocation: Showing location success message once');
          Alert.alert('Success', 'Location saved! You can now see nearby courts.');
        }
      } else {
        await updateUserProfile({ locationPermissionRequested: true });
        Alert.alert(
          'Location Access Denied',
          'You can still use PickleRadar by searching for courts using a ZIP code.'
        );
      }
    } catch (error) {
      console.error('useLocation: Error requesting location:', error);
      if (user) {
        Alert.alert(
          'Location Error',
          'Unable to access location. You can still search by ZIP code.'
        );
      }
      try {
        if (user) await updateUserProfile({ locationPermissionRequested: true });
      } catch (updateError) {
        console.error('useLocation: Error updating permission status:', updateError);
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [user, updateUserProfile]);

  const updateZipCode = async (zipCode: string) => {
    if (!user) return { success: false, error: 'Not logged in' };

    try {
      console.log('useLocation: Geocoding ZIP code:', zipCode);
      const result = await geocodeZipCode(zipCode);
      
      if (result.success && result.latitude && result.longitude) {
        console.log('useLocation: ZIP code geocoded successfully');
        await updateUserProfile({
          zipCode,
          latitude: result.latitude,
          longitude: result.longitude,
        });
        return { success: true };
      } else {
        console.log('useLocation: ZIP code geocoding failed:', result.error);
        return { success: false, error: result.error || 'Invalid ZIP code' };
      }
    } catch (error) {
      console.error('useLocation: Error updating ZIP code:', error);
      return { success: false, error: 'Failed to update ZIP code' };
    }
  };

  return {
    requestLocation,
    updateZipCode,
    requestingPermission,
    hasLocation: !!(user?.latitude && user?.longitude),
    userLocation: user?.latitude && user?.longitude ? {
      latitude: user.latitude,
      longitude: user.longitude,
    } : null,
  };
};
