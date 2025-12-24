
import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { User } from '@/types';

const CURRENT_TERMS_VERSION = 'v1.0';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    console.log('useAuth: Initializing...');
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);
    console.log('useAuth: Supabase configured:', configured);
    
    if (!configured) {
      console.log('useAuth: Supabase not configured, skipping auth');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log('useAuth: Error getting session:', error);
        setLoading(false);
      } else {
        console.log('useAuth: Current session:', session ? 'Active' : 'None');
        if (session?.user) {
          // Verify this is a phone-based session
          if (session.user.phone) {
            console.log('useAuth: Valid phone session found');
            fetchUserProfile(session.user.id, session.user.phone);
          } else {
            console.log('useAuth: Session exists but no phone number - clearing invalid session');
            supabase.auth.signOut().then(() => {
              setLoading(false);
            });
          }
        } else {
          setLoading(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('useAuth: Auth state changed:', _event, session ? 'User logged in' : 'User logged out');
      if (session?.user) {
        if (session.user.phone) {
          fetchUserProfile(session.user.id, session.user.phone);
        } else {
          console.log('useAuth: Invalid session without phone number');
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

  const fetchUserProfile = async (userId: string, phone: string) => {
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
                email: null,
                phone: phone || null,
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
            skillLevel: newProfile.skill_level as 'Beginner' | 'Intermediate' | 'Advanced' | undefined,
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
          skillLevel: data.skill_level as 'Beginner' | 'Intermediate' | 'Advanced' | undefined,
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
    } catch (error) {
      console.log('useAuth: Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (phone: string) => {
    try {
      console.log('useAuth: Sending OTP to:', phone);
      
      // Ensure we're using phone OTP, not email
      const { data, error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          channel: 'sms',
        },
      });

      if (error) {
        console.log('useAuth: Send OTP error:', error);
        console.log('useAuth: Error details:', JSON.stringify(error, null, 2));
        
        // Handle specific error cases
        if (error.message.toLowerCase().includes('rate limit')) {
          return {
            success: false,
            error: error.message,
            message: 'Too many requests. Please wait a few minutes before trying again.',
          };
        }
        
        if (error.message.toLowerCase().includes('sms') || error.message.toLowerCase().includes('provider')) {
          return {
            success: false,
            error: error.message,
            message: 'SMS service is not configured. Please contact support or check your Supabase SMS provider settings.',
          };
        }
        
        throw error;
      }

      console.log('useAuth: OTP sent successfully:', data);
      
      return { 
        success: true, 
        error: null, 
        message: 'Verification code sent successfully.',
      };
    } catch (error: any) {
      console.log('useAuth: Send OTP error:', error);
      const errorMessage = error?.message || 'Failed to send verification code. Please try again.';
      return { 
        success: false, 
        error: errorMessage, 
        message: errorMessage,
      };
    }
  };

  const verifyOtp = async (phone: string, token: string, consentAccepted: boolean = false) => {
    try {
      console.log('useAuth: Verifying OTP for:', phone);
      console.log('useAuth: Token:', token);
      
      if (!consentAccepted) {
        return {
          success: false,
          error: 'Consent required',
          message: 'You must accept the Privacy Policy and Terms of Service to continue.',
        };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) {
        console.log('useAuth: Verify OTP error:', error);
        console.log('useAuth: Error details:', JSON.stringify(error, null, 2));
        
        // Handle specific error cases
        if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('expired')) {
          return {
            success: false,
            error: error.message,
            message: 'Invalid or expired verification code. Please try again.',
          };
        }
        
        if (error.message.toLowerCase().includes('token')) {
          return {
            success: false,
            error: error.message,
            message: 'The verification code you entered is incorrect. Please check and try again.',
          };
        }
        
        throw error;
      }

      console.log('useAuth: OTP verified successfully:', data);

      // Check if we have both user and session
      if (data.user && data.session) {
        console.log('useAuth: User verified and logged in');
        console.log('useAuth: User phone:', data.user.phone);
        
        // Create or update user profile with consent
        const now = new Date().toISOString();
        
        const { error: profileError } = await supabase
          .from('users')
          .upsert([
            {
              id: data.user.id,
              email: null,
              phone: data.user.phone || phone,
              privacy_opt_in: false,
              notifications_enabled: false,
              location_enabled: false,
              location_permission_requested: false,
              terms_accepted: true,
              privacy_accepted: true,
              accepted_at: now,
              accepted_version: CURRENT_TERMS_VERSION,
            },
          ], {
            onConflict: 'id',
          });

        if (profileError) {
          console.log('useAuth: Profile creation/update error:', profileError);
          // Don't throw error, just log it - user is still authenticated
        } else {
          console.log('useAuth: User profile created/updated successfully with consent');
        }
        
        // The auth state change listener will handle setting the user
        return { 
          success: true, 
          error: null, 
          message: 'Phone number verified. Welcome to PickleRadar.',
        };
      } else {
        console.log('useAuth: Unexpected verify response - no user or session returned');
        console.log('useAuth: Data:', JSON.stringify(data, null, 2));
        return {
          success: false,
          error: 'Verification failed',
          message: 'Failed to verify code. Please try again.',
        };
      }
    } catch (error: any) {
      console.log('useAuth: Verify OTP error:', error);
      const errorMessage = error?.message || 'Failed to verify code. Please try again.';
      return { 
        success: false, 
        error: errorMessage, 
        message: errorMessage,
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
      if (updates.skillLevel !== undefined) dbUpdates.skill_level = updates.skillLevel;
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
    sendOtp,
    verifyOtp,
    signOut,
    updateUserProfile,
    uploadProfilePicture,
    needsConsentUpdate,
    acceptConsent,
    currentTermsVersion: CURRENT_TERMS_VERSION,
  };
};
