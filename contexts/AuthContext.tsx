import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/supabase/client';
import { User } from '@/types';
import { registerPushToken } from '@/utils/notifications';

const CURRENT_TERMS_VERSION = 'v1.0';

// Single source of truth: one subscription, one state tree
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  authLoading: boolean;
  isConfigured: boolean;
  signUp: (
    email: string,
    password: string,
    consentAccepted: boolean,
    firstName?: string,
    lastName?: string,
    pickleballerNickname?: string,
    experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced',
    duprRating?: number
  ) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
    email?: string;
    requiresEmailConfirmation?: boolean;
  }>;
  signIn: (email: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  uploadProfilePicture: (uri: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  needsConsentUpdate: () => boolean;
  acceptConsent: () => Promise<{ success: boolean; error?: string }>;
  refetchUser: () => Promise<void>;
  currentTermsVersion: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapDbUserToUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    email: data.email as string | undefined,
    phone: data.phone as string | undefined,
    firstName: data.first_name as string | undefined,
    lastName: data.last_name as string | undefined,
    pickleballerNickname: data.pickleballer_nickname as string | undefined,
    skillLevel: data.skill_level as User['skillLevel'],
    experienceLevel: data.experience_level as User['experienceLevel'],
    privacyOptIn: !!data.privacy_opt_in,
    notificationsEnabled: !!data.notifications_enabled,
    locationEnabled: !!data.location_enabled,
    friendVisibility: data.friend_visibility !== false,
    latitude: data.latitude as number | undefined,
    longitude: data.longitude as number | undefined,
    zipCode: data.zip_code as string | undefined,
    duprRating: data.dupr_rating as number | undefined,
    locationPermissionRequested: !!data.location_permission_requested,
    profilePictureUrl: data.profile_picture_url as string | undefined,
    termsAccepted: !!data.terms_accepted,
    privacyAccepted: !!data.privacy_accepted,
    acceptedAt: data.accepted_at as string | undefined,
    acceptedVersion: data.accepted_version as string | undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  const fetchUserProfile = useCallback(async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert([
              {
                id: userId,
                email: email || null,
                phone: null,
                privacy_opt_in: false,
                notifications_enabled: false,
                location_enabled: false,
                location_permission_requested: false,
                terms_accepted: false,
                privacy_accepted: false,
              },
            ])
            .select()
            .single();

          if (createError) {
            console.warn('[AuthProvider] Error creating user profile:', createError.message);
            throw createError;
          }

          setUser(mapDbUserToUser(newProfile as Record<string, unknown>));
        } else {
          throw error;
        }
      } else {
        setUser(mapDbUserToUser(data as Record<string, unknown>));
      }

      registerPushToken(userId).catch((err) => {
        console.warn('[AuthProvider] Error registering push token:', err);
      });
    } catch (err) {
      console.warn('[AuthProvider] Error in fetchUserProfile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('[AuthProvider] Error getting session:', error.message);
          setLoading(false);
          return;
        }

        if (session?.user?.email) {
          await fetchUserProfile(session.user.id, session.user.email);
        } else if (session?.user && !session.user.email) {
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore
          }
          setUser(null);
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.warn('[AuthProvider] Error in initAuth:', err);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
          return;
        }

        if (session?.user?.email) {
          await fetchUserProfile(session.user.id, session.user.email);
        } else if (session?.user) {
          setUser(null);
          setLoading(false);
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[AuthProvider] Error in auth state change:', err);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      consentAccepted: boolean = false,
      firstName?: string,
      lastName?: string,
      pickleballerNickname?: string,
      experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced',
      duprRating?: number
    ) => {
      try {
        if (!consentAccepted) {
          return {
            success: false,
            error: 'Consent required',
            message: 'You must accept the Privacy Policy and Terms of Service to continue.',
          };
        }

        if (duprRating !== undefined && (duprRating < 1 || duprRating > 7)) {
          return {
            success: false,
            error: 'Invalid DUPR rating',
            message: 'DUPR rating must be between 1.0 and 7.0',
          };
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              terms_accepted: true,
              privacy_accepted: true,
              accepted_at: new Date().toISOString(),
              accepted_version: CURRENT_TERMS_VERSION,
            },
          },
        });

        if (error) {
          if (error.message.toLowerCase().includes('already registered')) {
            return {
              success: false,
              error: error.message,
              message: 'This email is already registered. Please sign in instead.',
            };
          }

          if (
            (error.message.includes('Error sending confirmation email') ||
              error.message.includes('authentication failed') ||
              error.status === 500) &&
            data?.user
          ) {
            const now = new Date().toISOString();
            await supabase.from('users').upsert(
              [
                {
                  id: data.user.id,
                  email: data.user.email || email,
                  phone: null,
                  first_name: firstName || null,
                  last_name: lastName || null,
                  pickleballer_nickname: pickleballerNickname || null,
                  experience_level: experienceLevel || null,
                  dupr_rating: duprRating || null,
                  privacy_opt_in: false,
                  notifications_enabled: false,
                  location_enabled: false,
                  location_permission_requested: false,
                  terms_accepted: true,
                  privacy_accepted: true,
                  accepted_at: now,
                  accepted_version: CURRENT_TERMS_VERSION,
                },
              ],
              { onConflict: 'id' }
            );
            return {
              success: true,
              error: null,
              message: 'Account created successfully! You can now sign in.',
              email,
              requiresEmailConfirmation: false,
            };
          }
          throw error;
        }

        if (data.user) {
          const now = new Date().toISOString();
          await supabase.from('users').upsert(
            [
              {
                id: data.user.id,
                email: data.user.email || email,
                phone: null,
                first_name: firstName || null,
                last_name: lastName || null,
                pickleballer_nickname: pickleballerNickname || null,
                experience_level: experienceLevel || null,
                dupr_rating: duprRating || null,
                privacy_opt_in: false,
                notifications_enabled: false,
                location_enabled: false,
                location_permission_requested: false,
                terms_accepted: true,
                privacy_accepted: true,
                accepted_at: now,
                accepted_version: CURRENT_TERMS_VERSION,
              },
            ],
            { onConflict: 'id' }
          );
        }

        return {
          success: true,
          error: null,
          message: 'Account created successfully! You can now sign in.',
          email,
          requiresEmailConfirmation: false,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
        return { success: false, error: msg, message: msg };
      }
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return {
          success: false,
          error: error.message,
          message: 'Incorrect email or password. Please try again.',
        };
      }

      if (data.user && data.session) {
        return { success: true, error: null, message: 'Sign in successful' };
      }

      return {
        success: false,
        error: 'Sign in failed',
        message: 'Incorrect email or password. Please try again.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: 'Sign in failed',
        message: 'Incorrect email or password. Please try again.',
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthProvider] Sign out error:', err);
    } finally {
      setUser(null);
    }
  }, []);

  const updateUserProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!user) return;

      const dbUpdates: Record<string, unknown> = {};
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.pickleballerNickname !== undefined) dbUpdates.pickleballer_nickname = updates.pickleballerNickname;
      if (updates.skillLevel !== undefined) dbUpdates.skill_level = updates.skillLevel;
      if (updates.experienceLevel !== undefined) dbUpdates.experience_level = updates.experienceLevel;
      if (updates.privacyOptIn !== undefined) dbUpdates.privacy_opt_in = updates.privacyOptIn;
      if (updates.notificationsEnabled !== undefined) dbUpdates.notifications_enabled = updates.notificationsEnabled;
      if (updates.locationEnabled !== undefined) dbUpdates.location_enabled = updates.locationEnabled;
      if (updates.friendVisibility !== undefined) dbUpdates.friend_visibility = updates.friendVisibility;
      if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
      if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
      if (updates.zipCode !== undefined) dbUpdates.zip_code = updates.zipCode;
      if (updates.duprRating !== undefined) {
        if (updates.duprRating !== null && (updates.duprRating < 1 || updates.duprRating > 7)) {
          throw new Error('DUPR rating must be between 1.0 and 7.0');
        }
        dbUpdates.dupr_rating = updates.duprRating;
      }
      if (updates.locationPermissionRequested !== undefined)
        dbUpdates.location_permission_requested = updates.locationPermissionRequested;
      if (updates.profilePictureUrl !== undefined) dbUpdates.profile_picture_url = updates.profilePictureUrl;
      if (updates.termsAccepted !== undefined) dbUpdates.terms_accepted = updates.termsAccepted;
      if (updates.privacyAccepted !== undefined) dbUpdates.privacy_accepted = updates.privacyAccepted;
      if (updates.acceptedAt !== undefined) dbUpdates.accepted_at = updates.acceptedAt;
      if (updates.acceptedVersion !== undefined) dbUpdates.accepted_version = updates.acceptedVersion;

      if (Object.keys(dbUpdates).length === 0) return;

      const { error } = await supabase.from('users').update(dbUpdates).eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, ...updates });
    },
    [user]
  );

  const uploadProfilePicture = useCallback(
    async (uri: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      if (!user) return { success: false, error: 'No user logged in' };

      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileExt = uri.split('.').pop() || 'jpg';
        const fileName = `${user.id}/profile.${fileExt}`;

        const { error } = await supabase.storage
          .from('profile-pictures')
          .upload(fileName, blob, { contentType: `image/${fileExt}`, upsert: true });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName);
        await updateUserProfile({ profilePictureUrl: publicUrl });
        return { success: true, url: publicUrl };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to upload profile picture';
        return { success: false, error: msg };
      }
    },
    [user, updateUserProfile]
  );

  const deleteAccount = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'No user logged in' };

    try {
      const { error: deleteError } = await supabase.from('users').delete().eq('id', user.id);
      if (deleteError) throw deleteError;
      await signOut();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account';
      return { success: false, error: msg };
    }
  }, [user, signOut]);

  const needsConsentUpdate = useCallback((): boolean => {
    if (!user) return false;
    if (!user.termsAccepted || !user.privacyAccepted) return true;
    if (user.acceptedVersion !== CURRENT_TERMS_VERSION) return true;
    return false;
  }, [user]);

  const acceptConsent = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'No user logged in' };

    try {
      const now = new Date().toISOString();
      await updateUserProfile({
        termsAccepted: true,
        privacyAccepted: true,
        acceptedAt: now,
        acceptedVersion: CURRENT_TERMS_VERSION,
      });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update consent';
      return { success: false, error: msg };
    }
  }, [user, updateUserProfile]);

  const refetchUser = useCallback(async () => {
    if (!user?.email) return;
    await fetchUserProfile(user.id, user.email);
  }, [user, fetchUserProfile]);

  const value: AuthContextValue = {
    user,
    loading,
    authLoading: loading,
    isConfigured,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
    uploadProfilePicture,
    deleteAccount,
    needsConsentUpdate,
    acceptConsent,
    refetchUser,
    currentTermsVersion: CURRENT_TERMS_VERSION,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}
