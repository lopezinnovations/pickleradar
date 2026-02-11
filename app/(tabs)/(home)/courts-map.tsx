
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Constants from 'expo-constants';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { Court } from '@/types';

// CRITICAL: Detect Expo Go BEFORE attempting any imports
const isExpoGo = Constants.appOwnership === 'expo';

// Conditional import - only attempt if NOT in Expo Go
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
let PROVIDER_GOOGLE: any = null;
let mapsAvailable = false;

if (!isExpoGo) {
  try {
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
  
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const courts = useMemo(() => {
    try {
      const courtsParam = params.courts;
      if (!courtsParam) {
        console.log('CourtsMapScreen: No courts parameter provided');
        return [];
      }
      
      const parsed = typeof courtsParam === 'string' ? JSON.parse(courtsParam) : courtsParam;
      const courtsArray = Array.isArray(parsed) ? parsed : [];
      console.log('CourtsMapScreen: Loaded courts:', courtsArray.length);
      return courtsArray;
    } catch (error) {
      console.error('CourtsMapScreen: Error parsing courts:', error);
      setHasError(true);
      setErrorMessage('Failed to load courts data');
      return [];
    }
  }, [params.courts]);

  const userLocation = useMemo(() => {
    try {
      const locationParam = params.userLocation;
      if (!locationParam) {
        console.log('CourtsMapScreen: No user location provided');
        return null;
      }
      
      const parsed = typeof locationParam === 'string' ? JSON.parse(locationParam) : locationParam;
      console.log('CourtsMapScreen: User location:', parsed);
      return parsed;
    } catch (error) {
      console.error('CourtsMapScreen: Error parsing user location:', error);
      return null;
    }
  }, [params.userLocation]);

  useEffect(() => {
    if (!mapsAvailable || !courts || courts.length === 0) {
      return;
    }

    if (!mapRef.current || !userLocation) {
      return;
    }

    try {
      const validCourts = courts.filter((court: Court) => 
        court.latitude && 
        court.longitude && 
        !isNaN(court.latitude) && 
        !isNaN(court.longitude)
      );

      if (validCourts.length === 0) {
        console.log('CourtsMapScreen: No valid courts with coordinates');
        return;
      }

      const coordinates = validCourts.map((court: Court) => ({
        latitude: court.latitude,
        longitude: court.longitude,
      }));

      if (userLocation.latitude && userLocation.longitude) {
        coordinates.push({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    } catch (error) {
      console.error('CourtsMapScreen: Error fitting map to coordinates:', error);
    }
  }, [courts, userLocation, mapsAvailable]);

  const handleMarkerPress = (court: Court) => {
    console.log('CourtsMapScreen: Marker pressed for court:', court.name);
  };

  const handleCalloutPress = (court: Court) => {
    console.log('CourtsMapScreen: Callout pressed for court:', court.name);
    router.push(`/court/${court.id}`);
  };

  const handleBackToList = () => {
    console.log('CourtsMapScreen: Back to list pressed');
    router.back();
  };

  const getMarkerColor = (activityLevel: 'low' | 'medium' | 'high') => {
    const colorMap = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
    };
    return colorMap[activityLevel] || colorMap.low;
  };

  // ERROR STATE
  if (hasError) {
    const errorTitle = 'Unable to Load Map';
    const backButtonText = 'Back to List View';
    
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ title: 'Map Error' }} />
        <IconSymbol
          ios_icon_name="exclamationmark.triangle"
          android_material_icon_name="error"
          size={64}
          color={colors.accent}
        />
        <Text style={styles.fallbackTitle}>{errorTitle}</Text>
        <Text style={styles.fallbackText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.fallbackButton} onPress={handleBackToList}>
          <Text style={styles.fallbackButtonText}>{backButtonText}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // EXPO GO OR MAPS NOT AVAILABLE
  if (isExpoGo || !mapsAvailable) {
    const fallbackTitle = 'Map View Not Available';
    const fallbackMessage1 = 'Map view isn\'t available in Expo Go. It requires native modules not included in the Expo Go app.';
    const fallbackMessage2 = 'To use the map, please run this app in an Expo Development Build (EAS dev client) or a production build.';
    const listViewButtonText = 'Use List View';
    const devInfoTitle = 'For developers:';
    const devInfoCommand = 'eas build --profile development --platform all';
    const devInfoCommand2 = 'Then open with: expo start --dev-client';
    
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ title: 'Map View Not Available' }} />
        <IconSymbol
          ios_icon_name="map"
          android_material_icon_name="map"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={styles.fallbackTitle}>{fallbackTitle}</Text>
        <Text style={styles.fallbackText}>{fallbackMessage1}</Text>
        <Text style={styles.fallbackText}>{fallbackMessage2}</Text>
        <TouchableOpacity style={styles.fallbackButton} onPress={handleBackToList}>
          <Text style={styles.fallbackButtonText}>{listViewButtonText}</Text>
        </TouchableOpacity>
        <View style={styles.devInfo}>
          <Text style={styles.devInfoText}>{devInfoTitle}</Text>
          <Text style={styles.devInfoCommand}>{devInfoCommand}</Text>
          <Text style={styles.devInfoCommand}>{devInfoCommand2}</Text>
        </View>
      </View>
    );
  }

  // NO COURTS
  if (!courts || courts.length === 0) {
    const noCourtsTitle = 'No Courts to Display';
    const noCourtsMessage = 'No courts match your current filters.';
    const backButtonText = 'Back to List View';
    
    return (
      <View style={styles.fallbackContainer}>
        <Stack.Screen options={{ title: 'No Courts' }} />
        <IconSymbol
          ios_icon_name="map"
          android_material_icon_name="map"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={styles.fallbackTitle}>{noCourtsTitle}</Text>
        <Text style={styles.fallbackText}>{noCourtsMessage}</Text>
        <TouchableOpacity style={styles.fallbackButton} onPress={handleBackToList}>
          <Text style={styles.fallbackButtonText}>{backButtonText}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // CALCULATE INITIAL REGION
  const initialRegion = userLocation && userLocation.latitude && userLocation.longitude
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }
    : courts[0] && courts[0].latitude && courts[0].longitude
    ? {
        latitude: courts[0].latitude,
        longitude: courts[0].longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  const listViewButtonText = 'List View';

  // RENDER MAP
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Courts Map' }} />
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {courts.map((court: Court) => {
          if (!court.latitude || !court.longitude || isNaN(court.latitude) || isNaN(court.longitude)) {
            return null;
          }

          const activityLevelText = court.activityLevel.charAt(0).toUpperCase() + court.activityLevel.slice(1);
          const playersText = court.currentPlayers === 1 ? 'player' : 'players';
          const playersCountText = `${court.currentPlayers} ${playersText} checked in`;

          return (
            <Marker
              key={court.id}
              coordinate={{
                latitude: court.latitude,
                longitude: court.longitude,
              }}
              pinColor={getMarkerColor(court.activityLevel)}
              onPress={() => handleMarkerPress(court)}
            >
              <Callout onPress={() => handleCalloutPress(court)}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{court.name}</Text>
                  <Text style={styles.calloutText}>{court.address}</Text>
                  <Text style={styles.calloutText}>Activity: {activityLevelText}</Text>
                  {court.currentPlayers > 0 && (
                    <Text style={styles.calloutText}>{playersCountText}</Text>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <TouchableOpacity style={styles.backButton} onPress={handleBackToList}>
        <IconSymbol
          ios_icon_name="list.bullet"
          android_material_icon_name="list"
          size={20}
          color={colors.card}
        />
        <Text style={styles.backButtonText}>{listViewButtonText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
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
  devInfo: {
    marginTop: 40,
    padding: 16,
    backgroundColor: colors.highlight,
    borderRadius: 12,
    width: '100%',
  },
  devInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  devInfoCommand: {
    fontSize: 11,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  backButton: {
    position: 'absolute',
    bottom: 24,
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  calloutContainer: {
    padding: 10,
    minWidth: 200,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.text,
  },
  calloutText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
