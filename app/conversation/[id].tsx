
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { MuteOptionsModal } from '@/components/MuteOptionsModal';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
  isOptimistic?: boolean;
  optimisticId?: string;
}

interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  pickleballer_nickname?: string;
}

interface MessageRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'ignored';
}

export default function ConversationScreen() {
  const router = useRouter();
  const { id: recipientId } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientProfile, setRecipientProfile] = useState<UserProfile | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageRequest, setMessageRequest] = useState<MessageRequest | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<any>(null);

  const fetchRecipientProfile = useCallback(async () => {
    if (!recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, pickleballer_nickname')
        .eq('id', recipientId)
        .single();

      if (error) {
        console.log('Error loading user profile:', error);
        throw error;
      }
      setRecipientProfile(data);
    } catch (error) {
      console.log('Failed to load recipient profile:', error);
    }
  }, [recipientId]);

  const checkFriendshipStatus = useCallback(async () => {
    if (!user || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${recipientId}),and(user_id.eq.${recipientId},friend_id.eq.${user.id})`)
        .eq('status', 'accepted')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setIsFriend(!!data);
    } catch (error) {
      console.log('Error checking friendship status:', error);
    }
  }, [user, recipientId]);

  const checkMessageRequest = useCallback(async () => {
    if (!user || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('message_requests')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setMessageRequest(data);
    } catch (error) {
      console.log('Error checking message request:', error);
    }
  }, [user, recipientId]);

  const fetchMessages = useCallback(async () => {
    if (!user || !recipientId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching messages for conversation with:', recipientId);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.log('Error fetching messages:', error);
        throw error;
      }

      setMessages(data || []);

      // Mark unread messages as read
      const unreadMessageIds = (data || [])
        .filter((msg: Message) => msg.recipient_id === user.id && !msg.read)
        .map((msg: Message) => msg.id);

      if (unreadMessageIds.length > 0) {
        await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessageIds);
      }
    } catch (error) {
      console.log('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user, recipientId]);

  const acceptMessageRequest = useCallback(async () => {
    if (!messageRequest || !user || !isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('message_requests')
        .update({ status: 'accepted' })
        .eq('id', messageRequest.id);

      if (error) throw error;
      await checkMessageRequest();
    } catch (error) {
      console.log('Error accepting message request:', error);
    }
  }, [messageRequest, user, checkMessageRequest]);

  const checkMuteStatus = useCallback(async () => {
    if (!user || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('conversation_mutes')
        .select('*')
        .eq('user_id', user.id)
        .eq('conversation_type', 'direct')
        .eq('conversation_id', recipientId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.log('Error checking mute status:', error);
      }

      if (data) {
        const mutedUntil = data.muted_until;
        const isMutedNow = !mutedUntil || new Date(mutedUntil) > new Date();
        setIsMuted(isMutedNow);
      }
    } catch (error) {
      console.log('Error in checkMuteStatus:', error);
    }
  }, [user, recipientId]);

  const handleMuteConversation = async (minutes: number | null) => {
    console.log('User muting conversation for:', minutes, 'minutes');
    try {
      if (!user || !recipientId || !isSupabaseConfigured()) return;

      const mutedUntil = minutes ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : null;

      const { error } = await supabase
        .from('conversation_mutes')
        .upsert({
          user_id: user.id,
          conversation_type: 'direct',
          conversation_id: recipientId,
          muted_until: mutedUntil,
        }, {
          onConflict: 'user_id,conversation_type,conversation_id',
        });

      if (error) {
        console.log('Error muting conversation:', error);
        throw error;
      }

      setIsMuted(true);
      setShowMuteModal(false);
      
      const muteMessage = minutes 
        ? `Muted for ${minutes >= 1440 ? '24 hours' : minutes >= 480 ? '8 hours' : '1 hour'}`
        : 'Muted until you turn it back on';
      console.log(muteMessage);
    } catch (error: any) {
      console.log('Error in handleMuteConversation:', error);
    }
  };

  const handleUnmute = async () => {
    console.log('User unmuting conversation');
    try {
      if (!user || !recipientId || !isSupabaseConfigured()) return;

      const { error } = await supabase
        .from('conversation_mutes')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_type', 'direct')
        .eq('conversation_id', recipientId);

      if (error) {
        console.log('Error unmuting conversation:', error);
        throw error;
      }

      setIsMuted(false);
      console.log('Notifications enabled for this conversation');
    } catch (error: any) {
      console.log('Error in handleUnmute:', error);
    }
  };

  useEffect(() => {
    fetchRecipientProfile();
    fetchMessages();
    checkFriendshipStatus();
    checkMessageRequest();
    checkMuteStatus();
  }, [fetchRecipientProfile, fetchMessages, checkFriendshipStatus, checkMessageRequest, checkMuteStatus]);

  // Separate effect for real-time subscription to avoid re-subscribing unnecessarily
  useEffect(() => {
    // Set up real-time subscription for incoming messages
    if (!user || !recipientId || !isSupabaseConfigured()) {
      return;
    }

    console.log('Setting up real-time subscription for conversation');
    
    // Clean up existing subscription
    if (subscriptionRef.current) {
      console.log('Cleaning up existing subscription before creating new one');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    const channelName = `conversation_${user.id}_${recipientId}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${recipientId},recipient_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time message received:', payload.new);
          const newMessage = payload.new as Message;
          
          setMessages((prev) => {
            // Remove optimistic messages (they'll be replaced by real ones)
            const withoutOptimistic = prev.filter(m => !m.isOptimistic);
            
            // Check if message already exists (avoid duplicates)
            if (withoutOptimistic.some(m => m.id === newMessage.id)) {
              console.log('Message already exists, skipping duplicate');
              return withoutOptimistic;
            }
            
            console.log('Adding new real-time message to list');
            return [...withoutOptimistic, newMessage];
          });

          // Mark as read if from recipient
          if (newMessage.sender_id === recipientId && newMessage.recipient_id === user.id) {
            supabase
              .from('messages')
              .update({ read: true })
              .eq('id', newMessage.id)
              .then(() => {
                console.log('Marked message as read');
              })
              .catch((err) => {
                console.log('Error marking message as read:', err);
              });
          }

          // Scroll to bottom after a short delay to ensure render is complete
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 150);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('Channel error - subscription failed');
        }
      });

    subscriptionRef.current = subscription;

    return () => {
      console.log('Cleaning up real-time subscription on unmount');
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user, recipientId]);

  const createMessageRequest = async () => {
    if (!user || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('message_requests')
        .insert([
          {
            sender_id: user.id,
            recipient_id: recipientId,
            status: 'pending',
          },
        ]);

      if (error && error.code !== '23505') {
        throw error;
      }

      await checkMessageRequest();
    } catch (error) {
      console.log('Error creating message request:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !user || !recipientId || !isSupabaseConfigured()) return;

    console.log('User sending message to:', recipientId);
    const messageContent = messageText.trim();
    const optimisticId = `optimistic-${Date.now()}`;

    // Optimistic UI: Add message immediately
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: user.id,
      recipient_id: recipientId as string,
      content: messageContent,
      read: false,
      created_at: new Date().toISOString(),
      isOptimistic: true,
      optimisticId: optimisticId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageText('');
    setSending(true);

    // Scroll to bottom immediately
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      // Check if we need to create a message request
      if (!isFriend && !messageRequest) {
        await createMessageRequest();
      }

      // If recipient is replying to a pending request, accept it automatically
      if (messageRequest && messageRequest.status === 'pending' && messageRequest.recipient_id === user.id) {
        await acceptMessageRequest();
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: user.id,
            recipient_id: recipientId,
            content: messageContent,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter(m => m.optimisticId !== optimisticId));
        throw error;
      }

      console.log('Message sent successfully:', data.id);

      // Replace optimistic message with real message immediately
      // Don't wait for real-time subscription
      setMessages((prev) => 
        prev.map(m => m.optimisticId === optimisticId ? { ...data, isOptimistic: false } : m)
      );
    } catch (error) {
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isFromMe = item.sender_id === user?.id;
    const showDateSeparator = index === 0 || 
      formatDate(item.created_at) !== formatDate(messages[index - 1].created_at);

    const dateText = formatDate(item.created_at);
    const timeText = formatTime(item.created_at);

    return (
      <React.Fragment key={item.id}>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{dateText}</Text>
          </View>
        )}
        <View style={[styles.messageContainer, isFromMe && styles.myMessageContainer]}>
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

  const recipientName = recipientProfile
    ? recipientProfile.first_name && recipientProfile.last_name
      ? `${recipientProfile.first_name} ${recipientProfile.last_name.charAt(0)}.`
      : recipientProfile.pickleballer_nickname || 'User'
    : 'Loading...';

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
            onPress={() => router.push(`/user/${recipientId}`)}
          >
            <View style={styles.headerAvatar}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.headerName}>{recipientName}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => {
              console.log('User tapped options menu');
              setShowOptionsMenu(true);
            }}
          >
            <IconSymbol
              ios_icon_name="ellipsis"
              android_material_icon_name="more-vert"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {!isFriend && messageRequest?.status === 'pending' && messageRequest.sender_id === user?.id && (
          <View style={styles.messageRequestBanner}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.messageRequestText}>
              Message request sent. {recipientName} can reply to accept.
            </Text>
          </View>
        )}

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
                {!isFriend && !messageRequest 
                  ? 'Send a message to start a conversation'
                  : 'No messages yet. Start the conversation!'}
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

        {/* Options Menu Modal */}
        <Modal
          visible={showOptionsMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOptionsMenu(false)}
        >
          <TouchableOpacity
            style={styles.optionsOverlay}
            activeOpacity={1}
            onPress={() => setShowOptionsMenu(false)}
          >
            <View style={styles.optionsMenu}>
              <TouchableOpacity
                style={styles.optionsMenuItem}
                onPress={() => {
                  setShowOptionsMenu(false);
                  if (isMuted) {
                    handleUnmute();
                  } else {
                    setShowMuteModal(true);
                  }
                }}
              >
                <IconSymbol
                  ios_icon_name={isMuted ? "bell.fill" : "bell.slash.fill"}
                  android_material_icon_name={isMuted ? "notifications" : "notifications-off"}
                  size={24}
                  color={colors.text}
                />
                <Text style={styles.optionsMenuText}>
                  {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Mute Options Modal */}
        <MuteOptionsModal
          visible={showMuteModal}
          onClose={() => setShowMuteModal(false)}
          onSelectMute={handleMuteConversation}
        />
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
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  optionsButton: {
    padding: 4,
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  optionsMenu: {
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
  },
  optionsMenuText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 16,
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
  messageRequestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    gap: 8,
  },
  messageRequestText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
