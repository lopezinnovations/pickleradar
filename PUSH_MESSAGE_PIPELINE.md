# Message Push Notification Pipeline

## Single Source of Truth: Push Send Function

**Remote push (Expo API) is sent from:**
- **File:** `supabase/functions/notify-new-message/index.ts`
- **Function:** `sendExpoPush()` (internal helper) — sends to `https://exp.host/--/api/v2/push/send`
- **Entry point:** Edge function `notify-new-message` invoked via HTTP POST

## Call Sites (where push is triggered)

| Call site | File | When |
|-----------|------|------|
| Direct message | `app/conversation/[id].tsx` → `notifyNewMessage()` | After successful `messages` insert |
| Group message | `app/group-conversation/[id].tsx` → `notifyNewMessage()` | After successful `group_messages` insert |

## Client Helper

**File:** `utils/notifications.ts`  
**Function:** `notifyNewMessage(params)`  
- Calls `{supabaseUrl}/functions/v1/notify-new-message` with the session JWT
- Does not block; failures are logged only
- Parameters: `type`, `sender_id`, `recipient_id` (direct) or `group_id` (group), `content`, `sender_name`, `message_id`

## Push Token Storage

| Table | Columns | Written by |
|-------|---------|------------|
| `push_tokens` | `user_id`, `platform`, `token`, `active`, `updated_at` | `registerPushToken()` — upserts by (user_id, platform) |
| `users` | `push_token` | Also updated by `registerPushToken()` (backward compatibility) |

**Token lookup:** Edge function reads from `push_tokens` (active=true, order by updated_at desc); falls back to `users.push_token` if no `push_tokens` row.

**Invalid tokens:** On `DeviceNotRegistered` from Expo, the edge function marks the token `active=false` so future sends skip it.

## Gating Conditions (skip push when)

1. **Token missing/empty** — log: `Skip: token missing or empty`
2. **Token not Expo format** — must be `ExponentPushToken[...]`; otherwise log: `Skip: token not in ExponentPushToken format`
3. **Notifications disabled** — `users.notifications_enabled === false`; log: `Skip: recipient has notifications disabled`
4. **Conversation muted** — `conversation_mutes` row exists for recipient + conversation:
   - `muted_until === null` → permanent mute
   - `muted_until > now` → temporary mute
5. **Currently viewing chat** — not implemented (would require presence/state tracking on server)

## Edge Function Logs (send path)

- `message_id`, `sender_id`, `recipient_id` / `group_id`
- `token_exists` (yes/no) from recipient lookup
- `Push payload summary`: token prefix, title, body length
- `Push send response`: HTTP status, Expo API result
- `Push send error`: on fetch failure
- Which rule caused skip (see above)

## Token Format

- **Expected:** `ExponentPushToken[xxx]` from `Notifications.getExpoPushTokenAsync()`
- **Sent to:** `https://exp.host/--/api/v2/push/send` with `to: ExponentPushToken[...]`

## Deploy

1. Run migration: `supabase db push` or apply `20250214200000_push_tokens_table.sql`
2. Deploy edge function: `supabase functions deploy notify-new-message`

---

## Manual Test Steps

### Prerequisites

- Two test accounts (User A = sender, User B = recipient)
- Physical iOS or Android device (not Expo Go on Android SDK 53+)
- Development Build or TestFlight/Production build

### iOS

1. **Token registration**
   - User B: Sign in → Profile → ensure notifications enabled
   - User B: Check logs for `[Push] Token registration: { userId, tokenLength, tokenPrefix, platform, lastUpdated }`
   - User B: Profile → Admin Tools → "Push Token: Present ✅"

2. **Test push (foreground)**
   - User B: Profile → Admin Tools → Send Test Push
   - User B: Should receive notification; check logs for `[Push] Test push full response`

3. **Message push (foreground)**
   - User A: Send a direct message to User B (app open)
   - User B: Should receive push; check Supabase function logs for `Push sent successfully`

4. **Message push (background)**
   - User B: Background the app (swipe up, don’t force-quit)
   - User A: Send a direct message
   - User B: Should receive push notification; tap to open conversation

### Android

1. **Token registration** — same as iOS
2. **Test push (foreground)** — same as iOS
3. **Message push (foreground)** — same as iOS
4. **Message push (background)** — same as iOS (home button or recent apps)

### Troubleshooting

- No token: Ensure Dev Build / TestFlight; grant notification permission
- DeviceNotRegistered: Token was marked inactive; sign out and back in to re-register
- Check Supabase Edge Function logs: `[notify-new-message]` prefix
