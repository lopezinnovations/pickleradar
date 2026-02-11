
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { Court } from '@/types';
import { logPerformance, getCachedData, setCachedData } from '@/utils/performanceLogger';
import { useRealtimeManager } from '@/utils/realtimeManager';

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
    friendsPlayingCount: 0,
    description: 'Beautiful outdoor courts in the heart of Central Park',
    openTime: '6:00 AM',
    closeTime: '10:00 PM',
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
    friendsPlayingCount: 0,
    description: 'Indoor and outdoor courts with great river views',
    openTime: '7:00 AM',
    closeTime: '9:00 PM',
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
    friendsPlayingCount: 0,
  },
];

const skillLevelToNumber = (skillLevel: string): number => {
  switch (skillLevel) {
    case 'Beginner':
      return 1;
    case 'Intermediate':
      return 2;
    case 'Advanced':
      return 3;
    default:
      return 2;
  }
};

export const useCourts = (userId?: string) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeManager = useRealtimeManager('useCourts');
  const hasSetupRealtime = useRef(false);

  const fetchCourts = useCallback(async () => {
    console.log('useCourts: Fetching courts...');
    logPerformance('QUERY_START', 'useCourts', 'fetchCourts');
    
    if (!isSupabaseConfigured()) {
      console.log('useCourts: Supabase not configured, using mock data');
      setCourts(MOCK_COURTS);
      setLoading(false);
      logPerformance('QUERY_END', 'useCourts', 'fetchCourts', { mock: true });
      return;
    }

    // Check cache first (2 minute TTL)
    const cacheKey = `courts_${userId || 'all'}`;
    const cached = getCachedData<Court[]>(cacheKey, 120000);
    if (cached) {
      console.log('useCourts: Using cached courts');
      setCourts(cached);
      setLoading(false);
      
      // Refresh in background
      setTimeout(() => {
        fetchCourtsFromServer();
      }, 100);
      return;
    }

    await fetchCourtsFromServer();
  }, [userId]);

  const fetchCourtsFromServer = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    try {
      console.log('useCourts: Fetching from Supabase...');
      
      // OPTIMIZED: Select only needed fields
      const { data, error } = await supabase
        .from('courts')
        .select('id, name, address, city, zip_code, latitude, longitude, description, open_time, close_time, google_place_id');

      if (error) {
        console.log('useCourts: Error fetching courts:', error);
        throw error;
      }
      
      console.log('useCourts: Fetched', data?.length || 0, 'courts');

      // Get user's friends if userId is provided
      let friendIds: string[] = [];
      if (userId) {
        const { data: friendsData } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', userId)
          .eq('status', 'accepted');

        friendIds = (friendsData || []).map(f => f.friend_id);
        console.log('useCourts: User has', friendIds.length, 'friends');
      }
      
      const courtsWithActivity = await Promise.all(
        (data || []).map(async (court) => {
          // OPTIMIZED: Fetch check-ins with only needed fields
          const { data: checkIns, error: checkInsError } = await supabase
            .from('check_ins')
            .select(`
              skill_level, 
              user_id,
              users!inner(dupr_rating)
            `)
            .eq('court_id', court.id)
            .gte('expires_at', new Date().toISOString());

          if (checkInsError) {
            console.log('useCourts: Error fetching check-ins for court', court.id, ':', checkInsError);
          }

          const currentPlayers = checkIns?.length || 0;
          
          // Count friends playing at this court
          const friendsPlaying = checkIns?.filter(checkIn => friendIds.includes(checkIn.user_id)) || [];
          const friendsPlayingCount = friendsPlaying.length;
          
          // Calculate average skill level
          let averageSkillLevel = 0;
          if (currentPlayers > 0 && checkIns) {
            const skillSum = checkIns.reduce((sum, checkIn) => {
              return sum + skillLevelToNumber(checkIn.skill_level);
            }, 0);
            averageSkillLevel = skillSum / currentPlayers;
          }

          // Calculate average DUPR if data exists
          let averageDupr: number | undefined;
          if (checkIns && checkIns.length > 0) {
            const duprRatings = checkIns
              .map(checkIn => checkIn.users?.dupr_rating)
              .filter((rating): rating is number => rating !== null && rating !== undefined);
            
            if (duprRatings.length > 0) {
              const duprSum = duprRatings.reduce((sum, rating) => sum + rating, 0);
              averageDupr = duprSum / duprRatings.length;
            }
          }

          let activityLevel: 'low' | 'medium' | 'high' = 'low';
          if (currentPlayers >= 6) activityLevel = 'high';
          else if (currentPlayers >= 3) activityLevel = 'medium';

          return {
            id: court.id,
            name: court.name,
            address: court.address,
            city: court.city,
            zipCode: court.zip_code,
            latitude: court.latitude,
            longitude: court.longitude,
            activityLevel,
            currentPlayers,
            averageSkillLevel,
            friendsPlayingCount,
            description: court.description,
            openTime: court.open_time,
            closeTime: court.close_time,
            googlePlaceId: court.google_place_id,
            averageDupr,
          };
        })
      );

      console.log('useCourts: Successfully processed courts with activity levels, skill averages, friend counts, and DUPR data');
      
      // Cache the result
      const cacheKey = `courts_${userId || 'all'}`;
      setCachedData(cacheKey, courtsWithActivity);
      
      setCourts(courtsWithActivity);
      logPerformance('QUERY_END', 'useCourts', 'fetchCourts', { courtsCount: courtsWithActivity.length });
    } catch (error) {
      console.log('useCourts: Error in fetchCourts, falling back to mock data:', error);
      setCourts(MOCK_COURTS);
      logPerformance('QUERY_END', 'useCourts', 'fetchCourts', { error: true });
    } finally {
      setLoading(false);
      console.log('useCourts: Fetch complete');
    }
  }, [userId]);

  useEffect(() => {
    console.log('useCourts: Initializing...');
    fetchCourts();
  }, [fetchCourts]);

  // FIXED: Use RealtimeManager for robust subscription management
  useEffect(() => {
    if (!isSupabaseConfigured() || hasSetupRealtime.current) {
      return;
    }

    hasSetupRealtime.current = true;
    console.log('useCourts: Setting up realtime subscription with RealtimeManager');

    // Subscribe to check-ins changes with fallback
    const unsubscribe = realtimeManager.subscribe({
      table: 'check_ins',
      event: '*',
      onUpdate: () => {
        console.log('useCourts: Check-in change detected via realtime, refreshing');
        fetchCourts();
      },
      fallbackFetch: fetchCourts,
      timeoutMs: 10000,
      maxRetries: 3,
    });

    return () => {
      console.log('useCourts: Cleaning up realtime subscription');
      unsubscribe();
      hasSetupRealtime.current = false;
    };
  }, [fetchCourts, realtimeManager]);

  return { courts, loading, refetch: fetchCourts };
};
