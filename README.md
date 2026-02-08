# PickleRadar

A React Native + Expo app for tracking pickleball court activity and connecting with friends.

This app was built using [Natively.dev](https://natively.dev) - a platform for creating mobile apps.

Made with 💙 for creativity.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run on iOS
npm run ios

# Run on Android
npm run android
```

**Note:** Push notifications will NOT work in Expo Go on Android (SDK 53+). See Push Notifications Setup below.

---

## 🔔 Push Notifications Setup

### ⚠️ CRITICAL: Push Notifications Do NOT Work in Expo Go (SDK 53+)

**Expo Go removed Android remote push notifications in SDK 53.** You MUST use one of the following to test push notifications:

- **iOS**: TestFlight or Development Build
- **Android**: Development Build (Expo Go does NOT support push notifications)

### Prerequisites

1. **EAS Account**: Sign up at [expo.dev](https://expo.dev)
2. **EAS CLI**: Install with `npm install -g eas-cli`
3. **EAS Project ID**: Run `eas init` to create a project and get your project ID

### Configuration Steps

#### 1. Add EAS Project ID

The app needs your EAS project ID to register for push notifications. This is configured in `eas.json` (managed by EAS CLI).

Run:
```bash
eas init
```

This will create an `eas.json` file with your project ID.

#### 2. iOS Configuration (APNs)

For iOS push notifications, you need:

- **Apple Developer Account** (required for TestFlight and production)
- **Push Notification Capability** enabled in your app identifier

EAS handles APNs certificate generation automatically when you build:

```bash
eas build --platform ios --profile development
```

#### 3. Android Configuration (FCM)

For Android push notifications, you need:

- **Firebase Project** with Cloud Messaging enabled
- **google-services.json** file

**Steps:**

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add an Android app with package name: `com.anonymous.PickleRadar`
3. Download `google-services.json`
4. Place it in the project root directory
5. Add to `app.json`:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### Building for Testing

#### Development Build (Recommended for Testing)

**iOS:**
```bash
eas build --platform ios --profile development
```

Install on device via:
- QR code scan
- Direct download link
- TestFlight (for wider testing)

**Android:**
```bash
eas build --platform android --profile development
```

Install the APK on your device.

#### Production Build

**iOS (TestFlight):**
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

**Android (Google Play):**
```bash
eas build --platform android --profile production
eas submit --platform android
```

### Testing Push Notifications

1. **Build and install** a development or production build (NOT Expo Go)
2. **Sign in** to the app
3. **Grant notification permissions** when prompted
4. **Check Profile screen** - you should see "Push Token Status: Registered ✓"
5. **Tap "Send Test Push"** button to send yourself a test notification

### Troubleshooting

#### "Push Token Status: Not registered"

**Cause:** Running in Expo Go on Android (SDK 53+) or no permissions granted.

**Solution:**
- Use a Development Build or TestFlight
- Ensure notification permissions are granted
- Check console logs for `[Push]` messages

#### "Push notifications not supported in this environment"

**Cause:** Running in Expo Go on Android.

**Solution:** Build a development build with `eas build --platform android --profile development`

#### Push token registered but notifications not received

**Possible causes:**
1. **iOS**: APNs certificate not configured (EAS handles this automatically)
2. **Android**: `google-services.json` missing or incorrect
3. **Device**: Notification permissions denied or battery optimization blocking
4. **Network**: Device not connected to internet

**Debug steps:**
1. Check console logs for `[Push]` messages
2. Verify push token is saved in Supabase `users.push_token` column
3. Test with "Send Test Push" button in Profile screen
4. Check device notification settings

### Code Structure

- **`utils/notifications.ts`**: Core push notification logic
  - `isPushNotificationSupported()`: Checks if push is available
  - `registerPushToken()`: Registers device for push notifications
  - `sendTestPushNotification()`: Sends test push (admin/testing)

- **`app/_layout.tsx`**: Initializes notification listeners
- **`hooks/useAuth.ts`**: Registers push token on user login
- **`app/(tabs)/profile.tsx`**: Shows push token status and test button

### Environment Detection

The app automatically detects the environment:

```typescript
// Expo Go (push NOT supported on Android SDK 53+)
Constants.appOwnership === 'expo'

// Development Build or Production (push supported)
Constants.appOwnership === 'standalone'
```

### Push Notification Flow

1. User signs in → `useAuth` hook calls `registerPushToken()`
2. `registerPushToken()` checks if push is supported
3. If supported, requests permissions and gets Expo push token
4. Token is saved to Supabase `users.push_token` column
5. Backend can now send push notifications to this token

### Sending Push Notifications from Backend

Use the Expo Push API:

```typescript
const message = {
  to: 'ExponentPushToken[...]',
  sound: 'default',
  title: 'Friend Checked In',
  body: 'John is now playing at Central Park Courts',
  data: { courtId: '123', type: 'friend_checkin' },
};

await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(message),
});
```

### Resources

- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Firebase Cloud Messaging Setup](https://firebase.google.com/docs/cloud-messaging)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)

---

## 📝 Implementation Summary

### What Was Fixed

1. **Environment Detection**: Added checks to prevent push notification initialization in Expo Go on Android (SDK 53+)
2. **Device Validation**: Added `expo-device` to verify physical device before attempting push registration
3. **Proper Error Handling**: All push notification functions now gracefully handle unsupported environments
4. **User Feedback**: Profile screen shows push token status and helpful messages
5. **Test Functionality**: Added "Send Test Push" button for users with registered tokens
6. **Configuration**: Updated `app.json` with proper iOS and Android push notification settings
7. **Documentation**: Comprehensive README with setup instructions and troubleshooting

### Files Modified

- `utils/notifications.ts` - Enhanced with environment detection and test push functionality
- `app/_layout.tsx` - Added notification listeners with environment checks
- `app/(tabs)/profile.tsx` - Added push token status display and test button
- `hooks/useAuth.ts` - Already had push token registration (no changes needed)
- `app.json` - Added iOS `UIBackgroundModes` and `expo-notifications` plugin
- `README.md` - Added comprehensive push notifications setup guide

### Key Features

✅ Automatic environment detection (Expo Go vs Development Build)
✅ Push token registration on user login
✅ Push token saved to Supabase `users.push_token` column
✅ Visual feedback in Profile screen showing token status
✅ "Send Test Push" button for testing notifications
✅ Comprehensive error messages guiding users to use dev builds
✅ iOS APNs configuration ready
✅ Android FCM configuration ready (requires `google-services.json`)
✅ Full documentation with troubleshooting guide

### Next Steps for Production

1. **Get EAS Project ID**: Run `eas init` to create project
2. **iOS Setup**: Build with `eas build --platform ios --profile development`
3. **Android Setup**: 
   - Create Firebase project
   - Download `google-services.json`
   - Build with `eas build --platform android --profile development`
4. **Test**: Install build on device and test push notifications
5. **Backend Integration**: Implement server-side push notification sending using Expo Push API

---
