
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useFriendsQuery } from '@/hooks/useFriendsQuery';
import { IconSymbol } from '@/components/IconSymbol';
import { FriendCardSkeleton } from '@/components/SkillLevelBars';
import { debounce } from '@/utils/performanceLogger';
import { LegalFooter } from '@/components/LegalFooter';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const { friends, pendingRequests, allUsers, loading, refetch, isRefetching } = useFriendsQuery(user?.id);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notificationPrefsModalVisible, setNotificationPrefsModalVisible] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [notifyCheckin, setNotifyCheckin] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      console.log('FriendsScreen: Debounced search query:', query);
      setDebouncedSearchQuery(query);
    }, 400),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      console.log('FriendsScreen: Screen focused');
    }, [])
  );

  const handleAcceptRequest = async (requestId: string, friendId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('FriendsScreen: Supabase not configured');
      return;
    }

    setActionLoading(requestId);
    try {
      console.log('FriendsScreen: Accepting friend request:', requestId);
      
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      console.log('FriendsScreen: Friend request accepted successfully');
      await refetch();
    } catch (error: any) {
      console.error('FriendsScreen: Error accepting friend request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('FriendsScreen: Supabase not configured');
      return;
    }

    setActionLoading(requestId);
    try {
      console.log('FriendsScreen: Declining friend request:', requestId);
      
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      console.log('FriendsScreen: Friend request declined successfully');
      await refetch();
    } catch (error: any) {
      console.error('FriendsScreen: Error declining friend request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenNotificationPrefs = async (friendId: string) => {
    setSelectedFriendId(friendId);
    
    if (!isSupabaseConfigured() || !user?.id) {
      setNotificationPrefsModalVisible(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('friend_notification_preferences')
        .select('notify_checkin, notify_messages')
        .eq('user_id', user.id)
        .eq('friend_id', friendId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('FriendsScreen: Error fetching notification preferences:', error);
      }

      if (data) {
        setNotifyCheckin(data.notify_checkin);
        setNotifyMessages(data.notify_messages);
      } else {
        setNotifyCheckin(true);
        setNotifyMessages(true);
      }
    } catch (error) {
      console.error('FriendsScreen: Error loading notification preferences:', error);
    }

    setNotificationPrefsModalVisible(true);
  };

  const handleSaveNotificationPrefs = async () => {
    if (!isSupabaseConfigured() || !user?.id || !selectedFriendId) {
      setNotificationPrefsModalVisible(false);
      return;
    }

    try {
      console.log('FriendsScreen: Saving notification preferences for friend:', selectedFriendId);
      
      const { error } = await supabase
        .from('friend_notification_preferences')
        .upsert({
          user_id: user.id,
          friend_id: selectedFriendId,
          notify_checkin: notifyCheckin,
          notify_messages: notifyMessages,
        }, {
          onConflict: 'user_id,friend_id',
        });

      if (error) throw error;

      console.log('FriendsScreen: Notification preferences saved successfully');
    } catch (error: any) {
      console.error('FriendsScreen: Error saving notification preferences:', error);
    } finally {
      setNotificationPrefsModalVisible(false);
      setSelectedFriendId(null);
    }
  };

  const filteredFriends = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return friends;
    const query = debouncedSearchQuery.toLowerCase();
    return friends.filter(friend =>
      friend.firstName?.toLowerCase().includes(query) ||
      friend.lastName?.toLowerCase().includes(query) ||
      friend.pickleballerNickname?.toLowerCase().includes(query)
    );
  }, [friends, debouncedSearchQuery]);

  const filteredRequests = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return pendingRequests;
    const query = debouncedSearchQuery.toLowerCase();
    return pendingRequests.filter(request =>
      request.firstName?.toLowerCase().includes(query) ||
      request.lastName?.toLowerCase().includes(query) ||
      request.pickleballerNickname?.toLowerCase().includes(query)
    );
  }, [pendingRequests, debouncedSearchQuery]);

  const filteredUsers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return allUsers;
    const query = debouncedSearchQuery.toLowerCase();
    return allUsers.filter(user =>
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.pickleballer_nickname?.toLowerCase().includes(query)
    );
  }, [allUsers, debouncedSearchQuery]);

  if (loading) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.header}>
          <Text style={commonStyles.title}>Friends</Text>
          <Text style={commonStyles.textSecondary}>
            Connect with pickleball players
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {[1, 2, 3, 4, 5].map((_, index) => (
            <FriendCardSkeleton key={index} />
          ))}
        </View>
      </View>
    );
  }

  const friendsLabel = 'Friends';
  const requestsLabel = 'Requests';
  const searchLabel = 'Search';

  return (
    <View style={commonStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={commonStyles.title}>Friends</Text>
          <Text style={commonStyles.textSecondary}>
            Connect with pickleball players
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
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

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => {
              console.log('User switched to Friends tab');
              setActiveTab('friends');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
              {friendsLabel} ({friends.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => {
              console.log('User switched to Requests tab');
              setActiveTab('requests');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              {requestsLabel} ({pendingRequests.length})
            </Text>
            {pendingRequests.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => {
              console.log('User switched to Search tab');
              setActiveTab('search');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
              {searchLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'friends' && (
            <>
              {filteredFriends.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol
                    ios_icon_name="person.2"
                    android_material_icon_name="group"
                    size={64}
                    color={colors.textSecondary}
                  />
                  <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
                    {searchQuery.trim() ? 'No Friends Found' : 'No Friends Yet'}
                  </Text>
                  <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }]}>
                    {searchQuery.trim()
                      ? 'Try adjusting your search'
                      : 'Search for players and send friend requests to get started'}
                  </Text>
                </View>
              ) : (
                filteredFriends.map((friend) => {
                  const displayName = friend.firstName && friend.lastName
                    ? `${friend.firstName} ${friend.lastName}`
                    : friend.pickleballerNickname || 'Unknown User';

                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={styles.friendCard}
                      onPress={() => {
                        console.log('User tapped friend:', displayName);
                        router.push(`/user/${friend.userId}`);
                      }}
                    >
                      <View style={styles.friendAvatar}>
                        <IconSymbol
                          ios_icon_name="person.fill"
                          android_material_icon_name="person"
                          size={32}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={commonStyles.subtitle} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {friend.pickleballerNickname && friend.firstName && (
                          <Text style={commonStyles.textSecondary} numberOfLines={1}>
                            &quot;{friend.pickleballerNickname}&quot;
                          </Text>
                        )}
                        {friend.experienceLevel && (
                          <Text style={[commonStyles.textSecondary, { fontSize: 13 }]}>
                            {friend.experienceLevel}
                            {friend.duprRating && ` • DUPR ${friend.duprRating}`}
                          </Text>
                        )}
                      </View>
                      <View style={styles.friendActions}>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            console.log('User tapped notification settings for:', displayName);
                            handleOpenNotificationPrefs(friend.userId);
                          }}
                        >
                          <IconSymbol
                            ios_icon_name="bell.fill"
                            android_material_icon_name="notifications"
                            size={20}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            console.log('User tapped message button for:', displayName);
                            router.push(`/conversation/${friend.userId}`);
                          }}
                        >
                          <IconSymbol
                            ios_icon_name="message.fill"
                            android_material_icon_name="message"
                            size={20}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'requests' && (
            <>
              {filteredRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol
                    ios_icon_name="person.badge.plus"
                    android_material_icon_name="person-add"
                    size={64}
                    color={colors.textSecondary}
                  />
                  <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
                    No Pending Requests
                  </Text>
                  <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }]}>
                    Friend requests will appear here
                  </Text>
                </View>
              ) : (
                filteredRequests.map((request) => {
                  const displayName = request.firstName && request.lastName
                    ? `${request.firstName} ${request.lastName}`
                    : request.pickleballerNickname || 'Unknown User';

                  const isLoading = actionLoading === request.id;

                  return (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.friendAvatar}>
                        <IconSymbol
                          ios_icon_name="person.fill"
                          android_material_icon_name="person"
                          size={32}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={commonStyles.subtitle} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {request.pickleballerNickname && request.firstName && (
                          <Text style={commonStyles.textSecondary} numberOfLines={1}>
                            &quot;{request.pickleballerNickname}&quot;
                          </Text>
                        )}
                        {request.experienceLevel && (
                          <Text style={[commonStyles.textSecondary, { fontSize: 13 }]}>
                            {request.experienceLevel}
                            {request.duprRating && ` • DUPR ${request.duprRating}`}
                          </Text>
                        )}
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.success }]}
                          onPress={() => {
                            console.log('User accepted friend request from:', displayName);
                            handleAcceptRequest(request.id, request.userId);
                          }}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.card} />
                          ) : (
                            <IconSymbol
                              ios_icon_name="checkmark"
                              android_material_icon_name="check"
                              size={20}
                              color={colors.card}
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.accent }]}
                          onPress={() => {
                            console.log('User declined friend request from:', displayName);
                            handleDeclineRequest(request.id);
                          }}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.card} />
                          ) : (
                            <IconSymbol
                              ios_icon_name="xmark"
                              android_material_icon_name="close"
                              size={20}
                              color={colors.card}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'search' && (
            <>
              {filteredUsers.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol
                    ios_icon_name="magnifyingglass"
                    android_material_icon_name="search"
                    size={64}
                    color={colors.textSecondary}
                  />
                  <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
                    No Users Found
                  </Text>
                  <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }]}>
                    Try searching for players by name or nickname
                  </Text>
                </View>
              ) : (
                filteredUsers.map((user) => {
                  const displayName = user.first_name && user.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : user.pickleballer_nickname || 'Unknown User';

                  const statusBadge = user.friendshipStatus === 'accepted' ? 'Friends' :
                    user.friendshipStatus === 'pending_sent' ? 'Pending' :
                    user.friendshipStatus === 'pending_received' ? 'Respond' : null;

                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.friendCard}
                      onPress={() => {
                        console.log('User tapped search result:', displayName);
                        router.push(`/user/${user.id}`);
                      }}
                    >
                      <View style={styles.friendAvatar}>
                        <IconSymbol
                          ios_icon_name="person.fill"
                          android_material_icon_name="person"
                          size={32}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={commonStyles.subtitle} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {user.pickleballer_nickname && user.first_name && (
                          <Text style={commonStyles.textSecondary} numberOfLines={1}>
                            &quot;{user.pickleballer_nickname}&quot;
                          </Text>
                        )}
                        {user.experience_level && (
                          <Text style={[commonStyles.textSecondary, { fontSize: 13 }]}>
                            {user.experience_level}
                            {user.dupr_rating && ` • DUPR ${user.dupr_rating}`}
                          </Text>
                        )}
                      </View>
                      {statusBadge && (
                        <View style={[styles.statusBadge, user.friendshipStatus === 'accepted' && { backgroundColor: colors.success }]}>
                          <Text style={styles.statusBadgeText}>{statusBadge}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </View>

        <LegalFooter />
      </ScrollView>

      <Modal
        visible={notificationPrefsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationPrefsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[commonStyles.title, { fontSize: 20, marginBottom: 8 }]}>
              Notification Preferences
            </Text>
            <Text style={[commonStyles.textSecondary, { marginBottom: 24 }]}>
              Choose what notifications you want to receive from this friend
            </Text>

            <TouchableOpacity
              style={styles.preferenceRow}
              onPress={() => setNotifyCheckin(!notifyCheckin)}
            >
              <View style={styles.preferenceInfo}>
                <Text style={commonStyles.subtitle}>Check-in Notifications</Text>
                <Text style={commonStyles.textSecondary}>
                  Get notified when this friend checks in or out
                </Text>
              </View>
              <View style={[styles.checkbox, notifyCheckin && styles.checkboxActive]}>
                {notifyCheckin && (
                  <IconSymbol
                    ios_icon_name="checkmark"
                    android_material_icon_name="check"
                    size={16}
                    color={colors.card}
                  />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.preferenceRow}
              onPress={() => setNotifyMessages(!notifyMessages)}
            >
              <View style={styles.preferenceInfo}>
                <Text style={commonStyles.subtitle}>Message Notifications</Text>
                <Text style={commonStyles.textSecondary}>
                  Get notified when this friend sends you a message
                </Text>
              </View>
              <View style={[styles.checkbox, notifyMessages && styles.checkboxActive]}>
                {notifyMessages && (
                  <IconSymbol
                    ios_icon_name="checkmark"
                    android_material_icon_name="check"
                    size={16}
                    color={colors.card}
                  />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[buttonStyles.secondary, { flex: 1, marginRight: 8 }]}
                onPress={() => setNotificationPrefsModalVisible(false)}
              >
                <Text style={[buttonStyles.text, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[buttonStyles.primary, { flex: 1, marginLeft: 8 }]}
                onPress={handleSaveNotificationPrefs}
              >
                <Text style={buttonStyles.text}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    marginRight: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: colors.card,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    backgroundColor: colors.highlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 24,
  },
});
