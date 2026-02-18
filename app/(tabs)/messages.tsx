import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useMessagesQuery } from '@/hooks/useMessagesQuery';
import { IconSymbol } from '@/components/IconSymbol';
import { NotificationPermissionModal } from '@/components/NotificationPermissionModal';
import { 
  requestNotificationPermissions, 
  shouldShowNotificationsPrompt,
  setNotificationsPromptDismissedAt,
  registerPushToken
} from '@/utils/notifications';
import { debounce } from '@/utils/performanceLogger';
import { useRealtimeManager } from '@/utils/realtimeManager';
import { ConversationCardSkeleton } from '@/components/SkillLevelBars';
import { isSupabaseConfigured } from '@/app/integrations/supabase/client;

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

  const { conversations, loading, refetch, isRefetching } = useMessagesQuery(user?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  const realtimeManager = useRealtimeManager('MessagesScreen');

  const debouncedSearch = useCallback((query: string) => {
    setDebouncedSearchQuery(query);
  }, []);

  const debouncedSearchHandler = React.useMemo(
    () => debounce(debouncedSearch, 400),
    [debouncedSearch]
  );

  useEffect(() => {
    debouncedSearchHandler(searchQuery);
  }, [searchQuery, debouncedSearchHandler]);

  const checkAndShowNotificationPrompt = useCallback(async () => {
    if (!user) return;
    try {
      const shouldShow = await shouldShowNotificationsPrompt();
      if (shouldShow) setShowNotificationPrompt(true);
    } catch (err) {
      console.log('Notification prompt error:', err);
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    setShowNotificationPrompt(false);
    const granted = await requestNotificationPermissions();
    if (granted && user) {
      await registerPushToken(user.id);
    }
  };

  const handleNotNow = async () => {
    setShowNotificationPrompt(false);
    await setNotificationsPromptDismissedAt();
  };

  useFocusEffect(
    useCallback(() => {
      checkAndShowNotificationPrompt();
    }, [checkAndShowNotificationPrompt])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user || !isSupabaseConfigured()) return;

      const unsubscribeMessages = realtimeManager.subscribe({
        table: 'messages',
        filter: `sender_id=eq.${user.id}`,
        event: '*',
        onUpdate: refetch,
        fallbackFetch: refetch,
      });

      const unsubscribeMessagesReceived = realtimeManager.subscribe({
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
        event: '*',
        onUpdate: refetch,
        fallbackFetch: refetch,
      });

      const unsubscribeGroupMessages = realtimeManager.subscribe({
        table: 'group_messages',
        event: 'INSERT',
        onUpdate: refetch,
        fallbackFetch: refetch,
      });

      return () => {
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv => {
    if (!debouncedSearchQuery.trim()) return true;
    const query = debouncedSearchQuery.toLowerCase();
    return (
      conv.title.toLowerCase().includes(query) ||
      conv.userFirstName?.toLowerCase().includes(query) ||
      conv.userLastName?.toLowerCase().includes(query) ||
      conv.userNickname?.toLowerCase().includes(query)
    );
  });

  const renderConversation = ({ item }: { item: Conversation }) => {
    const handlePress = () => {
      if (item.type === 'group') {
        router.push(`/group-conversation/${item.id}`);
      } else {
        router.push(`/conversation/${item.userId}`);
      }
    };

    return (
      <TouchableOpacity style={styles.conversationCard} onPress={handlePress}>
        <View style={styles.avatarContainer}>
          <IconSymbol
            ios_icon_name={item.type === 'group' ? 'person.3.fill' : 'person.fill'}
            android_material_icon_name={item.type === 'group' ? 'group' : 'person'}
            size={32}
            color={colors.primary}
          />
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={[commonStyles.subtitle, { flex: 1 }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(item.lastMessageTime)}
            </Text>
          </View>

          <Text
            style={[
              commonStyles.textSecondary,
              item.unreadCount > 0 && styles.unreadMessage,
            ]}
            numberOfLines={2}
          >
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={commonStyles.container}>
          <View style={styles.header}>
            <Text style={commonStyles.title}>Messages</Text>
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <ConversationCardSkeleton key={i} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={commonStyles.container}>
        <View style={styles.header}>
          <Text style={commonStyles.title}>Messages</Text>
          <Text style={commonStyles.textSecondary}>
            Chat with your pickleball friends
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => `${item.type}:${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />

        <NotificationPermissionModal
          visible={showNotificationPrompt}
          onEnable={handleEnableNotifications}
          onNotNow={handleNotNow}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  unreadMessage: {
    fontWeight: '600',
    color: colors.text,
  },
});
