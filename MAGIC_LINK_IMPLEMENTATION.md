
# Magic Link Deep Link Handler - Implementation Complete

## Overview

This implementation provides a robust magic link authentication flow for PickleRadar using Supabase. The flow works seamlessly for:

- Magic link login
- Forgot password magic link
- First-time signup via magic link

## Key Features

### 1. Deep Link Handling (`app/_layout.tsx`)

The root layout listens for incoming deep links with the scheme `natively://magic-link` and handles them appropriately:

- **Token Parsing**: Extracts `access_token`, `refresh_token`, `expires_in`, and `token_type` from URL fragments (after `#`) or query parameters
- **Session Restoration**: Calls `supabase.auth.setSession()` with parsed tokens to establish the user session
- **Error Handling**: Gracefully handles errors and redirects to appropriate screens with error messages
- **Works on Launch and While Running**: Handles deep links both when the app is opened from a link and when it's already running

### 2. Magic Link Screen (`app/magic-link.tsx`)

A dedicated screen that provides visual feedback during the authentication process:

- **Loading State**: Shows a spinner and "Signing you in..." message while verifying the session
- **Success State**: Displays a welcome banner with the user's name (first name or pickleballer nickname)
  - Shows: "You're signed in. Welcome back!"
  - Includes user's name if available
  - Auto-redirects to home screen after 2.5 seconds
- **Error State**: Shows error message and redirects to auth screen after 3 seconds
- **Profile Fetching**: Automatically fetches user profile data from the `users` table to display personalized welcome message

### 3. Authentication Hook (`hooks/useAuth.ts`)

Enhanced to properly handle magic link authentication:

- **Auth State Listener**: Listens for `SIGNED_IN` and `TOKEN_REFRESHED` events to handle magic link sessions
- **Profile Auto-Creation**: Automatically creates user profile if it doesn't exist
- **Session Persistence**: Uses AsyncStorage to persist sessions across app restarts
- **Magic Link Functions**:
  - `signInWithOtp(email)`: Sends magic link to user's email with `redirectTo: 'natively://magic-link'`
  - `resetPassword(email)`: Sends password reset magic link with same redirect URL

### 4. Deep Link Configuration (`app.json`)

Properly configured for both iOS and Android:

- **Scheme**: `natively`
- **Host**: `magic-link`
- **Android Intent Filters**: Configured to handle `natively://magic-link` URLs
- **iOS Associated Domains**: Ready for universal links if needed

## Flow Diagram

### Magic Link Login Flow

1. User enters email on "Forgot Password?" screen
2. App calls `signInWithOtp(email)` with `redirectTo: 'natively://magic-link'`
3. Supabase sends email with magic link containing tokens
4. User clicks link in email
5. OS opens app with URL: `natively://magic-link#access_token=...&refresh_token=...`
6. `app/_layout.tsx` intercepts the deep link
7. Tokens are extracted from URL fragment
8. `supabase.auth.setSession()` is called with tokens
9. Session is established and persisted
10. User is redirected to `/magic-link?success=true`
11. `app/magic-link.tsx` fetches user profile
12. Welcome banner is shown: "You're signed in. Welcome back!"
13. User is auto-redirected to home screen after 2.5 seconds

### First-Time Signup Flow

1. User signs up with email/password
2. User profile is created in `users` table
3. Later, user can use "Forgot Password?" to get a magic link
4. Same flow as above applies
5. Profile data (name, nickname, skills) is fetched and displayed

### Password Reset Flow

1. User enters email on "Forgot Password?" screen
2. App calls `resetPassword(email)` with `redirectTo: 'natively://magic-link'`
3. Supabase sends password reset email with magic link
4. Same deep link flow as above
5. After successful authentication, user can update password in profile settings

## Technical Details

### Token Extraction

The implementation checks both URL fragments and query parameters for maximum compatibility:

```typescript
// Extract from fragment (after #)
const fragmentPart = fullUrl.split('#')[1];
const fragmentParams = new URLSearchParams(fragmentPart);
const accessToken = fragmentParams.get('access_token');
const refreshToken = fragmentParams.get('refresh_token');

// Fallback to query params
if (!accessToken && url.queryParams) {
  accessToken = url.queryParams.access_token;
  refreshToken = url.queryParams.refresh_token;
}
```

### Session Restoration

```typescript
const { data, error } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken,
});
```

### Profile Fetching

```typescript
const { data: profile } = await supabase
  .from('users')
  .select('first_name, pickleballer_nickname')
  .eq('id', session.user.id)
  .single();
```

## User Experience

### What Users See

1. **During Authentication**: 
   - Spinner with "Signing you in..." message
   - "Please wait while we verify your magic link" subtitle

2. **On Success**:
   - App logo
   - Green checkmark icon
   - Banner: "You're signed in. Welcome back!"
   - Personalized message: "Welcome back, [Name]!"
   - "Redirecting you to the app..." message

3. **On Error**:
   - Red X icon
   - Error banner with specific error message
   - "Redirecting to sign in..." message

### No Web Pages

The entire flow happens within the native app - no web pages are shown at any point. This provides a seamless, native experience.

## Error Handling

The implementation handles various error scenarios:

- **No tokens in URL**: Falls back to checking existing session
- **Session establishment failed**: Shows error and redirects to auth
- **Profile fetch failed**: Continues without name (doesn't block authentication)
- **Invalid/expired link**: Shows appropriate error message

## Testing

To test the magic link flow:

1. **Magic Link Login**:
   - Go to auth screen
   - Click "Forgot Password?"
   - Enter email
   - Click "Send Magic Link"
   - Check email and click the link
   - App should open and show welcome banner

2. **First-Time Signup**:
   - Sign up with new account
   - Use "Forgot Password?" to get magic link
   - Click link in email
   - Should see personalized welcome with your name

3. **Password Reset**:
   - Use "Forgot Password?" flow
   - After successful authentication, go to profile settings
   - Update password

## Database Requirements

The implementation expects a `users` table with the following columns:

- `id` (uuid, primary key)
- `email` (text)
- `first_name` (text, nullable)
- `last_name` (text, nullable)
- `pickleballer_nickname` (text, nullable)
- `experience_level` (text, nullable)
- `dupr_rating` (numeric, nullable)
- Other profile fields...

## Security Considerations

- Tokens are only valid for a limited time (set by Supabase)
- Sessions are automatically refreshed by Supabase client
- No sensitive data is logged (only presence/absence of tokens)
- Deep links are validated before processing

## Future Enhancements

Possible improvements:

1. Add rate limiting for magic link requests
2. Implement email verification for new signups
3. Add biometric authentication after initial magic link login
4. Support for SMS-based magic links
5. Add analytics to track magic link usage

## Troubleshooting

### Magic link doesn't open app

- Check that the app is installed
- Verify deep link scheme is configured correctly in `app.json`
- On Android, check intent filters are properly set
- On iOS, check associated domains if using universal links

### Session not persisting

- Verify AsyncStorage is working properly
- Check that `persistSession: true` is set in Supabase client config
- Ensure `autoRefreshToken: true` is enabled

### Profile data not loading

- Verify `users` table exists and has correct schema
- Check RLS policies allow authenticated users to read their own data
- Ensure user profile was created during signup

## Conclusion

This implementation provides a complete, production-ready magic link authentication flow that works seamlessly across all scenarios (login, password reset, first-time signup) without showing any web pages. The user experience is smooth, native, and includes personalized welcome messages.
