
import { useState, useEffect, useRef, useCallback } from 'react';
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

  const fetchUserProfile = useCallback(async (userId: string, email: string) => {
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
        console.log('Error registering push token:', err);
      });
    } catch (error) {
      console.log('useAuth: Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('useAuth: Auth state changed:', event, session ? 'User logged in' : 'User logged out');
      
      // Handle magic link authentication
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('useAuth: User signed in via:', session.user.app_metadata?.provider || 'unknown');
        
        if (session.user.email) {
          await fetchUserProfile(session.user.id, session.user.email);
        } else {
          console.log('useAuth: Invalid session without email');
          setUser(null);
          setLoading(false);
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('useAuth: Token refreshed for user:', session.user.email);
        
        if (session.user.email) {
          await fetchUserProfile(session.user.id, session.user.email);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('useAuth: User signed out');
        setUser(null);
        setLoading(false);
      } else if (session?.user) {
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
  }, [fetchUserProfile]);

  const refetchUser = useCallback(async () => {
    if (!user) {
      console.log('useAuth: Cannot refetch - no user');
      return;
    }
    console.log('useAuth: Refetching user profile');
    await fetchUserProfile(user.id, user.email || '');
  }, [user, fetchUserProfile]);

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

      // Validate DUPR rating if provided
      if (duprRating !== undefined && (duprRating < 1 || duprRating > 7)) {
        return {
          success: false,
          error: 'Invalid DUPR rating',
          message: 'DUPR rating must be between 1.0 and 7.0',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
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
              .upsert([
                {
                  id: data.user.id,
                  email: data.user.email || email,
                  phone: null,
                  first_name: firstName || null,
                  last_name: lastName || null,
                  pickleballer_nickname: pickleballerNickname || null,
                  experience_level: experienceLevel || null,
                  dupr_rating: duprRating || null,
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
                onConflict: 'id'
              });

            if (profileError) {
              console.log('useAuth: Profile creation error:', profileError);
            } else {
              console.log('useAuth: User profile created/updated successfully');
            }

            // Return success - user can proceed without email verification
            return {
              success: true,
              error: null,
              message: 'Account created successfully! You can now sign in.',
              email: email,
              requiresEmailConfirmation: false,
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
          .upsert([
            {
              id: data.user.id,
              email: data.user.email || email,
              phone: null,
              first_name: firstName || null,
              last_name: lastName || null,
              pickleballer_nickname: pickleballerNickname || null,
              experience_level: experienceLevel || null,
              dupr_rating: duprRating || null,
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
            onConflict: 'id'
          });

        if (profileError) {
          console.log('useAuth: Profile creation error:', profileError);
          // Don't throw error, just log it - user is still created
        } else {
          console.log('useAuth: User profile created/updated successfully with consent and profile fields');
        }
      }
      
      // Return success - no email confirmation required
      return { 
        success: true, 
        error: null, 
        message: 'Account created successfully! You can now sign in.',
        email: email,
        requiresEmailConfirmation: false,
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

  const signInWithOtp = async (email: string) => {
    try {
      console.log('useAuth: Sending magic link to:', email);
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'natively://magic-link',
        },
      });

      if (error) {
        console.log('useAuth: Magic link error:', error);
        console.log('useAuth: Error details:', JSON.stringify(error, null, 2));
        
        // Check for SMTP configuration errors
        if (error.message.includes('Error sending') || 
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

      console.log('useAuth: Magic link sent successfully');
      return { 
        success: true, 
        error: null, 
        message: 'Check your email! We sent you a magic link to sign in.',
      };
    } catch (error: any) {
      console.log('useAuth: Magic link error:', error);
      
      return { 
        success: false, 
        error: error?.message || 'Failed to send magic link', 
        message: 'Unable to send magic link. Please try again later or contact support.',
      };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('useAuth: Requesting password reset for:', email);
      
      // Use the natively://magic-link deep link for password reset as well
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'natively://magic-link',
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

  const updateUserProfile = useCallback(async (updates: Partial<User>) => {
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
      if (updates.duprRating !== undefined) {
        // Validate DUPR rating before updating
        if (updates.duprRating !== null && (updates.duprRating < 1 || updates.duprRating > 7)) {
          console.log('useAuth: Invalid DUPR rating:', updates.duprRating);
          throw new Error('DUPR rating must be between 1.0 and 7.0');
        }
        dbUpdates.dupr_rating = updates.duprRating;
      }
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
      throw error;
    }
  }, [user]);

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

  const deleteAccount = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      console.log('useAuth: Deleting account for user:', user.id);
      
      // Delete user data from database
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (deleteError) {
        console.log('useAuth: Error deleting user data:', deleteError);
        throw deleteError;
      }

      // Delete auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

      if (authError) {
        console.log('useAuth: Error deleting auth user:', authError);
        throw authError;
      }

      // Sign out
      await signOut();

      console.log('useAuth: Account deleted successfully');
      return { success: true };
    } catch (error: any) {
      console.log('useAuth: Delete account error:', error);
      return { success: false, error: error.message || 'Failed to delete account' };
    }
  };

  const needsConsentUpdate = useCallback((): boolean => {
    if (!user) return false;
    if (!user.termsAccepted || !user.privacyAccepted) return true;
    if (user.acceptedVersion !== CURRENT_TERMS_VERSION) return true;
    return false;
  }, [user]);

  const acceptConsent = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
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
  }, [user, updateUserProfile]);

  return {
    user,
    loading: loading,
    authLoading: loading,
    isConfigured,
    signUp,
    signIn,
    signInWithOtp,
    signOut,
    resetPassword,
    updatePassword,
    updateUserProfile,
    uploadProfilePicture,
    deleteAccount,
    needsConsentUpdate,
    acceptConsent,
    refetchUser,
    currentTermsVersion: CURRENT_TERMS_VERSION,
  };
};
