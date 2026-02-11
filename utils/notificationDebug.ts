
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isPushNotificationSupported, isExpoGo } from './notifications';

/**
 * Comprehensive push notification diagnostics
 * Use this to debug notification issues
 */
export const runNotificationDiagnostics = async (): Promise<{
  supported: boolean;
  issues: string[];
  warnings: string[];
  info: Record<string, any>;
}> => {
  const issues: string[] = [];
  const warnings: string[] = [];
  const info: Record<string, any> = {};

  console.log('=== PUSH NOTIFICATION DIAGNOSTICS ===');

  // 1. Check if physical device
  info.isPhysicalDevice = Device.isDevice;
  if (!Device.isDevice) {
    issues.push('Running on simulator/emulator - push notifications require physical device');
  }

  // 2. Check platform
  info.platform = Platform.OS;
  console.log('Platform:', Platform.OS);

  // 3. Check if Expo Go
  info.isExpoGo = isExpoGo();
  info.appOwnership = Constants.appOwnership;
  if (info.isExpoGo && Platform.OS === 'android') {
    issues.push('Running in Expo Go on Android - push notifications not supported in SDK 53+. Use Development Build or Production Build.');
  }

  // 4. Check EAS project ID
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                   Constants.easConfig?.projectId;
  info.hasProjectId = !!projectId;
  info.projectId = projectId || 'NOT CONFIGURED';
  
  if (!projectId) {
    issues.push('EAS project ID not found in app.json. Add it under expo.extra.eas.projectId');
  }

  // 5. Check notification permissions
  try {
    const { status } = await Notifications.getPermissionsAsync();
    info.permissionStatus = status;
    console.log('Permission status:', status);
    
    if (status === 'denied') {
      warnings.push('Notification permissions denied - user must enable in device settings');
    } else if (status === 'undetermined') {
      warnings.push('Notification permissions not requested yet');
    }
  } catch (error: any) {
    issues.push(`Error checking permissions: ${error.message}`);
  }

  // 6. Check if notifications are supported
  info.isSupported = isPushNotificationSupported();
  if (!info.isSupported) {
    issues.push('Push notifications not supported in current environment');
  }

  // 7. Try to get push token (if supported)
  if (info.isSupported && projectId) {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      info.pushToken = tokenData.data;
      info.hasPushToken = true;
      console.log('Push token obtained:', tokenData.data);
    } catch (error: any) {
      issues.push(`Failed to get push token: ${error.message}`);
      info.hasPushToken = false;
      info.pushTokenError = error.message;
    }
  }

  // 8. Check Android-specific configuration
  if (Platform.OS === 'android') {
    info.androidApiLevel = Device.platformApiLevel;
    console.log('Android API Level:', Device.platformApiLevel);
    
    if (Device.platformApiLevel && Device.platformApiLevel >= 33) {
      info.requiresPostNotificationsPermission = true;
      warnings.push('Android 13+ requires POST_NOTIFICATIONS permission (already added to app.json)');
    }
  }

  // 9. Check iOS-specific configuration
  if (Platform.OS === 'ios') {
    info.iosVersion = Device.osVersion;
    console.log('iOS Version:', Device.osVersion);
  }

  // 10. Summary
  console.log('\n=== DIAGNOSTICS SUMMARY ===');
  console.log('Supported:', info.isSupported);
  console.log('Issues:', issues.length);
  console.log('Warnings:', warnings.length);
  
  if (issues.length > 0) {
    console.log('\n🔴 ISSUES:');
    issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    warnings.forEach((warning, i) => console.log(`${i + 1}. ${warning}`));
  }
  
  console.log('\n📊 INFO:', JSON.stringify(info, null, 2));
  console.log('=== END DIAGNOSTICS ===\n');

  return {
    supported: info.isSupported && issues.length === 0,
    issues,
    warnings,
    info,
  };
};

/**
 * Quick check if push notifications are ready to use
 */
export const isPushNotificationReady = async (): Promise<boolean> => {
  const diagnostics = await runNotificationDiagnostics();
  return diagnostics.supported && diagnostics.issues.length === 0;
};
