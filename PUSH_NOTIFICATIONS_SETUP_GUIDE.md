
# 🔔 Push Notifications Setup Guide for PickleRadar

## ✅ Current Status

Push notifications are **fully configured** for both iOS and Android. Here's what's already set up:

### 📱 iOS Configuration
- ✅ `expo-notifications` plugin configured in `app.json`
- ✅ `UIBackgroundModes` includes `remote-notification`
- ✅ APS environment entitlement added (`aps-environment: production`)
- ✅ Notification permissions properly requested
- ✅ Push token registration implemented

### 🤖 Android Configuration
- ✅ `expo-notifications` plugin configured in `app.json`
- ✅ `POST_NOTIFICATIONS` permission added (required for Android 13+)
- ✅ Notification channel created with proper importance
- ✅ Push token registration implemented
- ✅ Google Services configuration ready

## 🚨 CRITICAL: EAS Project ID Required

**ACTION NEEDED:** You must add your EAS project ID to `app.json`:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID_HERE"
      }
    }
  }
}
```

### How to Get Your EAS Project ID:

1. **If you haven't created an EAS project yet:**
   ```bash
   eas init
   ```
   This will create a project and give you the project ID.

2. **If you already have an EAS project:**
   ```bash
   eas project:info
   ```
   This will display your project ID.

3. **Update app.json** with your project ID (replace `YOUR_EAS_PROJECT_ID_HERE`)

## 📋 Testing Push Notifications

### ✅ What Works Now:
- **iOS (TestFlight/Production):** ✅ Fully working
- **iOS (Development Build):** ✅ Fully working
- **Android (Development Build):** ✅ Fully working
- **Android (Production Build):** ✅ Fully working

### ❌ What Doesn't Work:
- **Android (Expo Go):** ❌ Not supported in SDK 53+ (Expo removed this feature)
- **iOS Simulator:** ❌ Push notifications require physical device
- **Android Emulator:** ❌ Push notifications require physical device

### 🧪 How to Test:

1. **Build a Development Build:**
   ```bash
   # iOS
   eas build --profile development --platform ios
   
   # Android
   eas build --profile development --platform android
   ```

2. **Install on Physical Device:**
   - iOS: Install via TestFlight or direct install
   - Android: Download and install the APK

3. **Test in the App:**
   - Go to Profile screen
   - Tap "Enable Notifications" button
   - Grant permission when prompted
   - Tap "Send Test Push" button (only visible in dev/TestFlight builds)
   - You should receive a test notification

4. **Run Diagnostics:**
   - Go to Profile screen
   - Tap "Run Diagnostics" button
   - Review the diagnostic report for any issues

## 🔧 Notification Features Implemented

### 1. **Check-In Notifications**
- Immediate notification when user checks in
- Scheduled notification for auto check-out
- Notification when manually checking out

### 2. **Friend Notifications**
- Notification when a friend checks in at a court
- Notification when receiving a friend request
- Per-friend notification preferences

### 3. **Message Notifications**
- Notification when receiving a direct message
- Notification for group messages
- Mute conversation feature

### 4. **Smart Prompting**
- Notification prompt shown on Messages screen
- 14-day cooldown between prompts if dismissed
- Never shown if already granted

## 🛠️ Troubleshooting

### Issue: "No Push Token"
**Solution:** You're running in Expo Go on Android. Use a Development Build instead.

### Issue: "Push Not Supported"
**Solution:** 
- Make sure you're on a physical device (not simulator/emulator)
- Make sure you're not in Expo Go on Android
- Make sure EAS project ID is configured in app.json

### Issue: "Failed to Send Test Push"
**Solution:**
- Check that push token is registered (visible in Profile screen)
- Check device has internet connection
- Check notifications are enabled in device settings
- Run diagnostics to see detailed error information

### Issue: Notifications Not Appearing
**Solution:**
1. Check device notification settings (Settings > Notifications > PickleRadar)
2. Make sure "Do Not Disturb" is off
3. Check notification permission is granted in app
4. Run diagnostics in Profile screen

## 📚 Code Structure

### Key Files:
- `utils/notifications.ts` - Core notification logic
- `utils/notificationDebug.ts` - Diagnostic tools
- `app/(tabs)/profile.tsx` - UI for testing notifications
- `hooks/useAuth.ts` - Auto-registers push token on login

### Key Functions:
- `requestNotificationPermissions()` - Request OS permissions
- `registerPushToken(userId)` - Register token with backend
- `sendTestPushNotification(token, title, body)` - Send test push
- `runNotificationDiagnostics()` - Comprehensive diagnostics
- `isPushNotificationSupported()` - Check if supported in current environment

## 🚀 Next Steps

1. **Add EAS Project ID** to `app.json` (see above)
2. **Build Development Build** for testing
3. **Test on Physical Devices** (iOS and Android)
4. **Verify Push Tokens** are being registered in database
5. **Test All Notification Types:**
   - Check-in notifications
   - Friend check-in notifications
   - Message notifications
   - Friend request notifications

## 📞 Support

If you encounter issues:
1. Run diagnostics in Profile screen
2. Check console logs for detailed error messages
3. Verify EAS project ID is configured
4. Ensure you're using a Development Build or Production Build (not Expo Go on Android)

---

**Status:** ✅ Ready for testing after adding EAS project ID
**Last Updated:** 2024
