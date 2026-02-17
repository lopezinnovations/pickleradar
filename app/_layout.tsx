// app/_layout.tsx
import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/styles/commonStyles';

const AUTH_PATH = 'auth';
const RESET_PATH = 'reset-password';
const LEGAL_PATH = 'legal';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const first = segments?.[0]; // e.g. "auth" or "(tabs)" or "legal"
    const inAuth = first === AUTH_PATH;
    const inReset = first === RESET_PATH;
    const inLegal = first === LEGAL_PATH;
    const inTabs = first === '(tabs)';

    // Signed OUT: keep them on auth/reset/legal only
    if (!user) {
      if (!inAuth && !inReset && !inLegal) {
        router.replace('/auth' as any);
      }
      return;
    }

    // Signed IN: never show auth screen
    if (user && inAuth) {
      router.replace('/(tabs)/(home)/' as any);
      return;
    }

    // Signed IN but in some unknown route: shove to tabs
    if (user && !inTabs && !inLegal && !inReset) {
      router.replace('/(tabs)/(home)/' as any);
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}
