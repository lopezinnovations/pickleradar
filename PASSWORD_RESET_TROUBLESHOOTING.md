
# Password Reset Email Troubleshooting Guide

## Issue
Password recovery emails are not being sent due to SMTP authentication failure.

## Root Cause
The Supabase project's SMTP (email server) settings are not properly configured. The error logs show:
```
"error":"535 5.7.8 Error: authentication failed"
"msg":"500: Error sending recovery email"
```

This is a **server-side configuration issue** that must be fixed in the Supabase dashboard.

## Solution

### Option 1: Configure Custom SMTP (Recommended for Production)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/biczbxmaisdxpcbplddr
   - Go to: Authentication → Settings → SMTP Settings

2. **Configure SMTP Provider**
   
   Choose one of these popular email providers:

   **Gmail (for testing only)**
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - SMTP Username: Your Gmail address
   - SMTP Password: App-specific password (not your regular password)
   - Sender Email: Your Gmail address
   - Sender Name: Your app name
   
   Note: You need to enable "2-Step Verification" and create an "App Password" in your Google Account settings.

   **SendGrid (Recommended for production)**
   - SMTP Host: `smtp.sendgrid.net`
   - SMTP Port: `587`
   - SMTP Username: `apikey`
   - SMTP Password: Your SendGrid API key
   - Sender Email: Your verified sender email
   - Sender Name: Your app name
   
   Sign up at: https://sendgrid.com/

   **Mailgun**
   - SMTP Host: `smtp.mailgun.org`
   - SMTP Port: `587`
   - SMTP Username: Your Mailgun SMTP username
   - SMTP Password: Your Mailgun SMTP password
   - Sender Email: Your verified sender email
   - Sender Name: Your app name
   
   Sign up at: https://www.mailgun.com/

   **AWS SES**
   - SMTP Host: `email-smtp.[region].amazonaws.com`
   - SMTP Port: `587`
   - SMTP Username: Your SES SMTP username
   - SMTP Password: Your SES SMTP password
   - Sender Email: Your verified sender email
   - Sender Name: Your app name

3. **Test the Configuration**
   - After saving SMTP settings, try the password reset feature again
   - Check the Supabase logs for any errors

### Option 2: Use Supabase's Built-in Email Service (Temporary)

For development/testing, you can use Supabase's default email service:

1. Go to: Authentication → Settings → SMTP Settings
2. Toggle "Enable Custom SMTP" to OFF
3. This will use Supabase's built-in email service (limited to development)

**Note:** The built-in service has rate limits and is not recommended for production.

### Option 3: Disable Email Confirmation (Not Recommended)

If you want to disable email verification entirely (not recommended for production):

1. Go to: Authentication → Settings
2. Under "Email Auth", toggle OFF "Enable email confirmations"
3. Users will be able to sign in immediately without email verification

**Warning:** This reduces security as anyone can sign up with any email address.

## Code Changes Made

The app code has been updated to handle SMTP errors gracefully:

1. **Enhanced Error Detection**
   - The `resetPassword` function now detects SMTP configuration errors
   - Returns a specific error code: `SMTP_NOT_CONFIGURED`

2. **User-Friendly Error Messages**
   - Users see: "Email service is currently not configured. Please contact support."
   - Technical details are logged for debugging

3. **Security Best Practices**
   - Generic success message: "If an account exists with this email, you will receive instructions"
   - This prevents email enumeration attacks

## Testing After Configuration

1. **Test Password Reset Flow**
   ```
   - Go to the app's sign-in screen
   - Click "Forgot Password?"
   - Enter a valid email address
   - Click "Send Reset Link"
   - Check your email inbox (and spam folder)
   ```

2. **Check Supabase Logs**
   ```
   - Go to: Logs → Auth Logs
   - Look for "mail.send" events
   - Verify no "authentication failed" errors
   ```

3. **Verify Email Template**
   - Go to: Authentication → Email Templates → Reset Password
   - Ensure the template includes the `{{ .ConfirmationURL }}` variable
   - Customize the template as needed

## Common Issues

### Issue: "App Password" not working with Gmail
**Solution:** 
- Enable 2-Step Verification in your Google Account
- Generate a new App Password specifically for this app
- Use the 16-character App Password (without spaces)

### Issue: SendGrid emails going to spam
**Solution:**
- Verify your sender domain in SendGrid
- Set up SPF, DKIM, and DMARC records
- Use a custom domain instead of @gmail.com

### Issue: Rate limiting errors
**Solution:**
- Upgrade your email provider plan
- Implement rate limiting in your app
- Use a dedicated IP address (for high-volume apps)

## Additional Resources

- [Supabase SMTP Configuration Docs](https://supabase.com/docs/guides/auth/auth-smtp)
- [SendGrid Setup Guide](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Mailgun Documentation](https://documentation.mailgun.com/en/latest/quickstart-sending.html)

## Support

If you continue to experience issues after configuring SMTP:

1. Check the Supabase Auth logs for detailed error messages
2. Verify your SMTP credentials are correct
3. Test your SMTP settings using a tool like [SMTP Test Tool](https://www.smtper.net/)
4. Contact Supabase support or your email provider's support team

## Summary

The password reset functionality is now properly handling SMTP errors and providing clear feedback to users. However, **you must configure SMTP settings in the Supabase dashboard** for password reset emails to actually be sent.

The recommended approach is to use a dedicated email service provider like SendGrid or Mailgun for production applications.
