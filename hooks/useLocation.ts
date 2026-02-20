// hooks/useLocation.ts
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from './useAuth';
import { requestLocationPermission, geocodeZipCode } from '@/utils/locationUtils';

type LocationResult = {
  granted: boolean;
  latitude?: number;
  longitude?: number;
  status?: 'granted' | 'denied' | 'undetermined';
};

export const useLocation = () => {
  const { user, updateUserProfile } = useAuth();
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Prevent repeated alerts across tab-focus loops
  const deniedShownRef = useRef(false);
  const successShownRef = useRef(false);

  const hasLocation = !!(user?.latitude && user?.longitude);
  const userLocation =
    user?.latitude && user?.longitude
      ? { latitude: user.latitude, longitude: user.longitude }
      : null;

  const requestLocation = useCallback(async () => {
    if (!user) return;
    if (Platform.OS === 'web') return;

    // If user explicitly turned off location services in profile, don't auto-request.
    const locationEnabled =
      (user as any)?.locationEnabled ?? (user as any)?.location_enabled ?? null;

    if (locationEnabled === false) {
      // They turned it off; don’t prompt.
      return;
    }

    // If we already have location, don’t prompt again.
    if (hasLocation) return;

    // If we already recorded that we asked and user denied, don't re-alert on every focus.
    const alreadyRequested =
      (user as any)?.locationPermissionRequested ??
      (user as any)?.location_permission_requested ??
      false;

    setRequestingPermission(true);
    try {
      const result = (await requestLocationPermission()) as LocationResult;

      // Always mark that we attempted at least once
      await updateUserProfile({ locationPermissionRequested: true });

      if (result.granted && result.latitude != null && result.longitude != null) {
        await updateUserProfile({
          latitude: result.latitude,
          longitude: result.longitude,
          locationEnabled: true,
        });

        if (!successShownRef.current) {
          successShownRef.current = true;
          Alert.alert('Success', 'Location saved! You can now see nearby courts.');
        }
        deniedShownRef.current = false;
        return;
      }

      // Denied case
      if (!alreadyRequested && !deniedShownRef.current) {
        deniedShownRef.current = true;
        Alert.alert(
          'Location Access Denied',
          'You can still use PickleRadar by searching for courts using a ZIP code.'
        );
      }
    } catch (error) {
      console.error('useLocation: Error requesting location:', error);

      // Avoid spamming error alerts on focus loops
      if (!deniedShownRef.current) {
        deniedShownRef.current = true;
        Alert.alert('Location Error', 'Unable to access location. You can still search by ZIP code.');
      }

      try {
        await updateUserProfile({ locationPermissionRequested: true });
      } catch (updateError) {
        console.error('useLocation: Error updating permission status:', updateError);
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [user, hasLocation, updateUserProfile]);

  const updateZipCode = useCallback(
    async (zipCode: string) => {
      if (!user) return { success: false, error: 'Not logged in' };

      try {
        const result = await geocodeZipCode(zipCode);

        if (result.success && result.latitude != null && result.longitude != null) {
          await updateUserProfile({
            zipCode,
            latitude: result.latitude,
            longitude: result.longitude,
          });
          return { success: true };
        }

        return { success: false, error: result.error || 'Invalid ZIP code' };
      } catch (error) {
        console.error('useLocation: Error updating ZIP code:', error);
        return { success: false, error: 'Failed to update ZIP code' };
      }
    },
    [user, updateUserProfile]
  );

  return {
    requestLocation,
    updateZipCode,
    requestingPermission,
    hasLocation,
    userLocation,
  };
};
