// app/_layout.tsx
import React, { useState, useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View, Linking } from "react-native";
import { logSupabaseEnvDiagnosticsOnce } from "@/utils/envDiagnostics";

export default function RootLayout() {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (__DEV__) logSupabaseEnvDiagnosticsOnce();
  }, []);

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const lower = url.toLowerCase();
      if (lower.includes('reset-password') || lower.includes('type=recovery')) {
        router.replace('/reset-password');
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => sub.remove();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </QueryClientProvider>
  );
}
