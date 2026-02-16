
# Supabase Integration for PickleRadar

## Overview
PickleRadar is now fully integrated with Supabase for backend services including authentication, database, and real-time features.

## Database Configuration

### Supabase Project Details
- **URL**: https://biczbxmaisdxpcbplddr.supabase.co
- **API Key**: sb_publishable_G_5RZYmomd6zB_uFbRCDtw_rBflTxYk

### Database Tables

#### 1. Users Table
Stores user profile information and preferences.

**Columns:**
- `id` (uuid, primary key) - References auth.users
- `email` (text) - User email address
- `skill_level` (text) - Beginner, Intermediate, or Advanced
- `privacy_opt_in` (boolean) - Friend visibility setting
- `notifications_enabled` (boolean) - Push notification preference
- `location_enabled` (boolean) - Location services preference
- `created_at` (timestamp)
- `updated_at` (timestamp)

**RLS Policies:**
- Users can view their own profile
- Users can update their own profile
- Users can insert their own profile

#### 2. Courts Table
Contains pickleball court locations and information.

**Columns:**
- `id` (uuid, primary key)
- `name` (text) - Court name
- `address` (text) - Full address
- `latitude` (double precision) - GPS latitude
- `longitude` (double precision) - GPS longitude
- `created_at` (timestamp)

**RLS Policies:**
- Anyone can view courts (public data)

**Sample Data:**
- Central Park Pickleball Courts
- Riverside Recreation Center
- Sunset Community Courts
- Brooklyn Bridge Courts
- Manhattan Sports Complex
- Queens Recreation Park

#### 3. Check-ins Table
Tracks user check-ins at courts with automatic expiration.

**Columns:**
- `id` (uuid, primary key)
- `user_id` (uuid) - References users table
- `court_id` (uuid) - References courts table
- `skill_level` (text) - Skill level at time of check-in
- `created_at` (timestamp)
- `expires_at` (timestamp) - Auto-expires after 3 hours

**RLS Policies:**
- Users can view their own check-ins
- Users can view active check-ins at courts (for activity levels)
- Users can create their own check-ins
- Users can delete their own check-ins

**Features:**
- Unique constraint: One check-in per user per court
- Automatic expiration after 3 hours
- Function to delete expired check-ins

#### 4. Friends Table
Manages friend relationships and requests.

**Columns:**
- `id` (uuid, primary key)
- `user_id` (uuid) - User who sent the request
- `friend_id` (uuid) - User who received the request
- `status` (text) - pending, accepted, or rejected
- `created_at` (timestamp)
- `updated_at` (timestamp)

**RLS Policies:**
- Users can view their own friend requests (sent and received)
- Users can create friend requests
- Users can update friend requests they received
- Users can delete their own friend requests

**Features:**
- Unique constraint: One friendship per user pair
- Check constraint: Users cannot friend themselves
- Bidirectional friendship support

## Authentication

### Email/Password Authentication
- Sign up with email verification required
- Email redirect URL: https://natively.dev/email-confirmed
- Automatic user profile creation on signup
- Session persistence with AsyncStorage

### Features
- Auto-refresh tokens
- Persistent sessions
- Email verification required
- Password reset support (via Supabase)

## App Integration

### Client Configuration
Location: `supabase/client.ts`

The Supabase client is configured with:
- AsyncStorage for session persistence
- Auto-refresh tokens enabled
- TypeScript types for type safety

### Custom Hooks

#### useAuth
Location: `hooks/useAuth.ts`

Features:
- User authentication state management
- Sign up with email verification
- Sign in with password
- Sign out
- Update user profile
- Automatic profile fetching

#### useCourts
Location: `hooks/useCourts.ts`

Features:
- Fetch all courts
- Calculate activity levels based on check-ins
- Real-time player counts
- Fallback to mock data if not configured

#### useCheckIn
Location: `hooks/useCheckIn.ts`

Features:
- Check in at a court with skill level
- Check out from a court
- Get user's current check-in
- Automatic expiration after 3 hours
- Prevents duplicate check-ins

#### useFriends
Location: `hooks/useFriends.ts`

Features:
- Fetch friends list
- Fetch pending friend requests
- Send friend requests by email
- Accept/reject friend requests
- Remove friends
- See which friends are currently playing

## Security

### Row Level Security (RLS)
All tables have RLS enabled with appropriate policies:
- Users can only access their own data
- Courts are publicly viewable
- Check-ins are visible to calculate activity but user-specific operations are restricted
- Friend relationships are only visible to involved users

### Data Privacy
- User check-ins are aggregated anonymously for activity levels
- Friend visibility is opt-in only
- Location data is optional and only used for nearby court suggestions

## Future Enhancements

### Planned Features
1. **Push Notifications**
   - Friend check-in notifications
   - Nearby court activity alerts
   - Friend request notifications

2. **Real-time Updates**
   - Live court activity updates
   - Real-time friend status
   - Instant check-in notifications

3. **Advanced Features**
   - Court ratings and reviews
   - Game scheduling
   - Tournament organization
   - Player statistics

4. **Subscription System**
   - Premium features
   - Ad-free experience
   - Advanced analytics

## Development Notes

### Testing
- Mock data is available when Supabase is not configured
- All hooks check for configuration before making API calls
- Graceful fallbacks for offline/error scenarios

### Database Maintenance
- Expired check-ins can be cleaned up using the `delete_expired_check_ins()` function
- Consider setting up a cron job to run this function periodically

### Type Safety
- TypeScript types are auto-generated from the database schema
- Types are located in `supabase/types.ts`
- Regenerate types after schema changes using Supabase CLI

## Support

For issues or questions:
1. Check Supabase dashboard for logs
2. Review RLS policies if data access issues occur
3. Verify API keys and project URL
4. Check network connectivity

## Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-react-native)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
