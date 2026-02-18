// hooks/useAuth.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client;

type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const isConfigured = useMemo(() => isSupabaseConfigured(), []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        if (!isSupabaseConfigured()) {
          if (!mounted) return;
          setUser(null);
          setLoading(false);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(data.session?.user ?? null);
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    init();

    if (!isSupabaseConfigured()) {
      return () => {
        mounted = false;
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      consentAccepted: boolean,
      firstName: string,
      lastName: string,
      pickleballerNickname: string,
      experienceLevel: ExperienceLevel,
      duprRating?: number
    ): Promise<{ success: boolean; message?: string }> => {
      if (!isSupabaseConfigured()) {
        return { success: false, message: 'Supabase not configured' };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              consentAccepted: !!consentAccepted,
              first_name: firstName,
              last_name: lastName,
              pickleballer_nickname: pickleballerNickname,
              experience_level: experienceLevel,
              dupr_rating: duprRating ?? null,
            },
          },
        });

        if (error) return { success: false, message: error.message };

        // Some configs require email confirmation; still a "success" here.
        return { success: true, message: data?.user ? 'Account created' : 'Check your email to confirm' };
      } catch (e: any) {
        return { success: false, message: e?.message || 'Sign up failed' };
      }
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase not configured' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, message: error.message };
      setUser(data.session?.user ?? null);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Sign in failed' };
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    // Clear UI immediately so button/state flips on web
    setUser(null);

    if (!isSupabaseConfigured()) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      // We still consider them logged out locally; throw so caller can toast/log if desired
      throw error;
    }
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    // KEY FIX: success is "no error"
    if (error) throw error;

    return true;
  }, []);

  return {
    user,
    loading,
    isConfigured,
    signUp,
    signIn,
    signOut,
    changePassword,
  };
}
