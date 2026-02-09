
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { Friend, FriendWithDetails } from '@/types';

interface UserWithStatus {
  id: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  pickleballer_nickname?: string;
  experience_level?: string;
  dupr_rating?: number;
  isAtCourt: boolean;
  courtsPlayed?: string[];
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  friendshipId?: string;
}

async function fetchFriends(userId: string) {
  console.log('useFriendsQuery: Fetching friends for user:', userId);
  
  if (!isSupabaseConfigured()) {
    console.log('useFriendsQuery: Supabase not configured');
    return { friends: [], pendingRequests: [], allUsers: [] };
  }

  try {
    // OPTIMIZED: Fetch friends WITHOUT embedded joins
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, status, created_at')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .limit(100); // ADDED: Pagination limit

    if (friendshipsError) throw friendshipsError;

    // Get unique user IDs
    const userIds = new Set<string>();
    (friendships || []).forEach(f => {
      if (f.user_id !== userId) userIds.add(f.user_id);
      if (f.friend_id !== userId) userIds.add(f.friend_id);
    });

    // OPTIMIZED: Fetch user details separately
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
      .in('id', Array.from(userIds));

    if (usersError) throw usersError;

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Process friendships
    const friends: FriendWithDetails[] = [];
    const pendingRequests: FriendWithDetails[] = [];

    for (const friendship of friendships || []) {
      const friendId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;
      const friendData = userMap.get(friendId);

      if (!friendData) continue;

      const friendDetails: FriendWithDetails = {
        id: friendship.id,
        userId: friendId,
        firstName: friendData.first_name,
        lastName: friendData.last_name,
        pickleballerNickname: friendData.pickleballer_nickname,
        experienceLevel: friendData.experience_level,
        duprRating: friendData.dupr_rating,
        status: friendship.status,
        createdAt: friendship.created_at,
        isAtCourt: false,
      };

      if (friendship.status === 'accepted') {
        friends.push(friendDetails);
      } else if (friendship.status === 'pending' && friendship.friend_id === userId) {
        pendingRequests.push(friendDetails);
      }
    }

    // OPTIMIZED: Fetch all users for search (limit to 200)
    const { data: allUsersData, error: allUsersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
      .neq('id', userId)
      .limit(200); // ADDED: Pagination limit

    if (allUsersError) throw allUsersError;

    const allUsers: UserWithStatus[] = (allUsersData || []).map(user => {
      const friendship = (friendships || []).find(
        f => (f.user_id === user.id || f.friend_id === user.id)
      );

      let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
      if (friendship) {
        if (friendship.status === 'accepted') {
          friendshipStatus = 'accepted';
        } else if (friendship.status === 'pending') {
          friendshipStatus = friendship.user_id === userId ? 'pending_sent' : 'pending_received';
        }
      }

      return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        pickleballer_nickname: user.pickleballer_nickname,
        experience_level: user.experience_level,
        dupr_rating: user.dupr_rating,
        isAtCourt: false,
        friendshipStatus,
        friendshipId: friendship?.id,
      };
    });

    console.log('useFriendsQuery: Loaded', friends.length, 'friends,', pendingRequests.length, 'pending requests,', allUsers.length, 'total users');

    return { friends, pendingRequests, allUsers };
  } catch (error) {
    console.error('useFriendsQuery: Error fetching friends:', error);
    return { friends: [], pendingRequests: [], allUsers: [] };
  }
}

export function useFriendsQuery(userId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => fetchFriends(userId!),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 30000, // 30 seconds
    gcTime: 600000, // 10 minutes
    refetchOnFocus: false,
  });

  const refetch = useCallback(() => {
    console.log('useFriendsQuery: Manual refetch triggered');
    return queryClient.invalidateQueries({ queryKey: ['friends', userId] });
  }, [queryClient, userId]);

  return {
    friends: query.data?.friends || [],
    pendingRequests: query.data?.pendingRequests || [],
    allUsers: query.data?.allUsers || [],
    loading: query.isLoading,
    error: query.error,
    refetch,
    isRefetching: query.isRefetching,
  };
}
