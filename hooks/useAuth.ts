
import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { User } from '@/types';

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
                email: email,
                privacy_opt_in: false,
                notifications_enabled: false,
                location_enabled: false,
                location_permission_requested: false,
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
          });
        } else {
          throw error;
        }
      } else {
        console.log('useAuth: User profile fetched successfully');
        setUser({
          id: data.id,
          email: data.email,
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
        });
      }
    } catch (error) {
      console.log('useAuth: Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('useAuth: Attempting to sign up user:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://natively.dev/email-confirmed'
        }
      });

      if (error) {
        console.log('useAuth: Sign up error:', error);
        throw error;
      }

      console.log('useAuth: Sign up response:', data);

      if (data.user) {
        console.log('useAuth: Creating user profile...');
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email || email,
              privacy_opt_in: false,
              notifications_enabled: false,
              location_enabled: false,
              location_permission_requested: false,
            },
          ]);

        if (profileError) {
          console.log('useAuth: Profile creation error:', profileError);
          if (profileError.code !== '23505') {
            throw profileError;
          }
        }

        console.log('useAuth: User profile created successfully');

        if (!data.session) {
          console.log('useAuth: Email verification required');
          return { 
            success: true, 
            error: null, 
            message: 'Account created successfully! Please check your email to verify your account before signing in.',
            requiresEmailVerification: true
          };
        }
      }

      console.log('useAuth: Sign up successful');
      return { 
        success: true, 
        error: null, 
        message: 'Account created successfully!',
        requiresEmailVerification: false
      };
    } catch (error: any) {
      console.log('useAuth: Sign up error:', error);
      const errorMessage = error?.message || 'Failed to create account. Please try again.';
      return { 
        success: false, 
        error: errorMessage, 
        message: errorMessage,
        requiresEmailVerification: false
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

      console.log('useAuth: Sign in response:', { data, error });

      if (error) {
        console.log('useAuth: Sign in error:', error);
        
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return { 
            success: false, 
            error: error.message, 
            message: 'Please verify your email address before signing in. Check your inbox for the verification link.',
            requiresEmailVerification: true
          };
        }
        
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          return { 
            success: false, 
            error: error.message, 
            message: 'Invalid email or password. Please check your credentials and try again.',
            requiresEmailVerification: false
          };
        }
        
        throw error;
      }

      console.log('useAuth: Sign in successful');
      return { 
        success: true, 
        error: null, 
        message: 'Successfully signed in!',
        requiresEmailVerification: false
      };
    } catch (error: any) {
      console.log('useAuth: Sign in error:', error);
      const errorMessage = error?.message || 'Failed to sign in. Please try again.';
      return { 
        success: false, 
        error: errorMessage, 
        message: errorMessage,
        requiresEmailVerification: false
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
      
      // Fetch the image as a blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create a unique filename
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/profile.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true, // Replace existing file
        });

      if (error) {
        console.log('useAuth: Upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      console.log('useAuth: Profile picture uploaded successfully:', publicUrl);

      // Update user profile with new URL
      await updateUserProfile({ profilePictureUrl: publicUrl });

      return { success: true, url: publicUrl };
    } catch (error: any) {
      console.log('useAuth: Upload profile picture error:', error);
      return { success: false, error: error.message || 'Failed to upload profile picture' };
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
  };
};
