import { Stack, useRouter, usePathname, useFocusEffect } from 'expo-router';
import { useMemo, useCallback } from 'react';

export default function HomeLayout() {
  const router = useRouter();
  const pathname = usePathname();

  // Default to LIST view whenever Courts area gains focus (tab switch, back, initial load)
  useFocusEffect(
    useCallback(() => {
      if (pathname?.includes('courts-map')) {
        router.replace('/(tabs)/(home)/');
      }
    }, [pathname])
  );
  // Memoize screenOptions to prevent recreation on every render
  const screenOptions = useMemo(() => ({
    headerShown: false,
    animation: 'slide_from_right' as const,
  }), []); // Empty dependency array - options never change

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="court/[id]" />
      <Stack.Screen name="courts-map" />
    </Stack>
  );
}
