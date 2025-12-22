
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { Friend, FriendWithDetails } from '@/types';

export const useFriends = (userId: string | undefined) => {
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      // Fetch accepted friends
      const { data: acceptedFriends, error: friendsError } = await supabase
        .from('friends')
        .select(`
          *,
          friend:users!friends_friend_id_fkey(id, email, skill_level)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendsError) throw friendsError;

      // Fetch pending requests (where user is the recipient)
      const { data: pending, error: pendingError } = await supabase
        .from('friends')
        .select(`
          *,
          requester:users!friends_user_id_fkey(id, email, skill_level)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Get check-in info for friends
      const friendsWithDetails: FriendWithDetails[] = await Promise.all(
        (acceptedFriends || []).map(async (friendship: any) => {
          const friendData = friendship.friend;
          
          // Check if friend is currently checked in
          const { data: checkIn } = await supabase
            .from('check_ins')
            .select('court_id, courts(name)')
            .eq('user_id', friendData.id)
            .gte('expires_at', new Date().toISOString())
            .single();

          return {
            id: friendship.id,
            userId: friendship.user_id,
            friendId: friendship.friend_id,
            status: friendship.status,
            createdAt: friendship.created_at,
            friendEmail: friendData.email,
            friendSkillLevel: friendData.skill_level,
            currentCourtId: checkIn?.court_id,
            currentCourtName: checkIn?.courts?.name,
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
          friendSkillLevel: requesterData.skill_level,
        };
      });

      setFriends(friendsWithDetails);
      setPendingRequests(pendingWithDetails);
    } catch (error) {
      console.log('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && isSupabaseConfigured()) {
      fetchFriends();
    } else {
      setLoading(false);
    }
  }, [userId, fetchFriends]);

  const sendFriendRequest = async (friendEmail: string) => {
    if (!userId || !isSupabaseConfigured()) {
      return { success: false, error: 'Not configured' };
    }

    try {
      // Find user by email
      const { data: friendUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', friendEmail)
        .single();

      if (userError || !friendUser) {
        return { success: false, error: 'User not found' };
      }

      if (friendUser.id === userId) {
        return { success: false, error: 'Cannot add yourself as a friend' };
      }

      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${userId})`)
        .single();

      if (existing) {
        return { success: false, error: 'Friend request already exists' };
      }

      // Create friend request
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
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    refetch: fetchFriends,
  };
};
