
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

interface CheckInHistory {
  id: string;
  courtName: string;
  skillLevel: string;
  checkedInAt: string;
}

export const useCheckIn = (userId?: string) => {
  const [loading, setLoading] = useState(false);
  const [checkInHistory, setCheckInHistory] = useState<CheckInHistory[]>([]);

  useEffect(() => {
    if (userId) {
      fetchCheckInHistory(userId);
    }
  }, [userId]);

  const fetchCheckInHistory = async (userId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured - no check-in history');
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
      console.log('Error fetching check-in history:', error);
    }
  };

  const checkIn = async (
    userId: string,
    courtId: string,
    skillLevel: 'Beginner' | 'Intermediate' | 'Advanced'
  ) => {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured - mock check-in');
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
        return { success: false, error: 'Already checked in at this court' };
      }

      // Create check-in (expires in 3 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 3);

      const { error } = await supabase
        .from('check_ins')
        .insert([
          {
            user_id: userId,
            court_id: courtId,
            skill_level: skillLevel,
            expires_at: expiresAt.toISOString(),
          },
        ]);

      if (error) throw error;
      
      // Refresh check-in history
      await fetchCheckInHistory(userId);
      
      return { success: true, error: null };
    } catch (error: any) {
      console.log('Check-in error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const checkOut = async (userId: string, courtId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured - mock check-out');
      return { success: true, error: null };
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('check_ins')
        .delete()
        .eq('user_id', userId)
        .eq('court_id', courtId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error: any) {
      console.log('Check-out error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const getUserCheckIn = async (userId: string) => {
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

      if (error) throw error;
      return data;
    } catch (error) {
      console.log('Error fetching user check-in:', error);
      return null;
    }
  };

  return { checkIn, checkOut, getUserCheckIn, loading, checkInHistory };
};
