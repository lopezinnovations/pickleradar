import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/supabase/client';

/** Skip realtime check-in updates for this user while their mutation is pending. */
let _pendingMutationUserId: string | null = null;
export const setCheckInMutationPending = (uid: string | null) => { _pendingMutationUserId = uid; };
export const getCheckInMutationPending = () => _pendingMutationUserId;
import {
  scheduleCheckInNotification,
  cancelCheckOutNotification,
  sendManualCheckOutNotification,
  isPushNotificationSupported,
} from '@/utils/notifications';

interface CheckInHistory {
  id: string;
  courtName: string;
  skillLevel: string;
  checkedInAt: string;
}

interface CheckInData {
  id: string;
  user_id: string;
  court_id: string;
  skill_level: string;
  created_at: string;
  expires_at: string;
  duration_minutes: number;
  notification_id?: string;
  courts?: {
    name: string;
  };
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
  fn().catch((e) => console.warn('useCheckIn: non-blocking task failed:', e));
};

export const useCheckIn = (userId?: string) => {
  const [loading, setLoading] = useState(false);
  const [checkInHistory, setCheckInHistory] = useState<CheckInHistory[]>([]);
  const inFlightRef = useRef(false);

  const fetchCheckInHistory = useCallback(async (uid: string) => {
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured - no check-in history');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select(
          `
          id,
          skill_level,
          created_at,
          courts (
            name
          )
        `
        )
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const history: CheckInHistory[] = (data || []).map((item: any) => ({
        id: item.id,
        courtName: item.courts?.name || 'Unknown Court',
        skillLevel: item.skill_level,
        checkedInAt: item.created_at,
      }));

      setCheckInHistory(history);
    } catch (error) {
      console.log('useCheckIn: Error fetching check-in history:', error);
    }
  }, []);

  useEffect(() => {
    if (userId) fetchCheckInHistory(userId);
  }, [userId, fetchCheckInHistory]);

  const refetch = useCallback(async () => {
    if (userId) {
      console.log('useCheckIn: Refetching check-in history');
      await fetchCheckInHistory(userId);
    }
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

      if (!response.ok) {
        console.error('useCheckIn: Error notifying friends:', result?.error);
        return { success: false, message: result?.error || 'Failed to notify friends' };
      }

      return { success: true, message: result?.message };
    } catch (error: any) {
      console.error('useCheckIn: notify-friends-checkin failed:', error);
      return { success: false, message: error?.message || 'Failed to notify friends' };
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

      if (!response.ok) {
        console.error('useCheckIn: Error notifying friends of checkout:', result?.error);
        return { success: false, message: result?.error || 'Failed to notify friends' };
      }

      return { success: true, message: result?.message };
    } catch (error: any) {
      console.error('useCheckIn: notify-friends-checkout failed:', error);
      return { success: false, message: error?.message || 'Failed to notify friends' };
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
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured - mock check-in');
      return { success: true, error: null };
    }
    if (inFlightRef.current) {
      console.log('useCheckIn: CHECKIN skipped - mutation already in flight');
      return { success: false, error: 'Please wait for the current request to finish' };
    }

    inFlightRef.current = true;
    setLoading(true);
    setCheckInMutationPending(uid);
    try {
      console.log('useCheckIn: CHECKIN calling supabase');

      // Preflight: single-active-court rule (server is still source of truth)
      const existingActive = await getUserCheckIn(uid);
      if (existingActive && existingActive.court_id !== courtId) {
        const courtName = (existingActive as CheckInData).courts?.name || 'another court';
        return {
          success: false,
          error: 'You\'re already checked in at another court. Please check out first.',
          code: 'ALREADY_CHECKED_IN',
          courtId: existingActive.court_id,
          courtName,
        };
      }

      const { data: existingCheckIn, error: fetchError } = await supabase
        .from('check_ins')
        .select('id, notification_id')
        .eq('user_id', uid)
        .eq('court_id', courtId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const { data: courtData } = await supabase.from('courts').select('name').eq('id', courtId).maybeSingle();
      const courtName = courtData?.name || 'Unknown Court';

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

      // Notifications should NOT block check-in UX
      let notificationId: string | null = null;
      if (isPushNotificationSupported()) {
        safeAsync(async () => {
          if (existingCheckIn?.notification_id) {
            await withTimeout(cancelCheckOutNotification(existingCheckIn.notification_id), 8000);
          }
        });

        // scheduling returns an id we store; keep this awaited but timeboxed
        notificationId = await withTimeout(scheduleCheckInNotification(courtName, durationMinutes), 8000);
      }

      if (existingCheckIn?.id) {
        const { error: updateError } = await supabase
          .from('check_ins')
          .update({
            skill_level: skillLevel,
            expires_at: expiresAt.toISOString(),
            duration_minutes: durationMinutes,
            notification_id: notificationId,
            created_at: new Date().toISOString(),
          })
          .eq('id', existingCheckIn.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('check_ins').insert({
          user_id: uid,
          court_id: courtId,
          skill_level: skillLevel,
          expires_at: expiresAt.toISOString(),
          duration_minutes: durationMinutes,
          notification_id: notificationId,
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          if (insertError.code === '23505' || /unique|duplicate/i.test(insertError.message || '')) {
            const current = await getUserCheckIn(uid);
            const courtName = (current as CheckInData)?.courts?.name || 'another court';
            return {
              success: false,
              error: 'You\'re already checked in at another court. Please check out first.',
              code: 'ALREADY_CHECKED_IN',
              courtId: current?.court_id,
              courtName,
            };
          }
          throw insertError;
        }
      }

      await fetchCheckInHistory(uid);

      // Friend notifications: non-blocking, NO alerts here (screen will show combined message)
      safeAsync(async () => {
        const result = await notifyFriends(courtId, courtName, skillLevel, durationMinutes);
        console.log('useCheckIn: notifyFriends result:', result);
      });

      console.log('useCheckIn: CHECKIN returned');
      return { success: true, error: null, courtName };
    } catch (error: any) {
      console.log('useCheckIn: Check-in error:', error);
      if (error?.code === '23505' || /unique|duplicate/i.test(error?.message || '')) {
        const current = await getUserCheckIn(uid);
        const courtName = (current as CheckInData)?.courts?.name || 'another court';
        return {
          success: false,
          error: 'You\'re already checked in at another court. Please check out first.',
          code: 'ALREADY_CHECKED_IN',
          courtId: current?.court_id,
          courtName,
        };
      }
      return { success: false, error: error?.message || 'Check-in failed' };
    } finally {
      inFlightRef.current = false;
      setCheckInMutationPending(null);
      setLoading(false);
    }
  };

  const checkOut = async (uid: string, courtId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured - mock check-out');
      return { success: true, error: null };
    }
    if (inFlightRef.current) {
      console.log('useCheckIn: CHECKOUT skipped - mutation already in flight');
      return { success: false, error: 'Please wait for the current request to finish' };
    }

    inFlightRef.current = true;
    setLoading(true);
    setCheckInMutationPending(uid);
    try {
      console.log('useCheckIn: CHECKOUT calling supabase');
      const { data: checkInData, error: readError } = await supabase
        .from('check_ins')
        .select('notification_id, courts(name)')
        .eq('user_id', uid)
        .eq('court_id', courtId)
        .maybeSingle();

      if (readError) throw readError;
      if (!checkInData) {
        console.log('useCheckIn: checkOut - no check-in row found, proceeding with delete (no-op)');
      }

      const courtName = (checkInData as any)?.courts?.name || 'Unknown Court';

      // Cancel notification: fire-and-forget, never block checkout
      const notificationIdToCancel = checkInData?.notification_id;
      if (notificationIdToCancel && isPushNotificationSupported()) {
        safeAsync(async () => {
          try {
            await withTimeout(cancelCheckOutNotification(notificationIdToCancel), 8000);
          } catch (e) {
            console.warn('useCheckIn: checkOut - cancelCheckOutNotification failed (non-blocking):', e);
          }
        });
      }

      const { error: deleteError } = await supabase.from('check_ins').delete().eq('user_id', uid).eq('court_id', courtId);
      if (deleteError) throw deleteError;

      // Manual check-out notification: fire-and-forget, never block checkout
      if (isPushNotificationSupported()) {
        safeAsync(async () => {
          try {
            await withTimeout(sendManualCheckOutNotification(courtName), 8000);
          } catch (e) {
            console.warn('useCheckIn: checkOut - sendManualCheckOutNotification failed (non-blocking):', e);
          }
        });
      }

      // Friend checkout notifications: fire-and-forget
      safeAsync(async () => {
        try {
          const result = await notifyFriendsCheckout(courtId, courtName);
          console.log('useCheckIn: notifyFriendsCheckout result:', result);
        } catch (e) {
          console.warn('useCheckIn: checkOut - notifyFriendsCheckout failed (non-blocking):', e);
        }
      });

      console.log('useCheckIn: CHECKOUT returned');
      return { success: true, error: null, courtName };
    } catch (error: any) {
      console.log('useCheckIn: Check-out error:', error);
      return { success: false, error: error?.message || 'Check-out failed' };
    } finally {
      inFlightRef.current = false;
      setCheckInMutationPending(null);
      setLoading(false);
    }
  };

  const getUserCheckIn = async (uid: string): Promise<CheckInData | null> => {
    if (!isSupabaseConfigured()) return null;

    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*, courts(*)')
        .eq('user_id', uid)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      return (data as CheckInData) ?? null;
    } catch (error) {
      console.log('useCheckIn: Error fetching user check-in:', error);
      return null;
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
