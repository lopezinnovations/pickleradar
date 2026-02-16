import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

/**
 * Handles notification tap → deep link to conversation.
 * Mount when user has access to app navigation (e.g. tabs layout).
 */
export function NotificationNavigationHandler() {
  const router = useRouter();
  const isMounted = useRef(false);

  const handleNotificationResponse = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    if (!data) return;

    const type = data.type as string | undefined;
    const conversationId = data.conversationId as string | undefined;

    if (type === 'new_message_direct' && conversationId) {
      router.push(`/conversation/${conversationId}`);
    } else if (type === 'new_message_group' && conversationId) {
      router.push(`/group-conversation/${conversationId}`);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;

    isMounted.current = true;

    Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!isMounted.current) return;
      handleNotificationResponse(response);
    });

    return () => {
      isMounted.current = false;
      sub.remove();
    };
  }, [router]);

  return null;
}
