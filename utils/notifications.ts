
import * as Notifications from 'expo-notifications';
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

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
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
    
    return true;
  } catch (error) {
    console.log('Error requesting notification permissions:', error);
    return false;
  }
};

export const registerPushToken = async (userId: string): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, skipping push token registration');
      return null;
    }

    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission, skipping push token registration');
      return null;
    }

    // Get project ID from constants
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                     Constants.easConfig?.projectId;

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    
    const pushToken = tokenData.data;
    console.log('Got push token:', pushToken);

    // Save the push token to the user's profile
    const { error } = await supabase
      .from('users')
      .update({ push_token: pushToken })
      .eq('id', userId);

    if (error) {
      console.error('Error saving push token:', error);
      return null;
    }

    console.log('Push token registered successfully');
    return pushToken;
  } catch (error) {
    console.log('Error registering push token:', error);
    return null;
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
