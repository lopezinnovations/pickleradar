
# Email Configuration Guide for PickleRadar

## Issue: "Error sending confirmation email"

If you're seeing the error **"Error sending confirmation email"** when users try to sign up, this means that email verification is enabled in Supabase but SMTP (email service) is not properly configured.

## The Problem

The error in the logs shows:
```
535 5.7.8 Error: authentication failed
500: Error sending confirmation email
```

This is an **SMTP authentication error**. Supabase is trying to send verification emails but cannot authenticate with the email service.

## Solutions

You have two options to fix this:

### Option 1: Disable Email Confirmation (Quick Fix for Development)

This is the fastest solution for development/testing:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Find the setting **"Confirm email"**
4. **Disable** this setting
5. Save changes

**Pros:**
- Quick and easy
- Users can sign up and sign in immediately
- Good for development and testing

**Cons:**
- Less secure (no email verification)
- Not recommended for production
- Users can sign up with any email address (even fake ones)

### Option 2: Configure Custom SMTP (Recommended for Production)

This is the proper solution for production:

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Auth** → **SMTP Settings**
3. Configure your SMTP provider:

#### Using Gmail:
```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: your-app-password (not your regular password)
Sender email: your-email@gmail.com
Sender name: PickleRadar
```

**Note:** For Gmail, you need to create an "App Password":
- Go to your Google Account settings
- Security → 2-Step Verification → App passwords
- Generate a new app password for "Mail"
- Use this password in the SMTP settings

#### Using SendGrid:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: your-sendgrid-api-key
Sender email: your-verified-sender@yourdomain.com
Sender name: PickleRadar
```

#### Using AWS SES:
```
Host: email-smtp.us-east-1.amazonaws.com (adjust region)
Port: 587
Username: your-smtp-username
Password: your-smtp-password
Sender email: your-verified-email@yourdomain.com
Sender name: PickleRadar
```

4. Test the configuration by sending a test email
5. Save changes

**Pros:**
- Secure email verification
- Professional email delivery
- Recommended for production
- Better deliverability

**Cons:**
- Requires SMTP provider setup
- May have costs (depending on provider)
- Takes more time to configure

## Current App Behavior

The app has been updated to handle this error gracefully:

### During Sign Up:
- If email sending fails, the app shows a clear error message
- Users are informed that email verification is unavailable
- The error message suggests contacting the administrator

### During Sign In:
- If a user tries to sign in with an unverified email, they get a helpful message
- The message explains that email verification may not be working

### User Experience:
- Clear error messages explain the issue
- Users are not left confused about what went wrong
- Instructions are provided for next steps

## Testing

After configuring SMTP or disabling email confirmation:

1. Try signing up with a new email address
2. Check if you receive the verification email (if SMTP is configured)
3. Click the verification link in the email
4. Try signing in with the verified account

## Recommended Approach

**For Development:**
- Disable email confirmation temporarily
- Focus on building features
- Re-enable before production

**For Production:**
- Configure proper SMTP with a reliable provider
- Use a custom domain for professional emails
- Test thoroughly before launch
- Monitor email delivery rates

## Additional Resources

- [Supabase SMTP Configuration Docs](https://supabase.com/docs/guides/auth/auth-smtp)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [SendGrid Setup](https://sendgrid.com/docs/for-developers/sending-email/integrating-with-the-smtp-api/)
- [AWS SES Setup](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)

## Support

If you continue to have issues:
1. Check the Supabase logs for detailed error messages
2. Verify your SMTP credentials are correct
3. Ensure your email provider allows SMTP access
4. Check if your IP is not blocked by the email provider
5. Contact your email provider's support if needed
