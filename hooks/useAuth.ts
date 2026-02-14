import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Consumes auth state and actions from the single AuthProvider.
 * Auth state and onAuthStateChange subscription live in AuthProvider only.
 */
export function useAuth() {
  return useAuthContext();
}
