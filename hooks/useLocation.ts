
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './useAuth';
import { requestLocationPermission, geocodeZipCode } from '@/utils/locationUtils';

export const useLocation = () => {
  const { user, updateUserProfile } = useAuth();
  const [requestingPermission, setRequestingPermission] = useState(false);

  const requestLocation = useCallback(async () => {
    console.log('useLocation: User requested location permission');
    if (!user) {
      console.log('useLocation: No user found, cannot request location');
      Alert.alert('Error', 'You must be logged in to enable location services.');
      return;
    }

    setRequestingPermission(true);
    
    try {
      console.log('useLocation: Calling requestLocationPermission');
      const result = await requestLocationPermission();
      
      if (result.granted && result.latitude && result.longitude) {
        console.log('useLocation: Permission granted, updating user profile with location');
        await updateUserProfile({
          latitude: result.latitude,
          longitude: result.longitude,
          locationEnabled: true,
          locationPermissionRequested: true,
        });
        Alert.alert('Success', 'Location saved! You can now see nearby courts.');
      } else {
        console.log('useLocation: Permission denied or location unavailable');
        await updateUserProfile({ locationPermissionRequested: true });
        Alert.alert(
          'Location Access Denied',
          'You can still use PickleRadar by searching for courts using a ZIP code.'
        );
      }
    } catch (error) {
      console.error('useLocation: Error requesting location:', error);
      Alert.alert(
        'Location Error',
        'Unable to access location. You can still search by ZIP code.'
      );
      try {
        await updateUserProfile({ locationPermissionRequested: true });
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
