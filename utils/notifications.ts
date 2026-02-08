
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import Constants from 'expo-constants';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    // Check if push notifications are supported
    if (!isPushNotificationSupported()) {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('[Push] Notification permissions not granted');
      return false;
    }
    
    // For Android, create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
    console.log('[Push] Notification permissions granted');
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

    // Check if push notifications are supported
    if (!isPushNotificationSupported()) {
      console.log('[Push] Push notifications not supported in this environment');
      return null;
    }

    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Push] No notification permission, skipping push token registration');
      return null;
    }

    // Get project ID from constants
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                     Constants.easConfig?.projectId;

    if (!projectId) {
      console.error('[Push] Expo project ID not found in app.json. Please add it under expo.extra.eas.projectId');
      return null;
    }

    console.log('[Push] Getting Expo push token with project ID:', projectId);

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    
    const pushToken = tokenData.data;
    console.log('[Push] Got push token:', pushToken);

    // Save the push token to the user's profile
    const { error } = await supabase
      .from('users')
      .update({ push_token: pushToken })
      .eq('id', userId);

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

/**
 * Send a test push notification to a specific Expo push token
 * Admin-only function for testing push notifications
 */
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

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('[Push] Test push notification response:', result);

    if (result.data && result.data[0] && result.data[0].status === 'ok') {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: result.data?.[0]?.message || 'Failed to send test push notification' 
      };
    }
  } catch (error: any) {
    console.error('[Push] Error sending test push notification:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send test push notification' 
    };
  }
};

export const scheduleCheckInNotification = async (courtName: string, durationMinutes: number) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission, skipping notification');
      return null;
    }

    // Immediate notification for successful check-in
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Checked In! 🎾',
        body: `You're checked in at ${courtName} for ${durationMinutes} minutes`,
        data: { courtName, type: 'check_in' },
      },
      trigger: null, // Immediate
    });

    // Schedule notification for check-out time
    const checkOutTime = new Date(Date.now() + durationMinutes * 60 * 1000);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Auto Check-Out ⏰',
        body: `You've been automatically checked out from ${courtName}`,
        data: { courtName, type: 'auto_checkout' },
      },
      trigger: {
        date: checkOutTime,
      },
    });

    // Also send a notification about scheduled check-out time
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    let durationText = '';
    if (hours > 0) {
      durationText = `${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) {
        durationText += ` and ${minutes} minutes`;
      }
    } else {
      durationText = `${minutes} minutes`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Check-Out Scheduled 📅',
        body: `You'll be automatically checked out in ${durationText}`,
        data: { courtName, type: 'checkout_scheduled' },
      },
      trigger: {
        seconds: 2, // Show 2 seconds after check-in
      },
    });

    return notificationId;
  } catch (error) {
    console.log('Error scheduling check-in notification:', error);
    return null;
  }
};

export const cancelCheckOutNotification = async (notificationId: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('Cancelled scheduled check-out notification');
  } catch (error) {
    console.log('Error cancelling notification:', error);
  }
};

export const sendManualCheckOutNotification = async (courtName: string) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission, skipping notification');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Checked Out ✅',
        body: `You've checked out from ${courtName}`,
        data: { courtName, type: 'manual_checkout' },
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.log('Error sending manual check-out notification:', error);
  }
};

export const sendFriendCheckInNotification = async (friendEmail: string, courtName: string) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission, skipping notification');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Friend Checked In! 👋',
        body: `${friendEmail} is now playing at ${courtName}`,
        data: { friendEmail, courtName, type: 'friend_checkin' },
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.log('Error sending friend check-in notification:', error);
  }
};

export const sendFriendRequestNotification = async (requesterIdentifier: string) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission, skipping notification');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Friend Request! 👋',
        body: `${requesterIdentifier} wants to connect with you on PickleRadar`,
        data: { requesterIdentifier, type: 'friend_request' },
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.log('Error sending friend request notification:', error);
  }
};

export const checkNotificationPermissionStatus = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error) {
    console.log('Error checking notification permission status:', error);
    return 'undetermined';
  }
};
