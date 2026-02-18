/**
 * Dev-only Supabase env diagnostics (web only). No secrets printed.
 */
import { Platform } from "react-native";

let _diagnosticsLogged = false;

export function logSupabaseEnvDiagnosticsOnce(): void {
  if (Platform.OS !== "web") return;
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;
  if (_diagnosticsLogged) return;
  _diagnosticsLogged = true;

  const urlPresent = !!(typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SUPABASE_URL);
  const anonPresent = !!(
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
  const source = urlPresent && anonPresent ? "env" : "extra";

  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "(n/a)";

  console.log("[envDiagnostics] Supabase env (dev/web):", {
    EXPO_PUBLIC_SUPABASE_URL: urlPresent,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonPresent,
    source,
    origin,
  });
}
