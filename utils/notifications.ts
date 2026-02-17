import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/supabase/client';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-notifications does not support web - setNotificationHandler can crash (e.g. localStorage)
// A notifications.web.ts stub is used for web builds; this guard is a fallback
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('[Notifications] setNotificationHandler failed:', e);
  }
}

// Constants for notification prompt persistence
const NOTIFICATION_PROMPT_DISMISSED_KEY = 'notificationsPromptDismissedAt';
const MIN_DAYS_BETWEEN_PROMPTS = 14; // 14 days

// ---------- Helpers ----------
const withTimeout = async <T,>(p: Promise<T>, ms = 8000): Promise<T> => {
  return (await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timed out')), ms)),
  ])) as T;
};

/**
 * Check permission WITHOUT prompting.
 * Use this during check-in/out so we never hang waiting for an OS prompt.
 */
const hasGrantedNotificationsNoPrompt = async (): Promise<boolean> => {
  try {
    const { status } = await withTimeout(Notifications.getPermissionsAsync(), 5000);
    return status === 'granted';
  } catch (error) {
    console.log('[Notifications] Error checking permission (no-prompt):', error);
    return false;
  }
};

/**
 * Check if we're running in Expo Go (not a dev build or production build)
 * Push notifications don't work in Expo Go on Android SDK 53+
 */
export const isExpoGo = (): boolean => {
  return Constants.appOwnership === 'expo';
};

/**
 * Check if push notifications are supported in the current environment
 */
export const isPushNotificationSupported = (): boolean => {
  // Must be a physical device
  if (!Device.isDevice) {
    console.log('[Push] Not supported: Must use physical device');
    return false;
  }

  // Check if running in Expo Go on Android
  const isAndroid = Platform.OS === 'android';
  const inExpoGo = isExpoGo();

  if (isAndroid && inExpoGo) {
    console.log('[Push] Not supported: Expo Go removed Android remote push notifications in SDK 53+');
    console.log('[Push] Please use a Development Build or TestFlight/Production build to test push notifications');
    return false;
  }

  return true;
};

/**
 * Get the timestamp when the user last dismissed the notification prompt
 */
export const getNotificationsPromptDismissedAt = async (): Promise<number | null> => {
  try {
    const dismissedAt = await AsyncStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY);
    return dismissedAt ? parseInt(dismissedAt, 10) : null;
  } catch (error) {
    console.log('[Notifications] Error reading prompt dismissed timestamp:', error);
    return null;
  }
};

/**
 * Set the timestamp when the user dismissed the notification prompt
 */
export const setNotificationsPromptDismissedAt = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, Date.now().toString());
    console.log('[Notifications] Prompt dismissed timestamp saved');
  } catch (error) {
    console.log('[Notifications] Error saving prompt dismissed timestamp:', error);
  }
};

/**
 * Clear the notification prompt dismissed timestamp (for manual re-enable)
 */
export const clearNotificationsPromptDismissedAt = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_PROMPT_DISMISSED_KEY);
    console.log('[Notifications] Prompt dismissed timestamp cleared');
  } catch (error) {
    console.log('[Notifications] Error clearing prompt dismissed timestamp:', error);
  }
};

/**
 * Check if we should show the notification prompt
 */
export const shouldShowNotificationsPrompt = async (): Promise<boolean> => {
  try {
    const { status } = await withTimeout(Notifications.getPermissionsAsync(), 5000);
    if (status === 'granted') {
      console.log('[Notifications] Already granted, no need to show prompt');
      return false;
    }

    const dismissedAt = await getNotificationsPromptDismissedAt();

    if (!dismissedAt) {
      console.log('[Notifications] Never dismissed, should show prompt');
      return true;
    }

    const fourteenDaysInMs = MIN_DAYS_BETWEEN_PROMPTS * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = Date.now() - fourteenDaysInMs;
    const shouldShow = dismissedAt < fourteenDaysAgo;

    console.log('[Notifications] Dismissed at:', new Date(dismissedAt).toISOString());
    console.log('[Notifications] Should show prompt:', shouldShow);

    return shouldShow;
  } catch (error) {
    console.log('[Notifications] Error checking if should show prompt:', error);
    return false;
  }
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (!isPushNotificationSupported()) return false;

    const { status: existingStatus } = await withTimeout(Notifications.getPermissionsAsync(), 5000);
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await withTimeout(Notifications.requestPermissionsAsync(), 15000);
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Notification permissions not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await withTimeout(
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        }),
        8000
      );
    }

    console.log('[Push] Notification permissions granted');
    await clearNotificationsPromptDismissedAt();
    return true;
  } catch (error) {
    console.log('[Push] Error requesting notification permissions:', error);
    return false;
  }
};

