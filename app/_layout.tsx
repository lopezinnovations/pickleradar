// app/_layout.tsx
import React, { useState } from "react";
import { Slot } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View } from "react-native";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </QueryClientProvider>
  );
}
