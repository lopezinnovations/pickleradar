
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { Court } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

// Mock data for when Supabase is not configured
const MOCK_COURTS: Court[] = [
  {
    id: '1',
    name: 'Central Park Pickleball Courts',
    address: '123 Park Ave, New York, NY',
    latitude: 40.7829,
    longitude: -73.9654,
    activityLevel: 'high',
    currentPlayers: 8,
    averageSkillLevel: 3.5,
  },
  {
    id: '2',
    name: 'Riverside Recreation Center',
    address: '456 River Rd, Brooklyn, NY',
    latitude: 40.7128,
    longitude: -74.0060,
    activityLevel: 'medium',
    currentPlayers: 4,
    averageSkillLevel: 2.5,
  },
  {
    id: '3',
    name: 'Sunset Community Courts',
    address: '789 Sunset Blvd, Queens, NY',
    latitude: 40.7282,
    longitude: -73.7949,
    activityLevel: 'low',
    currentPlayers: 2,
    averageSkillLevel: 1.5,
  },
];

// Convert skill level string to numeric value
const skillLevelToNumber = (skillLevel: string): number => {
  switch (skillLevel) {
    case 'Beginner':
      return 1;
    case 'Intermediate':
      return 2;
    case 'Advanced':
      return 3;
    default:
      return 2; // Default to Intermediate
  }
};

export const useCourts = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchCourts = useCallback(async () => {
    console.log('useCourts: Fetching courts...');
    setLoading(true);
    
    if (!isSupabaseConfigured()) {
      console.log('useCourts: Supabase not configured, using mock data');
      setCourts(MOCK_COURTS);
      setLoading(false);
      return;
    }

    try {
      console.log('useCourts: Fetching from Supabase...');
      const { data, error } = await supabase
        .from('courts')
        .select('*');

      if (error) {
        console.log('useCourts: Error fetching courts:', error);
        throw error;
      }
      
      console.log('useCourts: Fetched', data?.length || 0, 'courts');
      
      // Calculate activity levels and average skill based on active check-ins
      const courtsWithActivity = await Promise.all(
        (data || []).map(async (court) => {
          // Fetch active check-ins for this court
          const { data: checkIns, error: checkInsError } = await supabase
            .from('check_ins')
            .select('skill_level')
            .eq('court_id', court.id)
            .gte('expires_at', new Date().toISOString());

          if (checkInsError) {
            console.log('useCourts: Error fetching check-ins for court', court.id, ':', checkInsError);
          }

          const currentPlayers = checkIns?.length || 0;
          
          // Calculate average skill level
          let averageSkillLevel = 0;
          if (currentPlayers > 0 && checkIns) {
            const skillSum = checkIns.reduce((sum, checkIn) => {
              return sum + skillLevelToNumber(checkIn.skill_level);
            }, 0);
            averageSkillLevel = skillSum / currentPlayers;
          }

          // Determine activity level
          let activityLevel: 'low' | 'medium' | 'high' = 'low';
          if (currentPlayers >= 6) activityLevel = 'high';
          else if (currentPlayers >= 3) activityLevel = 'medium';

          return {
            id: court.id,
            name: court.name,
            address: court.address,
            latitude: court.latitude,
            longitude: court.longitude,
            activityLevel,
            currentPlayers,
            averageSkillLevel,
          };
        })
      );

      console.log('useCourts: Successfully processed courts with activity levels and skill averages');
      setCourts(courtsWithActivity);
    } catch (error) {
      console.log('useCourts: Error in fetchCourts, falling back to mock data:', error);
      setCourts(MOCK_COURTS);
    } finally {
      setLoading(false);
      console.log('useCourts: Fetch complete');
    }
  }, []);

  const setupRealtimeSubscription = useCallback(() => {
    try {
      // Check if already subscribed
      if (channelRef.current?.state === 'subscribed') {
        console.log('useCourts: Already subscribed to realtime updates');
        return;
      }

      console.log('useCourts: Setting up realtime subscription for check-ins');
      
      const channel = supabase.channel('check_ins:changes', {
        config: { broadcast: { self: true } }
      });
      
      channelRef.current = channel;

      // Listen for all check-in changes
      channel
        .on('broadcast', { event: 'INSERT' }, (payload) => {
          console.log('useCourts: Check-in created', payload);
          fetchCourts();
        })
        .on('broadcast', { event: 'DELETE' }, (payload) => {
          console.log('useCourts: Check-in deleted', payload);
          fetchCourts();
        })
        .on('broadcast', { event: 'UPDATE' }, (payload) => {
          console.log('useCourts: Check-in updated', payload);
          fetchCourts();
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('useCourts: Successfully subscribed to check-in updates');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('useCourts: Channel error:', err);
          } else if (status === 'CLOSED') {
            console.log('useCourts: Channel closed');
          }
        });
    } catch (error) {
      console.error('useCourts: Error setting up realtime subscription:', error);
    }
  }, [fetchCourts]);

  useEffect(() => {
    console.log('useCourts: Initializing...');
    fetchCourts();
    
    // Set up real-time subscription for check-ins
    if (isSupabaseConfigured()) {
      setupRealtimeSubscription();
    }

    return () => {
      // Cleanup subscription on unmount
      if (channelRef.current) {
        console.log('useCourts: Cleaning up realtime subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchCourts, setupRealtimeSubscription]);

  return { courts, loading, refetch: fetchCourts };
};
