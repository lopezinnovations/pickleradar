
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { LegalFooter } from '@/components/LegalFooter';
import { supabase } from '@/app/integrations/supabase/client';

export default function AuthScreen() {
  const router = useRouter();
  const { signUp, signIn, resetPassword, isConfigured } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Clear any existing sessions on mount to ensure clean state
  useEffect(() => {
    const clearOldSessions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user.phone) {
          console.log('AuthScreen: Clearing old phone session');
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.log('AuthScreen: Error clearing old sessions:', error);
      }
    };
    clearOldSessions();
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleSignUp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (!consentAccepted) {
      Alert.alert('Consent Required', 'You must agree to the Privacy Policy and Terms of Service to continue.');
      return;
    }

    if (!isConfigured) {
      Alert.alert(
        'Supabase Required',
        'Please enable Supabase by pressing the Supabase button in Natively and connecting to a project to use authentication features.'
      );
      return;
    }

    setLoading(true);

    try {
      console.log('AuthScreen: Signing up with email:', email);
      
      const result = await signUp(email, password, consentAccepted);
      
      if (result.success) {
        // Clear form
        setEmail('');
        setPassword('');
        setConsentAccepted(false);
        // Redirect to home immediately
        router.replace('/(tabs)/(home)/');
      } else {
        console.log('AuthScreen: Sign up failed:', result.message);
        Alert.alert('Sign Up Failed', result.message || 'Failed to create account. Please try again.');
      }
    } catch (error: any) {
      console.log('AuthScreen: Sign up error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    if (!isConfigured) {
      Alert.alert(
        'Supabase Required',
        'Please enable Supabase by pressing the Supabase button in Natively and connecting to a project to use authentication features.'
      );
      return;
    }

    setLoading(true);

    try {
      console.log('AuthScreen: Signing in with email:', email);
      
      const result = await signIn(email, password);
      
      if (result.success) {
        // Clear form
        setEmail('');
        setPassword('');
        // Redirect to home immediately without showing success message
        router.replace('/(tabs)/(home)/');
      } else {
        console.log('AuthScreen: Sign in failed:', result.message);
        // Show generic error message
        Alert.alert('Sign In Failed', 'Incorrect email or password. Please try again.');
      }
    } catch (error: any) {
      console.log('AuthScreen: Sign in error:', error);
      Alert.alert('Sign In Failed', 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!isConfigured) {
      Alert.alert(
        'Supabase Required',
        'Please enable Supabase by pressing the Supabase button in Natively and connecting to a project to use authentication features.'
      );
      return;
    }

    setLoading(true);

    try {
      console.log('AuthScreen: Requesting password reset for:', email);
      
      const result = await resetPassword(email);
      
      if (result.success) {
        Alert.alert(
          'Check Your Email',
          result.message || 'If an account exists with this email, you will receive password reset instructions shortly.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsForgotPassword(false);
                setEmail('');
              },
            },
          ]
        );
      } else {
        console.log('AuthScreen: Password reset failed:', result.message);
        
        // Check if it's an SMTP configuration error
        if (result.error === 'SMTP_NOT_CONFIGURED') {
          Alert.alert(
            'Email Service Unavailable',
            'The email service is currently not configured. Please contact support for assistance with password recovery.\n\nTechnical details: SMTP authentication is not properly set up on the server.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setIsForgotPassword(false);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Error',
            result.message || 'Unable to send password reset email. Please try again later.',
            [
              {
                text: 'OK',
              },
            ]
          );
        }
      }
    } catch (error: any) {
      console.log('AuthScreen: Password reset error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    setEmail('');
    setPassword('');
    setConsentAccepted(false);
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setIsSignUp(false);
    setPassword('');
    setConsentAccepted(false);
  };

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <IconSymbol 
            ios_icon_name="chevron.left" 
            android_material_icon_name="chevron_left" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Image 
            source={require('@/assets/images/d00ee021-be7a-42f9-a115-ea45cb937f7f.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[commonStyles.title, { color: colors.primary }]}>
            {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={commonStyles.textSecondary}>
            {isForgotPassword 
              ? 'Enter your email to receive reset instructions' 
              : isSignUp 
                ? 'Sign up to start finding pickleball courts' 
                : 'Sign in to continue'}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={commonStyles.input}
            placeholder="your@email.com"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {!isForgotPassword && (
            <>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[commonStyles.input, styles.passwordInput]}
                  placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <IconSymbol
                    ios_icon_name={showPassword ? 'eye.slash.fill' : 'eye.fill'}
                    android_material_icon_name={showPassword ? 'visibility_off' : 'visibility'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {isSignUp && (
            <View style={styles.consentContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setConsentAccepted(!consentAccepted)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
                  {consentAccepted && (
                    <IconSymbol 
                      ios_icon_name="checkmark" 
                      android_material_icon_name="check" 
                      size={16} 
                      color={colors.card} 
                    />
                  )}
                </View>
                <View style={styles.consentTextContainer}>
                  <Text style={styles.consentText}>
                    I agree to the{' '}
                    <Text 
                      style={styles.consentLink}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push('/legal/privacy-policy');
                      }}
                    >
                      Privacy Policy
                    </Text>
                    {' '}and{' '}
                    <Text 
                      style={styles.consentLink}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push('/legal/terms-of-service');
                      }}
                    >
                      Terms of Service
                    </Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[
              buttonStyles.primary, 
              { marginTop: 8 }, 
              (loading || (isSignUp && !consentAccepted)) && { opacity: 0.6 }
            ]}
            onPress={isForgotPassword ? handleForgotPassword : isSignUp ? handleSignUp : handleSignIn}
            disabled={loading || (isSignUp && !consentAccepted)}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={buttonStyles.text}>
                {isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {!isForgotPassword && !isSignUp && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={toggleForgotPassword}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}

          {!isForgotPassword && (
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={toggleMode}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.toggleLink}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
          )}

          {isForgotPassword && (
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={toggleForgotPassword}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                Remember your password?{' '}
                <Text style={styles.toggleLink}>
                  Sign In
                </Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isConfigured && (
          <View style={[commonStyles.card, { backgroundColor: colors.accent, marginTop: 20 }]}>
            <View style={styles.warningHeader}>
              <IconSymbol 
                ios_icon_name="exclamationmark.triangle.fill" 
                android_material_icon_name="warning" 
                size={24} 
                color={colors.card} 
              />
              <Text style={[commonStyles.subtitle, { marginLeft: 12, color: colors.card }]}>
                Supabase Required
              </Text>
            </View>
            <Text style={[commonStyles.textSecondary, { marginTop: 12, color: colors.card }]}>
              To use authentication and all features, please enable Supabase by pressing the Supabase button 
              in Natively and connecting to a project.
            </Text>
          </View>
        )}

        <LegalFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 8,
  },
  consentContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentTextContainer: {
    flex: 1,
  },
  consentText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  consentLink: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotPasswordButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  toggleLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
