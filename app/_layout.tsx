// app/_layout.tsx
import React, { useState, useEffect } from "react";
import { Slot } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View } from "react-native";
import { logSupabaseEnvDiagnosticsOnce } from "@/utils/envDiagnostics";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (__DEV__) logSupabaseEnvDiagnosticsOnce();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </QueryClientProvider>
  );
}
