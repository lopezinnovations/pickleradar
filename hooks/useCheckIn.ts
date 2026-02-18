import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

import {
  scheduleCheckInNotification,
  cancelCheckOutNotification,
  sendManualCheckOutNotification,
  isPushNotificationSupported,
} from '@/utils/notifications';

/** Skip check-in reads for this user while their mutation is pending (screen uses this). */
let _pendingMutationUserId: string | null = null;
export const setCheckInMutationPending = (uid: string | null) => {
  _pendingMutationUserId = uid;
};
export const getCheckInMutationPending = () => _pendingMutationUserId;

interface CheckInHistory {
  id: string;
  courtName: string;
  skillLevel: string;
  checkedInAt: string;
}

export interface CheckInData {
  id: string;
  user_id: string;
  court_id: string;
  skill_level: string;
  created_at: string;
  expires_at: string;
  duration_minutes: number;
  notification_id?: string;
  courts?: { name: string };
}

const withTimeout = async <T,>(p: Promise<T>, ms = 12000): Promise<T> => {
  return (await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms)
    ),
  ])) as T;
};

// Fire-and-forget helper (never blocks UI)
const safeAsync = (fn: () => Promise<any>) => {
  fn().catch((e) => console.warn('[CHECKIN] non-blocking task failed:', e));
};

