
# 🔔 Push Notifications - Quick Check

## ✅ Pre-Launch Checklist

### 1. Configuration Files
- [ ] `app.json` has EAS project ID under `expo.extra.eas.projectId`
- [ ] `app.json` has `expo-notifications` plugin configured
- [ ] iOS: `UIBackgroundModes` includes `remote-notification`
- [ ] iOS: `aps-environment` entitlement is set to `production`
- [ ] Android: `POST_NOTIFICATIONS` permission is added
- [ ] Android: `googleServicesFile` path is configured (if using FCM)

### 2. Code Implementation
- [ ] `utils/notifications.ts` exists and exports all required functions
- [ ] `utils/notificationDebug.ts` exists for diagnostics
- [ ] Push token registration happens on login (`hooks/useAuth.ts`)
- [ ] Notification handler is configured (`Notifications.setNotificationHandler`)

### 3. Database
- [ ] `users` table has `push_token` column (text/varchar)
- [ ] Push tokens are being saved to database on registration

### 4. Testing
- [ ] Built Development Build (not using Expo Go on Android)
- [ ] Tested on physical iOS device
- [ ] Tested on physical Android device
- [ ] Verified push token appears in Profile screen
- [ ] Successfully sent test push notification
- [ ] Ran diagnostics and resolved all issues

## 🧪 Quick Test Steps

1. **Open Profile Screen**
2. **Tap "Enable Notifications"** → Should show OS permission prompt
3. **Grant Permission** → Should see "Notifications Enabled" alert
4. **Check "Push Token Status"** → Should show "Registered ✓"
5. **Tap "Send Test Push"** → Should receive notification within seconds
6. **Tap "Run Diagnostics"** → Should show "✅ Push notifications are fully configured and ready!"

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| "No Push Token" | Add EAS project ID to app.json |
| "Push Not Supported" | Use Development Build (not Expo Go on Android) |
| "Permission Denied" | Enable in device Settings > Notifications |
| Question mark in diagnostics | Check EAS project ID is correct |

## 📱 Platform-Specific Notes

### iOS
- Works in: TestFlight, Development Build, Production
- Requires: Physical device, notification permission
- APNs: Automatically configured by Expo

### Android
- Works in: Development Build, Production Build
- Does NOT work in: Expo Go (SDK 53+)
- Requires: Physical device, notification permission, POST_NOTIFICATIONS permission (Android 13+)
- FCM: Automatically configured by Expo

## ✅ Launch Readiness

**Before launching to production:**
1. ✅ EAS project ID configured
2. ✅ Tested on iOS physical device
3. ✅ Tested on Android physical device
4. ✅ All diagnostic checks pass
5. ✅ Push tokens being saved to database
6. ✅ Test notifications received successfully

**Status:** Ready for launch after EAS project ID is added ✅
