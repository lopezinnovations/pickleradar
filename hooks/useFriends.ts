
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
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  friendshipId?: string;
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
      console.log('Fetching all users for userId:', userId);
      
      // Get all users except the current user
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, phone, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
        .neq('id', userId);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      console.log('Fetched users:', users?.length);

      // Get all users who are currently checked in
      const { data: checkIns, error: checkInsError } = await supabase
        .from('check_ins')
        .select('user_id')
        .gte('expires_at', new Date().toISOString());

      if (checkInsError) {
        console.error('Error fetching check-ins:', checkInsError);
        throw checkInsError;
      }

      const checkedInUserIds = new Set((checkIns || []).map(ci => ci.user_id));

      // Get ALL friend relationships (not just accepted ones)
      const { data: allRelationships, error: relationshipsError } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (relationshipsError) {
        console.error('Error fetching relationships:', relationshipsError);
        throw relationshipsError;
      }

      console.log('Fetched relationships:', allRelationships?.length);

      // Create a map of user relationships
      const relationshipMap = new Map<string, { status: string; friendshipId: string; isSender: boolean }>();
      (allRelationships || []).forEach(rel => {
        const otherUserId = rel.user_id === userId ? rel.friend_id : rel.user_id;
        const isSender = rel.user_id === userId;
        
        if (rel.status === 'accepted') {
          relationshipMap.set(otherUserId, { 
            status: 'accepted', 
            friendshipId: rel.id,
            isSender 
          });
        } else if (rel.status === 'pending') {
          // Determine if this is a sent or received request
          const friendshipStatus = isSender ? 'pending_sent' : 'pending_received';
          relationshipMap.set(otherUserId, { 
            status: friendshipStatus, 
            friendshipId: rel.id,
            isSender 
          });
        }
      });

      // Get courts played by each user
      const { data: userCheckIns, error: userCheckInsError } = await supabase
        .from('check_ins')
        .select('user_id, court_id, courts(name)');

      if (userCheckInsError) {
        console.error('Error fetching user check-ins:', userCheckInsError);
        throw userCheckInsError;
      }

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

      // Map users with their relationship status
      const usersWithStatus: UserWithStatus[] = (users || []).map(user => {
        const relationship = relationshipMap.get(user.id);
        return {
          ...user,
          isAtCourt: checkedInUserIds.has(user.id),
          courtsPlayed: userCourtsMap.has(user.id) 
            ? Array.from(userCourtsMap.get(user.id)!) 
            : [],
          friendshipStatus: relationship?.status as any || 'none',
          friendshipId: relationship?.friendshipId,
        };
      });

      console.log('Users with status:', usersWithStatus.length);
      setAllUsers(usersWithStatus);
    } catch (error) {
      console.error('Error in fetchAllUsers:', error);
    }
  }, [userId]);

  const fetchFriends = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      console.log('useFriends: Fetching friends for userId:', userId);

      // Fetch accepted friends where current user is the sender (user_id)
      const { data: sentFriends, error: sentError } = await supabase
        .from('friends')
        .select(`
          *,
          friend:users!friends_friend_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (sentError) {
        console.error('useFriends: Error fetching sent friends:', sentError);
        throw sentError;
      }

      console.log('useFriends: Sent friends:', sentFriends?.length || 0);

      // Fetch accepted friends where current user is the receiver (friend_id)
      const { data: receivedFriends, error: receivedError } = await supabase
        .from('friends')
        .select(`
          *,
          requester:users!friends_user_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `)
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      if (receivedError) {
        console.error('useFriends: Error fetching received friends:', receivedError);
        throw receivedError;
      }

      console.log('useFriends: Received friends:', receivedFriends?.length || 0);

      // Fetch pending requests where current user is the receiver
      const { data: pending, error: pendingError } = await supabase
        .from('friends')
        .select(`
          *,
          requester:users!friends_user_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (pendingError) {
        console.error('useFriends: Error fetching pending requests:', pendingError);
        throw pendingError;
      }

      console.log('useFriends: Pending requests:', pending?.length || 0);

      // Process sent friends (where current user is user_id)
      const sentFriendsWithDetails: FriendWithDetails[] = await Promise.all(
        (sentFriends || []).map(async (friendship: any) => {
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

      // Process received friends (where current user is friend_id)
      const receivedFriendsWithDetails: FriendWithDetails[] = await Promise.all(
        (receivedFriends || []).map(async (friendship: any) => {
          const friendData = friendship.requester;
          
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
            friendId: friendship.user_id, // The friend is the user_id in this case
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

      // Combine both lists
      const allFriends = [...sentFriendsWithDetails, ...receivedFriendsWithDetails];
      console.log('useFriends: Total friends:', allFriends.length);

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

      setFriends(allFriends);
      setPendingRequests(pendingWithDetails);
      
      // Also fetch all users
      await fetchAllUsers();
    } catch (error) {
      console.error('Error fetching friends:', error);
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
      console.error('Error sending friend request:', error);
      return { success: false, error: error.message };
    }
  };

  const sendFriendRequestById = async (friendId: string) => {
    if (!userId || !isSupabaseConfigured()) {
      console.error('sendFriendRequestById: Not configured or no userId');
      return { success: false, error: 'Not configured' };
    }

    try {
      console.log('Sending friend request from', userId, 'to', friendId);
      
      if (friendId === userId) {
        console.error('Cannot add yourself as a friend');
        return { success: false, error: 'Cannot add yourself as a friend' };
      }

      // Check if a relationship already exists
      const { data: existing, error: existingError } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (existingError) {
        console.error('Error checking existing relationship:', existingError);
        throw existingError;
      }

      if (existing && existing.length > 0) {
        console.log('Relationship already exists:', existing);
        return { success: false, error: 'Friend request already exists' };
      }

      console.log('Inserting new friend request');
      const { data: insertData, error: insertError } = await supabase
        .from('friends')
        .insert([
          {
            user_id: userId,
            friend_id: friendId,
            status: 'pending',
          },
        ])
        .select();

      if (insertError) {
        console.error('Error inserting friend request:', insertError);
        throw insertError;
      }

      console.log('Friend request inserted successfully:', insertData);
      
      // Refresh the data
      await fetchFriends();
      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error in sendFriendRequestById:', error);
      return { success: false, error: error.message || 'Failed to send friend request' };
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
      console.error('Error accepting friend request:', error);
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
      console.error('Error rejecting friend request:', error);
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
  };
};
