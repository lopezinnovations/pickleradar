
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    first_name?: string;
    last_name?: string;
    pickleballer_nickname?: string;
  };
  isOptimistic?: boolean;
  optimisticId?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  created_by: string;
  memberCount: number;
}

export default function GroupConversationScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<any>(null);

  const fetchGroupInfo = useCallback(async () => {
    if (!groupId || !isSupabaseConfigured()) return;

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('group_chats')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) {
        console.log('Error fetching group info:', groupError);
        throw groupError;
      }

      const { count: memberCount, error: countError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

      if (countError) {
        console.log('Error counting members:', countError);
      }

      setGroupInfo({
        id: groupData.id,
        name: groupData.name,
        created_by: groupData.created_by,
        memberCount: memberCount || 0,
      });
    } catch (error) {
      console.log('Error in fetchGroupInfo:', error);
    }
  }, [groupId]);

  const fetchMessages = useCallback(async () => {
    if (!groupId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching messages for group:', groupId);
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          sender:users!group_messages_sender_id_fkey(id, first_name, last_name, pickleballer_nickname)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching group messages:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        // Don't throw - just log and show empty state
        setMessages([]);
        return;
      }

      console.log('Fetched', data?.length || 0, 'messages for group');
      setMessages(data || []);
    } catch (error) {
      console.log('Error in fetchMessages:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupInfo();
    fetchMessages();
  }, [fetchGroupInfo, fetchMessages]);

  // Separate effect for real-time subscription to avoid re-subscribing unnecessarily
  useEffect(() => {
    // Set up real-time subscription for group messages
    if (!groupId || !isSupabaseConfigured()) {
      return;
    }

    console.log('Setting up real-time subscription for group:', groupId);
    
    // Clean up existing subscription
    if (subscriptionRef.current) {
      console.log('Cleaning up existing subscription before creating new one');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    const channelName = `group_messages_${groupId}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          console.log('Real-time group message received:', payload.new);
          const newMessage = payload.new as GroupMessage;
          
          // Fetch sender info
          const { data: senderData, error: senderError } = await supabase
            .from('users')
            .select('id, first_name, last_name, pickleballer_nickname')
            .eq('id', newMessage.sender_id)
            .single();

          if (senderError) {
            console.error('Error fetching sender info:', senderError);
          }

          const messageWithSender = {
            ...newMessage,
            sender: senderData || undefined,
          };

          setMessages((prev) => {
            // Remove any optimistic messages first
            const withoutOptimistic = prev.filter(m => !m.isOptimistic);
            // Check if message already exists (avoid duplicates)
            if (withoutOptimistic.some(m => m.id === messageWithSender.id)) {
              console.log('Message already exists, skipping duplicate');
              return withoutOptimistic;
            }
            console.log('Adding new real-time message to list');
            return [...withoutOptimistic, messageWithSender];
          });

          // Scroll to bottom after a short delay to ensure render is complete
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 150);
        }
      )
      .subscribe((status) => {
        console.log('Group subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('Channel error - subscription failed');
        }
      });

    subscriptionRef.current = subscription;

    return () => {
      console.log('Cleaning up group real-time subscription on unmount');
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [groupId]);

  const sendMessage = async () => {
    if (!messageText.trim() || !user || !groupId || !isSupabaseConfigured()) {
      console.log('Cannot send message: missing required data');
      return;
    }

    console.log('User sending message to group:', groupId, 'Content:', messageText.trim());
    const messageContent = messageText.trim();
    const optimisticId = `optimistic-${Date.now()}`;

    // Optimistic UI: Add message immediately
    const optimisticMessage: GroupMessage = {
      id: optimisticId,
      group_id: groupId as string,
      sender_id: user.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        pickleballer_nickname: user.pickleballerNickname,
      },
      isOptimistic: true,
      optimisticId: optimisticId,
    };

    console.log('Adding optimistic message to UI:', optimisticId);
    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageText('');
    setSending(true);

    // Scroll to bottom immediately
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      console.log('Inserting message into database...');
      const { data, error } = await supabase
        .from('group_messages')
        .insert([
          {
            group_id: groupId,
            sender_id: user.id,
            content: messageContent,
          },
        ])
        .select(`
          *,
          sender:users!group_messages_sender_id_fkey(id, first_name, last_name, pickleballer_nickname)
        `)
        .single();

      if (error) {
        console.error('Error sending message:', error);
        // Remove optimistic message on error
        console.log('Removing optimistic message due to error');
        setMessages((prev) => prev.filter(m => m.optimisticId !== optimisticId));
        throw error;
      }

      console.log('Message sent successfully:', data.id);

      // Replace optimistic message with real message immediately
      // Don't wait for real-time subscription
      setMessages((prev) => 
        prev.map(m => m.optimisticId === optimisticId ? { ...data, isOptimistic: false } : m)
      );
    } catch (error: any) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return timeString;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return dateString;
    }
  };

  const formatSenderName = (message: GroupMessage) => {
    if (!message.sender) return 'Unknown';
    if (message.sender_id === user?.id) return 'You';
    if (message.sender.first_name && message.sender.last_name) {
      const name = `${message.sender.first_name} ${message.sender.last_name.charAt(0)}.`;
      return name;
    }
    return message.sender.pickleballer_nickname || 'Unknown';
  };

  const renderMessage = ({ item, index }: { item: GroupMessage; index: number }) => {
    const isFromMe = item.sender_id === user?.id;
    const showDateSeparator = index === 0 || 
      formatDate(item.created_at) !== formatDate(messages[index - 1].created_at);
    const showSenderName = !isFromMe && (
      index === 0 ||
      messages[index - 1].sender_id !== item.sender_id ||
      showDateSeparator
    );

    const senderName = formatSenderName(item);
    const timeText = formatTime(item.created_at);
    const dateText = formatDate(item.created_at);

    return (
      <React.Fragment key={item.id}>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{dateText}</Text>
          </View>
        )}
        <View style={[styles.messageContainer, isFromMe && styles.myMessageContainer]}>
          {showSenderName && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <View style={[
            styles.messageBubble, 
            isFromMe && styles.myMessageBubble,
            item.isOptimistic && styles.optimisticMessage
          ]}>
            <Text style={[styles.messageText, isFromMe && styles.myMessageText]}>
              {item.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, isFromMe && styles.myMessageTime]}>
                {timeText}
              </Text>
              {item.isOptimistic && (
                <IconSymbol
                  ios_icon_name="clock"
                  android_material_icon_name="schedule"
                  size={12}
                  color={isFromMe ? colors.card : colors.textSecondary}
                  style={{ marginLeft: 4, opacity: 0.6 }}
                />
              )}
            </View>
          </View>
        </View>
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading conversation...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={commonStyles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="chevron-left"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={() => {
              console.log('User tapped group header, navigating to group info');
              router.push(`/group-info/${groupId}`);
            }}
          >
            <View style={styles.headerAvatar}>
              <IconSymbol
                ios_icon_name="person.3.fill"
                android_material_icon_name="group"
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerName}>{groupInfo?.name || 'Group'}</Text>
              <Text style={styles.headerSubtitle}>
                {groupInfo?.memberCount} members
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="message"
                android_material_icon_name="message"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[commonStyles.textSecondary, { marginTop: 16, textAlign: 'center' }]}>
                No messages yet. Start the conversation!
              </Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <IconSymbol
                ios_icon_name="arrow.up.circle.fill"
                android_material_icon_name="send"
                size={32}
                color={messageText.trim() ? colors.card : colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    backgroundColor: colors.highlight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optimisticMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  myMessageText: {
    color: colors.card,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  myMessageTime: {
    color: colors.card,
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.highlight,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
});
