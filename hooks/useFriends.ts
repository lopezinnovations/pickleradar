
import { useState, useEffect, useCallback } from 'react';
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
}

export const useFriends = (userId: string | undefined) => {
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithDetails[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const getRemainingTime = (expiresAt: string): { hours: number; minutes: number; totalMinutes: number } => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes };
  };

  const fetchAllUsers = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      return;
    }

    try {
      // Get all users except the current user
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, phone, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
        .neq('id', userId);

      if (usersError) throw usersError;

      // Get all users who are currently checked in
      const { data: checkIns, error: checkInsError } = await supabase
        .from('check_ins')
        .select('user_id')
        .gte('expires_at', new Date().toISOString());

      if (checkInsError) throw checkInsError;

      const checkedInUserIds = new Set((checkIns || []).map(ci => ci.user_id));

      // Get existing friend relationships and pending requests
      const { data: existingRelationships, error: relationshipsError } = await supabase
        .from('friends')
        .select('friend_id, user_id, status')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (relationshipsError) throw relationshipsError;

      // Create a set of user IDs that are already friends or have pending requests
      const relatedUserIds = new Set(
        (existingRelationships || []).flatMap(r => [r.user_id, r.friend_id]).filter(id => id !== userId)
      );

      // Get courts played by each user
      const { data: userCheckIns, error: userCheckInsError } = await supabase
        .from('check_ins')
        .select('user_id, court_id, courts(name)');

      if (userCheckInsError) throw userCheckInsError;

      // Create a map of user_id to courts played
      const userCourtsMap = new Map<string, Set<string>>();
      (userCheckIns || []).forEach((checkIn: any) => {
        if (checkIn.courts?.name) {
          if (!userCourtsMap.has(checkIn.user_id)) {
            userCourtsMap.set(checkIn.user_id, new Set());
          }
          userCourtsMap.get(checkIn.user_id)?.add(checkIn.courts.name);
        }
      });

      // Filter out users who are already friends or have pending requests
      const usersWithStatus: UserWithStatus[] = (users || [])
        .filter(user => !relatedUserIds.has(user.id))
        .map(user => ({
          ...user,
          isAtCourt: checkedInUserIds.has(user.id),
          courtsPlayed: userCourtsMap.has(user.id) 
            ? Array.from(userCourtsMap.get(user.id)!) 
            : [],
        }));

      setAllUsers(usersWithStatus);
    } catch (error) {
      console.log('Error fetching all users:', error);
    }
  }, [userId]);

  const fetchFriends = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const { data: acceptedFriends, error: friendsError } = await supabase
        .from('friends')
        .select(`
          *,
          friend:users!friends_friend_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendsError) throw friendsError;

      const { data: pending, error: pendingError } = await supabase
        .from('friends')
        .select(`
          *,
          requester:users!friends_user_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      const friendsWithDetails: FriendWithDetails[] = await Promise.all(
        (acceptedFriends || []).map(async (friendship: any) => {
          const friendData = friendship.friend;
          
          const { data: checkIn } = await supabase
            .from('check_ins')
            .select('court_id, expires_at, courts(name)')
            .eq('user_id', friendData.id)
            .gte('expires_at', new Date().toISOString())
            .single();

          let remainingTime = undefined;
          if (checkIn?.expires_at) {
            remainingTime = getRemainingTime(checkIn.expires_at);
          }

          return {
            id: friendship.id,
            userId: friendship.user_id,
            friendId: friendship.friend_id,
            status: friendship.status,
            createdAt: friendship.created_at,
            friendEmail: friendData.email,
            friendPhone: friendData.phone,
            friendFirstName: friendData.first_name,
            friendLastName: friendData.last_name,
            friendNickname: friendData.pickleballer_nickname,
            friendSkillLevel: friendData.skill_level,
            friendExperienceLevel: friendData.experience_level,
            friendDuprRating: friendData.dupr_rating,
            currentCourtId: checkIn?.court_id,
            currentCourtName: checkIn?.courts?.name,
            remainingTime,
          };
        })
      );

      const pendingWithDetails: FriendWithDetails[] = (pending || []).map((friendship: any) => {
        const requesterData = friendship.requester;
        return {
          id: friendship.id,
          userId: friendship.user_id,
          friendId: friendship.friend_id,
          status: friendship.status,
          createdAt: friendship.created_at,
          friendEmail: requesterData.email,
          friendPhone: requesterData.phone,
          friendFirstName: requesterData.first_name,
          friendLastName: requesterData.last_name,
          friendNickname: requesterData.pickleballer_nickname,
          friendSkillLevel: requesterData.skill_level,
          friendExperienceLevel: requesterData.experience_level,
          friendDuprRating: requesterData.dupr_rating,
        };
      });

      setFriends(friendsWithDetails);
      setPendingRequests(pendingWithDetails);
      
      // Also fetch all users
      await fetchAllUsers();
    } catch (error) {
      console.log('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchAllUsers]);

  useEffect(() => {
    if (userId && isSupabaseConfigured()) {
      fetchFriends();
    } else {
      setLoading(false);
    }
  }, [userId, fetchFriends]);

  const sendFriendRequest = async (friendIdentifier: string) => {
    if (!userId || !isSupabaseConfigured()) {
      return { success: false, error: 'Not configured' };
    }

    try {
      // Try to find user by phone or email
      let friendUser = null;
      
      // Check if it looks like a phone number (contains digits and possibly +, -, (, ), spaces)
      const isPhone = /[\d+\-() ]/.test(friendIdentifier) && friendIdentifier.replace(/[\D]/g, '').length >= 10;
      
      if (isPhone) {
        // Clean phone number
        const cleanPhone = friendIdentifier.replace(/\D/g, '');
        const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;
        
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('phone', formattedPhone)
          .single();
        
        if (!error && data) {
          friendUser = data;
        }
      } else {
        // Try email
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', friendIdentifier)
          .single();
        
        if (!error && data) {
          friendUser = data;
        }
      }

      if (!friendUser) {
        return { success: false, error: 'User not found' };
      }

      if (friendUser.id === userId) {
        return { success: false, error: 'Cannot add yourself as a friend' };
      }

      const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${userId})`)
        .single();

      if (existing) {
        return { success: false, error: 'Friend request already exists' };
      }

      const { error } = await supabase
        .from('friends')
        .insert([
          {
            user_id: userId,
            friend_id: friendUser.id,
            status: 'pending',
          },
        ]);

      if (error) throw error;

      await fetchFriends();
      return { success: true, error: null };
    } catch (error: any) {
      console.log('Error sending friend request:', error);
      return { success: false, error: error.message };
    }
  };

  const sendFriendRequestById = async (friendId: string) => {
    if (!userId || !isSupabaseConfigured()) {
      return { success: false, error: 'Not configured' };
    }

    try {
      if (friendId === userId) {
        return { success: false, error: 'Cannot add yourself as a friend' };
      }

      const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .single();

      if (existing) {
        return { success: false, error: 'Friend request already exists' };
      }

      const { error } = await supabase
        .from('friends')
        .insert([
          {
            user_id: userId,
            friend_id: friendId,
            status: 'pending',
          },
        ]);

      if (error) throw error;

      await fetchFriends();
      return { success: true, error: null };
    } catch (error: any) {
      console.log('Error sending friend request:', error);
      return { success: false, error: error.message };
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;

      await fetchFriends();
    } catch (error) {
      console.log('Error accepting friend request:', error);
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      await fetchFriends();
    } catch (error) {
      console.log('Error rejecting friend request:', error);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      await fetchFriends();
    } catch (error) {
      console.log('Error removing friend:', error);
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
  };
};
