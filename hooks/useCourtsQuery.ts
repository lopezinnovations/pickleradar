
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client;
import { Court } from '@/types';
import { calculateDistance, calculateBoundingBox } from '@/utils/locationUtils';

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
    isFavorite: false,
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
    isFavorite: false,
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
    isFavorite: false,
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

interface FetchCourtsParams {
  userId?: string;
  userLat?: number;
  userLng?: number;
  radiusMiles?: number;
}

async function fetchCourts({ userId, userLat, userLng, radiusMiles = 25 }: FetchCourtsParams): Promise<Court[]> {
  console.log('useCourtsQuery: Fetching courts with params:', { userId, userLat, userLng, radiusMiles });
  
  if (!isSupabaseConfigured()) {
    console.log('useCourtsQuery: Supabase not configured, using mock data');
    return MOCK_COURTS;
  }

  try {
    // OPTIMIZED: Build query with bounding box filter if location is available
    let query = supabase
      .from('courts')
      .select('id, name, address, city, zip_code, latitude, longitude, description, open_time, close_time, google_place_id');

    // NEARBY ONLY: Apply bounding box filter if user location is available
    if (userLat !== undefined && userLng !== undefined) {
      const boundingBox = calculateBoundingBox(userLat, userLng, radiusMiles);
      
      console.log('useCourtsQuery: Applying bounding box filter:', boundingBox);
      
      query = query
        .gte('latitude', boundingBox.minLat)
        .lte('latitude', boundingBox.maxLat)
        .gte('longitude', boundingBox.minLng)
        .lte('longitude', boundingBox.maxLng);
    }

    // Limit results to prevent loading too many courts
    query = query.limit(200);

    const { data, error } = await query;

    if (error) {
      console.error('useCourtsQuery: Error fetching courts:', error);
      throw error;
    }
    
    console.log('useCourtsQuery: Fetched', data?.length || 0, 'courts');

    // BATCHED FAVORITES FETCH: Get all user's favorites in one query
    let favoriteCourtIds = new Set<string>();
    if (userId) {
      const { data: favoritesData } = await supabase
        .from('court_favorites')
        .select('court_id')
        .eq('user_id', userId);

      favoriteCourtIds = new Set((favoritesData || []).map(fav => fav.court_id));
      console.log('useCourtsQuery: User has', favoriteCourtIds.size, 'favorite courts');
    }

    // Get user's friends if userId is provided
    let friendIds: string[] = [];
    if (userId) {
      const { data: friendsData } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      friendIds = (friendsData || []).map(f => f.friend_id);
      console.log('useCourtsQuery: User has', friendIds.length, 'friends');
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
          console.error('useCourtsQuery: Error fetching check-ins for court', court.id, ':', checkInsError);
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

        // CLIENT-SIDE: Calculate exact distance using Haversine if user location is available
        let distance: number | undefined;
        if (userLat !== undefined && userLng !== undefined) {
          distance = calculateDistance(userLat, userLng, court.latitude, court.longitude);
        }

        // Check if this court is favorited
        const isFavorite = favoriteCourtIds.has(court.id);

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
          distance,
          isFavorite,
        };
      })
    );

    console.log('useCourtsQuery: Successfully processed courts with activity levels, skill averages, friend counts, DUPR data, distances, and favorites');
    
    return courtsWithActivity;
  } catch (error) {
    console.error('useCourtsQuery: Error in fetchCourts, falling back to mock data:', error);
    return MOCK_COURTS;
  }
}

export function useCourtsQuery(userId?: string, userLat?: number, userLng?: number, radiusMiles?: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['courts', userId, userLat, userLng, radiusMiles],
    queryFn: () => fetchCourts({ userId, userLat, userLng, radiusMiles }),
    staleTime: 30000, // 30 seconds - data is fresh for 30s
    gcTime: 600000, // 10 minutes - keep in cache for 10 min
    refetchOnFocus: false, // Don't auto-refetch on tab focus
    refetchOnMount: true, // Refetch on mount if stale
  });

  const refetch = useCallback(() => {
    console.log('useCourtsQuery: Manual refetch triggered');
    return queryClient.invalidateQueries({ queryKey: ['courts', userId, userLat, userLng, radiusMiles] });
  }, [queryClient, userId, userLat, userLng, radiusMiles]);

  return {
    courts: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch,
    isRefetching: query.isRefetching,
  };
}
