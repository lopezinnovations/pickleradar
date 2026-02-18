import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client;
import type { FriendWithDetails } from '@/types';

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

type RemainingTime = { hours: number; minutes: number; totalMinutes: number };

const getRemainingTime = (expiresAt: string): RemainingTime => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, totalMinutes };
};

export const useFriends = (userId: string | null | undefined) => {
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithDetails[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Prevent overlapping fetches (focus + refresh + effect)
  const inFlight = useRef(false);

  const fetchAllUsers = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setAllUsers([]);
      return;
    }

    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, phone, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
        .neq('id', userId);

      if (usersError) throw usersError;

      // Active check-ins (who is currently checked in)
      const { data: checkIns, error: checkInsError } = await supabase
        .from('check_ins')
        .select('user_id')
        .gte('expires_at', new Date().toISOString());

      if (checkInsError) throw checkInsError;

      const checkedInUserIds = new Set((checkIns || []).map((ci) => ci.user_id));

      // Relationships involving me (all statuses)
      const { data: allRelationships, error: relationshipsError } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (relationshipsError) throw relationshipsError;

      const relationshipMap = new Map<string, { status: UserWithStatus['friendshipStatus']; friendshipId: string }>();
      (allRelationships || []).forEach((rel) => {
        const otherUserId = rel.user_id === userId ? rel.friend_id : rel.user_id;
        const isSender = rel.user_id === userId;

        if (rel.status === 'accepted') {
          relationshipMap.set(otherUserId, { status: 'accepted', friendshipId: rel.id });
        } else if (rel.status === 'pending') {
          relationshipMap.set(otherUserId, { status: isSender ? 'pending_sent' : 'pending_received', friendshipId: rel.id });
        }
      });

      // Courts played map (optional / can be heavy; keep if you want it)
      const { data: userCheckIns, error: userCheckInsError } = await supabase
        .from('check_ins')
        .select('user_id, courts(name)');

      if (userCheckInsError) throw userCheckInsError;

      const userCourtsMap = new Map<string, Set<string>>();
      (userCheckIns || []).forEach((ci: any) => {
        if (ci.courts?.name) {
          if (!userCourtsMap.has(ci.user_id)) userCourtsMap.set(ci.user_id, new Set());
          userCourtsMap.get(ci.user_id)!.add(ci.courts.name);
        }
      });

      const usersWithStatus: UserWithStatus[] = (users || []).map((u) => {
        const rel = relationshipMap.get(u.id);
        return {
          ...u,
          isAtCourt: checkedInUserIds.has(u.id),
          courtsPlayed: userCourtsMap.has(u.id) ? Array.from(userCourtsMap.get(u.id)!) : [],
          friendshipStatus: rel?.status || 'none',
          friendshipId: rel?.friendshipId,
        };
      });

      setAllUsers(usersWithStatus);
    } catch (err) {
      console.error('Error in fetchAllUsers:', err);
    }
  }, [userId]);

  const fetchFriends = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setFriends([]);
      setPendingRequests([]);
      setAllUsers([]);
      setLoading(false);
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;

    setLoading(true);

    try {
      // 1) Fetch accepted friends (sent)
      const { data: sentFriends, error: sentError } = await supabase
        .from('friends')
        .select(
          `
          id, user_id, friend_id, status, created_at,
          friend:users!friends_friend_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `
        )
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (sentError) throw sentError;

      // 2) Fetch accepted friends (received)
      const { data: receivedFriends, error: receivedError } = await supabase
        .from('friends')
        .select(
          `
          id, user_id, friend_id, status, created_at,
          requester:users!friends_user_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `
        )
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      if (receivedError) throw receivedError;

      // 3) Fetch pending (received)
      const { data: pending, error: pendingError } = await supabase
        .from('friends')
        .select(
          `
          id, user_id, friend_id, status, created_at,
          requester:users!friends_user_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `
        )
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Collect ALL friend user IDs (so we can fetch check-ins in one go)
      const friendIds: string[] = [];
      (sentFriends || []).forEach((f: any) => f.friend?.id && friendIds.push(f.friend.id));
      (receivedFriends || []).forEach((f: any) => f.requester?.id && friendIds.push(f.requester.id));

      // 4) Fetch active check-ins for all friends in one query
      const checkInMap = new Map<
        string,
        { court_id?: string; expires_at?: string; courtName?: string; remainingTime?: RemainingTime }
      >();

      if (friendIds.length > 0) {
        const { data: activeCheckIns, error: checkInError } = await supabase
          .from('check_ins')
          .select('user_id, court_id, expires_at, courts(name)')
          .in('user_id', friendIds)
          .gte('expires_at', new Date().toISOString());

        if (checkInError) throw checkInError;

        (activeCheckIns || []).forEach((ci: any) => {
          const remainingTime = ci.expires_at ? getRemainingTime(ci.expires_at) : undefined;
          checkInMap.set(ci.user_id, {
            court_id: ci.court_id,
            expires_at: ci.expires_at,
            courtName: ci.courts?.name,
            remainingTime,
          });
        });
      }

      // 5) Build friend objects (no per-friend queries)
      const sentFriendsWithDetails: FriendWithDetails[] = (sentFriends || []).map((friendship: any) => {
        const friendData = friendship.friend;
        const ci = friendData?.id ? checkInMap.get(friendData.id) : undefined;

        return {
          id: friendship.id,
          userId: friendship.user_id,
          friendId: friendship.friend_id,
          status: friendship.status,
          createdAt: friendship.created_at,
          friendEmail: friendData?.email,
          friendPhone: friendData?.phone,
          friendFirstName: friendData?.first_name,
          friendLastName: friendData?.last_name,
          friendNickname: friendData?.pickleballer_nickname,
          friendSkillLevel: friendData?.skill_level,
          friendExperienceLevel: friendData?.experience_level,
          friendDuprRating: friendData?.dupr_rating,
          currentCourtId: ci?.court_id,
          currentCourtName: ci?.courtName,
          remainingTime: ci?.remainingTime,
        };
      });

      const receivedFriendsWithDetails: FriendWithDetails[] = (receivedFriends || []).map((friendship: any) => {
        const friendData = friendship.requester;
        const ci = friendData?.id ? checkInMap.get(friendData.id) : undefined;

        return {
          id: friendship.id,
          userId: friendship.user_id,
          // friend is the requester (user_id) in this case
          friendId: friendship.user_id,
          status: friendship.status,
          createdAt: friendship.created_at,
          friendEmail: friendData?.email,
          friendPhone: friendData?.phone,
          friendFirstName: friendData?.first_name,
          friendLastName: friendData?.last_name,
          friendNickname: friendData?.pickleballer_nickname,
          friendSkillLevel: friendData?.skill_level,
          friendExperienceLevel: friendData?.experience_level,
          friendDuprRating: friendData?.dupr_rating,
          currentCourtId: ci?.court_id,
          currentCourtName: ci?.courtName,
          remainingTime: ci?.remainingTime,
        };
      });

      const pendingWithDetails: FriendWithDetails[] = (pending || []).map((friendship: any) => {
        const requesterData = friendship.requester;
        return {
          id: friendship.id,
          userId: friendship.user_id,
          friendId: friendship.friend_id,
          status: friendship.status,
          createdAt: friendship.created_at,
          friendEmail: requesterData?.email,
          friendPhone: requesterData?.phone,
          friendFirstName: requesterData?.first_name,
          friendLastName: requesterData?.last_name,
          friendNickname: requesterData?.pickleballer_nickname,
          friendSkillLevel: requesterData?.skill_level,
          friendExperienceLevel: requesterData?.experience_level,
          friendDuprRating: requesterData?.dupr_rating,
        };
      });

      setFriends([...sentFriendsWithDetails, ...receivedFriendsWithDetails]);
      setPendingRequests(pendingWithDetails);
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      setFriends([]);
      setPendingRequests([]);
      setAllUsers([]);
      setLoading(false);
      return;
    }
    fetchFriends();
  }, [userId, fetchFriends]);

  const sendFriendRequest = async (friendIdentifier: string) => {
    if (!userId || !isSupabaseConfigured()) return { success: false, error: 'Not configured' };

    try {
      let friendUser: { id: string } | null = null;

      const isPhone = /[\d+\-() ]/.test(friendIdentifier) && friendIdentifier.replace(/[\D]/g, '').length >= 10;

      if (isPhone) {
        const cleanPhone = friendIdentifier.replace(/\D/g, '');
        const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;
        const { data } = await supabase.from('users').select('id').eq('phone', formattedPhone).single();
        if (data) friendUser = data;
      } else {
        const { data } = await supabase.from('users').select('id').eq('email', friendIdentifier).single();
        if (data) friendUser = data;
      }

      if (!friendUser) return { success: false, error: 'User not found' };
      if (friendUser.id === userId) return { success: false, error: 'Cannot add yourself as a friend' };

      const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${userId})`)
        .maybeSingle();

      if (existing) return { success: false, error: 'Friend request already exists' };

      const { error } = await supabase.from('friends').insert([{ user_id: userId, friend_id: friendUser.id, status: 'pending' }]);
      if (error) throw error;

      await fetchFriends();
      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      return { success: false, error: error.message };
    }
  };

  const sendFriendRequestById = async (friendId: string) => {
    if (!userId || !isSupabaseConfigured()) return { success: false, error: 'Not configured' };

    try {
      if (friendId === userId) return { success: false, error: 'Cannot add yourself as a friend' };

      const { data: existing, error: existingError } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (existingError) throw existingError;
      if (existing && existing.length > 0) return { success: false, error: 'Friend request already exists' };

      const { error: insertError } = await supabase.from('friends').insert([{ user_id: userId, friend_id: friendId, status: 'pending' }]);
      if (insertError) throw insertError;

      await fetchFriends();
      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error in sendFriendRequestById:', error);
      return { success: false, error: error.message || 'Failed to send friend request' };
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    if (!userId || !isSupabaseConfigured()) return;
    try {
      const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendshipId);
      if (error) throw error;
      await fetchFriends();
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    if (!userId || !isSupabaseConfigured()) return;
    try {
      const { error } = await supabase.from('friends').delete().eq('id', friendshipId);
      if (error) throw error;
      await fetchFriends();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!userId || !isSupabaseConfigured()) return;
    try {
      const { error } = await supabase.from('friends').delete().eq('id', friendshipId);
      if (error) throw error;
      await fetchFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  return {
    friends,
    pendingRequests,
    allUsers,
    loading,
    sendFriendRequest,
    sendFriendRequestById,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    refetch: fetchFriends,
    // call this from the screen ONLY when activeTab === 'search'
    fetchAllUsers,
  };
};
