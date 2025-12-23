
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
          fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setLoading(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('useAuth: Auth state changed:', _event, session ? 'User logged in' : 'User logged out');
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email || '');
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

  const signUp = async (email: string, password: string, consentAccepted: boolean = false) => {
    try {
      console.log('useAuth: Attempting to sign up user:', email);
      
      if (!consentAccepted) {
        return {
          success: false,
          error: 'Consent required',
          message: 'You must accept the Privacy Policy and Terms of Service to create an account.',
        };
      }

      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://natively.dev/email-confirmed',
        },
      });

      if (error) {
        console.log('useAuth: Sign up error:', error);
        
        // Handle specific error cases
        if (error.message.toLowerCase().includes('user already registered')) {
          return {
            success: false,
            error: error.message,
            message: 'An account with this email already exists. Please sign in instead.',
          };
        }
        
        throw error;
      }

      console.log('useAuth: Sign up response:', data);

      // Check if we have both user and session (email verification disabled)
      if (data.user && data.session) {
        console.log('useAuth: User signed up and automatically logged in (email verification disabled)');
        
        // Create user profile with consent
        const now = new Date().toISOString();
        
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email || email,
              phone: null,
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
          // Ignore duplicate key errors (user profile already exists)
          if (profileError.code !== '23505') {
            throw profileError;
          }
        }

        console.log('useAuth: User profile created successfully with consent');
        
        // The auth state change listener will handle setting the user
        return { 
          success: true, 
          error: null, 
          message: 'Account created successfully. Welcome to PickleRadar.',
        };
      } else if (data.user && !data.session) {
        // Email verification is enabled - user needs to confirm email
        console.log('useAuth: User created but email verification required');
        return {
          success: false,
          error: 'Email verification required',
          message: 'Please check your email and click the verification link to complete signup. If you don\'t see the email, check your spam folder.',
          requiresEmailVerification: true,
        };
      } else {
        console.log('useAuth: Unexpected signup response - no user returned');
        return {
          success: false,
          error: 'Signup failed',
          message: 'Failed to create account. Please try again.',
        };
      }
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
      console.log('useAuth: Attempting to sign in user:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('useAuth: Sign in response:', { 
        hasData: !!data, 
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: error?.message 
      });

      if (error) {
        console.log('useAuth: Sign in error:', error);
        
        // Provide clear error messages for common issues
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          return { 
            success: false, 
            error: error.message, 
            message: 'Invalid email or password. Please check your credentials and try again.',
          };
        }
        
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return {
            success: false,
            error: error.message,
            message: 'Please verify your email address before signing in. Check your inbox for the verification link.',
            requiresEmailVerification: true,
          };
        }
        
        throw error;
      }

      if (!data.session) {
        console.log('useAuth: Sign in succeeded but no session returned');
        return {
          success: false,
          error: 'No session',
          message: 'Sign in failed. Please try again.',
        };
      }

      console.log('useAuth: Sign in successful');
      // The auth state change listener will handle setting the user
      return { 
        success: true, 
        error: null, 
        message: 'Successfully signed in!',
      };
    } catch (error: any) {
      console.log('useAuth: Sign in error:', error);
      const errorMessage = error?.message || 'Failed to sign in. Please try again.';
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
    signUp,
    signIn,
    signOut,
    updateUserProfile,
    uploadProfilePicture,
    needsConsentUpdate,
    acceptConsent,
    currentTermsVersion: CURRENT_TERMS_VERSION,
  };
};
