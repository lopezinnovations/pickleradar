// hooks/useAuth.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

type AcceptConsentResult = { success: true } | { success: false; error?: string };

type UpdateUserProfileInput = {
  firstName: string;
  lastName: string;
  pickleballerNickname?: string;
  // You have both skill_level and experience_level; Profile uses experienceLevel
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  duprRating?: number;
  privacyOptIn?: boolean;
  locationEnabled?: boolean;
  friendVisibility?: boolean;
};

const USERS_TABLE = 'users';

// If your bucket name differs, change this:
const AVATAR_BUCKET = 'avatars';

// If you version your legal/consent texts, put the current version here:
const LATEST_ACCEPTED_VERSION = '1';

function mergeUser(authUser: any, profileRow: any) {
  if (!authUser && !profileRow) return null;

  const base = authUser ? { ...authUser } : {};
  const profile = profileRow ? { ...profileRow } : {};

  // Provide camelCase aliases used by UI (non-breaking)
  return {
    ...base,
    ...profile,

    firstName: profile.first_name ?? profile.firstName ?? base.firstName,
    lastName: profile.last_name ?? profile.lastName ?? base.lastName,
    pickleballerNickname: profile.pickleballer_nickname ?? profile.pickleballerNickname ?? base.pickleballerNickname,

    experienceLevel: profile.experience_level ?? profile.experienceLevel ?? base.experienceLevel,
    skillLevel: profile.skill_level ?? profile.skillLevel ?? base.skillLevel,

    duprRating: profile.dupr_rating ?? profile.duprRating ?? base.duprRating,
    privacyOptIn: profile.privacy_opt_in ?? profile.privacyOptIn ?? base.privacyOptIn,
    locationEnabled: profile.location_enabled ?? profile.locationEnabled ?? base.locationEnabled,
    friendVisibility: profile.friend_visibility ?? profile.friendVisibility ?? base.friendVisibility,

    profilePictureUrl: profile.profile_picture_url ?? profile.profilePictureUrl ?? base.profilePictureUrl,

    // Consent/acceptance fields that match your schema
    termsAccepted: profile.terms_accepted ?? profile.termsAccepted ?? base.termsAccepted,
    privacyAccepted: profile.privacy_accepted ?? profile.privacyAccepted ?? base.privacyAccepted,
    acceptedAt: profile.accepted_at ?? profile.acceptedAt ?? base.acceptedAt,
    acceptedVersion: profile.accepted_version ?? profile.acceptedVersion ?? base.acceptedVersion,
  };
}

export function useAuth() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // coalesce concurrent refetches
  const inflightRef = useRef<Promise<any> | null>(null);

  const fetchProfileRow = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select(
        `
        id,
        email,
        phone,
        first_name,
        last_name,
        pickleballer_nickname,
        experience_level,
        skill_level,
        dupr_rating,
        privacy_opt_in,
        location_enabled,
        friend_visibility,
        profile_picture_url,
        notifications_enabled,
        notification_prompt_shown,
        push_token,
        is_super_admin,
        terms_accepted,
        privacy_accepted,
        accepted_at,
        accepted_version,
        is_deleted,
        updated_at
      `
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
    if (!isSupabaseConfigured()) return null;

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

        // Optional: if soft-deleted, treat as signed out
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
    let mounted = true;

    const init = async () => {
      if (!isSupabaseConfigured()) {
        if (mounted) {
          setAuthLoading(false);
          setUser(null);
        }
        return;
      }

      setAuthLoading(true);
      await refetchUser();

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;

        const authUser = session?.user ?? null;
        if (!authUser?.id) {
          setUser(null);
          setAuthLoading(false);
          return;
        }

        const profileRow = await fetchProfileRow(authUser.id);

        if ((profileRow as any)?.is_deleted) {
          setUser(null);
          setAuthLoading(false);
          return;
        }

        setUser(mergeUser(authUser, profileRow));
        setAuthLoading(false);
      });

      return () => {
        sub?.subscription?.unsubscribe();
      };
    };

    let cleanup: (() => void) | undefined;
    init().then((c) => {
      cleanup = c as any;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [fetchProfileRow, refetchUser]);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateUserProfile = useCallback(
    async (input: UpdateUserProfileInput) => {
      if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
      if (!user?.id) throw new Error('Not signed in.');

      const payload: any = {
        first_name: input.firstName,
        last_name: input.lastName,
        pickleballer_nickname: input.pickleballerNickname ?? null,

        // Keep your canonical field as experience_level; also mirror to skill_level if you want
        experience_level: input.experienceLevel ?? null,
        skill_level: input.experienceLevel ?? null,

        dupr_rating: typeof input.duprRating === 'number' ? input.duprRating : null,
        privacy_opt_in: typeof input.privacyOptIn === 'boolean' ? input.privacyOptIn : null,
        location_enabled: typeof input.locationEnabled === 'boolean' ? input.locationEnabled : null,
        friend_visibility: typeof input.friendVisibility === 'boolean' ? input.friendVisibility : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(USERS_TABLE).update(payload).eq('id', user.id);
      if (error) throw error;

      await refetchUser();
    },
    [user?.id, refetchUser]
  );

  const uploadProfilePicture = useCallback(
    async (uri: string): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured.' };
        if (!user?.id) return { success: false, error: 'Not signed in.' };

        // RN + web: fetch(uri) -> blob
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

  // Your Profile expects needsConsentUpdate?.() and acceptConsent()
  // Use your schema: terms_accepted + privacy_accepted + accepted_version
  const needsConsentUpdate = useCallback(() => {
    const termsAccepted = !!(user as any)?.termsAccepted ?? !!(user as any)?.terms_accepted;
    const privacyAccepted = !!(user as any)?.privacyAccepted ?? !!(user as any)?.privacy_accepted;
    const acceptedVersion = (user as any)?.acceptedVersion ?? (user as any)?.accepted_version ?? null;

    if (!termsAccepted || !privacyAccepted) return true;
    if (acceptedVersion !== LATEST_ACCEPTED_VERSION) return true;
    return false;
  }, [user]);

  const acceptConsent = useCallback(async (): Promise<AcceptConsentResult> => {
    try {
      if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured.' };
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
    [user, authLoading, isConfigured, signOut, updateUserProfile, uploadProfilePicture, needsConsentUpdate, acceptConsent, refetchUser]
  );
}
