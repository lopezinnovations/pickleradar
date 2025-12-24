
# Authentication Troubleshooting Guide

This guide helps resolve common authentication issues in PickleRadar.

## Common Issues

### 1. "Error sending confirmation email"

**Symptoms:**
- Users can't sign up
- Error message: "Error sending confirmation email"
- Logs show: "535 5.7.8 Error: authentication failed"

**Cause:**
Email verification is enabled in Supabase but SMTP is not configured.

**Solutions:**

#### Quick Fix (Development):
1. Go to Supabase Dashboard → Authentication → Providers → Email
2. Disable "Confirm email"
3. Save changes

#### Proper Fix (Production):
1. Go to Supabase Dashboard → Project Settings → Auth → SMTP Settings
2. Configure your SMTP provider (Gmail, SendGrid, AWS SES, etc.)
3. Test the configuration
4. Save changes

See [EMAIL_CONFIGURATION_GUIDE.md](./EMAIL_CONFIGURATION_GUIDE.md) for detailed instructions.

---

### 2. "Email not confirmed"

**Symptoms:**
- User can sign up but can't sign in
- Error: "Please verify your email address before signing in"

**Cause:**
Email verification is enabled but user hasn't clicked the verification link.

**Solutions:**
- Check spam/junk folder for verification email
- If no email received, SMTP may not be configured (see issue #1)
- Admin can manually verify users in Supabase Dashboard

---

### 3. "Invalid login credentials"

**Symptoms:**
- User can't sign in
- Error: "Invalid email or password"

**Possible Causes:**
- Wrong password
- Email not verified (if email confirmation is enabled)
- User doesn't exist

**Solutions:**
- Double-check email and password
- Ensure email is verified
- Try password reset
- Check if user exists in Supabase Dashboard

---

### 4. Session not persisting

**Symptoms:**
- User signs in successfully but is logged out on app restart
- Session doesn't persist between app launches

**Cause:**
AsyncStorage not properly configured or session storage failing.

**Solutions:**
- Check that AsyncStorage is properly installed
- Clear app data and try again
- Check console logs for storage errors

---

### 5. "Supabase Required" warning

**Symptoms:**
- Warning message about Supabase not being configured
- Authentication buttons disabled

**Cause:**
Supabase environment variables not set.

**Solutions:**
1. Create `.env` file in project root
2. Add:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Restart the development server

---

## Checking Logs

### Supabase Logs:
1. Go to Supabase Dashboard
2. Navigate to Logs → Auth
3. Look for error messages
4. Common errors:
   - SMTP authentication failures
   - Invalid credentials
   - Rate limiting

### App Logs:
Check the console for messages starting with:
- `useAuth:`
- `AuthScreen:`

These provide detailed information about authentication flow.

---

## Email Verification Flow

### Normal Flow:
1. User signs up with email and password
2. Supabase sends verification email
3. User clicks link in email
4. Email is verified
5. User can now sign in

### If SMTP Not Configured:
1. User signs up
2. Email sending fails
3. User account is created but not verified
4. User cannot sign in until email is verified
5. Admin must manually verify or disable email confirmation

---

## Manual User Verification

If you need to manually verify a user:

1. Go to Supabase Dashboard
2. Navigate to Authentication → Users
3. Find the user
4. Click on the user
5. Look for "Email Confirmed" field
6. Manually set it to confirmed

---

## Testing Authentication

### Test Sign Up:
```javascript
// In your app
1. Enter email: test@example.com
2. Enter password: test123456
3. Accept terms
4. Click Sign Up
5. Check for success message
6. Check email for verification link
```

### Test Sign In:
```javascript
// In your app
1. Enter verified email
2. Enter correct password
3. Click Sign In
4. Should redirect to home screen
```

---

## Environment Setup

Required environment variables:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these from:
1. Supabase Dashboard
2. Project Settings → API
3. Copy URL and anon/public key

---

## Database Setup

Ensure the `users` table exists with proper columns:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  phone TEXT,
  skill_level TEXT,
  privacy_opt_in BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT FALSE,
  location_enabled BOOLEAN DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  zip_code TEXT,
  dupr_rating DOUBLE PRECISION,
  location_permission_requested BOOLEAN DEFAULT FALSE,
  profile_picture_url TEXT,
  terms_accepted BOOLEAN DEFAULT FALSE,
  privacy_accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

## Common Error Messages

### "Error sending confirmation email"
→ See [EMAIL_CONFIGURATION_GUIDE.md](./EMAIL_CONFIGURATION_GUIDE.md)

### "Email not confirmed"
→ User needs to verify email or admin needs to disable email confirmation

### "Invalid login credentials"
→ Wrong email/password or email not verified

### "User already registered"
→ Email already exists, user should sign in instead

### "Failed to create account"
→ Check Supabase logs for specific error

---

## Getting Help

1. Check this troubleshooting guide
2. Check [EMAIL_CONFIGURATION_GUIDE.md](./EMAIL_CONFIGURATION_GUIDE.md)
3. Review Supabase logs
4. Check app console logs
5. Review Supabase documentation
6. Contact support with:
   - Error message
   - Steps to reproduce
   - Console logs
   - Supabase logs

---

## Best Practices

### Development:
- Disable email confirmation for faster testing
- Use test email addresses
- Clear app data between tests

### Production:
- Enable email confirmation
- Configure proper SMTP
- Use custom domain for emails
- Monitor email delivery rates
- Set up proper error tracking

---

## Security Notes

- Never commit `.env` file to version control
- Keep Supabase keys secure
- Use Row Level Security (RLS) policies
- Validate user input
- Use HTTPS for all API calls
- Implement rate limiting
- Monitor for suspicious activity
