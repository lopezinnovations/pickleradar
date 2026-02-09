
export interface Court {
  id: string;
  name: string;
  address: string;
  city?: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  activityLevel: 'low' | 'medium' | 'high';
  currentPlayers: number;
  averageSkillLevel: number;
  friendsPlayingCount: number;
  distance?: number | null; // Distance in miles from user's location (null if court has no coordinates)
  description?: string; // Google Maps description
  openTime?: string; // Court open time
  closeTime?: string; // Court close time
  googlePlaceId?: string; // Google Place ID
  averageDupr?: number; // Average DUPR of checked-in players
}

export interface User {
  id: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  pickleballerNickname?: string;
  skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  privacyOptIn: boolean;
  notificationsEnabled: boolean;
  locationEnabled: boolean;
  latitude?: number;
  longitude?: number;
  zipCode?: string;
  duprRating?: number;
  locationPermissionRequested?: boolean;
  profilePictureUrl?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  acceptedAt?: string;
  acceptedVersion?: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  courtId: string;
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  timestamp: string;
  expiresAt: string;
  durationMinutes: number;
  notificationId?: string;
}

export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface FriendWithDetails extends Friend {
  friendEmail?: string;
  friendPhone?: string;
  friendFirstName?: string;
  friendLastName?: string;
  friendNickname?: string;
  friendSkillLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  friendExperienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  friendDuprRating?: number;
  currentCourtId?: string;
  currentCourtName?: string;
  remainingTime?: {
    hours: number;
    minutes: number;
    totalMinutes: number;
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'friend_request' | 'friend_accepted' | 'friend_checkin' | 'friend_checkout' | 'checkin_confirmation' | 'auto_checkout';
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

export type SortOption = 'activity' | 'nearest' | 'alphabetical';

export interface FilterOptions {
  skillLevels?: ('Beginner' | 'Intermediate' | 'Advanced')[];
  showFriendsOnly?: boolean;
}

export interface UserSubmittedCourt {
  id?: string;
  user_id: string;
  name: string;
  address: string;
  city?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  skill_level?: 'Beginner' | 'Intermediate' | 'Advanced';
  dupr_rating?: number;
  status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
  updated_at: string;
}
