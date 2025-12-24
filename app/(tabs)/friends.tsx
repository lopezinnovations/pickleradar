
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { IconSymbol } from '@/components/IconSymbol';
import { BrandingFooter } from '@/components/BrandingFooter';

export default function FriendsScreen() {
  const { user } = useAuth();
  const { friends, pendingRequests, activeUsers, loading, sendFriendRequest, sendFriendRequestById, acceptFriendRequest, rejectFriendRequest, removeFriend } = useFriends(user?.id);
  const [friendIdentifier, setFriendIdentifier] = useState('');
  const [sending, setSending] = useState(false);

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

  const handleAddFriend = async () => {
    if (!friendIdentifier.trim()) {
      Alert.alert('Error', 'Please enter a phone number or email address');
      return;
    }

    setSending(true);
    const result = await sendFriendRequest(friendIdentifier.trim().toLowerCase());
    setSending(false);

    if (result.success) {
      Alert.alert('Success', 'Friend request sent!');
      setFriendIdentifier('');
    } else {
      Alert.alert('Error', result.error || 'Failed to send friend request');
    }
  };

  const handleAddFriendById = async (friendId: string, friendName: string) => {
    const result = await sendFriendRequestById(friendId);
    
    if (result.success) {
      Alert.alert('Success', `Friend request sent to ${friendName}!`);
    } else {
      Alert.alert('Error', result.error || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    await acceptFriendRequest(friendshipId);
    Alert.alert('Success', 'Friend request accepted!');
  };

  const handleRejectRequest = async (friendshipId: string) => {
    await rejectFriendRequest(friendshipId);
  };

  const handleRemoveFriend = (friendshipId: string, friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend(friendshipId),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={commonStyles.title}>Friends</Text>
          <Text style={commonStyles.textSecondary}>
            Connect with other pickleball players
          </Text>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.subtitle}>Add Friend</Text>
          <Text style={[commonStyles.textSecondary, { marginTop: 8, marginBottom: 12 }]}>
            Enter your friend&apos;s phone number or email address
          </Text>
          
          <TextInput
            style={commonStyles.input}
            placeholder="+1 (555) 123-4567 or friend@example.com"
            placeholderTextColor={colors.textSecondary}
            value={friendIdentifier}
            onChangeText={setFriendIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[buttonStyles.primary, { marginTop: 12 }]}
            onPress={handleAddFriend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={buttonStyles.text}>Send Request</Text>
            )}
          </TouchableOpacity>
        </View>

        {activeUsers.length > 0 && (
          <View style={styles.section}>
            <Text style={commonStyles.subtitle}>Active Users ({activeUsers.length})</Text>
            <Text style={[commonStyles.textSecondary, { marginTop: 4, marginBottom: 12 }]}>
              Players currently checked in at courts
            </Text>
            {activeUsers.map((activeUser, index) => {
              const displayName = formatUserName(
                activeUser.first_name,
                activeUser.last_name,
                activeUser.pickleballer_nickname
              );
              
              return (
                <View key={index} style={[commonStyles.card, { marginTop: 12 }]}>
                  <View style={styles.friendHeader}>
                    <View style={styles.friendIcon}>
                      <IconSymbol 
                        ios_icon_name="person.fill" 
                        android_material_icon_name="person" 
                        size={24} 
                        color={colors.primary} 
                      />
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={commonStyles.subtitle}>{displayName}</Text>
                      {activeUser.experience_level && (
                        <Text style={commonStyles.textSecondary}>
                          {activeUser.experience_level}
                          {activeUser.dupr_rating && ` • DUPR: ${activeUser.dupr_rating}`}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => handleAddFriendById(activeUser.id, displayName)}
                    >
                      <IconSymbol 
                        ios_icon_name="plus.circle.fill" 
                        android_material_icon_name="add_circle" 
                        size={32} 
                        color={colors.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={commonStyles.subtitle}>Pending Requests ({pendingRequests.length})</Text>
            {pendingRequests.map((request, index) => {
              const displayName = formatUserName(
                request.friendFirstName,
                request.friendLastName,
                request.friendNickname,
                request.friendEmail,
                request.friendPhone
              );
              
              return (
                <View key={index} style={[commonStyles.card, { marginTop: 12 }]}>
                  <View style={styles.friendHeader}>
                    <View style={styles.friendIcon}>
                      <IconSymbol 
                        ios_icon_name="person.fill" 
                        android_material_icon_name="person" 
                        size={24} 
                        color={colors.primary} 
                      />
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={commonStyles.subtitle}>{displayName}</Text>
                      {request.friendExperienceLevel && (
                        <Text style={commonStyles.textSecondary}>
                          {request.friendExperienceLevel}
                          {request.friendDuprRating && ` • DUPR: ${request.friendDuprRating}`}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[buttonStyles.primary, { flex: 1, marginRight: 8 }]}
                      onPress={() => handleAcceptRequest(request.id)}
                    >
                      <Text style={buttonStyles.text}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[buttonStyles.secondary, { flex: 1 }]}
                      onPress={() => handleRejectRequest(request.id)}
                    >
                      <Text style={[buttonStyles.text, { color: colors.text }]}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={commonStyles.subtitle}>
            My Friends ({friends.length})
          </Text>
          
          {friends.length === 0 ? (
            <View style={[commonStyles.card, { marginTop: 12, alignItems: 'center', padding: 32 }]}>
              <IconSymbol 
                ios_icon_name="person.2.slash" 
                android_material_icon_name="people_outline" 
                size={48} 
                color={colors.textSecondary} 
              />
              <Text style={[commonStyles.textSecondary, { marginTop: 16, textAlign: 'center' }]}>
                No friends yet. Add friends to see when they&apos;re playing!
              </Text>
            </View>
          ) : (
            friends.map((friend, index) => {
              const displayName = formatUserName(
                friend.friendFirstName,
                friend.friendLastName,
                friend.friendNickname,
                friend.friendEmail,
                friend.friendPhone
              );
              
              return (
                <View key={index} style={[commonStyles.card, { marginTop: 12 }]}>
                  <View style={styles.friendHeader}>
                    <View style={styles.friendIcon}>
                      <IconSymbol 
                        ios_icon_name="person.fill" 
                        android_material_icon_name="person" 
                        size={24} 
                        color={colors.primary} 
                      />
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={commonStyles.subtitle}>{displayName}</Text>
                      {friend.friendExperienceLevel && (
                        <Text style={commonStyles.textSecondary}>
                          {friend.friendExperienceLevel}
                          {friend.friendDuprRating && ` • DUPR: ${friend.friendDuprRating}`}
                        </Text>
                      )}
                      {friend.currentCourtName ? (
                        <View style={styles.playingContainer}>
                          <View style={styles.atCourtBadge}>
                            <IconSymbol 
                              ios_icon_name="location.fill" 
                              android_material_icon_name="location_on" 
                              size={16} 
                              color={colors.card} 
                            />
                            <Text style={styles.atCourtText}>
                              At {friend.currentCourtName}
                            </Text>
                          </View>
                          {friend.remainingTime && (
                            <View style={styles.timeContainer}>
                              <IconSymbol 
                                ios_icon_name="clock.fill" 
                                android_material_icon_name="schedule" 
                                size={14} 
                                color={colors.primary} 
                              />
                              <Text style={styles.timeText}>
                                {friend.remainingTime.hours > 0 && `${friend.remainingTime.hours}h `}
                                {friend.remainingTime.minutes}m left
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View style={styles.offlineContainer}>
                          <View style={styles.offlineDot} />
                          <Text style={styles.offlineText}>Not at a court</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveFriend(friend.id, displayName)}
                    >
                      <IconSymbol 
                        ios_icon_name="trash" 
                        android_material_icon_name="delete" 
                        size={20} 
                        color={colors.textSecondary} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <BrandingFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
  },
  section: {
    marginTop: 24,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  addButton: {
    padding: 4,
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  playingContainer: {
    marginTop: 8,
  },
  atCourtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  atCourtText: {
    fontSize: 13,
    color: colors.card,
    fontWeight: '700',
    marginLeft: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  offlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
    marginRight: 6,
  },
  offlineText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
