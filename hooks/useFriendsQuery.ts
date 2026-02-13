import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { FriendWithDetails } from '@/types';

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
    return { friends: [], pendingRequests: [], allUsers: [] as UserWithStatus[] };
  }

  try {
    // Fetch all friendships involving this user
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, status, created_at')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .limit(300);

    if (friendshipsError) throw friendshipsError;

    const rows = friendships || [];

    // Build a map: otherUserId -> friendshipRow (the row involving ME + THEM)
    const friendshipByOtherId = new Map<string, any>();
    for (const f of rows) {
      const otherId = f.user_id === userId ? f.friend_id : f.user_id;
      friendshipByOtherId.set(otherId, f);
    }

    // Collect unique other user ids for details fetch
    const otherUserIds = Array.from(friendshipByOtherId.keys());

    // Fetch user details for friends/requests
    const userMap = new Map<string, any>();
    if (otherUserIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
        .in('id', otherUserIds);

      if (usersError) throw usersError;

      (users || []).forEach((u: any) => userMap.set(u.id, u));
    }

    const friends: FriendWithDetails[] = [];
    const pendingRequests: FriendWithDetails[] = [];

    for (const [otherId, friendship] of friendshipByOtherId.entries()) {
      const otherUser = userMap.get(otherId);
      if (!otherUser) continue;

      const friendDetails: FriendWithDetails = {
        id: friendship.id,
        userId: otherId,
        firstName: otherUser.first_name,
        lastName: otherUser.last_name,
        pickleballerNickname: otherUser.pickleballer_nickname,
        experienceLevel: otherUser.experience_level,
        duprRating: otherUser.dupr_rating,
        status: friendship.status,
        createdAt: friendship.created_at,
        isAtCourt: false,
      };

      if (friendship.status === 'accepted') {
        friends.push(friendDetails);
      } else if (friendship.status === 'pending' && friendship.friend_id === userId) {
        // pending request TO me (I can accept/decline)
        pendingRequests.push(friendDetails);
      }
    }

    // Fetch all users for search
    const { data: allUsersData, error: allUsersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
      .neq('id', userId)
      .limit(200);

    if (allUsersError) throw allUsersError;

    const allUsers: UserWithStatus[] = (allUsersData || []).map((u: any) => {
      const f = friendshipByOtherId.get(u.id);

      let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
      let friendshipId: string | undefined;

      if (f) {
        friendshipId = f.id;

        if (f.status === 'accepted') {
          friendshipStatus = 'accepted';
        } else if (f.status === 'pending') {
          // If I am user_id, I sent it. Otherwise I received it.
          friendshipStatus = f.user_id === userId ? 'pending_sent' : 'pending_received';
        }
      }

      return {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        pickleballer_nickname: u.pickleballer_nickname,
        experience_level: u.experience_level,
        dupr_rating: u.dupr_rating,
        isAtCourt: false,
        friendshipStatus,
        friendshipId,
      };
    });

    console.log(
      'useFriendsQuery: Loaded',
      friends.length,
      'friends,',
      pendingRequests.length,
      'pending requests,',
      allUsers.length,
      'total users'
    );

    return { friends, pendingRequests, allUsers };
  } catch (error) {
    console.error('useFriendsQuery: Error fetching friends:', error);
    return { friends: [], pendingRequests: [], allUsers: [] as UserWithStatus[] };
  }
}

export function useFriendsQuery(userId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => fetchFriends(userId!),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 30000,
    gcTime: 600000,
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
