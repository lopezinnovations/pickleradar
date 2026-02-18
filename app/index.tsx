// app/index.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { supabase, isSupabaseConfigured } from "@/app/integrations/supabase/client";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        // No env vars? Don't crash; go to welcome.
        if (!isSupabaseConfigured() || !supabase) {
          setAuthed(false);
          return;
        }

        const { data, error: e } = await supabase.auth.getSession();
        if (e) {
          setAuthed(false);
          return;
        }

        setAuthed(!!data.session?.user);
      } catch (err: any) {
        setError(err?.message ?? "Failed to initialize app");
        setAuthed(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: colors.error, textAlign: "center" }}>{error}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return authed ? <Redirect href="/(tabs)/(home)/" /> : <Redirect href="/welcome" />;
}
