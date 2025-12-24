
# Sign-In Issue - Root Cause and Fix

## Problem Summary

Users were unable to sign in to the PickleRadar app. The Supabase auth logs showed multiple "Invalid login credentials" errors.

## Root Cause Analysis

### 1. **Authentication Method Mismatch**

The Supabase logs revealed:
```
"error_code": "invalid_credentials"
"grant_type": "password"
```

This indicates the system was receiving **password-based authentication attempts**, but the app is configured for **phone OTP authentication only**.

### 2. **Mixed User Base**

Database query revealed multiple authentication methods in use:
- **Phone users:** `15202600996` (can sign in)
- **Email users:** `cdlopez8@gmail.com`, `acaciamartinez33@gmail.com`, `firehead6770@gmail.com` (cannot sign in)

### 3. **Potential SMS Configuration Issue**

The app uses Supabase phone authentication, which requires an SMS provider (Twilio, MessageBird, or Vonage) to be configured. If not set up, OTP codes cannot be sent.

## Changes Made

### 1. **Enhanced Error Handling** (`hooks/useAuth.ts`)

- Added explicit `channel: 'sms'` parameter to `signInWithOtp` call
- Added detailed error logging with JSON stringification
- Added specific error messages for SMS configuration issues
- Added validation to ensure only phone-based sessions are accepted
- Clear invalid sessions (non-phone) on initialization

Key changes:
```typescript
// Explicitly specify SMS channel
const { data, error } = await supabase.auth.signInWithOtp({
  phone,
  options: {
    channel: 'sms',
  },
});

// Detect SMS configuration errors
if (error.message.toLowerCase().includes('sms') || 
    error.message.toLowerCase().includes('provider')) {
  return {
    success: false,
    message: 'SMS service is not configured. Please contact support...',
  };
}
```

### 2. **Session Cleanup** (`app/auth.tsx`)

- Added `useEffect` hook to clear old non-phone sessions on mount
- Added `autoFocus` to OTP input for better UX
- Enhanced logging throughout the authentication flow

```typescript
useEffect(() => {
  const clearOldSessions = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && !session.user.phone) {
      console.log('AuthScreen: Clearing old non-phone session');
      await supabase.auth.signOut();
    }
  };
  clearOldSessions();
}, []);
```

### 3. **Documentation**

Created comprehensive troubleshooting guides:
- `AUTHENTICATION_TROUBLESHOOTING.md` - Detailed guide for common issues
- `SIGN_IN_FIX_SUMMARY.md` - This document
- `app/auth-migration-notice.tsx` - User-facing migration notice screen

## Testing Checklist

### For Developers

- [ ] Verify SMS provider is configured in Supabase Dashboard
  - Go to Authentication → Providers → Phone
  - Ensure Twilio/MessageBird/Vonage credentials are added
  - Verify SMS provider account has credits

- [ ] Test with real phone number
  - Enter phone number in format: (555) 123-4567
  - Verify SMS is received
  - Enter 6-digit code
  - Confirm successful sign-in

- [ ] Test error scenarios
  - Try with invalid phone number
  - Try with expired OTP code
  - Try with incorrect OTP code
  - Verify error messages are clear

- [ ] Check Supabase logs
  - Go to Logs → Auth Logs
  - Look for `user_confirmation_requested` (OTP sent)
  - Look for successful token verification
  - No more `invalid_credentials` with `grant_type: password`

### For Users

- [ ] Can enter phone number with automatic formatting
- [ ] Receive SMS with 6-digit code
- [ ] Can enter verification code
- [ ] Successfully sign in and reach home screen
- [ ] Can sign out and sign back in
- [ ] Session persists across app restarts

## Next Steps

### Immediate Actions

1. **Configure SMS Provider** (if not already done)
   - Sign up for Twilio (recommended)
   - Add credentials to Supabase
   - Test with real phone number

2. **Test Authentication Flow**
   - Clear app data/cache
   - Test fresh sign-up
   - Test sign-in with existing phone user
   - Verify session persistence

3. **Monitor Logs**
   - Watch Supabase auth logs for errors
   - Check app console logs for issues
   - Verify OTP codes are being sent

### Future Improvements

1. **Email User Migration**
   - Decide on migration strategy for existing email users
   - Option A: Let them create new accounts
   - Option B: Implement account linking flow

2. **Better Error Messages**
   - Add in-app SMS configuration check
   - Show specific error for unconfigured SMS provider
   - Add link to setup instructions

3. **Testing Infrastructure**
   - Set up test phone numbers in Supabase
   - Add automated tests for auth flow
   - Create staging environment for testing

## Common Issues and Solutions

### Issue: "Failed to send verification code"

**Solution:** Check SMS provider configuration in Supabase Dashboard

### Issue: "Invalid or expired verification code"

**Solution:** Request new code, ensure entering correct 6-digit code

### Issue: Old email users can't sign in

**Solution:** They need to create new account with phone number

### Issue: SMS not received

**Possible causes:**
- SMS provider not configured
- SMS provider out of credits
- Invalid phone number format
- Rate limiting

**Solution:** Verify SMS provider setup and account balance

## Monitoring

### Key Metrics to Watch

1. **Authentication Success Rate**
   - Track successful OTP verifications
   - Monitor failed attempts

2. **SMS Delivery Rate**
   - Verify OTP codes are being sent
   - Check SMS provider delivery reports

3. **Error Rates**
   - Monitor specific error types
   - Track rate limiting issues

### Supabase Dashboard Checks

- Authentication → Users (verify new phone users)
- Authentication → Logs (check for errors)
- Authentication → Providers → Phone (verify configuration)

## Support Resources

- Supabase Phone Auth Docs: https://supabase.com/docs/guides/auth/phone-login
- Twilio Setup: https://www.twilio.com/docs/sms
- MessageBird Setup: https://developers.messagebird.com/
- Vonage Setup: https://developer.vonage.com/messaging/sms/overview

## Conclusion

The sign-in issue was caused by:
1. Mixed authentication methods (email vs phone)
2. Possible SMS provider configuration issues
3. Old sessions interfering with new auth flow

The fix includes:
1. Enhanced error handling and logging
2. Session cleanup for invalid auth methods
3. Better user messaging
4. Comprehensive documentation

**Next critical step:** Verify SMS provider is configured in Supabase Dashboard.
