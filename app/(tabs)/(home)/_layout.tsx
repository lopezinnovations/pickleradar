import { Stack } from 'expo-router';
import { useMemo } from 'react';

export default function HomeLayout() {
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: 'slide_from_right' as const,
    }),
    []
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="court/[id]" />
      <Stack.Screen name="courts-map" />
    </Stack>
  );
}
