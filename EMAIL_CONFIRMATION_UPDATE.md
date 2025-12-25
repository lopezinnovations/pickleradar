
# Email Confirmation Message Update

## Overview
This document provides instructions for updating the email confirmation message in Supabase Auth to include a thank you message and instructions to return to the PickleRadar app.

## Changes Implemented in Code

### 1. Sign-Up Confirmation Modal
- Added a modal that appears immediately after successful sign-up
- The modal prompts users to check their email for a confirmation link
- Users can dismiss the modal and will be redirected to the home screen

### 2. Friend List Display Updates
- Friend cards now display:
  - First name and last initial (e.g., "John D.")
  - Nickname in parentheses if available (e.g., "John D. (The Dink Master)")
  - Current court status: "Playing at [Court Name]" or "Not currently on a court"
  - Time remaining if checked in at a court

### 3. Accepted Friends Display
- Once a friend request is accepted, the friend automatically appears in the "My Friends" section
- The friend list is automatically refreshed when the screen comes into focus
- Real-time updates show when friends check in or out of courts

## Manual Configuration Required in Supabase Dashboard

### Update Email Confirmation Template

You need to manually update the email confirmation template in your Supabase project dashboard:

1. **Navigate to Authentication Settings**
   - Go to your Supabase project dashboard: https://app.supabase.com
   - Select your project: `biczbxmaisdxpcbplddr`
   - Click on "Authentication" in the left sidebar
   - Click on "Email Templates"

2. **Update the "Confirm signup" Template**
   - Find the "Confirm signup" template
   - Replace the default message with the following:

```html
<h2>Confirm Your Email</h2>

<p>Thank you for signing up for PickleRadar!</p>

<p>Please click the link below to confirm your email address:</p>

<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>

<p>Or copy and paste this URL into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p><strong>Thank you for confirming your email! You can now return to the PickleRadar app.</strong></p>

<p>If you didn't sign up for PickleRadar, you can safely ignore this email.</p>

<p>Best regards,<br>The PickleRadar Team</p>
```

3. **Save the Template**
   - Click "Save" to apply the changes
   - The new template will be used for all future sign-ups

### Alternative: Custom Email Template with Branding

For a more branded experience, you can use this enhanced template:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Your Email - PickleRadar</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">PickleRadar</h1>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #4CAF50;">Welcome to PickleRadar! 🎾</h2>
        
        <p>Thank you for signing up! We're excited to help you find pickleball courts and connect with other players.</p>
        
        <p>To get started, please confirm your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Confirm Email Address</a>
        </div>
        
        <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">{{ .ConfirmationURL }}</p>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin-top: 30px;">
            <p style="margin: 0; font-weight: bold; color: #4CAF50;">✓ Email Confirmed!</p>
            <p style="margin: 10px 0 0 0;">Once you click the confirmation link, you can return to the PickleRadar app and start exploring courts near you!</p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">If you didn't sign up for PickleRadar, you can safely ignore this email.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
            Best regards,<br>
            The PickleRadar Team
        </p>
    </div>
</body>
</html>
```

## Testing the Changes

### Test Sign-Up Flow
1. Create a new account in the app
2. Verify that the email confirmation modal appears
3. Check your email for the confirmation message
4. Click the confirmation link
5. Verify you can return to the app and sign in

### Test Friend List Display
1. Add a friend using their email or phone
2. Have the friend accept your request
3. Verify the friend appears in your "My Friends" section
4. Check that the display shows:
   - First name and last initial
   - Nickname (if available)
   - Court status (playing or not)

### Test Court Status Updates
1. Have a friend check in at a court
2. Verify their status updates to show "Playing at [Court Name]"
3. Verify the time remaining is displayed
4. When they check out, verify status changes to "Not currently on a court"

## Troubleshooting

### Email Not Received
- Check spam/junk folder
- Verify SMTP settings are configured in Supabase
- Check Supabase logs for email sending errors

### Friend Not Appearing in List
- Ensure the friend request was accepted (check status in database)
- Try pulling down to refresh the friends list
- Check console logs for any errors

### Court Status Not Updating
- Verify Realtime is enabled for the `check_ins` table
- Check that the friend has privacy_opt_in enabled
- Ensure both users are friends (status = 'accepted')

## Database Schema Reference

### Friends Table
- `id`: UUID (primary key)
- `user_id`: UUID (references users.id)
- `friend_id`: UUID (references users.id)
- `status`: text ('pending', 'accepted', 'rejected')
- `created_at`: timestamp
- `updated_at`: timestamp

### Users Table (Relevant Fields)
- `id`: UUID (primary key)
- `first_name`: text
- `last_name`: text
- `pickleballer_nickname`: text
- `experience_level`: text ('Beginner', 'Intermediate', 'Advanced')
- `dupr_rating`: numeric (0.0 - 8.0)
- `privacy_opt_in`: boolean

### Check-Ins Table
- `id`: UUID (primary key)
- `user_id`: UUID (references users.id)
- `court_id`: UUID (references courts.id)
- `skill_level`: text
- `created_at`: timestamp
- `expires_at`: timestamp
- `duration_minutes`: integer (default 90)

## Support

If you encounter any issues with these changes, please check:
1. Supabase project logs
2. Browser/app console logs
3. Network requests in developer tools
4. Database RLS policies

For additional help, refer to:
- Supabase Auth documentation: https://supabase.com/docs/guides/auth
- Supabase Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
