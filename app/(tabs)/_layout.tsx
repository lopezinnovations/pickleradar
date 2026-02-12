import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
  // Memoize tabs array with empty dependency array to prevent recreation
  const tabs: TabBarItem[] = useMemo(
    () => [
      {
        name: '(home)',
        // ✅ Map tab should open the actual map screen
        route: '/(tabs)/(home)/courts-map',
        icon: 'map',
        label: 'Map',
        iosIcon: 'map.fill',
      },
      {
        name: 'friends',
        route: '/(tabs)/friends',
        icon: 'people',
        label: 'Friends',
        iosIcon: 'person.2.fill',
      },
      {
        name: 'messages',
        route: '/(tabs)/messages',
        icon: 'mail',
        label: 'Messages',
        iosIcon: 'envelope.fill',
      },
      {
        name: 'profile',
        route: '/(tabs)/profile',
        icon: 'person',
        label: 'Profile',
        iosIcon: 'person.fill',
      },
    ],
    []
  );

  // Memoize screenOptions with empty dependency array
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: 'none' as const,
    }),
    []
  );

  return (
    <>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(home)" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
