
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { NotificationPermissionModal } from '@/components/NotificationPermissionModal';
import { requestNotificationPermissions, checkNotificationPermissionStatus } from '@/utils/notifications';

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isMuted: boolean;
  // For direct messages
  userId?: string;
  userFirstName?: string;
  userLastName?: string;
  userNickname?: string;
  // For group chats
  memberCount?: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkAndShowNotificationPrompt = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;

    try {
      // Get user's notification prompt status
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('messages_visit_count, notification_prompt_shown')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.log('Error fetching user notification status:', userError);
        return;
      }

      const currentVisitCount = (userData?.messages_visit_count || 0) + 1;
      setVisitCount(currentVisitCount);

      // Update visit count
      await supabase
        .from('users')
        .update({ messages_visit_count: currentVisitCount })
        .eq('id', user.id);

      // Check if we should show the prompt
      const hasShownPrompt = userData?.notification_prompt_shown || false;
      const permissionStatus = await checkNotificationPermissionStatus();

      // Show prompt on 2nd visit if not shown before and permission not granted
      if (currentVisitCount >= 2 && !hasShownPrompt && permissionStatus !== 'granted') {
        setShowNotificationPrompt(true);
      }
    } catch (error) {
      console.log('Error checking notification prompt:', error);
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    console.log('User tapped Enable Notifications');
    const granted = await requestNotificationPermissions();
    
    if (granted && user && isSupabaseConfigured()) {
      // Mark prompt as shown
      await supabase
        .from('users')
        .update({ notification_prompt_shown: true })
        .eq('id', user.id);
      
      console.log('Notifications enabled successfully');
    }
    
    setShowNotificationPrompt(false);
  };

  const handleNotNow = async () => {
    console.log('User tapped Not Now for notifications');
    if (user && isSupabaseConfigured()) {
      // Mark prompt as shown so we don't ask again
      await supabase
        .from('users')
        .update({ notification_prompt_shown: true })
        .eq('id', user.id);
    }
    setShowNotificationPrompt(false);
  };

  const fetchConversations = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      console.log('MessagesScreen: No user or Supabase not configured');
      setLoading(false);
      setConversations([]);
      return;
    }

    try {
      console.log('MessagesScreen: Fetching conversations for user:', user.id);
      setError(null);

      // Fetch direct message conversations
      // Use explicit FK names to avoid PGRST200 relationship errors
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, first_name, last_name, pickleballer_nickname),
          recipient:users!messages_recipient_id_fkey(id, first_name, last_name, pickleballer_nickname)
        `)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      // PGRST116 means no rows found, which is not an error
      if (messagesError && messagesError.code !== 'PGRST116') {
        console.error('MessagesScreen: Error fetching messages:', messagesError);
        console.error('MessagesScreen: Full error details:', JSON.stringify(messagesError, null, 2));
        // Don't throw - continue to try loading group chats
        setError(`Direct messages error: ${messagesError.message || 'Unknown error'}`);
      }

      console.log('MessagesScreen: Fetched', messages?.length || 0, 'direct messages');

      // Fetch group chats the user is a member of
      // Use a simpler query that doesn't trigger RLS recursion
      const { data: userGroups, error: userGroupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (userGroupsError && userGroupsError.code !== 'PGRST116') {
        console.error('MessagesScreen: Error fetching user groups:', userGroupsError);
        console.error('MessagesScreen: Full error details:', JSON.stringify(userGroupsError, null, 2));
        // Don't throw - continue with just direct messages
        setError(`Group chats error: ${userGroupsError.message || 'Unknown error'}`);
      }

      console.log('MessagesScreen: User is member of', userGroups?.length || 0, 'groups');

      // Now fetch the group details for those groups
      let groupConversations: Conversation[] = [];
      if (userGroups && userGroups.length > 0) {
        const groupIds = userGroups.map(g => g.group_id);
        
        const { data: groups, error: groupsError } = await supabase
          .from('group_chats')
          .select('*')
          .in('id', groupIds);

        if (groupsError && groupsError.code !== 'PGRST116') {
          console.error('MessagesScreen: Error fetching groups:', groupsError);
        } else {
          console.log('MessagesScreen: Fetched', groups?.length || 0, 'group details');

          // Fetch muted conversations
          const { data: mutes, error: mutesError } = await supabase
            .from('conversation_mutes')
            .select('*')
            .eq('user_id', user.id);

          if (mutesError && mutesError.code !== 'PGRST116') {
            console.log('MessagesScreen: Error fetching mutes (non-critical):', mutesError);
          }

          const mutesMap = new Map<string, boolean>();
          (mutes || []).forEach((mute: any) => {
            const key = `${mute.conversation_type}:${mute.conversation_id}`;
            const isMuted = !mute.muted_until || new Date(mute.muted_until) > new Date();
            mutesMap.set(key, isMuted);
          });

          // Process each group
          for (const group of groups || []) {
            // Fetch last message for this group
            const { data: lastMessages, error: lastMsgError } = await supabase
              .from('group_messages')
              .select('*')
              .eq('group_id', group.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (lastMsgError && lastMsgError.code !== 'PGRST116') {
              console.log('MessagesScreen: Error fetching group messages (non-critical):', lastMsgError);
            }

            // Count members
            const { count: memberCount, error: countError } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);

            if (countError && countError.code !== 'PGRST116') {
              console.log('MessagesScreen: Error counting group members (non-critical):', countError);
            }

            const lastMessage = lastMessages && lastMessages.length > 0 ? lastMessages[0] : null;
            const muteKey = `group:${group.id}`;

            groupConversations.push({
              id: group.id,
              type: 'group',
              title: group.name,
              lastMessage: lastMessage?.content || 'No messages yet',
              lastMessageTime: lastMessage?.created_at || group.created_at,
              unreadCount: 0,
              memberCount: memberCount || 0,
              isMuted: mutesMap.get(muteKey) || false,
            });
          }
        }
      }

      // Process direct messages
      const directConversationsMap = new Map<string, Conversation>();
      (messages || []).forEach((message: any) => {
        const isFromMe = message.sender_id === user.id;
        const partnerId = isFromMe ? message.recipient_id : message.sender_id;
        const partner = isFromMe ? message.recipient : message.sender;

        if (!directConversationsMap.has(partnerId)) {
          const displayName = partner?.first_name && partner?.last_name
            ? `${partner.first_name} ${partner.last_name.charAt(0)}.`
            : partner?.pickleballer_nickname || 'Unknown User';

          const muteKey = `direct:${partnerId}`;
          directConversationsMap.set(partnerId, {
            id: partnerId,
            type: 'direct',
            title: displayName,
            userId: partnerId,
            userFirstName: partner?.first_name,
            userLastName: partner?.last_name,
            userNickname: partner?.pickleballer_nickname,
            lastMessage: message.content || '',
            lastMessageTime: message.created_at,
            unreadCount: 0,
            isMuted: false,
          });
        }

        // Count unread messages
        if (!isFromMe && !message.read) {
          const conv = directConversationsMap.get(partnerId);
          if (conv) {
            conv.unreadCount += 1;
          }
        }
      });

      // Combine and sort by last message time
      const allConversations = [
        ...Array.from(directConversationsMap.values()),
        ...groupConversations,
      ].sort((a, b) => {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      console.log('MessagesScreen: Loaded', allConversations.length, 'total conversations');
      setConversations(allConversations);
      // Only clear error if we successfully loaded everything
      if (!error) {
        setError(null);
      }
    } catch (error: any) {
      console.error('MessagesScreen: Error in fetchConversations:', error);
      console.error('MessagesScreen: Full error details:', JSON.stringify(error, null, 2));
      setError(error.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      console.log('MessagesScreen: Screen focused, fetching conversations');
      fetchConversations();
      checkAndShowNotificationPrompt();
    }, [fetchConversations, checkAndShowNotificationPrompt])
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Separate effect for real-time subscriptions to avoid re-subscribing unnecessarily
  useEffect(() => {
    // Set up real-time subscriptions
    if (!user || !isSupabaseConfigured()) {
      return;
    }

    console.log('MessagesScreen: Setting up real-time subscriptions');

    const messagesSubscription = supabase
      .channel('messages_list_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          console.log('MessagesScreen: Message change detected, refreshing conversations');
          fetchConversations();
        }
      )
      .subscribe((status) => {
        console.log('MessagesScreen: Messages subscription status:', status);
      });

    const groupMessagesSubscription = supabase
      .channel('group_messages_list_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
        },
        () => {
          console.log('MessagesScreen: Group message change detected, refreshing conversations');
          fetchConversations();
        }
      )
      .subscribe((status) => {
        console.log('MessagesScreen: Group messages subscription status:', status);
      });

    return () => {
      console.log('MessagesScreen: Cleaning up real-time subscriptions');
      messagesSubscription.unsubscribe();
      groupMessagesSubscription.unsubscribe();
    };
  }, [user, fetchConversations]);

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
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
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

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading messages...</Text>
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

      {error && (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="error"
              size={24}
              color={colors.error}
            />
            <View style={styles.errorTextContainer}>
              <Text style={styles.errorTitle}>Couldn&apos;t load conversations</Text>
              <Text style={styles.errorMessage}>Please try again.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              console.log('User tapped Retry');
              setError(null);
              setLoading(true);
              fetchConversations();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {filteredConversations.length === 0 && !error ? (
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
      ) : !error ? (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => `${item.type}:${item.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : null}

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
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  errorTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#c62828',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.card,
  },
});
