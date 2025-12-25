
import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { User } from '@/types';
import { registerPushToken } from '@/utils/notifications';

const CURRENT_TERMS_VERSION = 'v1.0';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const hasInitialized = useRef(false);
  const isInitializing = useRef(false);

  useEffect(() => {
    // Prevent multiple simultaneous initializations
    if (hasInitialized.current || isInitializing.current) {
      return;
    }
    
    isInitializing.current = true;
    console.log('useAuth: Initializing...');
    
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);
    console.log('useAuth: Supabase configured:', configured);
    
    if (!configured) {
      console.log('useAuth: Supabase not configured, skipping auth');
      setLoading(false);
      isInitializing.current = false;
      hasInitialized.current = true;
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.log('useAuth: Error getting session:', error);
          setLoading(false);
        } else {
          console.log('useAuth: Current session:', session ? 'Active' : 'None');
          if (session?.user) {
            // Verify this is an email-based session
            if (session.user.email) {
              console.log('useAuth: Valid email session found');
              await fetchUserProfile(session.user.id, session.user.email);
            } else {
              console.log('useAuth: Session exists but no email - clearing invalid session');
              await supabase.auth.signOut();
              setLoading(false);
            }
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.log('useAuth: Error in initAuth:', error);
        setLoading(false);
      } finally {
        isInitializing.current = false;
        hasInitialized.current = true;
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('useAuth: Auth state changed:', _event, session ? 'User logged in' : 'User logged out');
      if (session?.user) {
        if (session.user.email) {
          await fetchUserProfile(session.user.id, session.user.email);
        } else {
          console.log('useAuth: Invalid session without email');
          setUser(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('useAuth: Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    console.log('useAuth: Fetching user profile for:', userId);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('useAuth: Error fetching user profile:', error);
        
        if (error.code === 'PGRST116') {
          console.log('useAuth: User profile not found, creating new profile...');
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert([
              {
                id: userId,
                email: email || null,
                phone: null,
                privacy_opt_in: false,
                notifications_enabled: false,
                location_enabled: false,
                location_permission_requested: false,
                terms_accepted: false,
                privacy_accepted: false,
              },
            ])
            .select()
            .single();

          if (createError) {
            console.log('useAuth: Error creating user profile:', createError);
            throw createError;
          }

          console.log('useAuth: User profile created successfully');
          setUser({
            id: newProfile.id,
            email: newProfile.email,
            phone: newProfile.phone,
            firstName: newProfile.first_name,
            lastName: newProfile.last_name,
            pickleballerNickname: newProfile.pickleballer_nickname,
            skillLevel: newProfile.skill_level as 'Beginner' | 'Intermediate' | 'Advanced' | undefined,
            experienceLevel: newProfile.experience_level as 'Beginner' | 'Intermediate' | 'Advanced' | undefined,
            privacyOptIn: newProfile.privacy_opt_in || false,
            notificationsEnabled: newProfile.notifications_enabled || false,
            locationEnabled: newProfile.location_enabled || false,
            latitude: newProfile.latitude,
            longitude: newProfile.longitude,
            zipCode: newProfile.zip_code,
            duprRating: newProfile.dupr_rating,
            locationPermissionRequested: newProfile.location_permission_requested || false,
            profilePictureUrl: newProfile.profile_picture_url,
            termsAccepted: newProfile.terms_accepted || false,
            privacyAccepted: newProfile.privacy_accepted || false,
            acceptedAt: newProfile.accepted_at,
            acceptedVersion: newProfile.accepted_version,
          });
        } else {
          throw error;
        }
      } else {
        console.log('useAuth: User profile fetched successfully');
        setUser({
          id: data.id,
          email: data.email,
          phone: data.phone,
          firstName: data.first_name,
          lastName: data.last_name,
          pickleballerNickname: data.pickleballer_nickname,
          skillLevel: data.skill_level as 'Beginner' | 'Intermediate' | 'Advanced' | undefined,
          experienceLevel: data.experience_level as 'Beginner' | 'Intermediate' | 'Advanced' | undefined,
          privacyOptIn: data.privacy_opt_in || false,
          notificationsEnabled: data.notifications_enabled || false,
          locationEnabled: data.location_enabled || false,
          latitude: data.latitude,
          longitude: data.longitude,
          zipCode: data.zip_code,
          duprRating: data.dupr_rating,
          locationPermissionRequested: data.location_permission_requested || false,
          profilePictureUrl: data.profile_picture_url,
          termsAccepted: data.terms_accepted || false,
          privacyAccepted: data.privacy_accepted || false,
          acceptedAt: data.accepted_at,
          acceptedVersion: data.accepted_version,
        });
      }

      // Register push token after user profile is loaded
      console.log('useAuth: Registering push token for user:', userId);
      registerPushToken(userId).catch(err => {
        console.log('useAuth: Failed to register push token:', err);
      });
    } catch (error) {
      console.log('useAuth: Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refetchUser = async () => {
    if (!user) {
      console.log('useAuth: Cannot refetch - no user');
      return;
    }
    console.log('useAuth: Refetching user profile');
    setLoading(true);
    await fetchUserProfile(user.id, user.email || '');
  };

  const signUp = async (
    email: string, 
    password: string, 
    consentAccepted: boolean = false,
    firstName?: string,
    lastName?: string,
    pickleballerNickname?: string,
    experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced',
    duprRating?: number
  ) => {
    try {
      console.log('useAuth: Signing up with email:', email);
      
      if (!consentAccepted) {
        return {
          success: false,
          error: 'Consent required',
          message: 'You must accept the Privacy Policy and Terms of Service to continue.',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://natively.dev/email-confirmed',
          data: {
            terms_accepted: true,
            privacy_accepted: true,
            accepted_at: new Date().toISOString(),
            accepted_version: CURRENT_TERMS_VERSION,
          }
        }
      });

      if (error) {
        console.log('useAuth: Sign up error:', error);
        console.log('useAuth: Error details:', JSON.stringify(error, null, 2));
        
        // Handle specific error cases
        if (error.message.toLowerCase().includes('already registered')) {
          return {
            success: false,
            error: error.message,
            message: 'This email is already registered. Please sign in instead.',
          };
        }

        // Handle SMTP/email sending errors - but still allow user to proceed
        if (error.message.includes('Error sending confirmation email') || 
            error.message.includes('authentication failed') ||
            error.status === 500) {
          console.log('useAuth: SMTP error detected - proceeding with signup anyway');
          
          // Check if user was created despite the email error
          if (data?.user) {
            console.log('useAuth: User created despite email error, creating profile...');
            
            // Create user profile with consent and new fields
            const now = new Date().toISOString();
            
            const { error: profileError } = await supabase
              .from('users')
              .insert([
                {
                  id: data.user.id,
                  email: data.user.email || email,
                  phone: null,
                  first_name: firstName,
                  last_name: lastName,
                  pickleballer_nickname: pickleballerNickname,
                  experience_level: experienceLevel,
                  dupr_rating: duprRating,
                  privacy_opt_in: false,
                  notifications_enabled: false,
                  location_enabled: false,
                  location_permission_requested: false,
                  terms_accepted: true,
                  privacy_accepted: true,
                  accepted_at: now,
                  accepted_version: CURRENT_TERMS_VERSION,
                },
              ]);

            if (profileError) {
              console.log('useAuth: Profile creation error:', profileError);
            }

            // Return success - user can proceed even without email verification
            return {
              success: true,
              error: null,
              message: 'Account created successfully!',
            };
          }
        }
        
        throw error;
      }

      console.log('useAuth: Sign up successful:', data);

      // Create user profile with consent and new fields
      if (data.user) {
        const now = new Date().toISOString();
        
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email || email,
              phone: null,
              first_name: firstName,
              last_name: lastName,
              pickleballer_nickname: pickleballerNickname,
              experience_level: experienceLevel,
              dupr_rating: duprRating,
              privacy_opt_in: false,
              notifications_enabled: false,
              location_enabled: false,
              location_permission_requested: false,
              terms_accepted: true,
              privacy_accepted: true,
              accepted_at: now,
              accepted_version: CURRENT_TERMS_VERSION,
            },
          ]);

        if (profileError) {
          console.log('useAuth: Profile creation error:', profileError);
          // Don't throw error, just log it - user is still created
        } else {
          console.log('useAuth: User profile created successfully with consent and profile fields');
        }
      }
      
      // Return success - user can proceed immediately
      return { 
        success: true, 
        error: null, 
        message: 'Account created successfully!',
      };
    } catch (error: any) {
      console.log('useAuth: Sign up error:', error);
      const errorMessage = error?.message || 'Failed to create account. Please try again.';
      return { 
        success: false, 
        error: errorMessage, 
        message: errorMessage,
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('useAuth: Signing in with email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('useAuth: Sign in error:', error);
        console.log('useAuth: Error details:', JSON.stringify(error, null, 2));
        
        // Return generic error message for all sign-in failures
        return {
          success: false,
          error: error.message,
          message: 'Incorrect email or password. Please try again.',
        };
      }

      console.log('useAuth: Sign in successful:', data);

      // Check if we have both user and session
      if (data.user && data.session) {
        console.log('useAuth: User signed in successfully');
        console.log('useAuth: User email:', data.user.email);
        
        // The auth state change listener will handle setting the user
        return { 
          success: true, 
          error: null, 
          message: 'Sign in successful',
        };
      } else {
        console.log('useAuth: Unexpected sign in response - no user or session returned');
        console.log('useAuth: Data:', JSON.stringify(data, null, 2));
        return {
          success: false,
          error: 'Sign in failed',
          message: 'Incorrect email or password. Please try again.',
        };
      }
    } catch (error: any) {
      console.log('useAuth: Sign in error:', error);
      return { 
        success: false, 
        error: error?.message || 'Sign in failed', 
        message: 'Incorrect email or password. Please try again.',
      };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('useAuth: Requesting password reset for:', email);
      
      // Use a deep link that will redirect back to the app
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'pickleball://reset-password',
      });

      if (error) {
        console.log('useAuth: Password reset error:', error);
        console.log('useAuth: Error details:', JSON.stringify(error, null, 2));
        
        // Check for SMTP configuration errors
        if (error.message.includes('Error sending recovery email') || 
            error.message.includes('authentication failed') ||
            error.status === 500) {
          console.log('useAuth: SMTP configuration error detected');
          return {
            success: false,
            error: 'SMTP_NOT_CONFIGURED',
            message: 'Email service is not configured. Please contact support or try again later.',
            technicalDetails: 'The email server (SMTP) is not properly configured. This is a server configuration issue that needs to be fixed by the administrator.',
          };
        }
        
        throw error;
      }

      console.log('useAuth: Password reset email sent successfully');
      return { 
        success: true, 
        error: null, 
        message: 'If an account exists with this email, you will receive password reset instructions shortly. Click the link in the email to reset your password.',
      };
    } catch (error: any) {
      console.log('useAuth: Password reset error:', error);
      
      // Provide a generic message for security (don't reveal if email exists)
      return { 
        success: false, 
        error: error?.message || 'Failed to process password reset request', 
        message: 'Unable to send password reset email. Please try again later or contact support.',
      };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      console.log('useAuth: Updating password...');
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      console.log('useAuth: Password updated successfully');
      return { 
        success: true, 
        error: null, 
        message: 'Password updated successfully!',
      };
    } catch (error: any) {
      console.log('useAuth: Update password error:', error);
      return { 
        success: false, 
        error: error?.message || 'Failed to update password', 
        message: 'Failed to update password. Please try again.',
      };
    }
  };

  const signOut = async () => {
    try {
      console.log('useAuth: Signing out user');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      console.log('useAuth: Sign out successful');
    } catch (error) {
      console.log('useAuth: Sign out error:', error);
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user) {
      console.log('useAuth: Cannot update profile - no user');
      return;
    }

    try {
      console.log('useAuth: Updating user profile:', updates);
      const dbUpdates: any = {};
      
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.pickleballerNickname !== undefined) dbUpdates.pickleballer_nickname = updates.pickleballerNickname;
      if (updates.skillLevel !== undefined) dbUpdates.skill_level = updates.skillLevel;
      if (updates.experienceLevel !== undefined) dbUpdates.experience_level = updates.experienceLevel;
      if (updates.privacyOptIn !== undefined) dbUpdates.privacy_opt_in = updates.privacyOptIn;
      if (updates.notificationsEnabled !== undefined) dbUpdates.notifications_enabled = updates.notificationsEnabled;
      if (updates.locationEnabled !== undefined) dbUpdates.location_enabled = updates.locationEnabled;
      if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
      if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
      if (updates.zipCode !== undefined) dbUpdates.zip_code = updates.zipCode;
      if (updates.duprRating !== undefined) dbUpdates.dupr_rating = updates.duprRating;
      if (updates.locationPermissionRequested !== undefined) dbUpdates.location_permission_requested = updates.locationPermissionRequested;
      if (updates.profilePictureUrl !== undefined) dbUpdates.profile_picture_url = updates.profilePictureUrl;
      if (updates.termsAccepted !== undefined) dbUpdates.terms_accepted = updates.termsAccepted;
      if (updates.privacyAccepted !== undefined) dbUpdates.privacy_accepted = updates.privacyAccepted;
      if (updates.acceptedAt !== undefined) dbUpdates.accepted_at = updates.acceptedAt;
      if (updates.acceptedVersion !== undefined) dbUpdates.accepted_version = updates.acceptedVersion;

      const { error } = await supabase
        .from('users')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) throw error;
      setUser({ ...user, ...updates });
      console.log('useAuth: Profile update successful');
    } catch (error) {
      console.log('useAuth: Update profile error:', error);
    }
  };

  const uploadProfilePicture = async (uri: string): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      console.log('useAuth: Uploading profile picture...');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/profile.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        console.log('useAuth: Upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      console.log('useAuth: Profile picture uploaded successfully:', publicUrl);

      await updateUserProfile({ profilePictureUrl: publicUrl });

      return { success: true, url: publicUrl };
    } catch (error: any) {
      console.log('useAuth: Upload profile picture error:', error);
      return { success: false, error: error.message || 'Failed to upload profile picture' };
    }
  };

  const needsConsentUpdate = (): boolean => {
    if (!user) return false;
    if (!user.termsAccepted || !user.privacyAccepted) return true;
    if (user.acceptedVersion !== CURRENT_TERMS_VERSION) return true;
    return false;
  };

  const acceptConsent = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      const now = new Date().toISOString();
      await updateUserProfile({
        termsAccepted: true,
        privacyAccepted: true,
        acceptedAt: now,
        acceptedVersion: CURRENT_TERMS_VERSION,
      });
      return { success: true };
    } catch (error: any) {
      console.log('useAuth: Accept consent error:', error);
      return { success: false, error: error.message || 'Failed to update consent' };
    }
  };

  return {
    user,
    loading,
    isConfigured,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateUserProfile,
    uploadProfilePicture,
    needsConsentUpdate,
    acceptConsent,
    refetchUser,
    currentTermsVersion: CURRENT_TERMS_VERSION,
  };
};
</write file>

