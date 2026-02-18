
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isSupabaseConfigured } from "@/app/integrations/supabase/client";
import { MuteOptionsModal } from '@/components/MuteOptionsModal';
import { notifyNewMessage } from '@/utils/notifications';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';

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
  const { id: recipientId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipientProfile, setRecipientProfile] = useState<UserProfile | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [messageRequest, setMessageRequest] = useState<MessageRequest | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchRecipientProfile = useCallback(async () => {
    if (!recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, pickleballer_nickname')
        .eq('id', recipientId)
        .single();

      if (error) throw error;
      setRecipientProfile(data);
    } catch (error) {
      console.error('Error fetching recipient profile:', error);
    }
  }, [recipientId]);

  const checkFriendshipStatus = useCallback(async () => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${recipientId}),and(user_id.eq.${recipientId},friend_id.eq.${user.id})`)
        .eq('status', 'accepted')
        .maybeSingle();

      if (error) throw error;
      setIsFriend(!!data);
    } catch (error) {
      console.error('Error checking friendship status:', error);
    }
  }, [user?.id, recipientId]);

  const checkMessageRequest = useCallback(async () => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('message_requests')
        .select('*')
        .eq('sender_id', user.id)
        .eq('recipient_id', recipientId)
        .maybeSingle();

      if (error) throw error;
      setMessageRequest(data);
    } catch (error) {
      console.error('[MESSAGES] Error checking message request:', error);
    }
  }, [user?.id, recipientId]);

  const checkMuteStatus = useCallback(async () => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('conversation_mutes')
        .select('muted_until')
        .eq('user_id', user.id)
        .eq('conversation_type', 'direct')
        .eq('conversation_id', recipientId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const mutedUntil = data.muted_until ? new Date(data.muted_until) : null;
        const now = new Date();
        setIsMuted(mutedUntil === null || mutedUntil > now);
      } else {
        setIsMuted(false);
      }
    } catch (error) {
      console.error('[MESSAGES] Error checking mute status:', error);
    }
  }, [user?.id, recipientId]);

  const fetchMessages = useCallback(async () => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      const unreadMessages = (data || []).filter(
        (msg: Message) => msg.recipient_id === user.id && !msg.read
      );

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map((msg: Message) => msg.id);
        await supabase
          .from('messages')
          .update({ read: true })
          .in('id', messageIds);
      }
    } catch (error) {
      console.error('[MESSAGES] Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, recipientId]);

  useEffect(() => {
    if (user && recipientId) {
      fetchRecipientProfile();
      fetchMessages();
      checkFriendshipStatus();
      checkMessageRequest();
      checkMuteStatus();
    }
  }, [user, recipientId, fetchRecipientProfile, fetchMessages, checkFriendshipStatus, checkMessageRequest, checkMuteStatus]);

  useEffect(() => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`messages:${user.id}:${recipientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id}))`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Replace our optimistic with real: remove optimistics from us when we get the real insert
            const filtered = newMsg.sender_id === user.id
              ? prev.filter((m) => !m.isOptimistic || m.sender_id !== user.id)
              : prev.filter((m) => !m.isOptimistic || m.optimisticId !== newMsg.id);
            return [...filtered, newMsg];
          });

          if (newMsg.recipient_id === user.id) {
            supabase
              .from('messages')
              .update({ read: true })
              .eq('id', newMsg.id)
              .then(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, recipientId]);

  const createMessageRequest = async () => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

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

      if (error) throw error;
      await checkMessageRequest();
    } catch (error) {
      console.error('[MESSAGES] Error creating message request:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !recipientId || sending || !isSupabaseConfigured()) return;

    if (!isFriend && !messageRequest) {
      await createMessageRequest();
    }

    setSending(true);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: user.id,
      recipient_id: recipientId,
      content: newMessage.trim(),
      read: false,
      created_at: new Date().toISOString(),
      isOptimistic: true,
      optimisticId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: user.id,
            recipient_id: recipientId,
            content: optimisticMessage.content,
          },
        ])
        .select('id')
        .single();

      if (error) throw error;

      const senderName =
        user.pickleballerNickname ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        undefined;
      console.log('[MESSAGES] Message inserted, triggering push for recipient', recipientId);
      notifyNewMessage({
        type: 'direct',
        sender_id: user.id,
        recipient_id: recipientId,
        content: optimisticMessage.content,
        sender_name: senderName,
        message_id: inserted?.id,
      }).catch((e) => console.warn('[MESSAGES] notifyNewMessage error', e));
    } catch (error) {
      console.error('[MESSAGES] Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.optimisticId !== optimisticId));
      setNewMessage(optimisticMessage.content);
    } finally {
      setSending(false);
    }
  };

  const handleMuteConversation = async (minutes: number | null) => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

    try {
      const mutedUntil = minutes === null ? null : new Date(Date.now() + minutes * 60000).toISOString();

      const { error } = await supabase
        .from('conversation_mutes')
        .upsert(
          {
            user_id: user.id,
            conversation_type: 'direct',
            conversation_id: recipientId,
            muted_until: mutedUntil,
          },
          {
            onConflict: 'user_id,conversation_type,conversation_id',
          }
        );

      if (error) throw error;

      setIsMuted(true);
      setShowMuteModal(false);

      const muteMessage =
        minutes === null
          ? 'Muted until you turn it back on'
          : minutes === 60
            ? 'Muted for 1 hour'
            : minutes === 480
              ? 'Muted for 8 hours'
              : minutes === 1440
                ? 'Muted for 24 hours'
                : `Muted for ${Math.round(minutes / 60)} hours`;
      Alert.alert('Muted', muteMessage);
    } catch (error) {
      console.error('Error muting conversation:', error);
    }
  };

  const handleUnmute = async () => {
    if (!user?.id || !recipientId || !isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('conversation_mutes')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_type', 'direct')
        .eq('conversation_id', recipientId);

      if (error) throw error;

      setIsMuted(false);
      Alert.alert('Unmuted', 'You will receive notifications for this conversation again.');
    } catch (error) {
      console.error('Error unmuting conversation:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timeString = `${formattedHours}:${formattedMinutes} ${ampm}`;
    return timeString;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateString = date.toDateString();
    const todayString = today.toDateString();
    const yesterdayString = yesterday.toDateString();

    if (dateString === todayString) {
      return 'Today';
    } else if (dateString === yesterdayString) {
      return 'Yesterday';
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[date.getMonth()];
      const dayNumber = date.getDate();
      const formattedDate = `${monthName} ${dayNumber}`;
      return formattedDate;
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isCurrentUser = item.sender_id === user?.id;
    const showDateSeparator =
      index === 0 ||
      new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();

    const dateLabel = formatDate(item.created_at);
    const timeLabel = formatTime(item.created_at);

    return (
      <React.Fragment key={item.id}>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{dateLabel}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
          ]}
        >
          <Text style={[styles.messageText, isCurrentUser && styles.currentUserMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isCurrentUser && styles.currentUserMessageTime]}>
            {timeLabel}
          </Text>
        </View>
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const recipientName = recipientProfile?.pickleballer_nickname ||
    (recipientProfile?.first_name && recipientProfile?.last_name
      ? `${recipientProfile.first_name} ${recipientProfile.last_name}`
      : 'User');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={24} color={colors.text} />
          </View>
          <Text style={styles.headerTitle}>{recipientName}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowMuteModal(true)} style={styles.muteButton}>
          <IconSymbol
            ios_icon_name={isMuted ? 'bell.slash.fill' : 'ellipsis'}
            android_material_icon_name={isMuted ? 'notifications-off' : 'more-vert'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
        >
          <IconSymbol ios_icon_name="arrow.up.circle.fill" android_material_icon_name="send" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

        <MuteOptionsModal
          visible={showMuteModal}
          onClose={() => setShowMuteModal(false)}
          onMute={handleMuteConversation}
          onUnmute={handleUnmute}
          isMuted={isMuted}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  muteButton: {
    padding: 8,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  currentUserMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  currentUserMessageTime: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    padding: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
