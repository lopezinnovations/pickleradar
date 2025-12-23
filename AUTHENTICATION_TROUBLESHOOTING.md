
# Authentication Troubleshooting Guide

## Issue: Sign In Not Working

### Problem
Users are unable to sign in after creating an account. The error message shows "Invalid login credentials" even though the email and password are correct.

### Root Cause
**Email verification is enabled in Supabase**, but the app was designed to work with email verification disabled. When email verification is enabled:

1. Users can create accounts successfully
2. However, they cannot sign in until they verify their email
3. The verification email may fail to send due to SMTP configuration issues
4. Users get stuck unable to access their accounts

### Solution Options

#### Option 1: Disable Email Verification (Recommended for Development)

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Uncheck **"Confirm email"**
4. Save changes

This allows users to sign in immediately after creating an account without email verification.

#### Option 2: Fix Existing Unverified Users (Quick Fix)

If you already have users who can't sign in because their email isn't verified, run this SQL query in the Supabase SQL Editor:

```sql
-- Confirm all unverified users
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

Or for a specific user:

```sql
-- Confirm a specific user by email
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'user@example.com' 
  AND email_confirmed_at IS NULL;
```

#### Option 3: Configure SMTP for Email Verification (Production)

If you want to keep email verification enabled:

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider (SendGrid, Mailgun, AWS SES, etc.)
3. Test the email sending functionality
4. Ensure the email templates are configured correctly

### Current App Behavior

The app now handles both scenarios:

**Email Verification Disabled:**
- Users are automatically logged in after signup
- Redirected to the home screen immediately
- Success message: "Account created successfully. Welcome to PickleRadar."

**Email Verification Enabled:**
- Users receive a message to check their email
- Cannot sign in until email is verified
- Clear error messages guide users through the process

### Testing Authentication

To test if authentication is working:

1. **Create a new account** with a test email
2. **Check the Supabase logs** for any errors:
   - Go to **Logs** → **Auth Logs**
   - Look for "Invalid login credentials" or "Email not confirmed" errors
3. **Verify the user in the database**:
   ```sql
   SELECT email, email_confirmed_at, confirmed_at 
   FROM auth.users 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
4. **Try signing in** with the test account

### Common Error Messages

- **"Invalid login credentials"**: Usually means email is not verified (if verification is enabled)
- **"Email not confirmed"**: Email verification is enabled and user hasn't clicked the verification link
- **"User already registered"**: Account exists, try signing in instead
- **"Error sending confirmation email"**: SMTP is not configured properly

### Logs to Check

When debugging authentication issues, check:

1. **Supabase Auth Logs**: Shows all authentication attempts and errors
2. **App Console Logs**: Look for messages starting with "useAuth:"
3. **Network Tab**: Check the actual API responses from Supabase

### Prevention

To avoid this issue in the future:

1. **Decide early** whether you want email verification enabled or disabled
2. **Configure SMTP** if you enable email verification
3. **Test the full signup/signin flow** before deploying
4. **Monitor auth logs** for any errors

### Current Status

✅ **Fixed**: The user `cdlopez8@gmail.com` has been manually verified and can now sign in.

✅ **Updated**: The app now provides clear error messages for email verification issues.

⚠️ **Recommendation**: Disable email verification in Supabase for development, or configure SMTP for production.
