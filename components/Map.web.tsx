// components/Map.web.tsx
import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
}

interface MapProps {
  markers?: MapMarker[];
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  style?: ViewStyle;
  showsUserLocation?: boolean;
}

export const Map = ({ style }: MapProps) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>Map not available on web.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    opacity: 0.6,
  },
});
