
# Authentication Troubleshooting Guide

## Current Authentication Method

**PickleRadar now uses PHONE NUMBER + SMS OTP authentication only.**

Email/password authentication has been disabled.

## Common Issues and Solutions

### Issue 1: "Invalid login credentials" Error

**Cause:** You're trying to log in with an old email/password account.

**Solution:** 
- The app now only supports phone number authentication
- You'll need to create a new account using your phone number
- Your old email-based account data is still in the database but cannot be accessed through the current app

### Issue 2: "SMS service is not configured" Error

**Cause:** Supabase SMS provider is not set up.

**Solution:**
1. Go to your Supabase Dashboard
2. Navigate to Authentication → Providers
3. Enable Phone authentication
4. Configure an SMS provider (Twilio, MessageBird, or Vonage):
   - **Twilio** (Recommended):
     - Sign up at https://www.twilio.com
     - Get your Account SID and Auth Token
     - Get a Twilio phone number
     - Add credentials to Supabase
   - **MessageBird**:
     - Sign up at https://www.messagebird.com
     - Get your API key
     - Add to Supabase
   - **Vonage**:
     - Sign up at https://www.vonage.com
     - Get your API key and secret
     - Add to Supabase

### Issue 3: "Failed to send verification code"

**Possible Causes:**
- SMS provider not configured
- SMS provider credentials invalid
- SMS provider account has no credits
- Rate limiting (too many requests)
- Invalid phone number format

**Solutions:**
- Verify SMS provider is configured correctly
- Check SMS provider account balance
- Wait a few minutes if rate limited
- Ensure phone number is in format: +1XXXXXXXXXX (US numbers)

### Issue 4: "Invalid or expired verification code"

**Possible Causes:**
- Code entered incorrectly
- Code has expired (usually 5-10 minutes)
- Code already used

**Solutions:**
- Double-check the code from your SMS
- Request a new code if expired
- Ensure you're entering the 6-digit code correctly

## Testing Phone Authentication

### Test Phone Numbers (Supabase Development)

You can configure test phone numbers in Supabase that don't require actual SMS:

1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Phone Auth"
3. Add test phone numbers with fixed OTP codes
4. Example: `+15555550100` with OTP `123456`

### Production Setup Checklist

- [ ] SMS provider configured in Supabase
- [ ] SMS provider account has credits
- [ ] Phone authentication enabled in Supabase
- [ ] Test with real phone number
- [ ] Verify OTP codes are being sent
- [ ] Check Supabase auth logs for errors

## Current Database State

The database contains:
- **Phone users:** Can sign in with current app
- **Email users:** Cannot sign in (authentication method changed)

## Migration Path for Email Users

If you need to migrate email users to phone authentication:

1. **Option A:** Have users create new accounts with phone numbers
2. **Option B:** Implement a migration flow:
   - Add temporary email login
   - Let users link phone number to existing account
   - Remove email login after migration

## Checking Supabase Logs

To debug authentication issues:

1. Go to Supabase Dashboard
2. Navigate to Logs → Auth Logs
3. Look for:
   - `user_confirmation_requested` - OTP sent successfully
   - `token` errors - OTP verification failed
   - `invalid_credentials` - Wrong authentication method
   - `rate_limit` - Too many requests

## Support

If you continue to have issues:

1. Check the browser/app console logs
2. Check Supabase auth logs
3. Verify SMS provider configuration
4. Ensure phone number format is correct (+1XXXXXXXXXX)
5. Try with a test phone number first
