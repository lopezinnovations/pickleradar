
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { SkillLevelBars } from '@/components/SkillLevelBars';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  pickleballer_nickname?: string;
  experience_level?: string;
  dupr_rating?: number;
  profile_picture_url?: string;
  created_at?: string;
}

interface CheckInHistory {
  courtName: string;
  checkedInAt: string;
  skillLevel: string;
}

interface CurrentCheckIn {
  courtName: string;
  skillLevel: string;
  expiresAt: string;
  remainingMinutes: number;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user: currentUser } = useAuth();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<CheckInHistory[]>([]);
  const [currentCheckIn, setCurrentCheckIn] = useState<CurrentCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUserProfile = useCallback(async () => {
    if (!id || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      console.log('UserProfile: Fetched user profile:', data);
      setUserProfile(data);
    } catch (error) {
      console.log('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCurrentCheckIn = useCallback(async () => {
    if (!id || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('skill_level, expires_at, courts(name)')
        .eq('user_id', id)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setCurrentCheckIn(null);
          return;
        }
        throw error;
      }

      if (data) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        const remainingMinutes = Math.max(0, Math.floor(diffMs / 60000));

        setCurrentCheckIn({
          courtName: (data as any).courts?.name || 'Unknown Court',
          skillLevel: data.skill_level,
          expiresAt: data.expires_at,
          remainingMinutes,
        });
      } else {
        setCurrentCheckIn(null);
      }
    } catch (error) {
      console.log('Error fetching current check-in:', error);
      setCurrentCheckIn(null);
    }
  }, [id]);

  const fetchCheckInHistory = useCallback(async () => {
    if (!id || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('skill_level, created_at, courts(name)')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const history: CheckInHistory[] = (data || []).map((checkIn: any) => ({
        courtName: checkIn.courts?.name || 'Unknown Court',
        checkedInAt: checkIn.created_at,
        skillLevel: checkIn.skill_level,
      }));

      setCheckInHistory(history);
    } catch (error) {
      console.log('Error fetching check-in history:', error);
    }
  }, [id]);

  const fetchFriendshipStatus = useCallback(async () => {
    if (!id || !currentUser || !isSupabaseConfigured()) return;

    try {
      console.log('UserProfile: Checking friendship status between', currentUser.id, 'and', id);
      
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${currentUser.id})`);

      if (error && error.code !== 'PGRST116') {
        console.error('UserProfile: Error fetching friendship status:', error);
        throw error;
      }

      console.log('UserProfile: Friendship data:', data);

      if (data && data.length > 0) {
        const friendship = data[0];
        setFriendshipId(friendship.id);
        
        if (friendship.status === 'accepted') {
          setFriendshipStatus('accepted');
        } else if (friendship.status === 'pending') {
          if (friendship.user_id === currentUser.id) {
            setFriendshipStatus('pending_sent');
          } else {
            setFriendshipStatus('pending_received');
          }
        }
        
        console.log('UserProfile: Friendship status set to:', friendship.status);
      } else {
        console.log('UserProfile: No friendship found');
        setFriendshipStatus('none');
      }
    } catch (error) {
      console.log('Error fetching friendship status:', error);
    }
  }, [id, currentUser]);

  useEffect(() => {
    if (id && currentUser) {
      fetchUserProfile();
      fetchCurrentCheckIn();
      fetchCheckInHistory();
      fetchFriendshipStatus();
    }
  }, [id, currentUser, fetchUserProfile, fetchCurrentCheckIn, fetchCheckInHistory, fetchFriendshipStatus]);

  const handleSendFriendRequest = async () => {
    if (!currentUser || !id || !isSupabaseConfigured()) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('friends')
        .insert([
          {
            user_id: currentUser.id,
            friend_id: id,
            status: 'pending',
          },
        ]);

      if (error) throw error;

      Alert.alert('Success', 'Friend request sent!');
      await fetchFriendshipStatus();
    } catch (error: any) {
      console.log('Error sending friend request:', error);
      Alert.alert('Error', error.message || 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!friendshipId || !isSupabaseConfigured()) return;

    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this friend request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await supabase
                .from('friends')
                .delete()
                .eq('id', friendshipId);

              if (error) throw error;

              Alert.alert('Success', 'Friend request cancelled');
              setFriendshipStatus('none');
              setFriendshipId(null);
            } catch (error: any) {
              console.log('Error cancelling request:', error);
              Alert.alert('Error', error.message || 'Failed to cancel request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveFriend = async () => {
    if (!friendshipId || !isSupabaseConfigured()) return;

    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await supabase
                .from('friends')
                .delete()
                .eq('id', friendshipId);

              if (error) throw error;

              Alert.alert('Success', 'Friend removed');
              setFriendshipStatus('none');
              setFriendshipId(null);
            } catch (error: any) {
              console.log('Error removing friend:', error);
              Alert.alert('Error', error.message || 'Failed to remove friend');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatUserName = (firstName?: string, lastName?: string, nickname?: string, email?: string, phone?: string) => {
    if (firstName && lastName) {
      const displayName = `${firstName} ${lastName.charAt(0)}.`;
      if (nickname) {
        return `${displayName} (${nickname})`;
      }
      return displayName;
    }
    if (nickname) {
      return nickname;
    }
    return email || phone || 'Unknown User';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatRemainingTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m remaining`;
    }
    return `${mins}m remaining`;
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <IconSymbol 
          ios_icon_name="person.crop.circle.badge.xmark" 
          android_material_icon_name="person-off" 
          size={64} 
          color={colors.textSecondary} 
        />
        <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
          User Not Found
        </Text>
        <TouchableOpacity
          style={[buttonStyles.primary, { marginTop: 24 }]}
          onPress={() => router.back()}
        >
          <Text style={buttonStyles.text}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFriend = friendshipStatus === 'accepted';
  const displayName = formatUserName(
    userProfile.first_name,
    userProfile.last_name,
    userProfile.pickleballer_nickname,
    userProfile.email,
    userProfile.phone
  );

  return (
    <View style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol 
            ios_icon_name="chevron.left" 
            android_material_icon_name="chevron-left" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {userProfile.profile_picture_url && isFriend ? (
              <Image 
                source={{ uri: userProfile.profile_picture_url }} 
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <IconSymbol 
                ios_icon_name="person.crop.circle.fill" 
                android_material_icon_name="account-circle" 
                size={64} 
                color={colors.primary} 
              />
            )}
          </View>
          <Text style={[commonStyles.title, { color: colors.primary, fontSize: 22, marginTop: 16 }]}>
            {displayName}
          </Text>
          
          {!isFriend && (
            <View style={[commonStyles.card, { marginTop: 16, backgroundColor: colors.highlight, padding: 12 }]}>
              <View style={styles.privacyNotice}>
                <IconSymbol 
                  ios_icon_name="lock.fill" 
                  android_material_icon_name="lock" 
                  size={16} 
                  color={colors.textSecondary} 
                />
                <Text style={[commonStyles.textSecondary, { marginLeft: 8, fontSize: 13 }]}>
                  Limited profile - Add as friend to see more
                </Text>
              </View>
            </View>
          )}

          {isFriend && currentCheckIn && (
            <View style={[commonStyles.card, { marginTop: 16, backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <View style={styles.presenceHeader}>
                <IconSymbol 
                  ios_icon_name="location.fill" 
                  android_material_icon_name="location_on" 
                  size={20} 
                  color={colors.success} 
                />
                <Text style={[commonStyles.subtitle, { color: colors.success, marginLeft: 8 }]}>
                  Currently Playing
                </Text>
              </View>
              <Text style={[commonStyles.text, { marginTop: 8, fontWeight: '600' }]}>
                {currentCheckIn.courtName}
              </Text>
              <Text style={[commonStyles.textSecondary, { marginTop: 4 }]}>
                {currentCheckIn.skillLevel} • {formatRemainingTime(currentCheckIn.remainingMinutes)}
              </Text>
            </View>
          )}

          {isFriend && !currentCheckIn && (
            <View style={[commonStyles.card, { marginTop: 16, backgroundColor: colors.highlight }]}>
              <View style={styles.presenceHeader}>
                <IconSymbol 
                  ios_icon_name="location.slash" 
                  android_material_icon_name="location-off" 
                  size={20} 
                  color={colors.textSecondary} 
                />
                <Text style={[commonStyles.textSecondary, { marginLeft: 8 }]}>
                  Not checked in
                </Text>
              </View>
            </View>
          )}
          
          {userProfile.experience_level && (
            <View style={styles.userStats}>
              {isFriend && (
                <React.Fragment>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{checkInHistory.length}</Text>
                    <Text style={commonStyles.textSecondary}>Check-ins</Text>
                  </View>
                  <View style={styles.separator} />
                </React.Fragment>
              )}
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userProfile.experience_level}</Text>
                <Text style={commonStyles.textSecondary}>Skill Level</Text>
              </View>
              
              {userProfile.dupr_rating && (
                <React.Fragment>
                  <View style={styles.separator} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{userProfile.dupr_rating}</Text>
                    <Text style={commonStyles.textSecondary}>DUPR</Text>
                  </View>
                </React.Fragment>
              )}
            </View>
          )}

          {userProfile.experience_level && (
            <View style={styles.skillLevelBarContainer}>
              <SkillLevelBars 
                averageSkillLevel={0}
                skillLevel={userProfile.experience_level as 'Beginner' | 'Intermediate' | 'Advanced'}
                size={12}
                color={colors.primary}
              />
            </View>
          )}

          {currentUser && currentUser.id !== id && (
            <View style={styles.actionButtonContainer}>
              {friendshipStatus === 'none' && (
                <TouchableOpacity
                  style={buttonStyles.primary}
                  onPress={handleSendFriendRequest}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <React.Fragment>
                      <IconSymbol 
                        ios_icon_name="person.badge.plus" 
                        android_material_icon_name="person-add" 
                        size={20} 
                        color={colors.card} 
                      />
                      <Text style={[buttonStyles.text, { marginLeft: 8 }]}>Add Friend</Text>
                    </React.Fragment>
                  )}
                </TouchableOpacity>
              )}

              {friendshipStatus === 'pending_sent' && (
                <TouchableOpacity
                  style={[buttonStyles.secondary, { backgroundColor: colors.accent }]}
                  onPress={handleCancelRequest}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <React.Fragment>
                      <IconSymbol 
                        ios_icon_name="person.badge.minus" 
                        android_material_icon_name="person-remove" 
                        size={20} 
                        color={colors.card} 
                      />
                      <Text style={[buttonStyles.text, { marginLeft: 8 }]}>Cancel Request</Text>
                    </React.Fragment>
                  )}
                </TouchableOpacity>
              )}

              {(friendshipStatus === 'none' || friendshipStatus === 'pending_sent' || friendshipStatus === 'pending_received') && (
                <TouchableOpacity
                  style={[buttonStyles.secondary, { marginTop: 12 }]}
                  onPress={() => router.push(`/conversation/${id}`)}
                >
                  <IconSymbol 
                    ios_icon_name="envelope.fill" 
                    android_material_icon_name="mail" 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={[buttonStyles.text, { marginLeft: 8, color: colors.primary }]}>Send Message</Text>
                </TouchableOpacity>
              )}

              {friendshipStatus === 'accepted' && (
                <React.Fragment>
                  <TouchableOpacity
                    style={buttonStyles.primary}
                    onPress={() => router.push(`/conversation/${id}`)}
                  >
                    <IconSymbol 
                      ios_icon_name="envelope.fill" 
                      android_material_icon_name="mail" 
                      size={20} 
                      color={colors.card} 
                    />
                    <Text style={[buttonStyles.text, { marginLeft: 8 }]}>Send Message</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[buttonStyles.secondary, { backgroundColor: colors.accent, marginTop: 12 }]}
                    onPress={handleRemoveFriend}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={colors.card} />
                    ) : (
                      <React.Fragment>
                        <IconSymbol 
                          ios_icon_name="person.badge.minus" 
                          android_material_icon_name="person-remove" 
                          size={20} 
                          color={colors.card} 
                        />
                        <Text style={[buttonStyles.text, { marginLeft: 8 }]}>Remove Friend</Text>
                      </React.Fragment>
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              )}
            </View>
          )}
        </View>

        {isFriend && (
          <View style={commonStyles.card}>
            <View style={styles.historyHeader}>
              <Text style={commonStyles.subtitle}>Check-In History</Text>
              <Text style={commonStyles.textSecondary}>
                {checkInHistory.length} total
              </Text>
            </View>
            
            {checkInHistory.length > 0 ? (
              <View style={styles.historyList}>
                {checkInHistory.map((checkIn, index) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyIcon}>
                      <IconSymbol 
                        ios_icon_name="location.fill" 
                        android_material_icon_name="location_on" 
                        size={20} 
                        color={colors.primary} 
                      />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={commonStyles.text}>{checkIn.courtName}</Text>
                      <Text style={commonStyles.textSecondary}>
                        {formatDate(checkIn.checkedInAt)} • {checkIn.skillLevel}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyHistory}>
                <Text style={commonStyles.textSecondary}>
                  No check-ins yet
                </Text>
              </View>
            )}
          </View>
        )}

        {isFriend && userProfile.created_at && (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Member Since</Text>
            <Text style={[commonStyles.text, { marginTop: 8 }]}>
              {formatDate(userProfile.created_at)}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  presenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 80,
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  skillLevelBarContainer: {
    width: '80%',
    marginTop: 16,
  },
  actionButtonContainer: {
    width: '100%',
    marginTop: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyList: {
    marginTop: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  emptyHistory: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
