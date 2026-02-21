/**
 * Web implementation: Push notifications are not supported on web.
 * This module provides no-op stubs so the app can render without loading
 * expo-notifications (which crashes or fails on web).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_PROMPT_DISMISSED_KEY = 'notificationsPromptDismissedAt';

export const isExpoGo = (): boolean => false;
export const isPushNotificationSupported = (): boolean => false;

export const getNotificationsPromptDismissedAt = async (): Promise<number | null> => {
  try {
    const v = await AsyncStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY);
    return v ? parseInt(v, 10) : null;
  } catch {
    return null;
  }
};

export const setNotificationsPromptDismissedAt = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, Date.now().toString());
  } catch {
    // ignore
  }
};

export const clearNotificationsPromptDismissedAt = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_PROMPT_DISMISSED_KEY);
  } catch {
    // ignore
  }
};

export const shouldShowNotificationsPrompt = async (): Promise<boolean> => false;
export const requestNotificationPermissions = async (): Promise<boolean> => false;
export const registerPushToken = async (_userId: string): Promise<string | null> => null;

export const sendTestPushNotification = async (
  _token: string,
  _title?: string,
  _body?: string
): Promise<{ success: boolean; error?: string; fullResponse?: unknown }> => ({
  success: false,
  error: 'Push notifications are not supported on web',
});

export const sendTestPushToCurrentUser = async (_userId: string) =>
  sendTestPushNotification('', undefined, undefined);

export const scheduleCheckInNotification = async (
  _courtName: string,
  _durationMinutes: number
): Promise<string | null> => null;

export const cancelCheckOutNotification = async (_notificationId: string): Promise<void> => {};
export const sendManualCheckOutNotification = async (_courtName: string): Promise<void> => {};
export const sendFriendCheckInNotification = async (
  _friendEmail: string,
  _courtName: string
): Promise<void> => {};
export const sendFriendRequestNotification = async (_requesterIdentifier: string): Promise<void> =>
  {};

/** No-op on web; push is not supported. Returns { ok: false } so callers do not throw. */
export async function notifyNewMessage(_payload: {
  type: 'direct' | 'group';
  message_id?: string;
  sender_id?: string;
  recipient_id?: string;
  group_id?: string;
  content?: string;
  sender_name?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Push notifications are not supported on web' };
}

export const checkNotificationPermissionStatus = async (): Promise<
  'granted' | 'denied' | 'undetermined'
> => 'undetermined';
