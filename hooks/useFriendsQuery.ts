import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client;
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

type FriendsResult = {
  friends: FriendWithDetails[];
  pendingRequests: FriendWithDetails[];
  allUsers: UserWithStatus[];
};

async function fetchFriendsCore(userId: string): Promise<Omit<FriendsResult, 'allUsers'>> {
  if (!isSupabaseConfigured()) {
    return { friends: [], pendingRequests: [] };
  }

  // 1) friendships (accepted + pending both directions)
  const { data: friendships, error: friendshipsError } = await supabase
    .from('friends')
    .select('id, user_id, friend_id, status, created_at')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .limit(300);

  if (friendshipsError) throw friendshipsError;

  const rows = friendships || [];

  // otherUserId -> friendship row
  const friendshipByOtherId = new Map<string, any>();
  for (const f of rows) {
    const otherId = f.user_id === userId ? f.friend_id : f.user_id;
    friendshipByOtherId.set(otherId, f);
  }

  const otherUserIds = Array.from(friendshipByOtherId.keys());

  // 2) user details for those other users (public.users)
  const userMap = new Map<string, any>();
  if (otherUserIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
      .in('id', otherUserIds);

    if (usersError) throw usersError;

    (users || []).forEach((u: any) => userMap.set(u.id, u));
  }

  // 3) active check-ins for those users (single query)
  const atCourtSet = new Set<string>();
  if (otherUserIds.length > 0) {
    const { data: activeCheckIns, error: checkInError } = await supabase
      .from('check_ins')
      .select('user_id')
      .in('user_id', otherUserIds)
      .gte('expires_at', new Date().toISOString());

    if (checkInError) throw checkInError;

    (activeCheckIns || []).forEach((ci: any) => atCourtSet.add(ci.user_id));
  }

  const friends: FriendWithDetails[] = [];
  const pendingRequests: FriendWithDetails[] = [];

  for (const [otherId, friendship] of friendshipByOtherId.entries()) {
    const otherUser = userMap.get(otherId);
    // Handle missing profile: still include friend with id/name fallback so count and list stay in sync
    const firstName = otherUser?.first_name ?? null;
    const lastName = otherUser?.last_name ?? null;
    const pickleballerNickname = otherUser?.pickleballer_nickname ?? null;

    const friendDetails: FriendWithDetails = {
      id: friendship.id,
      userId: userId,
      friendId: otherId,
      status: friendship.status,
      createdAt: friendship.created_at,
      friendFirstName: firstName ?? undefined,
      friendLastName: lastName ?? undefined,
      friendNickname: pickleballerNickname ?? undefined,
      friendExperienceLevel: otherUser?.experience_level as FriendWithDetails['friendExperienceLevel'],
      friendDuprRating: otherUser?.dupr_rating,
      isAtCourt: atCourtSet.has(otherId),
    } as FriendWithDetails;

    if (friendship.status === 'accepted') {
      friends.push(friendDetails);
    } else if (friendship.status === 'pending' && friendship.friend_id === userId) {
      pendingRequests.push(friendDetails);
    }
  }

  return { friends, pendingRequests };
}

async function fetchAllUsersForSearch(userId: string): Promise<UserWithStatus[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: allUsersData, error: allUsersError } = await supabase
    .from('users')
    .select('id, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
    .neq('id', userId)
    .limit(250);

  if (allUsersError) throw allUsersError;

  // Also fetch relationships so we can show status in search results
  const { data: friendships, error: friendshipsError } = await supabase
    .from('friends')
    .select('id, user_id, friend_id, status')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .limit(300);

  if (friendshipsError) throw friendshipsError;

  const rows = friendships || [];
  const friendshipByOtherId = new Map<string, any>();
  for (const f of rows) {
    const otherId = f.user_id === userId ? f.friend_id : f.user_id;
    friendshipByOtherId.set(otherId, f);
  }

  return (allUsersData || []).map((u: any) => {
    const f = friendshipByOtherId.get(u.id);

    let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
    let friendshipId: string | undefined;

    if (f) {
      friendshipId = f.id;
      if (f.status === 'accepted') friendshipStatus = 'accepted';
      else if (f.status === 'pending') friendshipStatus = f.user_id === userId ? 'pending_sent' : 'pending_received';
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
}

/**
 * loadAllUsers = false by default (fast)
 * set true ONLY when user is on Search tab
 */
export function useFriendsQuery(userId?: string, loadAllUsers: boolean = false) {
  const queryClient = useQueryClient();

  // Friends + pending (fast)
  const friendsQuery = useQuery({
    queryKey: ['friends-core', userId],
    queryFn: () => fetchFriendsCore(userId!),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 30_000,
    gcTime: 600_000,
    refetchOnFocus: false,
  });

  // Search users (only when needed)
  const allUsersQuery = useQuery({
    queryKey: ['friends-search-users', userId],
    queryFn: () => fetchAllUsersForSearch(userId!),
    enabled: !!userId && loadAllUsers && isSupabaseConfigured(),
    staleTime: 60_000,
    gcTime: 600_000,
    refetchOnFocus: false,
  });

  const refetch = useCallback(() => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['friends-core', userId] }),
      queryClient.invalidateQueries({ queryKey: ['friends-search-users', userId] }),
    ]);
  }, [queryClient, userId]);

  return {
    friends: friendsQuery.data?.friends || [],
    pendingRequests: friendsQuery.data?.pendingRequests || [],
    allUsers: allUsersQuery.data || [],
    loading: friendsQuery.isLoading, // keep behavior: skeleton tied to friends load
    error: friendsQuery.error || allUsersQuery.error,
    refetch,
    isRefetching: friendsQuery.isRefetching || allUsersQuery.isRefetching,
  };
}
