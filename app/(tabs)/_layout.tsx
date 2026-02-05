
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)/',
      icon: 'map',
      label: 'Map',
    },
    {
      name: 'friends',
      route: '/(tabs)/friends',
      icon: 'people',
      label: 'Friends',
      iosIcon: 'person.2.fill', // Explicitly set guaranteed SF Symbol for iOS
    },
    {
      name: 'messages',
      route: '/(tabs)/messages',
      icon: 'mail',
      label: 'Messages',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
      icon: 'person',
      label: 'Profile',
    },
  ];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="friends" name="friends" />
        <Stack.Screen key="messages" name="messages" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
