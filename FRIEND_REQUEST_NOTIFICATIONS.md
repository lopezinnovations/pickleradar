
# Friend Request Notifications Implementation

This document describes the implementation of email and push notifications for friend requests in PickleRadar.

## Overview

When a user sends a friend request, the recipient will receive:
1. **Email notification** (if SMTP is configured and recipient has an email)
2. **Push notification** (if recipient has granted notification permissions)

## Architecture

### 1. Database Trigger
- A PostgreSQL trigger (`on_friend_request_created`) fires when a new friend request is inserted into the `friends` table
- The trigger calls a Supabase Edge Function asynchronously using the `pg_net` extension
- Only triggers for `pending` friend requests

### 2. Supabase Edge Function
- **Function name**: `notify-friend-request`
- **Location**: Deployed as a Supabase Edge Function
- **Purpose**: Sends email and push notifications to the friend request recipient

#### Email Notifications
- Uses Resend API for sending emails (requires `RESEND_API_KEY` environment variable)
- Sends a beautifully formatted HTML email with:
  - Requester's identifier (email or phone)
  - Call-to-action button to open the app
  - PickleRadar branding

#### Push Notifications
- Uses Expo Push Notification service
- Sends notifications to devices with registered push tokens
- Includes notification data for deep linking

### 3. Client-Side Integration

#### Push Token Registration
- When a user signs in, their push token is automatically registered
- Push tokens are stored in the `users.push_token` column
- Registration happens in `hooks/useAuth.ts` after successful authentication

#### Notification Permissions
- Users are prompted for notification permissions when they first use the app
- Permissions are requested in `utils/notifications.ts`
- Android devices get a dedicated notification channel for better control

## Database Schema Changes

### New Column
```sql
ALTER TABLE users ADD COLUMN push_token TEXT;
```

### New Extension
```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

### New Trigger Function
```sql
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER AS $$
-- Calls the Edge Function when a new friend request is created
$$;
```

## Configuration Requirements

### Environment Variables (Supabase Edge Function)
To enable email notifications, set the following secret in Supabase:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

**Note**: The following environment variables are automatically available:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_OR_ANON_KEY`

### Resend API Setup
1. Sign up for a free account at [resend.com](https://resend.com)
2. Create an API key
3. Add the API key to Supabase secrets (see above)
4. Verify your sending domain (or use the Resend sandbox for testing)

## Testing

### Test Email Notifications
1. Ensure SMTP is configured in Supabase Dashboard
2. Set the `RESEND_API_KEY` environment variable
3. Send a friend request from one user to another
4. Check the recipient's email inbox

### Test Push Notifications
1. Ensure the app has notification permissions
2. User must be signed in (push token is registered automatically)
3. Send a friend request from one user to another
4. Check the recipient's device for the push notification

### Debugging
- Check Supabase Edge Function logs for the `notify-friend-request` function
- Check the `pg_net` request logs in the database
- Use `console.log` statements in the Edge Function for debugging

## Files Modified

### New Files
- None (Edge Function is deployed via Supabase CLI)

### Modified Files
1. **utils/notifications.ts**
   - Added `registerPushToken()` function
   - Added `sendFriendRequestNotification()` function

2. **hooks/useAuth.ts**
   - Integrated push token registration on user sign-in
   - Calls `registerPushToken()` after fetching user profile

3. **Database Migrations**
   - Added `push_token` column to `users` table
   - Enabled `pg_net` extension
   - Created `notify_friend_request()` trigger function
   - Created `on_friend_request_created` trigger

## User Experience

### Sender
1. User enters friend's email or phone number
2. Clicks "Send Request"
3. Sees success message
4. No additional action required

### Recipient
1. Receives email notification (if configured)
   - Email includes requester's identifier
   - Contains link to open the app
2. Receives push notification (if permissions granted)
   - Shows on device lock screen and notification center
   - Tapping opens the app
3. Opens app and sees pending request in Friends tab
4. Can accept or decline the request

## Future Enhancements

1. **In-App Notifications**
   - Add a notification bell icon in the app
   - Show unread notification count
   - Display notification history

2. **Notification Preferences**
   - Allow users to customize notification settings
   - Enable/disable email notifications
   - Enable/disable push notifications
   - Set quiet hours

3. **Rich Notifications**
   - Add profile pictures to notifications
   - Include quick action buttons (Accept/Decline)
   - Show friend's skill level and recent activity

4. **Email Templates**
   - Create multiple email templates
   - Support for different languages
   - Personalized content based on user preferences

## Troubleshooting

### Emails Not Sending
- Verify SMTP is configured in Supabase Dashboard (Settings > Auth > SMTP Settings)
- Check that `RESEND_API_KEY` is set in Supabase secrets
- Verify the sending domain is verified in Resend
- Check Edge Function logs for errors

### Push Notifications Not Working
- Ensure user has granted notification permissions
- Verify push token is saved in the database (`users.push_token`)
- Check that the Expo push token is valid
- Test with Expo's push notification tool: https://expo.dev/notifications

### Trigger Not Firing
- Check that `pg_net` extension is enabled
- Verify the trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_friend_request_created';`
- Check database logs for trigger errors
- Ensure the Edge Function URL is correct in the trigger function

## Security Considerations

1. **Email Privacy**
   - Emails are only sent to users who have provided an email address
   - Email content does not expose sensitive user data

2. **Push Token Security**
   - Push tokens are stored securely in the database
   - Only the user's own push token can be updated (enforced by RLS)

3. **Edge Function Security**
   - Function uses service role key for database access
   - Validates incoming webhook payloads
   - Logs errors without exposing sensitive data

4. **Rate Limiting**
   - Consider implementing rate limiting for friend requests
   - Prevent spam by limiting requests per user per day