export const useCheckIn = (userId?: string) => {
  const [loading, setLoading] = useState(false);
  const [checkInHistory, setCheckInHistory] = useState<CheckInHistory[]>([]);
  const inFlightRef = useRef(false);

  const fetchCheckInHistory = useCallback(async (uid: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('check_ins')
          .select(
            `
            id,
            skill_level,
            created_at,
            courts ( name )
          `
          )
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(20),
        12000
      );

      if (error) throw error;

      const history: CheckInHistory[] = (data || []).map((item: any) => ({
        id: item.id,
        courtName: item.courts?.name || 'Unknown Court',
        skillLevel: item.skill_level,
        checkedInAt: item.created_at,
      }));

      setCheckInHistory(history);
    } catch (error) {
      console.log('[CHECKIN] Error fetching check-in history:', error);
    }
  }, []);

  useEffect(() => {
    if (userId) fetchCheckInHistory(userId);
  }, [userId, fetchCheckInHistory]);

  const refetch = useCallback(async () => {
    if (userId) await fetchCheckInHistory(userId);
  }, [userId, fetchCheckInHistory]);

  const notifyFriends = async (
    courtId: string,
    courtName: string,
    skillLevel: string,
    durationMinutes: number
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) return { success: true, message: 'Supabase not configured' };
    if (!isPushNotificationSupported()) return { success: true, message: 'Push not supported' };

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) return { success: false, message: 'Not authenticated' };

      const response = await withTimeout(
        fetch(`${supabase.supabaseUrl}/functions/v1/notify-friends-checkin`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ courtId, courtName, skillLevel, durationMinutes }),
        }),
        12000
      );

      const result = await response.json();
      if (!response.ok) return { success: false, message: result?.error || 'Failed to notify friends' };

      return { success: true, message: result?.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to notify friends' };
    }
  };

  const notifyFriendsCheckout = async (
    courtId: string,
    courtName: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) return { success: true, message: 'Supabase not configured' };
    if (!isPushNotificationSupported()) return { success: true, message: 'Push not supported' };

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) return { success: false, message: 'Not authenticated' };

      const response = await withTimeout(
        fetch(`${supabase.supabaseUrl}/functions/v1/notify-friends-checkout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ courtId, courtName }),
        }),
        12000
      );

      const result = await response.json();
      if (!response.ok) return { success: false, message: result?.error || 'Failed to notify friends' };

      return { success: true, message: result?.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to notify friends' };
    }
  };

  const getUserCheckIn = async (uid: string): Promise<CheckInData | null> => {
    if (!isSupabaseConfigured()) return null;

    try {
      // IMPORTANT: maybeSingle() + gte(expires_at) must return null when not checked in (no throw).
      const { data, error } = await withTimeout(
        supabase
          .from('check_ins')
          .select('*, courts(*)')
          .eq('user_id', uid)
          .gte('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        12000
      );

      if (error) throw error;
      return (data as CheckInData) ?? null;
    } catch (error) {
      console.log('[CHECKIN] Error fetching user check-in:', error);
      return null;
    }
  };

  const checkIn = async (
    uid: string,
    courtId: string,
    skillLevel: 'Beginner' | 'Intermediate' | 'Advanced',
    durationMinutes: number = 90
  ): Promise<{
    success: boolean;
    error: string | null;
    courtName?: string;
    courtId?: string;
    code?: 'ALREADY_CHECKED_IN';
  }> => {
    if (!isSupabaseConfigured()) return { success: true, error: null };
    if (inFlightRef.current) return { success: false, error: 'Please wait for the current request to finish' };

    inFlightRef.current = true;
    setLoading(true);
    setCheckInMutationPending(uid);

    try {
      // Single-active-court rule (reliable: look for active row by expires_at)
      const existingActive = await withTimeout(
        supabase
          .from('check_ins')
          .select('court_id, expires_at')
          .eq('user_id', uid)
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        12000
      );

      if (existingActive.error) throw existingActive.error;

      const active = existingActive.data as { court_id: string; expires_at: string } | null;
      const activeIsValid = active ? new Date(active.expires_at).getTime() > Date.now() : false;

      if (active && activeIsValid && String(active.court_id) !== String(courtId)) {
        let otherCourtName = 'another court';
        try {
          const { data: otherCourt } = await withTimeout(
            supabase.from('courts').select('name').eq('id', active.court_id).maybeSingle(),
            12000
          );
          otherCourtName = otherCourt?.name || otherCourtName;
        } catch {}
        return {
          success: false,
          error: 'You must check out of your current court before checking into another.',
          code: 'ALREADY_CHECKED_IN',
          courtId: active.court_id,
          courtName: otherCourtName,
        };
      }

      // Existing check-in for THIS court?
      const { data: existingCheckIn, error: fetchError } = await withTimeout(
        supabase
          .from('check_ins')
          .select('id, notification_id')
          .eq('user_id', uid)
          .eq('court_id', courtId)
          .maybeSingle(),
        12000
      );
      if (fetchError) throw fetchError;

      const { data: courtData, error: courtErr } = await withTimeout(
        supabase.from('courts').select('name').eq('id', courtId).maybeSingle(),
        12000
      );
      if (courtErr) throw courtErr;

      const courtName = courtData?.name || 'Unknown Court';

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

      // Notifications: do not block DB write
      let notificationId: string | null = null;
      if (isPushNotificationSupported()) {
        safeAsync(async () => {
          if (existingCheckIn?.notification_id) {
            await withTimeout(cancelCheckOutNotification(existingCheckIn.notification_id), 8000);
          }
        });

        try {
          notificationId = await withTimeout(scheduleCheckInNotification(courtName, durationMinutes), 8000);
        } catch (e) {
          console.warn('[CHECKIN] scheduleCheckInNotification failed (non-blocking):', e);
          notificationId = null;
        }
      }

      if (existingCheckIn?.id) {
        const { error: updateError } = await withTimeout(
          supabase
            .from('check_ins')
            .update({
              skill_level: skillLevel,
              expires_at: expiresAt.toISOString(),
              duration_minutes: durationMinutes,
              notification_id: notificationId,
              created_at: new Date().toISOString(),
            })
            .eq('id', existingCheckIn.id),
          12000
        );
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await withTimeout(
          supabase.from('check_ins').insert({
            user_id: uid,
            court_id: courtId,
            skill_level: skillLevel,
            expires_at: expiresAt.toISOString(),
            duration_minutes: durationMinutes,
            notification_id: notificationId,
            created_at: new Date().toISOString(),
          }),
          12000
        );
        if (insertError) throw insertError;
      }

      await fetchCheckInHistory(uid);

      safeAsync(async () => {
        await notifyFriends(courtId, courtName, skillLevel, durationMinutes);
      });

      return { success: true, error: null, courtName };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Check-in failed' };
    } finally {
      inFlightRef.current = false;
      setCheckInMutationPending(null);
      setLoading(false);
    }
  };

  const checkOut = async (uid: string, courtId: string, courtNamePassed?: string) => {
    if (!isSupabaseConfigured()) return { success: true, error: null };
    if (inFlightRef.current) return { success: false, error: 'Please wait for the current request to finish' };

    inFlightRef.current = true;
    setLoading(true);
    setCheckInMutationPending(uid);

    try {
      const { data: checkInRow, error: readError } = await withTimeout(
        supabase
          .from('check_ins')
          .select('notification_id')
          .eq('user_id', uid)
          .eq('court_id', courtId)
          .maybeSingle(),
        12000
      );
      if (readError) throw readError;

      let courtName = courtNamePassed;
      if (!courtName) {
        const { data: courtRow } = await withTimeout(
          supabase.from('courts').select('name').eq('id', courtId).maybeSingle(),
          12000
        );
        courtName = courtRow?.name || 'Unknown Court';
      }

      const notificationIdToCancel = (checkInRow as any)?.notification_id as string | undefined;
      if (notificationIdToCancel && isPushNotificationSupported()) {
        safeAsync(async () => {
          await withTimeout(cancelCheckOutNotification(notificationIdToCancel), 8000);
        });
      }

      const { error: deleteError } = await withTimeout(
        supabase.from('check_ins').delete().eq('user_id', uid).eq('court_id', courtId),
        12000
      );
      if (deleteError) throw deleteError;

      if (isPushNotificationSupported()) {
        safeAsync(async () => {
          await withTimeout(sendManualCheckOutNotification(courtName || 'Unknown Court'), 8000);
        });
      }

      safeAsync(async () => {
        await notifyFriendsCheckout(courtId, courtName || 'Unknown Court');
      });

      return { success: true, error: null, courtName: courtName || 'Unknown Court' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Check-out failed' };
    } finally {
      inFlightRef.current = false;
      setCheckInMutationPending(null);
      setLoading(false);
    }
  };

  const getRemainingTime = (expiresAt: string): { hours: number; minutes: number; totalMinutes: number } => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes };
  };

  return { checkIn, checkOut, getUserCheckIn, getRemainingTime, loading, checkInHistory, refetch };
};
