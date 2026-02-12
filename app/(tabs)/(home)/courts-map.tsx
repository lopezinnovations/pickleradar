import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { Court } from '@/types';

import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useCourtsQuery } from '@/hooks/useCourtsQuery';

const RADIUS_MILES = 25;

// Detect Expo Go BEFORE attempting any imports
const isExpoGo = Constants.appOwnership === 'expo';

// Conditional import - only attempt if NOT in Expo Go
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
let PROVIDER_GOOGLE: any = null;
let mapsAvailable = false;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Callout = maps.Callout;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
    mapsAvailable = true;
    console.log('CourtsMapScreen: react-native-maps loaded successfully');
  } catch (e) {
    console.warn('CourtsMapScreen: Failed to load react-native-maps:', e);
    mapsAvailable = false;
  }
} else {
  console.log('CourtsMapScreen: Running in Expo Go, maps not available');
}

export default function CourtsMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Hook fallbacks (if screen opened without params)
  const { user } = useAuth();
  const { userLocation: hookUserLocation } = useLocation();
  const { courts: hookCourts, loading: courtsLoading } = useCourtsQuery(
    user?.id,
    hookUserLocation?.latitude,
    hookUserLocation?.longitude,
    RADIUS_MILES
  );

  // Prefer params if passed, else use hook data
  const courts: Court[] = useMemo(() => {
    try {
      const courtsParam: any = (params as any).courts;
      if (courtsParam) {
        const parsed = typeof courtsParam === 'string' ? JSON.parse(courtsParam) : courtsParam;
        const courtsArray = Array.isArray(parsed) ? parsed : [];
        console.log('CourtsMapScreen: Loaded courts from params:', courtsArray.length);
        return courtsArray;
      }
    } catch (error) {
      console.error('CourtsMapScreen: Error parsing courts params:', error);
      setHasError(true);
      setErrorMessage('Failed to load courts data');
      return [];
    }

    return (hookCourts ?? []) as Court[];
  }, [params, hookCourts]);

  const userLocation = useMemo(() => {
    try {
      const locationParam: any = (params as any).userLocation;
      if (locationParam) {
        const parsed = typeof locationParam === 'string' ? JSON.parse(locationParam) : locationParam;
        console.log('CourtsMapScreen: User location from params:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('CourtsMapScreen: Error parsing user location params:', error);
    }

    return hookUserLocation ?? null;
  }, [params, hookUserLocation]);

  useEffect(() => {
    if (!mapsAvailable || !courts || courts.length === 0) return;
    if (!mapRef.current || !userLocation) return;

    try {
      const validCourts = courts.filter(
        (court: Court) =>
          court.latitude &&
          court.longitude &&
          !isNaN(court.latitude as any) &&
          !isNaN(court.longitude as any)
      );

      if (validCourts.length === 0) return;

      const coordinates = validCourts.map((court: Court) => ({
        latitude: court.latitude,
        longitude: court.longitude,
      }));

      if (userLocation?.latitude && userLocation?.longitude) {
        coordinates.push({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    } catch (error) {
      console.error('CourtsMapScreen: Error fitting map to coordinates:', error);
    }
  }, [courts, userLocation]);

  const handleCalloutPress = (court: Court) => {
    router.push(`/(tabs)/(home)/court/${court.id}`);
  };

  const handleBackToList = () => {
    router.replace('/(tabs)/(home)/'); // ✅ Always return to list view
  };

  const getMarkerColor = (activityLevel: 'low' | 'medium' | 'high') => {
    const colorMap = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
    };
    return (colorMap as any)[activityLevel] || colorMap.low;
  };

  // ERROR STATE
  if (hasError) {
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ title: 'Map Error' }} />
        <IconSymbol ios_icon_name="exclamationmark.triangle" android_material_icon_name="error" size={64} color={colors.accent} />
        <Text style={styles.fallbackTitle}>Unable to Load Map</Text>
        <Text style={styles.fallbackText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.fallbackButton} onPress={handleBackToList}>
          <Text style={styles.fallbackButtonText}>Back to List View</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // EXPO GO OR MAPS NOT AVAILABLE
  if (isExpoGo || !mapsAvailable) {
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ title: 'Map View Not Available' }} />
        <IconSymbol ios_icon_name="map" android_material_icon_name="map" size={64} color={colors.textSecondary} />
        <Text style={styles.fallbackTitle}>Map View Not Available</Text>
        <Text style={styles.fallbackText}>
          Map view isn&apos;t available in Expo Go. It requires native modules not included in the Expo Go app.
        </Text>
        <Text style={styles.fallbackText}>
          To use the map, please run this app in an Expo Development Build (EAS dev client) or a production build.
        </Text>
        <TouchableOpacity style={styles.fallbackButton} onPress={handleBackToList}>
          <Text style={styles.fallbackButtonText}>Use List View</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // LOADING COURTS
  if (courtsLoading) {
    return (
      <View style={styles.fallbackContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.fallbackText, { marginTop: 12 }]}>Loading map...</Text>
      </View>
    );
  }

  // NO COURTS
  if (!courts || courts.length === 0) {
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ title: 'No Courts' }} />
        <IconSymbol ios_icon_name="map" android_material_icon_name="map" size={64} color={colors.textSecondary} />
        <Text style={styles.fallbackTitle}>No Courts to Display</Text>
        <Text style={styles.fallbackText}>No courts match your current filters.</Text>
        <TouchableOpacity style={styles.fallbackButton} onPress={handleBackToList}>
          <Text style={styles.fallbackButtonText}>Back to List View</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // CALCULATE INITIAL REGION
  const initialRegion =
    userLocation?.latitude && userLocation?.longitude
      ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.12,
          longitudeDelta: 0.08,
        }
      : courts[0]?.latitude && courts[0]?.longitude
      ? {
          latitude: courts[0].latitude,
          longitude: courts[0].longitude,
          latitudeDelta: 0.12,
          longitudeDelta: 0.08,
        }
      : {
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.12,
          longitudeDelta: 0.08,
        };

  // ✅ iOS fix: do NOT force Google provider unless Android
  const providerProp = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Courts Map' }} />

      <MapView
        ref={mapRef}
        provider={providerProp}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {courts.map((court: Court) => {
          if (!court.latitude || !court.longitude || isNaN(court.latitude as any) || isNaN(court.longitude as any)) {
            return null;
          }

          const activityLevelText = court.activityLevel
            ? court.activityLevel.charAt(0).toUpperCase() + court.activityLevel.slice(1)
            : 'Low';

          return (
            <Marker
              key={court.id}
              coordinate={{ latitude: court.latitude, longitude: court.longitude }}
              pinColor={getMarkerColor(court.activityLevel)}
            >
              <Callout onPress={() => handleCalloutPress(court)}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{court.name}</Text>
                  {!!court.address && <Text style={styles.calloutText}>{court.address}</Text>}
                  <Text style={styles.calloutText}>Activity: {activityLevelText}</Text>
                  {typeof court.currentPlayers === 'number' && court.currentPlayers > 0 && (
                    <Text style={styles.calloutText}>
                      {court.currentPlayers} {court.currentPlayers === 1 ? 'player' : 'players'} checked in
                    </Text>
                  )}
                  <Text style={[styles.calloutText, { marginTop: 6, fontWeight: '600' }]}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* ✅ Button sits ABOVE floating tab bar */}
      <TouchableOpacity
        style={[styles.listButton, { bottom: insets.bottom + 92 }]}
        onPress={handleBackToList}
        activeOpacity={0.85}
      >
        <IconSymbol ios_icon_name="list.bullet" android_material_icon_name="list" size={20} color={colors.card} />
        <Text style={styles.listButtonText}>List View</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 10,
    color: colors.text,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: colors.textSecondary,
    paddingHorizontal: 20,
  },
  fallbackButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  fallbackButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },

  listButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
  },
  listButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  calloutContainer: { padding: 10, minWidth: 220 },
  calloutTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4, color: colors.text },
  calloutText: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
});
