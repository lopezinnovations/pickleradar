
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { User } from '@/types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    console.log('useAuth: Initializing...');
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);
    console.log('useAuth: Supabase configured:', configured);
    
    if (!configured) {
      console.log('useAuth: Supabase not configured, skipping auth');
      setLoading(false);
      return;
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log('useAuth: Error getting session:', error);
      } else {
        console.log('useAuth: Current session:', session ? 'Active' : 'None');
        if (session?.user) {
          fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setLoading(false);
        }
      }
    });

    // Listen for auth changes
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
        
        // If user profile doesn't exist, create it
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
        // Create user profile
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
            },
          ]);

        if (profileError) {
          console.log('useAuth: Profile creation error:', profileError);
          // Don't throw error if profile already exists
          if (profileError.code !== '23505') {
            throw profileError;
          }
        }

        console.log('useAuth: User profile created successfully');

        // Check if email confirmation is required
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
        
        // Check for specific error types
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

  return {
    user,
    loading,
    isConfigured,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
  };
};
