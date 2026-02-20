// hooks/useAuth.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

type AcceptConsentResult = { success: true } | { success: false; error?: string };

const LATEST_ACCEPTED_VERSION = '1';

const USERS_TABLE = 'users';
const AVATAR_BUCKET = 'avatars';

type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  pickleballerNickname?: string;
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  duprRating?: number;
  privacyOptIn?: boolean;
  locationEnabled?: boolean;
  friendVisibility?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  zipCode?: string | null;
  locationPermissionRequested?: boolean;
  notificationPromptShown?: boolean;
  notificationsEnabled?: boolean;
  isDeleted?: boolean;
};

function mergeUser(authUser: any, profileRow: any) {
  if (!authUser && !profileRow) return null;
  const base = authUser ? { ...authUser } : {};
  const profile = profileRow ? { ...profileRow } : {};
  return {
    ...base,
    ...profile,
    firstName: profile.first_name ?? base.firstName,
    lastName: profile.last_name ?? base.lastName,
    pickleballerNickname: profile.pickleballer_nickname ?? base.pickleballerNickname,
    experienceLevel: profile.experience_level ?? base.experienceLevel,
    skillLevel: profile.skill_level ?? base.skillLevel,
    duprRating: profile.dupr_rating ?? base.duprRating,
    privacyOptIn: profile.privacy_opt_in ?? base.privacyOptIn,
    locationEnabled: profile.location_enabled ?? base.locationEnabled,
    friendVisibility: profile.friend_visibility ?? base.friendVisibility ?? true,
    profilePictureUrl: profile.profile_picture_url ?? base.profilePictureUrl,
    notificationsEnabled: profile.notifications_enabled ?? base.notificationsEnabled,
    latitude: profile.latitude ?? base.latitude,
    longitude: profile.longitude ?? base.longitude,
    zipCode: profile.zip_code ?? base.zipCode,
    locationPermissionRequested:
      profile.location_permission_requested ?? base.locationPermissionRequested,
    termsAccepted: profile.terms_accepted ?? base.termsAccepted,
    privacyAccepted: profile.privacy_accepted ?? base.privacyAccepted,
    acceptedAt: profile.accepted_at ?? base.acceptedAt,
    acceptedVersion: profile.accepted_version ?? base.acceptedVersion,
    isDeleted: profile.is_deleted ?? base.isDeleted,
  };
}

