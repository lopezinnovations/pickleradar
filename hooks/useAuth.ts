
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { User } from '@/types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());
    
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Current session:', session ? 'Active' : 'None');
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session ? 'User logged in' : 'User logged out');
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Error fetching user profile:', error);
        throw error;
      }
      
      setUser({
        id: data.id,
        email: data.email,
        skillLevel: data.skill_level as 'Beginner' | 'Intermediate' | 'Advanced' | undefined,
        privacyOptIn: data.privacy_opt_in || false,
        notificationsEnabled: data.notifications_enabled || false,
        locationEnabled: data.location_enabled || false,
      });
    } catch (error) {
      console.log('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign up user:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://natively.dev/email-confirmed'
        }
      });

      if (error) {
        console.log('Sign up error:', error);
        throw error;
      }

      console.log('Sign up response:', data);

      if (data.user) {
        // Create user profile
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
          console.log('Profile creation error:', profileError);
          throw profileError;
        }

        // Check if email confirmation is required
        if (!data.session) {
          return { 
            success: true, 
            error: null, 
            message: 'Account created successfully! Please check your email to verify your account before signing in.',
            requiresEmailVerification: true
          };
        }
      }

      return { 
        success: true, 
        error: null, 
        message: 'Account created successfully!',
        requiresEmailVerification: false
      };
    } catch (error: any) {
      console.log('Sign up error:', error);
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
      console.log('Attempting to sign in user:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Sign in response:', { data, error });

      if (error) {
        console.log('Sign in error:', error);
        
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

      console.log('Sign in successful');
      return { 
        success: true, 
        error: null, 
        message: 'Successfully signed in!',
        requiresEmailVerification: false
      };
    } catch (error: any) {
      console.log('Sign in error:', error);
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
      console.log('Signing out user');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      console.log('Sign out successful');
    } catch (error) {
      console.log('Sign out error:', error);
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      console.log('Updating user profile:', updates);
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
      console.log('Profile update successful');
    } catch (error) {
      console.log('Update profile error:', error);
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
