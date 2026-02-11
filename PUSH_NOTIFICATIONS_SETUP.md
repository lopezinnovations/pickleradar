
# Push Notifications Setup & Testing Guide for PickleRadar

## ✅ Current Implementation Status

Your push notification system is **fully implemented** with the following features:

### Features Implemented:
- ✅ Check-in notifications (immediate + scheduled auto-checkout)
- ✅ Friend check-in notifications (when friends check in at courts)
- ✅ Friend check-out notifications (when friends check out)
- ✅ Friend request notifications
- ✅ Message notifications (via Supabase Edge Functions)
- ✅ Test push notification button (for admins/dev builds)
- ✅ Permission handling for iOS and Android
- ✅ Push token registration and storage
- ✅ Android notification channels configured
- ✅ iOS background modes configured

## 🔧 Required Configuration

### 1. **EAS Project ID (CRITICAL)**

You need to add your EAS project ID to `app.json`:

```json
"extra": {
  "eas": {
    "projectId": "YOUR_ACTUAL_EAS_PROJECT_ID"
  }
}
```

**How to get your EAS Project ID:**
```bash
# If you haven't created an EAS project yet:
eas build:configure

# To view your project ID:
eas project:info
```

The project ID looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### 2. **Android Configuration**

For Android push notifications, you need:

#### A. Google Services JSON (FCM)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project or select existing project
3. Add an Android app with package name: `com.lopezinnovations.pickleradar`
4. Download `google-services.json`
5. Place it in your project root directory

#### B. Permissions (Already Added ✅)
- `POST_NOTIFICATIONS` - Added to app.json
- `useNextNotificationsApi: true` - Added to app.json

### 3. **iOS Configuration**

For iOS push notifications, you need:

#### A. Apple Push Notification Service (APNs)
1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to Certificates, Identifiers & Profiles
3. Select your app identifier: `com.anonymous.PickleRadar`
4. Enable "Push Notifications" capability
5. Generate APNs certificates (or use automatic signing)

#### B. Entitlements (Already Added ✅)
- `aps-environment: production` - Added to app.json
- `UIBackgroundModes: ["remote-notification"]` - Added to app.json

## 📱 Testing Push Notifications

### ⚠️ Important: Expo Go Limitations

**Push notifications DO NOT work in Expo Go on Android (SDK 53+)**

You MUST use one of these for testing:
- **iOS**: TestFlight or Development Build
- **Android**: Development Build or Production Build

### Testing Steps:

#### 1. **Build for Testing**

**For iOS (TestFlight):**
```bash
eas build --platform ios --profile preview
eas submit --platform ios
```

**For Android (Development Build):**
```bash
eas build --platform android --profile development
```

**For Android (Production):**
```bash
eas build --platform android --profile production
```

#### 2. **Install the Build**
- iOS: Install via TestFlight
- Android: Download and install the APK/AAB

#### 3. **Test Push Notifications**

**A. Enable Notifications:**
1. Open the app
2. Go to Profile tab
3. Tap "Enable Notifications" button
4. Grant permission when prompted
5. Verify "Push Token Status" shows "Registered ✓"

**B. Send Test Push (Dev/TestFlight builds only):**
1. In Profile screen, scroll down to "Push Token Status"
2. Tap "Send Test Push" button
3. You should receive a notification within seconds

**C. Test Real Scenarios:**

**Check-In Notifications:**
1. Go to a court detail screen
2. Tap "I'm Here" and select duration
3. You should receive:
   - Immediate: "Checked In! 🎾"
   - 2 seconds later: "Check-Out Scheduled 📅"
   - At expiry time: "Auto Check-Out ⏰"

**Friend Notifications:**
1. Add a friend in the app
2. Have your friend check in at a court
3. You should receive: "Friend Checked In! 👋"
4. When they check out: "Friend Checked Out 👋"

**Message Notifications:**
1. Have a friend send you a message
2. You should receive a notification with the message preview

**Friend Request Notifications:**
1. Have someone send you a friend request
2. You should receive: "New Friend Request! 👋"

## 🐛 Troubleshooting

### Issue: "No Push Token" or "Not registered"

**Cause:** Running in Expo Go on Android, or EAS project ID missing

**Solution:**
1. Verify `extra.eas.projectId` is set in `app.json`
2. Use a Development Build or TestFlight, NOT Expo Go
3. Rebuild the app after adding project ID

### Issue: Notifications not appearing

**Check:**
1. Device notification settings - ensure app notifications are enabled
2. Do Not Disturb mode is off
3. App has notification permission granted
4. Push token is registered (check Profile screen)
5. Internet connection is active

### Issue: iOS notifications not working

**Check:**
1. APNs certificates are configured in Apple Developer Portal
2. `aps-environment` entitlement is set to "production"
3. App is signed with correct provisioning profile
4. Testing on physical device (not simulator)

### Issue: Android notifications not working

**Check:**
1. `google-services.json` file is present in project root
2. FCM is enabled in Firebase Console
3. `POST_NOTIFICATIONS` permission is granted (Android 13+)
4. Using Development Build or Production Build (not Expo Go)

## 📊 Notification Flow Architecture

```
User Action (Check-in/Message/Friend Request)
    ↓
Frontend: Trigger notification function
    ↓
Backend: Supabase Edge Function
    ↓
Fetch recipient's push_token from users table
    ↓
Send to Expo Push Notification Service
    ↓
Expo routes to APNs (iOS) or FCM (Android)
    ↓
Device receives notification
```

## 🔐 Security Notes

- Push tokens are stored securely in the `users` table
- Only authenticated users can register push tokens
- Friend notifications respect privacy settings
- Notification content is sanitized before sending

## 📝 Next Steps for Launch

1. **Add EAS Project ID** to `app.json` (see step 1 above)
2. **Add `google-services.json`** for Android FCM
3. **Configure APNs** in Apple Developer Portal for iOS
4. **Build and test** on physical devices using TestFlight/Development Builds
5. **Verify all notification types** work as expected
6. **Test on both iOS and Android** before production launch

## 🎯 Verification Checklist

Before launch, verify:
- [ ] EAS project ID is configured in app.json
- [ ] google-services.json is added for Android
- [ ] APNs certificates are configured for iOS
- [ ] Test push button works in dev builds
- [ ] Check-in notifications appear correctly
- [ ] Friend notifications work between users
- [ ] Message notifications appear with correct content
- [ ] Friend request notifications work
- [ ] Notifications work on both iOS and Android physical devices
- [ ] Notification permissions are requested appropriately
- [ ] Push tokens are being registered and stored

## 📞 Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all configuration steps above
3. Test on physical devices (not simulators/Expo Go)
4. Ensure internet connectivity
5. Check device notification settings

---

**Status:** Implementation complete, awaiting EAS project ID and FCM configuration for full functionality.