export const registerPushToken = async (userId: string): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured()) {
      console.log('[Push] Supabase not configured, skipping push token registration');
      return null;
    }

    if (!isPushNotificationSupported()) {
      console.log('[Push] Push notifications not supported in this environment');
      return null;
    }

    // This is a user-initiated setup path: OK to prompt
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Push] No notification permission, skipping push token registration');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      console.error('[Push] Expo project ID not found in app.json. Please add it under expo.extra.eas.projectId');
      return null;
    }

    console.log('[Push] Getting Expo push token with project ID:', projectId);

    const tokenData = await withTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      15000
    );

    const pushToken = tokenData.data;
    const tokenPrefix = pushToken?.startsWith('ExponentPushToken[') ? pushToken.slice(0, 25) + '...]' : pushToken ? `${pushToken.slice(0, 12)}...` : 'null';
    const platform = Platform.OS as 'ios' | 'android' | 'web';
    const now = new Date().toISOString();

    console.log('[Push] Token registration:', {
      userId,
      tokenLength: pushToken?.length ?? 0,
      tokenPrefix,
      platform,
      lastUpdated: now,
    });

    // Upsert into push_tokens (user_id + platform) - one current token per device type
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          platform,
          token: pushToken,
          active: true,
          updated_at: now,
        },
        { onConflict: 'user_id,platform', ignoreDuplicates: false }
      );

    if (error) {
      console.error('[Push] Error saving push token:', error);
      return null;
    }

    // Also update users.push_token for backward compatibility (e.g. legacy readers)
    await supabase.from('users').update({ push_token: pushToken }).eq('id', userId);

    console.log('[Push] Push token registered successfully for user', userId);
    return pushToken;
  } catch (error) {
    console.log('[Push] Error registering push token:', error);
    return null;
  }
};

export type TestPushResult = {
  success: boolean;
  error?: string;
  /** Full Expo API response for debugging */
  fullResponse?: unknown;
};

export const sendTestPushNotification = async (
  expoPushToken: string,
  title: string = 'Test Push Notification',
  body: string = 'This is a test push from PickleRadar!'
): Promise<TestPushResult> => {
  try {
    const tokenPrefix = expoPushToken?.startsWith('ExponentPushToken[')
      ? expoPushToken.slice(0, 25) + '...]'
      : expoPushToken?.slice(0, 20) + '...';
    console.log('[Push] Sending test push to:', tokenPrefix);

    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: { type: 'test', timestamp: new Date().toISOString() },
    };

    const response = await withTimeout(
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }),
      15000
    );

    const result = await response.json();
    console.log('[Push] Test push full response:', JSON.stringify(result, null, 2));

    if (result?.data?.[0]?.status === 'ok') {
      return { success: true, fullResponse: result };
    }

    const errMsg = result?.data?.[0]?.message || result?.errors?.[0]?.message || 'Failed to send test push notification';
    return { success: false, error: errMsg, fullResponse: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Push] Test push error:', msg);
    return { success: false, error: msg, fullResponse: undefined };
  }
};

/**
 * Register current token, then send a test push to the current user.
 * Use from Profile or dev screen. Logs full send response.
 */
export const sendTestPushToCurrentUser = async (userId: string): Promise<TestPushResult> => {
  const token = await registerPushToken(userId);
  if (!token) {
    return { success: false, error: 'No push token (register failed or not supported)' };
  }
  return sendTestPushNotification(
    token,
    'Test Push from PickleRadar',
    'If you see this, push notifications are working!'
  );
};

/**
 * Request remote push for a new message (direct or group).
 * Called by the sender's client after a successful message insert.
 * Does not block; failures are logged only.
 */
export const notifyNewMessage = async (params: {
  type: 'direct' | 'group';
  sender_id: string;
  recipient_id?: string;
  group_id?: string;
  content: string;
  sender_name?: string;
  message_id?: string;
}): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  try {
    const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
    if (!supabaseUrl) {
      console.warn('[Push] notifyNewMessage: Supabase URL not configured');
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      console.warn('[Push] notifyNewMessage: No session, skipping');
      return;
    }
    const url = `${supabaseUrl}/functions/v1/notify-new-message`;
    const body =
      params.type === 'direct'
        ? {
            type: 'direct' as const,
            sender_id: params.sender_id,
            recipient_id: params.recipient_id,
            content: params.content,
            sender_name: params.sender_name,
            message_id: params.message_id,
          }
        : {
            type: 'group' as const,
            sender_id: params.sender_id,
            group_id: params.group_id,
            content: params.content,
            sender_name: params.sender_name,
            message_id: params.message_id,
          };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[Push] notifyNewMessage failed:', res.status, json);
    }
  } catch (err) {
    console.warn('[Push] notifyNewMessage error:', err);
  }
};

/**
 * NOTE:
 * - This is triggered during a check-in user action.
 * - It MUST NOT prompt permissions (no OS prompt).
 * - It will only schedule notifications if permission is already granted.
 */
