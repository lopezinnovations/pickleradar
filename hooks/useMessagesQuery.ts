import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { formatDisplayName } from '@/utils/formatDisplayName';


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

const MESSAGES_LIMIT = 50;

function isMuteActive(mutedUntil: string | null) {
  // null = muted indefinitely
  if (!mutedUntil) return true;
  return new Date(mutedUntil) > new Date();
}

async function fetchConversations(userId: string): Promise<Conversation[]> {
  console.log('useMessagesQuery: Fetching conversations for user:', userId);

  if (!isSupabaseConfigured()) {
    console.log('useMessagesQuery: Supabase not configured');
    return [];
  }

  try {
    // 1) Fetch direct messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, read')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_LIMIT);

    if (messagesError && messagesError.code !== 'PGRST116') {
      console.error('useMessagesQuery: Error fetching messages:', messagesError);
    }

    console.log('useMessagesQuery: Fetched', messages?.length || 0, 'direct messages');

    // 2) Fetch mutes ONCE (used for both direct + group)
    const { data: mutes, error: mutesError } = await supabase
      .from('conversation_mutes')
      .select('conversation_type, conversation_id, muted_until')
      .eq('user_id', userId);

    if (mutesError && mutesError.code !== 'PGRST116') {
      console.log('useMessagesQuery: Error fetching mutes (non-critical):', mutesError);
    }

    const mutesMap = new Map<string, boolean>();
    (mutes || []).forEach((mute: any) => {
      const key = `${mute.conversation_type}:${mute.conversation_id}`;
      mutesMap.set(key, isMuteActive(mute.muted_until));
    });

    // 3) Fetch user details for direct conv partners
    const uniqueUserIds = new Set<string>();
    (messages || []).forEach((msg: any) => {
      if (msg.sender_id !== userId) uniqueUserIds.add(msg.sender_id);
      if (msg.recipient_id !== userId) uniqueUserIds.add(msg.recipient_id);
    });

    const userDetailsMap = new Map<string, any>();
    if (uniqueUserIds.size > 0) {
      const { data: userDetails, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, pickleballer_nickname')
        .in('id', Array.from(uniqueUserIds));

      if (usersError && usersError.code !== 'PGRST116') {
        console.log('useMessagesQuery: Error fetching user details (non-critical):', usersError);
      }

      (userDetails || []).forEach((u: any) => userDetailsMap.set(u.id, u));
    }

    // 4) Build direct conversations
    const directConversationsMap = new Map<string, Conversation>();

    (messages || []).forEach((message: any) => {
      const isFromMe = message.sender_id === userId;
      const partnerId = isFromMe ? message.recipient_id : message.sender_id;
      const partner = userDetailsMap.get(partnerId);

      if (!directConversationsMap.has(partnerId)) {
        const displayName = partner
          ? formatDisplayName(partner)
          : 'Unknown User';

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
          isMuted: mutesMap.get(muteKey) || false,
        });
      }

      // Unread count (only messages from partner, unread)
      if (!isFromMe && !message.read) {
        const conv = directConversationsMap.get(partnerId);
        if (conv) conv.unreadCount += 1;
      }
    });

    // 5) Fetch groups the user is in
    const { data: userGroups, error: userGroupsError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .limit(MESSAGES_LIMIT);

    if (userGroupsError && userGroupsError.code !== 'PGRST116') {
      console.error('useMessagesQuery: Error fetching user groups:', userGroupsError);
    }

    console.log('useMessagesQuery: User is member of', userGroups?.length || 0, 'groups');

    let groupConversations: Conversation[] = [];

    if (userGroups && userGroups.length > 0) {
      const groupIds = userGroups.map((g: any) => g.group_id);

      const { data: groups, error: groupsError } = await supabase
        .from('group_chats')
        .select('id, name, created_at')
        .in('id', groupIds);

      if (groupsError && groupsError.code !== 'PGRST116') {
        console.error('useMessagesQuery: Error fetching groups:', groupsError);
      } else {
        console.log('useMessagesQuery: Fetched', groups?.length || 0, 'group details');

        // Parallel fetch last message + member count per group (faster than serial)
        const groupRows = await Promise.all(
          (groups || []).map(async (group: any) => {
            const [lastMsgRes, countRes] = await Promise.all([
              supabase
                .from('group_messages')
                .select('content, created_at')
                .eq('group_id', group.id)
                .order('created_at', { ascending: false })
                .limit(1),
              supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id),
            ]);

            const lastMessage = lastMsgRes.data && lastMsgRes.data.length > 0 ? lastMsgRes.data[0] : null;
            const memberCount = countRes.count || 0;

            const muteKey = `group:${group.id}`;

            return {
              id: group.id,
              type: 'group' as const,
              title: group.name,
              lastMessage: lastMessage?.content || 'No messages yet',
              lastMessageTime: lastMessage?.created_at || group.created_at,
              unreadCount: 0,
              memberCount,
              isMuted: mutesMap.get(muteKey) || false,
            } satisfies Conversation;
          })
        );

        groupConversations = groupRows;
      }
    }

    const allConversations = [...Array.from(directConversationsMap.values()), ...groupConversations].sort((a, b) => {
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    console.log('useMessagesQuery: Loaded', allConversations.length, 'total conversations');
    return allConversations;
  } catch (err: any) {
    console.error('useMessagesQuery: Error in fetchConversations:', err);
    return [];
  }
}

export function useMessagesQuery(userId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations', userId],
    queryFn: () => fetchConversations(userId!),
    enabled: !!userId && isSupabaseConfigured(),
    staleTime: 30000,
    gcTime: 600000,
    refetchOnFocus: false,
  });

  const refetch = useCallback(() => {
    console.log('useMessagesQuery: Manual refetch triggered');
    return queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
  }, [queryClient, userId]);

  return {
    conversations: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch,
    isRefetching: query.isRefetching,
  };
}
