
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { IconSymbol } from '@/components/IconSymbol';
import { LegalFooter } from '@/components/LegalFooter';

export default function FriendsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { 
    friends, 
    pendingRequests, 
    allUsers, 
    loading: friendsLoading, 
    sendFriendRequestById, 
    acceptFriendRequest, 
    rejectFriendRequest, 
    removeFriend,
    refetch
  } = useFriends(user?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);
  
  // Filter states
  const [minDupr, setMinDupr] = useState('');
  const [maxDupr, setMaxDupr] = useState('');
  const [selectedSkillLevels, setSelectedSkillLevels] = useState<string[]>([]);
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('FriendsScreen: Screen focused, refreshing data');
      console.log('FriendsScreen: Current user:', user?.id);
      if (user) {
        refetch();
      }
    }, [user, refetch])
  );

  // Log friends data when it changes
  useEffect(() => {
    console.log('FriendsScreen: Friends data updated:', {
      friendsCount: friends.length,
      pendingRequestsCount: pendingRequests.length,
      allUsersCount: allUsers.length,
      loading: friendsLoading
    });
  }, [friends, pendingRequests, allUsers, friendsLoading]);

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

  const handleAddFriendById = async (friendId: string, friendName: string) => {
    console.log('FriendsScreen: handleAddFriendById called for:', friendId, friendName);
    
    // Prevent multiple simultaneous requests
    if (sendingRequestTo) {
      console.log('FriendsScreen: Already sending a request, ignoring');
      return;
    }
    
    setSendingRequestTo(friendId);
    
    try {
      const result = await sendFriendRequestById(friendId);
      console.log('FriendsScreen: sendFriendRequestById result:', result);
      
      if (result.success) {
        Alert.alert('Success', `Friend request sent to ${friendName}!`);
      } else {
        Alert.alert('Error', result.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('FriendsScreen: Error in handleAddFriendById:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSendingRequestTo(null);
    }
  };

  const handleCancelRequest = async (friendshipId: string, friendName: string) => {
    Alert.alert(
      'Cancel Request',
      `Cancel friend request to ${friendName}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await removeFriend(friendshipId);
          },
        },
      ]
    );
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

  const toggleSkillLevel = (level: string) => {
    setSelectedSkillLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  const toggleCourt = (courtName: string) => {
    setSelectedCourts(prev => 
      prev.includes(courtName) 
        ? prev.filter(c => c !== courtName)
        : [...prev, courtName]
    );
  };

  const clearFilters = () => {
    setMinDupr('');
    setMaxDupr('');
    setSelectedSkillLevels([]);
    setSelectedCourts([]);
  };

  const hasActiveFilters = minDupr || maxDupr || selectedSkillLevels.length > 0 || selectedCourts.length > 0;

  // Get unique courts from all users
  const availableCourts = useMemo(() => {
    const courts = new Set<string>();
    allUsers.forEach(user => {
      if (user.courtsPlayed && user.courtsPlayed.length > 0) {
        user.courtsPlayed.forEach(court => courts.add(court));
      }
    });
    return Array.from(courts).sort();
  }, [allUsers]);

  // Filter users based on search query and filters
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const firstName = u.first_name?.toLowerCase() || '';
        const lastName = u.last_name?.toLowerCase() || '';
        const nickname = u.pickleballer_nickname?.toLowerCase() || '';
        const email = u.email?.toLowerCase() || '';
        
        const matchesSearch = firstName.includes(query) || 
               lastName.includes(query) || 
               nickname.includes(query) || 
               email.includes(query);
        
        if (!matchesSearch) return false;
      }

      // DUPR filter
      if (minDupr && u.dupr_rating !== undefined && u.dupr_rating !== null) {
        const min = parseFloat(minDupr);
        if (!isNaN(min) && u.dupr_rating < min) return false;
      }
      if (maxDupr && u.dupr_rating !== undefined && u.dupr_rating !== null) {
        const max = parseFloat(maxDupr);
        if (!isNaN(max) && u.dupr_rating > max) return false;
      }

      // Skill level filter
      if (selectedSkillLevels.length > 0) {
        if (!u.experience_level || !selectedSkillLevels.includes(u.experience_level)) {
          return false;
        }
      }

      // Courts filter - filter by places played
      if (selectedCourts.length > 0) {
        if (!u.courtsPlayed || u.courtsPlayed.length === 0) {
          return false;
        }
        const hasMatchingCourt = u.courtsPlayed.some(court => selectedCourts.includes(court));
        if (!hasMatchingCourt) return false;
      }

      return true;
    });
  }, [allUsers, searchQuery, minDupr, maxDupr, selectedSkillLevels, selectedCourts]);

  // Show loading state only while auth is initializing
  if (authLoading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading...</Text>
      </View>
    );
  }

  // Show "Not Logged In" only after auth has finished loading
  if (!user) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <View style={styles.emptyStateIcon}>
          <IconSymbol 
            ios_icon_name="person.2.slash" 
            android_material_icon_name="people_outline" 
            size={64} 
            color={colors.textSecondary} 
          />
        </View>
        <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
          Not Logged In
        </Text>
        <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center' }]}>
          Sign in to view and manage your friends
        </Text>
        <TouchableOpacity
          style={[buttonStyles.primary, { marginTop: 24 }]}
          onPress={() => router.push('/auth')}
        >
          <Text style={buttonStyles.text}>Sign In</Text>
        </TouchableOpacity>
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

        {/* My Friends Section */}
        <View style={styles.section}>
          <Text style={commonStyles.subtitle}>
            My Friends ({friends.length})
          </Text>
          
          {friendsLoading ? (
            <View style={[commonStyles.card, { marginTop: 12, alignItems: 'center', padding: 32 }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading friends...</Text>
            </View>
          ) : friends.length === 0 ? (
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
                <TouchableOpacity
                  key={index}
                  style={[commonStyles.card, { marginTop: 12 }]}
                  onPress={() => router.push(`/user/${friend.friendId}`)}
                >
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
                              Playing at {friend.currentCourtName}
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
                          <Text style={styles.offlineText}>Not currently on a court</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveFriend(friend.id, displayName);
                      }}
                    >
                      <IconSymbol 
                        ios_icon_name="person.badge.minus" 
                        android_material_icon_name="person_remove" 
                        size={32} 
                        color={colors.accent} 
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Friend Requests Section */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={commonStyles.subtitle}>Friend Requests ({pendingRequests.length})</Text>
            <Text style={[commonStyles.textSecondary, { marginTop: 4, marginBottom: 8 }]}>
              Accept or deny incoming friend requests
            </Text>
            {pendingRequests.map((request, index) => {
              const displayName = formatUserName(
                request.friendFirstName,
                request.friendLastName,
                request.friendNickname,
                request.friendEmail,
                request.friendPhone
              );
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[commonStyles.card, { marginTop: 12 }]}
                  onPress={() => router.push(`/user/${request.userId}`)}
                >
                  <View style={styles.friendHeader}>
                    <View style={styles.friendIcon}>
                      <IconSymbol 
                        ios_icon_name="person.fill" 
                        android_material_icon_name="person" 
                        size={24} 
                        color={colors.accent} 
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
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAcceptRequest(request.id);
                      }}
                    >
                      <Text style={buttonStyles.text}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[buttonStyles.secondary, { flex: 1 }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRejectRequest(request.id);
                      }}
                    >
                      <Text style={[buttonStyles.text, { color: colors.text }]}>Deny</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.section}>
          <Text style={commonStyles.subtitle}>Find People</Text>
          <Text style={[commonStyles.textSecondary, { marginTop: 4, marginBottom: 12 }]}>
            Search for players to add as friends
          </Text>
          
          <View style={styles.searchContainer}>
            <IconSymbol 
              ios_icon_name="magnifyingglass" 
              android_material_icon_name="search" 
              size={20} 
              color={colors.textSecondary} 
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, nickname, or email..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol 
                  ios_icon_name="xmark.circle.fill" 
                  android_material_icon_name="cancel" 
                  size={20} 
                  color={colors.textSecondary} 
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Toggle Button */}
          <TouchableOpacity 
            style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <IconSymbol 
              ios_icon_name="line.3.horizontal.decrease.circle" 
              android_material_icon_name="filter_list" 
              size={20} 
              color={hasActiveFilters ? colors.card : colors.text} 
            />
            <Text style={[styles.filterButtonText, hasActiveFilters && styles.filterButtonTextActive]}>
              Filters {hasActiveFilters && `(${[minDupr, maxDupr, ...selectedSkillLevels, ...selectedCourts].filter(Boolean).length})`}
            </Text>
            <IconSymbol 
              ios_icon_name={showFilters ? "chevron.up" : "chevron.down"} 
              android_material_icon_name={showFilters ? "expand_less" : "expand_more"} 
              size={20} 
              color={hasActiveFilters ? colors.card : colors.text} 
            />
          </TouchableOpacity>

          {/* Filters Panel */}
          {showFilters && (
            <View style={styles.filtersPanel}>
              {/* DUPR Rating Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>DUPR Rating</Text>
                <View style={styles.duprInputs}>
                  <View style={styles.duprInputContainer}>
                    <Text style={styles.duprInputLabel}>Min</Text>
                    <TextInput
                      style={styles.duprInput}
                      placeholder="0.0"
                      placeholderTextColor={colors.textSecondary}
                      value={minDupr}
                      onChangeText={setMinDupr}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={styles.duprSeparator}>-</Text>
                  <View style={styles.duprInputContainer}>
                    <Text style={styles.duprInputLabel}>Max</Text>
                    <TextInput
                      style={styles.duprInput}
                      placeholder="8.0"
                      placeholderTextColor={colors.textSecondary}
                      value={maxDupr}
                      onChangeText={setMaxDupr}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Skill Level Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Skill Level</Text>
                <View style={styles.chipContainer}>
                  {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.chip,
                        selectedSkillLevels.includes(level) && styles.chipSelected
                      ]}
                      onPress={() => toggleSkillLevel(level)}
                    >
                      <Text style={[
                        styles.chipText,
                        selectedSkillLevels.includes(level) && styles.chipTextSelected
                      ]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Courts Filter - Places Played */}
              {availableCourts.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}>Places Played</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.courtsScrollView}
                  >
                    <View style={styles.chipContainer}>
                      {availableCourts.map((court) => (
                        <TouchableOpacity
                          key={court}
                          style={[
                            styles.chip,
                            selectedCourts.includes(court) && styles.chipSelected
                          ]}
                          onPress={() => toggleCourt(court)}
                        >
                          <Text style={[
                            styles.chipText,
                            selectedCourts.includes(court) && styles.chipTextSelected
                          ]}>
                            {court}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <TouchableOpacity 
                  style={styles.clearFiltersButton}
                  onPress={clearFilters}
                >
                  <IconSymbol 
                    ios_icon_name="xmark.circle" 
                    android_material_icon_name="clear" 
                    size={18} 
                    color={colors.primary} 
                  />
                  <Text style={styles.clearFiltersText}>Clear All Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* All Users List */}
        <View style={styles.section}>
          <Text style={commonStyles.subtitle}>
            All Users ({filteredUsers.length})
          </Text>
          <Text style={[commonStyles.textSecondary, { marginTop: 4, marginBottom: 8 }]}>
            {searchQuery.trim() || hasActiveFilters ? 'Search results' : 'All players in the app'}
          </Text>
          
          {friendsLoading ? (
            <View style={[commonStyles.card, { marginTop: 12, alignItems: 'center', padding: 32 }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading users...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={[commonStyles.card, { marginTop: 12, alignItems: 'center', padding: 32 }]}>
              <IconSymbol 
                ios_icon_name="person.crop.circle.badge.questionmark" 
                android_material_icon_name="person_search" 
                size={48} 
                color={colors.textSecondary} 
              />
              <Text style={[commonStyles.textSecondary, { marginTop: 16, textAlign: 'center' }]}>
                {searchQuery.trim() || hasActiveFilters ? 'No users found matching your criteria' : 'No other users in the app yet'}
              </Text>
            </View>
          ) : (
            filteredUsers.map((otherUser, index) => {
              const displayName = formatUserName(
                otherUser.first_name,
                otherUser.last_name,
                otherUser.pickleballer_nickname,
                otherUser.email
              );
              
              const relationship = otherUser.friendshipStatus || 'none';
              const isSending = sendingRequestTo === otherUser.id;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[commonStyles.card, { marginTop: 12 }]}
                  onPress={() => router.push(`/user/${otherUser.id}`)}
                >
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
                      {otherUser.experience_level && (
                        <Text style={commonStyles.textSecondary}>
                          {otherUser.experience_level}
                          {otherUser.dupr_rating && ` • DUPR: ${otherUser.dupr_rating}`}
                        </Text>
                      )}
                      {otherUser.courtsPlayed && otherUser.courtsPlayed.length > 0 && (
                        <View style={styles.courtsPlayedContainer}>
                          <IconSymbol 
                            ios_icon_name="location.fill" 
                            android_material_icon_name="location_on" 
                            size={12} 
                            color={colors.textSecondary} 
                          />
                          <Text style={styles.courtsPlayedText}>
                            Played at {otherUser.courtsPlayed.length} court{otherUser.courtsPlayed.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                      {otherUser.isAtCourt ? (
                        <View style={styles.offlineContainer}>
                          <View style={styles.onlineDot} />
                          <Text style={styles.onlineText}>Currently on a court</Text>
                        </View>
                      ) : (
                        <View style={styles.offlineContainer}>
                          <View style={styles.offlineDot} />
                          <Text style={styles.offlineText}>Not currently on a court</Text>
                        </View>
                      )}
                    </View>
                    
                    {relationship === 'none' && (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddFriendById(otherUser.id, displayName);
                        }}
                        disabled={isSending}
                      >
                        {isSending ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <IconSymbol 
                            ios_icon_name="plus.circle.fill" 
                            android_material_icon_name="add_circle" 
                            size={32} 
                            color={colors.primary} 
                          />
                        )}
                      </TouchableOpacity>
                    )}
                    
                    {relationship === 'pending_sent' && otherUser.friendshipId && (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleCancelRequest(otherUser.friendshipId!, displayName);
                        }}
                      >
                        <IconSymbol 
                          ios_icon_name="minus.circle.fill" 
                          android_material_icon_name="remove_circle" 
                          size={32} 
                          color={colors.accent} 
                        />
                      </TouchableOpacity>
                    )}
                    
                    {relationship === 'accepted' && (
                      <View style={styles.friendBadge}>
                        <IconSymbol 
                          ios_icon_name="checkmark.circle.fill" 
                          android_material_icon_name="check_circle" 
                          size={24} 
                          color={colors.success} 
                        />
                        <Text style={styles.friendBadgeText}>Friend</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <LegalFooter />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    marginRight: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
    marginRight: 8,
  },
  filterButtonTextActive: {
    color: colors.card,
  },
  filtersPanel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  duprInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duprInputContainer: {
    flex: 1,
  },
  duprInputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  duprInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  duprSeparator: {
    fontSize: 18,
    color: colors.textSecondary,
    marginHorizontal: 12,
    marginTop: 18,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.card,
    fontWeight: '600',
  },
  courtsScrollView: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 6,
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
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  friendBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
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
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  offlineText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  onlineText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  courtsPlayedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  courtsPlayedText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