export function useAuth() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const inflightRef = useRef<Promise<any> | null>(null);

  const fetchProfileRow = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select(
        'id, email, phone, first_name, last_name, pickleballer_nickname, experience_level, skill_level, dupr_rating, privacy_opt_in, location_enabled, friend_visibility, profile_picture_url, notifications_enabled, notification_prompt_shown, terms_accepted, privacy_accepted, accepted_at, accepted_version, latitude, longitude, zip_code, location_permission_requested, is_deleted, updated_at'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[useAuth] fetchProfileRow error:', error.message);
      return null;
    }
    return data ?? null;
  }, []);

  const refetchUser = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return null;
    if (inflightRef.current) return inflightRef.current;

    inflightRef.current = (async () => {
      try {
        const { data: userResp, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const authUser = userResp?.user ?? null;
        if (!authUser?.id) {
          setUser(null);
          return null;
        }
        const profileRow = await fetchProfileRow(authUser.id);
        if ((profileRow as any)?.is_deleted) {
          setUser(null);
          return null;
        }
        const merged = mergeUser(authUser, profileRow);
        setUser(merged);
        return merged;
      } catch (e: any) {
        console.warn('[useAuth] refetchUser error:', e?.message ?? e);
        return null;
      } finally {
        inflightRef.current = null;
        setAuthLoading(false);
      }
    })();
    return inflightRef.current;
  }, [fetchProfileRow]);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured() || !client) {
      setAuthLoading(false);
      setUser(null);
      return;
    }
    let mounted = true;

    const init = async () => {
      setAuthLoading(true);
      const { data: userResp, error: userErr } = await client.auth.getUser();
      if (userErr || !userResp?.user?.id) {
        if (mounted) setUser(null);
        setAuthLoading(false);
        return;
      }
      const row = await fetchProfileRow(userResp.user.id);
      if (!mounted) return;
      if ((row as any)?.is_deleted) {
        setUser(null);
        setAuthLoading(false);
        return;
      }
      setUser(mergeUser(userResp.user, row));
      setAuthLoading(false);
    };

    init();

    const { data: sub } = client.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        const authUser = session?.user ?? null;
        if (!authUser?.id) {
          setUser(null);
          setAuthLoading(false);
          return;
        }
        const profileRow = await fetchProfileRow(authUser.id);
        if (!mounted) return;
        if ((profileRow as any)?.is_deleted) {
          setUser(null);
          setAuthLoading(false);
          return;
        }
        setUser(mergeUser(authUser, profileRow));
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [fetchProfileRow]);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateUserProfile = useCallback(
    async (input: UpdateUserProfileInput) => {
      if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
      if (!user?.id) throw new Error('Not signed in.');

      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (input.firstName !== undefined) payload.first_name = input.firstName.trim() || null;
      if (input.lastName !== undefined) payload.last_name = input.lastName.trim() || null;
      if (input.pickleballerNickname !== undefined)
        payload.pickleballer_nickname = input.pickleballerNickname.trim() || null;
      if (input.experienceLevel !== undefined) {
        payload.experience_level = input.experienceLevel || null;
        payload.skill_level = input.experienceLevel || null;
      }
      if (input.duprRating !== undefined)
        payload.dupr_rating = typeof input.duprRating === 'number' ? input.duprRating : null;
      if (input.privacyOptIn !== undefined) payload.privacy_opt_in = input.privacyOptIn;
      if (input.locationEnabled !== undefined) payload.location_enabled = input.locationEnabled;
      if (input.friendVisibility !== undefined) payload.friend_visibility = input.friendVisibility;
      if (input.latitude !== undefined) payload.latitude = input.latitude;
      if (input.longitude !== undefined) payload.longitude = input.longitude;
      if (input.zipCode !== undefined) payload.zip_code = input.zipCode;
      if (input.locationPermissionRequested !== undefined)
        payload.location_permission_requested = input.locationPermissionRequested;
      if (input.notificationPromptShown !== undefined)
        payload.notification_prompt_shown = input.notificationPromptShown;
      if (input.notificationsEnabled !== undefined)
        payload.notifications_enabled = input.notificationsEnabled;
      if (input.isDeleted !== undefined) payload.is_deleted = input.isDeleted;

      if (Object.keys(payload).length === 1) return;

      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined)
      ) as Record<string, unknown>;

      const { error } = await supabase
        .from(USERS_TABLE)
        .update(clean)
        .eq('id', user.id);

      if (error) throw error;
      await refetchUser();
    },
    [user?.id, refetchUser]
  );

  const uploadProfilePicture = useCallback(
    async (uri: string): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!isSupabaseConfigured() || !supabase)
          return { success: false, error: 'Supabase is not configured.' };
        if (!user?.id) return { success: false, error: 'Not signed in.' };

        const res = await fetch(uri);
        const blob = await res.blob();
        const ext = 'jpg';
        const filePath = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(filePath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (uploadErr) return { success: false, error: uploadErr.message };

        const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) return { success: false, error: 'Failed to get public URL.' };

        const { error: updateErr } = await supabase
          .from(USERS_TABLE)
          .update({ profile_picture_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (updateErr) return { success: false, error: updateErr.message };

        await refetchUser();
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message ?? 'Upload failed' };
      }
    },
    [user?.id, refetchUser]
  );

  const needsConsentUpdate = useCallback(() => {
    const termsAcceptedRaw = (user as any)?.termsAccepted ?? (user as any)?.terms_accepted ?? null;
    const privacyAcceptedRaw =
      (user as any)?.privacyAccepted ?? (user as any)?.privacy_accepted ?? null;
    const termsAccepted = termsAcceptedRaw === true;
    const privacyAccepted = privacyAcceptedRaw === true;
    const rawVersion = (user as any)?.acceptedVersion ?? (user as any)?.accepted_version ?? null;
    const acceptedVersion = rawVersion != null ? String(rawVersion).trim() : '';
    if (!termsAccepted || !privacyAccepted) return true;
    if (acceptedVersion !== String(LATEST_ACCEPTED_VERSION).trim()) return true;
    return false;
  }, [user]);

  const acceptConsent = useCallback(async (): Promise<AcceptConsentResult> => {
    try {
      if (!isSupabaseConfigured() || !supabase)
        return { success: false, error: 'Supabase is not configured.' };
      if (!user?.id) return { success: false, error: 'Not signed in.' };

      const payload = {
        terms_accepted: true,
        privacy_accepted: true,
        accepted_at: new Date().toISOString(),
        accepted_version: LATEST_ACCEPTED_VERSION,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(USERS_TABLE).update(payload).eq('id', user.id);
      if (error) return { success: false, error: error.message };

      setUser((prev: any) =>
        prev
          ? {
              ...prev,
              terms_accepted: true,
              privacy_accepted: true,
              accepted_at: payload.accepted_at,
              accepted_version: LATEST_ACCEPTED_VERSION,
            }
          : null
      );
      await refetchUser();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message ?? 'Failed to accept consent' };
    }
  }, [user?.id, refetchUser]);

  const isConfigured = isSupabaseConfigured();

  return useMemo(
    () => ({
      user,
      authLoading,
      isConfigured,
      signOut,
      updateUserProfile,
      uploadProfilePicture,
      needsConsentUpdate,
      acceptConsent,
      refetchUser,
    }),
    [
      user,
      authLoading,
      isConfigured,
      signOut,
      updateUserProfile,
      uploadProfilePicture,
      needsConsentUpdate,
      acceptConsent,
      refetchUser,
    ]
  );
}