export const scheduleCheckInNotification = async (courtName: string, durationMinutes: number) => {
  try {
    if (!isPushNotificationSupported()) {
      console.log('[Notifications] Push not supported, skipping check-in notification');
      return null;
    }

    const granted = await hasGrantedNotificationsNoPrompt();
    if (!granted) {
      console.log('[Notifications] Permission not granted, skipping check-in notifications');
      return null;
    }

    await withTimeout(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Checked In! 🎾',
          body: `You're checked in at ${courtName} for ${durationMinutes} minutes`,
          data: { courtName, type: 'check_in' },
        },
        trigger: null,
      }),
      8000
    );

    const checkOutTime = new Date(Date.now() + durationMinutes * 60 * 1000);
    const notificationId = await withTimeout(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Auto Check-Out ⏰',
          body: `You've been automatically checked out from ${courtName}`,
          data: { courtName, type: 'auto_checkout' },
        },
        trigger: { date: checkOutTime },
      }),
      8000
    );

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    let durationText = '';
    if (hours > 0) {
      durationText = `${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) durationText += ` and ${minutes} minutes`;
    } else {
      durationText = `${minutes} minutes`;
    }

    await withTimeout(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Check-Out Scheduled 📅',
          body: `You'll be automatically checked out in ${durationText}`,
          data: { courtName, type: 'checkout_scheduled' },
        },
        trigger: { seconds: 2 },
      }),
      8000
    );

    console.log('[Notifications] Check-in notifications scheduled successfully');
    return notificationId;
  } catch (error) {
    console.log('[Notifications] Error scheduling check-in notification (non-blocking):', error);
    return null;
  }
};

export const cancelCheckOutNotification = async (notificationId: string) => {
  try {
    if (!isPushNotificationSupported()) {
      console.log('[Notifications] Push not supported, skipping cancel notification');
      return;
    }

    await withTimeout(Notifications.cancelScheduledNotificationAsync(notificationId), 8000);
    console.log('[Notifications] Cancelled scheduled check-out notification');
  } catch (error) {
    console.log('[Notifications] Error cancelling notification (non-blocking):', error);
  }
};

/**
 * NOTE:
 * - This is triggered during a check-out user action.
 * - It MUST NOT prompt permissions (no OS prompt).
 * - It will only schedule a local notification if permission is already granted.
 */
export const sendManualCheckOutNotification = async (courtName: string) => {
  try {
    if (!isPushNotificationSupported()) {
      console.log('[Notifications] Push not supported, skipping check-out notification');
      return;
    }

    const granted = await hasGrantedNotificationsNoPrompt();
    if (!granted) {
      console.log('[Notifications] Permission not granted, skipping manual checkout notification');
      return;
    }

    await withTimeout(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Checked Out ✅',
          body: `You've checked out from ${courtName}`,
          data: { courtName, type: 'manual_checkout' },
        },
        trigger: null,
      }),
      8000
    );

    console.log('[Notifications] Manual check-out notification sent');
  } catch (error) {
    console.log('[Notifications] Error sending manual check-out notification (non-blocking):', error);
  }
};

export const sendFriendCheckInNotification = async (friendEmail: string, courtName: string) => {
  try {
    if (!isPushNotificationSupported()) {
      console.log('[Notifications] Push not supported, skipping friend check-in notification');
      return;
    }

    // This is not critical-path; avoid prompting
    const granted = await hasGrantedNotificationsNoPrompt();
    if (!granted) {
      console.log('[Notifications] Permission not granted, skipping friend check-in notification');
      return;
    }

    await withTimeout(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Friend Checked In! 👋',
          body: `${friendEmail} is now playing at ${courtName}`,
          data: { friendEmail, courtName, type: 'friend_checkin' },
        },
        trigger: null,
      }),
      8000
    );

    console.log('[Notifications] Friend check-in notification sent');
  } catch (error) {
    console.log('[Notifications] Error sending friend check-in notification (non-blocking):', error);
  }
};

export const sendFriendRequestNotification = async (requesterIdentifier: string) => {
  try {
    if (!isPushNotificationSupported()) {
      console.log('[Notifications] Push not supported, skipping friend request notification');
      return;
    }

    // Not critical-path; avoid prompting
    const granted = await hasGrantedNotificationsNoPrompt();
    if (!granted) {
      console.log('[Notifications] Permission not granted, skipping friend request notification');
      return;
    }

    await withTimeout(
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Friend Request! 👋',
          body: `${requesterIdentifier} wants to connect with you on PickleRadar`,
          data: { requesterIdentifier, type: 'friend_request' },
        },
        trigger: null,
      }),
      8000
    );

    console.log('[Notifications] Friend request notification sent');
  } catch (error) {
    console.log('[Notifications] Error sending friend request notification (non-blocking):', error);
  }
};

export const checkNotificationPermissionStatus = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
  try {
    const { status } = await withTimeout(Notifications.getPermissionsAsync(), 5000);
    return status;
  } catch (error) {
    console.log('Error checking notification permission status:', error);
    return 'undetermined';
  }
};
