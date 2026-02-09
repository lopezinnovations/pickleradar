
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Create QueryClient OUTSIDE component to prevent recreation on every render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - data is fresh for 30s
      gcTime: 600000, // 10 minutes - keep unused data in cache for 10min
      refetchOnFocus: false, // Don't refetch when tab regains focus
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 1, // Only retry failed queries once
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen name="group-conversation/[id]" />
        <Stack.Screen name="group-info/[id]" />
        <Stack.Screen name="create-group" />
        <Stack.Screen name="add-group-members/[id]" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="auth-migration-notice" />
        <Stack.Screen name="legal/privacy-policy" />
        <Stack.Screen name="legal/terms-of-service" />
        <Stack.Screen name="legal/disclaimer" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </QueryClientProvider>
  );
}
