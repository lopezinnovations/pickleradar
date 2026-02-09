
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { scheduleCheckInNotification, cancelCheckOutNotification, sendManualCheckOutNotification, isPushNotificationSupported } from '@/utils/notifications';
import { Alert } from 'react-native';

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

export const useCheckIn = (userId?: string) => {
  const [loading, setLoading] = useState(false);
  const [checkInHistory, setCheckInHistory] = useState<CheckInHistory[]>([]);

  const fetchCheckInHistory = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured - no check-in history');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select(`
          id,
          skill_level,
          created_at,
          courts (
            name
          )
        `)
        .eq('user_id', userId)
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
    if (userId) {
      fetchCheckInHistory(userId);
    }
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
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured, skipping friend notifications');
      return { success: true, message: 'Notifications not available' };
    }

    // Only send notifications if push is supported
    if (!isPushNotificationSupported()) {
      console.log('useCheckIn: Push notifications not supported in this environment, skipping friend notifications');
      return { success: true, message: 'Push notifications not available in this build' };
    }

    try {
      console.log('useCheckIn: Notifying friends of check-in at', courtName);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('useCheckIn: No session, cannot notify friends');
        return { success: false, message: 'Not authenticated' };
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/notify-friends-checkin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            courtId,
            courtName,
            skillLevel,
            durationMinutes,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('useCheckIn: Error notifying friends:', result.error);
        return { success: false, message: result.error };
      }

      console.log('useCheckIn: Friend notification result:', result);
      return { success: true, message: result.message };
    } catch (error: any) {
      console.error('useCheckIn: Error calling notify-friends-checkin function:', error);
      return { success: false, message: error.message || 'Failed to notify friends' };
    }
  };

  const checkIn = async (
    userId: string,
    courtId: string,
    skillLevel: 'Beginner' | 'Intermediate' | 'Advanced',
    durationMinutes: number = 90
  ) => {
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured - mock check-in');
      return { success: true, error: null };
    }

    setLoading(true);
    try {
      // Check if user is already checked in at this court
      const { data: existing } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .eq('court_id', courtId)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (existing) {
        setLoading(false);
        return { success: false, error: 'Already checked in at this court' };
      }

      // Check if user is checked in at any other court
      const { data: otherCheckIns } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString());

      // If user is checked in elsewhere, remove those check-ins first
      if (otherCheckIns && otherCheckIns.length > 0) {
        // Cancel any scheduled notifications
        for (const checkIn of otherCheckIns) {
          if (checkIn.notification_id) {
            await cancelCheckOutNotification(checkIn.notification_id);
          }
        }
        
        await supabase
          .from('check_ins')
          .delete()
          .eq('user_id', userId)
          .gte('expires_at', new Date().toISOString());
      }

      // Get court name for notification
      const { data: courtData } = await supabase
        .from('courts')
        .select('name')
        .eq('id', courtId)
        .single();

      const courtName = courtData?.name || 'Unknown Court';

      // Schedule local notifications (only if supported)
      let notificationId: string | null = null;
      if (isPushNotificationSupported()) {
        notificationId = await scheduleCheckInNotification(courtName, durationMinutes);
      }

      // Create check-in with custom duration
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

      const { error } = await supabase
        .from('check_ins')
        .insert([
          {
            user_id: userId,
            court_id: courtId,
            skill_level: skillLevel,
            expires_at: expiresAt.toISOString(),
            duration_minutes: durationMinutes,
            notification_id: notificationId,
          },
        ]);

      if (error) throw error;
      
      // Refresh check-in history
      await fetchCheckInHistory(userId);

      // Notify friends (non-blocking - don't fail check-in if this fails)
      notifyFriends(courtId, courtName, skillLevel, durationMinutes)
        .then((result) => {
          if (result.success && result.message) {
            console.log('useCheckIn: Friend notification success:', result.message);
            // Show toast confirmation
            Alert.alert('Friends Notified', "Friends notified you're here.", [{ text: 'OK' }]);
          }
        })
        .catch((err) => {
          console.error('useCheckIn: Friend notification failed (non-blocking):', err);
          // Don't show error to user - check-in was successful
        });
      
      return { success: true, error: null };
    } catch (error: any) {
      console.log('useCheckIn: Check-in error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const checkOut = async (userId: string, courtId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured - mock check-out');
      return { success: true, error: null };
    }

    setLoading(true);
    try {
      // Get the check-in to cancel notification and get court name
      const { data: checkInData } = await supabase
        .from('check_ins')
        .select('notification_id, courts(name)')
        .eq('user_id', userId)
        .eq('court_id', courtId)
        .single();

      if (checkInData?.notification_id && isPushNotificationSupported()) {
        await cancelCheckOutNotification(checkInData.notification_id);
      }

      const courtName = (checkInData as any)?.courts?.name || 'Unknown Court';

      const { error } = await supabase
        .from('check_ins')
        .delete()
        .eq('user_id', userId)
        .eq('court_id', courtId);

      if (error) throw error;

      // Send manual check-out notification (only if supported)
      if (isPushNotificationSupported()) {
        await sendManualCheckOutNotification(courtName);
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.log('useCheckIn: Check-out error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const getUserCheckIn = async (userId: string): Promise<CheckInData | null> => {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*, courts(*)')
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (error) {
        // If no check-in found, return null (not an error)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      return data as CheckInData;
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