Now let's fix the friends hook to ensure it properly loads data:

<write file="hooks/useFriends.ts">
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { Friend, FriendWithDetails } from '@/types';

interface UserWithStatus {
  id: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  pickleballer_nickname?: string;
  experience_level?: string;
  dupr_rating?: number;
  isAtCourt: boolean;
  courtsPlayed?: string[];
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  friendshipId?: string;
}

export const useFriends = (userId: string | undefined) => {
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithDetails[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const getRemainingTime = (expiresAt: string): { hours: number; minutes: number; totalMinutes: number } => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes };
  };

  const fetchAllUsers = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      console.log('useFriends: Cannot fetch users - no userId or not configured');
      return;
    }

    try {
      console.log('useFriends: Fetching all users for userId:', userId);
      
      // Get all users except the current user
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, phone, first_name, last_name, pickleballer_nickname, experience_level, dupr_rating')
        .neq('id', userId);

      if (usersError) {
        console.error('useFriends: Error fetching users:', usersError);
        throw usersError;
      }

      console.log('useFriends: Fetched users:', users?.length);

      // Get all users who are currently checked in
      const { data: checkIns, error: checkInsError } = await supabase
        .from('check_ins')
        .select('user_id')
        .gte('expires_at', new Date().toISOString());

      if (checkInsError) {
        console.error('useFriends: Error fetching check-ins:', checkInsError);
        throw checkInsError;
      }

      const checkedInUserIds = new Set((checkIns || []).map(ci => ci.user_id));

      // Get ALL friend relationships (not just accepted ones)
      const { data: allRelationships, error: relationshipsError } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (relationshipsError) {
        console.error('useFriends: Error fetching relationships:', relationshipsError);
        throw relationshipsError;
      }

      console.log('useFriends: Fetched relationships:', allRelationships?.length);

      // Create a map of user relationships
      const relationshipMap = new Map<string, { status: string; friendshipId: string; isSender: boolean }>();
      (allRelationships || []).forEach(rel => {
        const otherUserId = rel.user_id === userId ? rel.friend_id : rel.user_id;
        const isSender = rel.user_id === userId;
        
        if (rel.status === 'accepted') {
          relationshipMap.set(otherUserId, { 
            status: 'accepted', 
            friendshipId: rel.id,
            isSender 
          });
        } else if (rel.status === 'pending') {
          // Determine if this is a sent or received request
          const friendshipStatus = isSender ? 'pending_sent' : 'pending_received';
          relationshipMap.set(otherUserId, { 
            status: friendshipStatus, 
            friendshipId: rel.id,
            isSender 
          });
        }
      });

      // Get courts played by each user
      const { data: userCheckIns, error: userCheckInsError } = await supabase
        .from('check_ins')
        .select('user_id, court_id, courts(name)');

      if (userCheckInsError) {
        console.error('useFriends: Error fetching user check-ins:', userCheckInsError);
        throw userCheckInsError;
      }

      // Create a map of user_id to courts played
      const userCourtsMap = new Map<string, Set<string>>();
      (userCheckIns || []).forEach((checkIn: any) => {
        if (checkIn.courts?.name) {
          if (!userCourtsMap.has(checkIn.user_id)) {
            userCourtsMap.set(checkIn.user_id, new Set());
          }
          userCourtsMap.get(checkIn.user_id)?.add(checkIn.courts.name);
        }
      });

      // Map users with their relationship status
      const usersWithStatus: UserWithStatus[] = (users || []).map(user => {
        const relationship = relationshipMap.get(user.id);
        return {
          ...user,
          isAtCourt: checkedInUserIds.has(user.id),
          courtsPlayed: userCourtsMap.has(user.id) 
            ? Array.from(userCourtsMap.get(user.id)!) 
            : [],
          friendshipStatus: relationship?.status as any || 'none',
          friendshipId: relationship?.friendshipId,
        };
      });

      console.log('useFriends: Users with status:', usersWithStatus.length);
      setAllUsers(usersWithStatus);
    } catch (error) {
      console.error('useFriends: Error in fetchAllUsers:', error);
    }
  }, [userId]);

  const fetchFriends = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      console.log('useFriends: Cannot fetch friends - no userId or not configured');
      setLoading(false);
      return;
    }

    try {
      console.log('useFriends: Fetching friends for userId:', userId);
      
      const { data: acceptedFriends, error: friendsError } = await supabase
        .from('friends')
        .select(`
          *,
          friend:users!friends_friend_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('useFriends: Error fetching accepted friends:', friendsError);
        throw friendsError;
      }

      console.log('useFriends: Fetched accepted friends:', acceptedFriends?.length);

      const { data: pending, error: pendingError } = await supabase
        .from('friends')
        .select(`
          *,
          requester:users!friends_user_id_fkey(id, email, phone, first_name, last_name, pickleballer_nickname, skill_level, experience_level, dupr_rating)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (pendingError) {
        console.error('useFriends: Error fetching pending requests:', pendingError);
        throw pendingError;
      }

      console.log('useFriends: Fetched pending requests:', pending?.length);

      const friendsWithDetails: FriendWithDetails[] = await Promise.all(
        (acceptedFriends || []).map(async (friendship: any) => {
          const friendData = friendship.friend;
          
          const { data: checkIn } = await supabase
            .from('check_ins')
            .select('court_id, expires_at, courts(name)')
            .eq('user_id', friendData.id)
            .gte('expires_at', new Date().toISOString())
            .single();

          let remainingTime = undefined;
          if (checkIn?.expires_at) {
            remainingTime = getRemainingTime(checkIn.expires_at);
          }

          return {
            id: friendship.id,
            userId: friendship.user_id,
            friendId: friendship.friend_id,
            status: friendship.status,
            createdAt: friendship.created_at,
            friendEmail: friendData.email,
            friendPhone: friendData.phone,
            friendFirstName: friendData.first_name,
            friendLastName: friendData.last_name,
            friendNickname: friendData.pickleballer_nickname,
            friendSkillLevel: friendData.skill_level,
            friendExperienceLevel: friendData.experience_level,
            friendDuprRating: friendData.dupr_rating,
            currentCourtId: checkIn?.court_id,
            currentCourtName: checkIn?.courts?.name,
            remainingTime,
          };
        })
      );

      const pendingWithDetails: FriendWithDetails[] = (pending || []).map((friendship: any) => {
        const requesterData = friendship.requester;
        return {
          id: friendship.id,
          userId: friendship.user_id,
          friendId: friendship.friend_id,
          status: friendship.status,
          createdAt: friendship.created_at,
          friendEmail: requesterData.email,
          friendPhone: requesterData.phone,
          friendFirstName: requesterData.first_name,
          friendLastName: requesterData.last_name,
          friendNickname: requesterData.pickleballer_nickname,
          friendSkillLevel: requesterData.skill_level,
          friendExperienceLevel: requesterData.experience_level,
          friendDuprRating: requesterData.dupr_rating,
        };
      });

      console.log('useFriends: Setting friends:', friendsWithDetails.length);
      console.log('useFriends: Setting pending requests:', pendingWithDetails.length);
      
      setFriends(friendsWithDetails);
      setPendingRequests(pendingWithDetails);
      
      // Also fetch all users
      await fetchAllUsers();
    } catch (error) {
      console.error('useFriends: Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchAllUsers]);

  useEffect(() => {
    console.log('useFriends: useEffect triggered with userId:', userId);
    if (userId && isSupabaseConfigured()) {
      fetchFriends();
    } else {
      console.log('useFriends: Skipping fetch - no userId or not configured');
      setLoading(false);
    }
  }, [userId, fetchFriends]);

  const sendFriendRequest = async (friendIdentifier: string) => {
    if (!userId || !isSupabaseConfigured()) {
      return { success: false, error: 'Not configured' };
    }

    try {
      // Try to find user by phone or email
      let friendUser = null;
      
      // Check if it looks like a phone number (contains digits and possibly +, -, (, ), spaces)
      const isPhone = /[\d+\-() ]/.test(friendIdentifier) && friendIdentifier.replace(/[\D]/g, '').length >= 10;
      
      if (isPhone) {
        // Clean phone number
        const cleanPhone = friendIdentifier.replace(/\D/g, '');
        const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;
        
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('phone', formattedPhone)
          .single();
        
        if (!error && data) {
          friendUser = data;
        }
      } else {
        // Try email
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', friendIdentifier)
          .single();
        
        if (!error && data) {
          friendUser = data;
        }
      }

      if (!friendUser) {
        return { success: false, error: 'User not found' };
      }

      if (friendUser.id === userId) {
        return { success: false, error: 'Cannot add yourself as a friend' };
      }

      const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${userId})`)
        .single();

      if (existing) {
        return { success: false, error: 'Friend request already exists' };
      }

      const { error } = await supabase
        .from('friends')
        .insert([
          {
            user_id: userId,
            friend_id: friendUser.id,
            status: 'pending',
          },
        ]);

      if (error) throw error;

      await fetchFriends();
      return { success: true, error: null };
    } catch (error: any) {
      console.error('useFriends: Error sending friend request:', error);
      return { success: false, error: error.message };
    }
  };

  const sendFriendRequestById = async (friendId: string) => {
    if (!userId || !isSupabaseConfigured()) {
      console.error('useFriends: sendFriendRequestById - Not configured or no userId');
      return { success: false, error: 'Not configured' };
    }

    try {
      console.log('useFriends: Sending friend request from', userId, 'to', friendId);
      
      if (friendId === userId) {
        console.error('useFriends: Cannot add yourself as a friend');
        return { success: false, error: 'Cannot add yourself as a friend' };
      }

      // Check if a relationship already exists
      const { data: existing, error: existingError } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (existingError) {
        console.error('useFriends: Error checking existing relationship:', existingError);
        throw existingError;
      }

      if (existing && existing.length > 0) {
        console.log('useFriends: Relationship already exists:', existing);
        return { success: false, error: 'Friend request already exists' };
      }

      console.log('useFriends: Inserting new friend request');
      const { data: insertData, error: insertError } = await supabase
        .from('friends')
        .insert([
          {
            user_id: userId,
            friend_id: friendId,
            status: 'pending',
          },
        ])
        .select();

      if (insertError) {
        console.error('useFriends: Error inserting friend request:', insertError);
        throw insertError;
      }

      console.log('useFriends: Friend request inserted successfully:', insertData);
      
      // Refresh the data
      await fetchFriends();
      return { success: true, error: null };
    } catch (error: any) {
      console.error('useFriends: Error in sendFriendRequestById:', error);
      return { success: false, error: error.message || 'Failed to send friend request' };
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      console.log('useFriends: Accepting friend request:', friendshipId);
      
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) {
        console.error('useFriends: Error accepting friend request:', error);
        throw error;
      }

      console.log('useFriends: Friend request accepted successfully');
      await fetchFriends();
    } catch (error) {
      console.error('useFriends: Error accepting friend request:', error);
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      console.log('useFriends: Rejecting friend request:', friendshipId);
      
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendshipId);

      if (error) {
        console.error('useFriends: Error rejecting friend request:', error);
        throw error;
      }

      console.log('useFriends: Friend request rejected successfully');
      await fetchFriends();
    } catch (error) {
      console.error('useFriends: Error rejecting friend request:', error);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      console.log('useFriends: Removing friend:', friendshipId);
      
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendshipId);

      if (error) {
        console.error('useFriends: Error removing friend:', error);
        throw error;
      }

      console.log('useFriends: Friend removed successfully');
      await fetchFriends();
    } catch (error) {
      console.error('useFriends: Error removing friend:', error);
    }
  };

  return {
    friends,
    pendingRequests,
    allUsers,
    loading,
    sendFriendRequest,
    sendFriendRequestById,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    refetch: fetchFriends,
  };
};
