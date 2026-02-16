
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/supabase/client';
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

  const notifyFriendsCheckout = async (
    courtId: string,
    courtName: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) {
      console.log('useCheckIn: Supabase not configured, skipping checkout notifications');
      return { success: true, message: 'Notifications not available' };
    }

    if (!isPushNotificationSupported()) {
      console.log('useCheckIn: Push notifications not supported in this environment');
      return { success: true, message: 'Push notifications not available in this build' };
    }

    try {
      console.log('useCheckIn: Notifying friends of check-out from', courtName);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('useCheckIn: No session, cannot notify friends');
        return { success: false, message: 'Not authenticated' };
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/notify-friends-checkout`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            courtId,
            courtName,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('useCheckIn: Error notifying friends of checkout:', result.error);
        return { success: false, message: result.error };
      }

      console.log('useCheckIn: Friend checkout notification result:', result);
      return { success: true, message: result.message };
    } catch (error: any) {
      console.error('useCheckIn: Error calling notify-friends-checkout function:', error);
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
      console.log('useCheckIn: Starting check-in for user', userId, 'at court', courtId);

      // Step 1: Check if a check-in already exists for this user and court
      const { data: existingCheckIn, error: fetchError } = await supabase
        .from('check_ins')
        .select('id, notification_id')
        .eq('user_id', userId)
        .eq('court_id', courtId)
        .maybeSingle();

      if (fetchError) {
        console.error('useCheckIn: Error checking for existing check-in:', fetchError);
        throw fetchError;
      }

      // Get court name for notifications
      const { data: courtData } = await supabase
        .from('courts')
        .select('name')
        .eq('id', courtId)
        .single();

      const courtName = courtData?.name || 'Unknown Court';

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

      // Schedule notification
      let notificationId: string | null = null;
      if (isPushNotificationSupported()) {
        // Cancel old notification if updating
        if (existingCheckIn?.notification_id) {
          await cancelCheckOutNotification(existingCheckIn.notification_id);
        }
        notificationId = await scheduleCheckInNotification(courtName, durationMinutes);
      }

      if (existingCheckIn) {
        // Step 2a: Update the existing check-in record
        console.log('useCheckIn: Updating existing check-in with id', existingCheckIn.id);
        
        const { error: updateError } = await supabase
          .from('check_ins')
          .update({
            skill_level: skillLevel,
            expires_at: expiresAt.toISOString(),
            duration_minutes: durationMinutes,
            notification_id: notificationId,
            created_at: new Date().toISOString(), // Update timestamp
          })
          .eq('id', existingCheckIn.id);

        if (updateError) {
          console.error('useCheckIn: Error updating check-in:', updateError);
          throw updateError;
        }

        console.log('useCheckIn: Check-in updated successfully');
      } else {
        // Step 2b: Insert a new check-in record
        console.log('useCheckIn: No existing check-in found, inserting new record');
        
        const { error: insertError } = await supabase
          .from('check_ins')
          .insert({
            user_id: userId,
            court_id: courtId,
            skill_level: skillLevel,
            expires_at: expiresAt.toISOString(),
            duration_minutes: durationMinutes,
            notification_id: notificationId,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('useCheckIn: Error inserting check-in:', insertError);
          throw insertError;
        }

        console.log('useCheckIn: Check-in inserted successfully');
      }
      
      await fetchCheckInHistory(userId);

      // Send friend notifications (non-blocking)
      notifyFriends(courtId, courtName, skillLevel, durationMinutes)
        .then((result) => {
          if (result.success) {
            console.log('useCheckIn: Friend notification success:', result.message);
            // Show success toast
            if (isPushNotificationSupported()) {
              Alert.alert('Success', "Friends notified you're here!", [{ text: 'OK' }]);
            }
          } else {
            console.log('useCheckIn: Friend notification skipped or failed:', result.message);
          }
        })
        .catch((err) => {
          console.error('useCheckIn: Friend notification failed (non-blocking):', err);
          // Don't block check-in if push fails
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

      if (isPushNotificationSupported()) {
        await sendManualCheckOutNotification(courtName);
      }

      // Send friend checkout notifications (non-blocking)
      notifyFriendsCheckout(courtId, courtName)
        .then((result) => {
          if (result.success) {
            console.log('useCheckIn: Friend checkout notification success:', result.message);
          } else {
            console.log('useCheckIn: Friend checkout notification skipped or failed:', result.message);
          }
        })
        .catch((err) => {
          console.error('useCheckIn: Friend checkout notification failed (non-blocking):', err);
          // Don't block check-out if push fails
        });

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
