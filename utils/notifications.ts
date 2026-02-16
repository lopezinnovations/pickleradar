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
    console.log('[Push] Got push token:', pushToken);

    const { error } = await supabase.from('users').update({ push_token: pushToken }).eq('id', userId);
    if (error) {
      console.error('[Push] Error saving push token:', error);
      return null;
    }

    console.log('[Push] Push token registered successfully');
    return pushToken;
  } catch (error) {
    console.log('[Push] Error registering push token:', error);
    return null;
  }
};

export const sendTestPushNotification = async (
  expoPushToken: string,
  title: string = 'Test Push Notification',
  body: string = 'This is a test push from PickleRadar!'
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[Push] Sending test push notification to:', expoPushToken);

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
    console.log('[Push] Test push notification response:', result);

    if (result?.data?.[0]?.status === 'ok') return { success: true };

    return { success: false, error: result?.data?.[0]?.message || 'Failed to send test push notification' };
  } catch (error: any) {
    console.error('[Push] Error sending test push notification:', error);
    return { success: false, error: error?.message || 'Failed to send test push notification' };
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
