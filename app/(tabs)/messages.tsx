
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useMessagesQuery } from '@/hooks/useMessagesQuery';
import { IconSymbol } from '@/components/IconSymbol';
import { NotificationPermissionModal } from '@/components/NotificationPermissionModal';
import { 
  requestNotificationPermissions, 
  checkNotificationPermissionStatus,
  shouldShowNotificationsPrompt,
  setNotificationsPromptDismissedAt,
  registerPushToken
} from '@/utils/notifications';
import { debounce } from '@/utils/performanceLogger';
import { useRealtimeManager } from '@/utils/realtimeManager';
import { ConversationCardSkeleton } from '@/components/SkillLevelBars';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isMuted: boolean;
  userId?: string;
  userFirstName?: string;
  userLastName?: string;
  userNickname?: string;
  memberCount?: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  // REACT QUERY: Use the new query hook
  const { conversations, loading, refetch, isRefetching } = useMessagesQuery(user?.id);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  
  // REALTIME: Initialize realtime manager
  const realtimeManager = useRealtimeManager('MessagesScreen');

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      console.log('MessagesScreen: Debounced search query:', query);
      setDebouncedSearchQuery(query);
    }, 400),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Check if we should show the notification prompt
  const checkAndShowNotificationPrompt = useCallback(async () => {
    if (!user) return;

    console.log('MessagesScreen: Checking if should show notification prompt');
    
    try {
      const shouldShow = await shouldShowNotificationsPrompt();
      
      if (shouldShow) {
        console.log('MessagesScreen: Showing notification prompt');
        setShowNotificationPrompt(true);
      } else {
        console.log('MessagesScreen: Not showing notification prompt');
      }
    } catch (err) {
      console.log('MessagesScreen: Error checking notification prompt:', err);
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    console.log('MessagesScreen: User tapped Enable Notifications');
    setShowNotificationPrompt(false);
    
    const granted = await requestNotificationPermissions();
    
    if (granted && user) {
      console.log('MessagesScreen: Notifications enabled, registering push token');
      // Register push token with backend
      await registerPushToken(user.id);
      console.log('MessagesScreen: Notifications enabled successfully');
    } else {
      console.log('MessagesScreen: Notifications not granted');
    }
  };

  const handleNotNow = async () => {
    console.log('MessagesScreen: User tapped Not Now for notifications');
    setShowNotificationPrompt(false);
    
    // Persist the dismissal timestamp - won't show again for 14 days
    await setNotificationsPromptDismissedAt();
    console.log('MessagesScreen: Notification prompt dismissed, will not show again for 14 days');
  };

  // PULL-TO-REFRESH: Refetch on focus and check notification prompt
  useFocusEffect(
    useCallback(() => {
      console.log('MessagesScreen: Screen focused');
      checkAndShowNotificationPrompt();
    }, [checkAndShowNotificationPrompt])
  );

  // REALTIME: Subscribe ONLY while Messages tab is focused
  useFocusEffect(
    useCallback(() => {
      if (!user || !isSupabaseConfigured()) {
        return;
      }

      console.log('MessagesScreen: Setting up realtime subscriptions (focused)');

      // Subscribe to direct messages with filter for this user
      const unsubscribeMessages = realtimeManager.subscribe({
        table: 'messages',
        filter: `sender_id=eq.${user.id}`,
        event: '*',
        onUpdate: () => {
          console.log('MessagesScreen: Direct message change detected, refreshing');
          refetch();
        },
        fallbackFetch: refetch,
        timeoutMs: 10000,
        maxRetries: 3,
      });

      const unsubscribeMessagesReceived = realtimeManager.subscribe({
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
        event: '*',
        onUpdate: () => {
          console.log('MessagesScreen: Received message change detected, refreshing');
          refetch();
        },
        fallbackFetch: refetch,
        timeoutMs: 10000,
        maxRetries: 3,
      });

      const unsubscribeGroupMessages = realtimeManager.subscribe({
        table: 'group_messages',
        event: 'INSERT',
        onUpdate: () => {
          console.log('MessagesScreen: Group message change detected, refreshing');
          refetch();
        },
        fallbackFetch: refetch,
        timeoutMs: 10000,
        maxRetries: 3,
      });

      // Cleanup on blur/unmount
      return () => {
        console.log('MessagesScreen: Cleaning up realtime subscriptions (blurred)');
        unsubscribeMessages();
        unsubscribeMessagesReceived();
        unsubscribeGroupMessages();
      };
    }, [user, refetch, realtimeManager])
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) {
      const minsText = `${diffMins}m ago`;
      return minsText;
    }
    if (diffHours < 24) {
      const hoursText = `${diffHours}h ago`;
      return hoursText;
    }
    if (diffDays < 7) {
      const daysText = `${diffDays}d ago`;
      return daysText;
    }
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv => {
    if (!debouncedSearchQuery.trim()) return true;
    const query = debouncedSearchQuery.toLowerCase();
    return conv.title.toLowerCase().includes(query) ||
           conv.userFirstName?.toLowerCase().includes(query) ||
           conv.userLastName?.toLowerCase().includes(query) ||
           conv.userNickname?.toLowerCase().includes(query);
  });

  const renderConversation = ({ item }: { item: Conversation }) => {
    const handlePress = () => {
      console.log('User tapped conversation:', item.title);
      if (item.type === 'group') {
        router.push(`/group-conversation/${item.id}`);
      } else {
        router.push(`/conversation/${item.userId}`);
      }
    };

    return (
      <TouchableOpacity style={styles.conversationCard} onPress={handlePress}>
        <View style={styles.avatarContainer}>
          {item.type === 'group' ? (
            <IconSymbol
              ios_icon_name="person.3.fill"
              android_material_icon_name="group"
              size={32}
              color={colors.primary}
            />
          ) : (
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={32}
              color={colors.primary}
            />
          )}
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 9 ? '9+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <View style={styles.titleRow}>
              <Text style={[commonStyles.subtitle, { flex: 1 }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.type === 'group' && (
                <View style={styles.groupBadge}>
                  <IconSymbol
                    ios_icon_name="person.2"
                    android_material_icon_name="group"
                    size={12}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.groupBadgeText}>{item.memberCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.timeText}>{formatTime(item.lastMessageTime)}</Text>
          </View>
          <View style={styles.lastMessageRow}>
            <Text
              style={[
                commonStyles.textSecondary,
                item.unreadCount > 0 && styles.unreadMessage,
                { flex: 1 },
              ]}
              numberOfLines={2}
            >
              {item.lastMessage}
            </Text>
            {item.isMuted && (
              <IconSymbol
                ios_icon_name="bell.slash.fill"
                android_material_icon_name="notifications-off"
                size={16}
                color={colors.textSecondary}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show skeleton loaders while loading
  if (loading) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.header}>
          <Text style={commonStyles.title}>Messages</Text>
          <Text style={commonStyles.textSecondary}>
            Chat with your pickleball friends
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
            placeholder="Search conversations..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {[1, 2, 3, 4, 5].map((_, index) => (
            <ConversationCardSkeleton key={index} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.header}>
        <Text style={commonStyles.title}>Messages</Text>
        <Text style={commonStyles.textSecondary}>
          Chat with your pickleball friends
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
          placeholder="Search conversations..."
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

      <TouchableOpacity
        style={styles.createGroupButton}
        onPress={() => {
          console.log('User tapped Create Group Chat');
          router.push('/create-group');
        }}
      >
        <IconSymbol
          ios_icon_name="plus.circle.fill"
          android_material_icon_name="add-circle"
          size={24}
          color={colors.primary}
        />
        <Text style={styles.createGroupText}>Create Group Chat</Text>
      </TouchableOpacity>

      {filteredConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="envelope"
            android_material_icon_name="email"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
            No Messages Yet
          </Text>
          <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }]}>
            {searchQuery.trim()
              ? 'No conversations match your search'
              : 'Create a group or message friends to get started.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => `${item.type}:${item.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      <NotificationPermissionModal
        visible={showNotificationPrompt}
        onEnable={handleEnableNotifications}
        onNotNow={handleNotNow}
      />
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
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    marginRight: 12,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createGroupText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.card,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadMessage: {
    fontWeight: '600',
    color: colors.text,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
});
