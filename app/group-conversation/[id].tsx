
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, isSupabaseConfigured } from '@/supabase/client';
import { IconSymbol } from '@/components/IconSymbol';
import { MuteOptionsModal } from '@/components/MuteOptionsModal';

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
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const checkMuteStatus = useCallback(async () => {
    if (!user?.id || !groupId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('conversation_mutes')
        .select('muted_until')
        .eq('user_id', user.id)
        .eq('conversation_type', 'group')
        .eq('conversation_id', groupId)
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
      console.error('Error checking group mute status:', error);
    }
  }, [user?.id, groupId]);

  useFocusEffect(
    useCallback(() => {
      checkMuteStatus();
    }, [checkMuteStatus])
  );

  const fetchGroupInfo = useCallback(async () => {
    if (!groupId || !isSupabaseConfigured()) return;

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('group_chats')
        .select('id, name, created_by')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const { count, error: countError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

      if (countError) throw countError;

      setGroupInfo({
        ...groupData,
        memberCount: count || 0,
      });
    } catch (error) {
      console.error('Error fetching group info:', error);
    }
  }, [groupId]);

  const fetchMessages = useCallback(async () => {
    if (!groupId || !isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          sender:users!group_messages_sender_id_fkey(id, first_name, last_name, pickleballer_nickname)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      fetchGroupInfo();
      fetchMessages();
      checkMuteStatus();
    }
  }, [groupId, fetchGroupInfo, fetchMessages, checkMuteStatus]);

  useEffect(() => {
    if (!groupId || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`group_messages:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const newMsg = payload.new as GroupMessage;

          const { data: senderData } = await supabase
            .from('users')
            .select('id, first_name, last_name, pickleballer_nickname')
            .eq('id', newMsg.sender_id)
            .single();

          const messageWithSender = {
            ...newMsg,
            sender: senderData,
          };

          setMessages((prev) => {
            const isFromMe = newMsg.sender_id === user?.id;
            const filtered = isFromMe
              ? prev.filter((m) => !m.isOptimistic || m.sender_id !== user?.id)
              : prev.filter((m) => !m.isOptimistic || m.optimisticId !== newMsg.id);
            return [...filtered, messageWithSender];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const handleMuteGroup = async (minutes: number | null) => {
    if (!user?.id || !groupId || !isSupabaseConfigured()) return;

    try {
      const mutedUntil = minutes === null ? null : new Date(Date.now() + minutes * 60000).toISOString();

      const { error } = await supabase
        .from('conversation_mutes')
        .upsert(
          {
            user_id: user.id,
            conversation_type: 'group',
            conversation_id: groupId,
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
      console.error('Error muting group:', error);
    }
  };

  const handleUnmuteGroup = async () => {
    if (!user?.id || !groupId || !isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('conversation_mutes')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_type', 'group')
        .eq('conversation_id', groupId);

      if (error) throw error;

      setIsMuted(false);
      setShowMuteModal(false);
      Alert.alert('Unmuted', 'You will receive notifications for this conversation again.');
    } catch (error) {
      console.error('Error unmuting group:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !groupId || sending || !isSupabaseConfigured()) return;

    setSending(true);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: GroupMessage = {
      id: optimisticId,
      group_id: groupId,
      sender_id: user.id,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        pickleballer_nickname: user.pickleballerNickname,
      },
      isOptimistic: true,
      optimisticId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const { error } = await supabase
        .from('group_messages')
        .insert([
          {
            group_id: groupId,
            sender_id: user.id,
            content: optimisticMessage.content,
          },
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.optimisticId !== optimisticId));
      setNewMessage(optimisticMessage.content);
    } finally {
      setSending(false);
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

  const formatSenderName = (message: GroupMessage) => {
    if (!message.sender) return 'Unknown';
    const senderData = message.sender;
    const senderName = senderData.pickleballer_nickname ||
      (senderData.first_name && senderData.last_name
        ? `${senderData.first_name} ${senderData.last_name}`
        : 'User');
    return senderName;
  };

  const renderMessage = ({ item, index }: { item: GroupMessage; index: number }) => {
    const isCurrentUser = item.sender_id === user?.id;
    const showDateSeparator =
      index === 0 ||
      new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();

    const dateLabel = formatDate(item.created_at);
    const timeLabel = formatTime(item.created_at);
    const senderName = formatSenderName(item);

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
          {!isCurrentUser && <Text style={styles.senderName}>{senderName}</Text>}
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

  const groupName = groupInfo?.name || 'Group Chat';
  const memberCountText = groupInfo?.memberCount ? `${groupInfo.memberCount} members` : '';

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
            <IconSymbol ios_icon_name="person.3.fill" android_material_icon_name="group" size={24} color={colors.text} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{groupName}</Text>
            {memberCountText && <Text style={styles.headerSubtitle}>{memberCountText}</Text>}
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowMuteModal(true)} style={styles.headerIconButton}>
            <IconSymbol
              ios_icon_name={isMuted ? 'bell.slash.fill' : 'ellipsis'}
              android_material_icon_name={isMuted ? 'notifications-off' : 'more-vert'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/group-info/${groupId}`)} style={styles.headerIconButton}>
            <IconSymbol ios_icon_name="info.circle" android_material_icon_name="info" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <MuteOptionsModal
        visible={showMuteModal}
        onClose={() => setShowMuteModal(false)}
        onMute={handleMuteGroup}
        onUnmute={handleUnmuteGroup}
        isMuted={isMuted}
      />

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
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 8,
  },
  infoButton: {
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
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
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
