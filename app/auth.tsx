
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { IconSymbol } from '@/components/IconSymbol';
import { LegalFooter } from '@/components/LegalFooter';

export default function AuthScreen() {
  const router = useRouter();
  const { signUp, signIn } = useAuth();
  const { successMessage } = useLocalSearchParams<{ successMessage?: string }>();
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pickleballerNickname, setPickleballerNickname] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [duprRating, setDuprRating] = useState('');
  const [duprError, setDuprError] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  const emailInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (successMessage) {
      setShowSuccessMessage(true);
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const validateDuprRating = (value: string): boolean => {
    if (!value.trim()) {
      setDuprError('');
      return true;
    }

    const duprValue = parseFloat(value);
    if (isNaN(duprValue)) {
      setDuprError('DUPR rating must be a number');
      return false;
    }

    if (duprValue < 1 || duprValue > 7) {
      setDuprError('DUPR rating must be between 1.0 and 7.0');
      return false;
    }

    setDuprError('');
    return true;
  };

  const handleDuprChange = (value: string) => {
    setDuprRating(value);
    validateDuprRating(value);
  };

  const handleSignUp = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (!firstName.trim()) {
      Alert.alert('Missing Information', 'Please enter your first name');
      return;
    }

    if (!lastName.trim()) {
      Alert.alert('Missing Information', 'Please enter your last name');
      return;
    }

    if (!consentAccepted) {
      Alert.alert(
        'Consent Required',
        'Please accept the Privacy Policy and Terms of Service to continue'
      );
      return;
    }

    const duprValue = duprRating.trim() ? parseFloat(duprRating) : undefined;
    if (duprValue !== undefined && !validateDuprRating(duprRating)) {
      Alert.alert('Invalid DUPR Rating', 'Please enter a valid DUPR rating between 1.0 and 7.0');
      return;
    }

    setLoading(true);
    console.log('AuthScreen: Attempting sign up with email:', email);
    
    const result = await signUp(
      email, 
      password, 
      consentAccepted,
      firstName.trim(),
      lastName.trim(),
      pickleballerNickname.trim() || undefined,
      experienceLevel,
      duprValue
    );
    
    setLoading(false);

    if (result.success) {
      console.log('AuthScreen: Sign up successful');
      Alert.alert(
        'Success!',
        result.message || 'Account created successfully! You can now sign in.',
        [
          {
            text: 'OK',
            onPress: () => {
              setMode('signin');
              setPassword('');
              setConfirmPassword('');
            },
          },
        ]
      );
    } else {
      console.log('AuthScreen: Sign up failed:', result.error);
      Alert.alert('Sign Up Failed', result.message || result.error || 'Failed to create account. Please try again.');
    }
  };

  const handleSignIn = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    console.log('AuthScreen: Attempting sign in with email:', email);
    
    const result = await signIn(email, password);
    
    setLoading(false);

    if (result.success) {
      console.log('AuthScreen: Sign in successful, navigating to home');
      router.replace('/(tabs)/(home)');
    } else {
      console.log('AuthScreen: Sign in failed:', result.error);
      Alert.alert('Sign In Failed', result.message || result.error || 'Incorrect email or password. Please try again.');
    }
  };

  const handleSendCode = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    console.log('AuthScreen: Sending password reset email to:', email);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'pickleradar://reset-password',
      });

      if (error) {
        console.log('AuthScreen: Password reset error:', error);
        
        if (error.message.includes('Email rate limit exceeded')) {
          Alert.alert(
            'Too Many Requests',
            'Please wait a few minutes before requesting another password reset email.'
          );
        } else if (error.message.includes('Error sending email')) {
          Alert.alert(
            'Email Service Unavailable',
            'Unable to send password reset email at this time. Please try again later or contact support.'
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to send password reset email');
        }
      } else {
        console.log('AuthScreen: Password reset email sent successfully');
        setResetEmailSent(true);
        Alert.alert(
          'Check Your Email',
          'We have sent you a password reset link. Please check your email and follow the instructions.',
          [
            {
              text: 'OK',
              onPress: () => {
                setForgotPasswordMode(false);
                setResetEmailSent(false);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.log('AuthScreen: Password reset exception:', error);
      Alert.alert('Error', error.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    console.log('AuthScreen: Verify code not implemented yet');
    Alert.alert('Not Implemented', 'Code verification will be implemented soon');
  };

  const handleBack = () => {
    console.log('AuthScreen: User tapped back button');
    if (forgotPasswordMode) {
      setForgotPasswordMode(false);
      setResetEmailSent(false);
    } else {
      router.back();
    }
  };

  const toggleMode = () => {
    console.log('AuthScreen: Toggling mode from', mode, 'to', mode === 'signin' ? 'signup' : 'signin');
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setPickleballerNickname('');
    setExperienceLevel('Beginner');
    setDuprRating('');
    setDuprError('');
    setConsentAccepted(false);
  };

  const toggleForgotPassword = () => {
    console.log('AuthScreen: Toggling forgot password mode');
    setForgotPasswordMode(!forgotPasswordMode);
    setResetEmailSent(false);
  };

  const beginnerLabel = 'Beginner';
  const intermediateLabel = 'Intermediate';
  const advancedLabel = 'Advanced';

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <IconSymbol 
            ios_icon_name="chevron.left" 
            android_material_icon_name="arrow-back" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>PickleRadar</Text>
          <Text style={styles.tagline}>Find Your Game</Text>
        </View>

        {showSuccessMessage && successMessage && (
          <View style={styles.successBanner}>
            <IconSymbol 
              ios_icon_name="checkmark.circle.fill" 
              android_material_icon_name="check-circle" 
              size={24} 
              color={colors.success} 
            />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {forgotPasswordMode ? (
          <View style={styles.formContainer}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={[commonStyles.textSecondary, { marginBottom: 24, textAlign: 'center' }]}>
              Enter your email address and we&apos;ll send you a link to reset your password
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailInputRef}
              style={commonStyles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TouchableOpacity
              style={[buttonStyles.primary, { marginTop: 24 }]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={buttonStyles.text}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[buttonStyles.secondary, { marginTop: 12 }]}
              onPress={toggleForgotPassword}
              disabled={loading}
            >
              <Text style={[buttonStyles.text, { color: colors.text }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={[commonStyles.textSecondary, { marginBottom: 24, textAlign: 'center' }]}>
              {mode === 'signin' 
                ? 'Sign in to find pickleball courts and connect with players' 
                : 'Join PickleRadar to discover courts and meet players'}
            </Text>

            {mode === 'signup' && (
              <>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="Enter your first name"
                  placeholderTextColor={colors.textSecondary}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="Enter your last name"
                  placeholderTextColor={colors.textSecondary}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Text style={styles.label}>Pickleballer Nickname (Optional)</Text>
                <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
                  Your fun pickleball nickname
                </Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="e.g., Dink Master, Ace, Smash King"
                  placeholderTextColor={colors.textSecondary}
                  value={pickleballerNickname}
                  onChangeText={setPickleballerNickname}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Text style={styles.label}>Experience Level</Text>
                <View style={styles.skillLevelContainer}>
                  <TouchableOpacity
                    style={[
                      styles.skillLevelButton,
                      experienceLevel === 'Beginner' && styles.skillLevelButtonActive,
                    ]}
                    onPress={() => setExperienceLevel('Beginner')}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.skillLevelText,
                        experienceLevel === 'Beginner' && styles.skillLevelTextActive,
                      ]}
                    >
                      {beginnerLabel}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.skillLevelButton,
                      experienceLevel === 'Intermediate' && styles.skillLevelButtonActive,
                    ]}
                    onPress={() => setExperienceLevel('Intermediate')}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.skillLevelText,
                        experienceLevel === 'Intermediate' && styles.skillLevelTextActive,
                      ]}
                    >
                      {intermediateLabel}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.skillLevelButton,
                      experienceLevel === 'Advanced' && styles.skillLevelButtonActive,
                    ]}
                    onPress={() => setExperienceLevel('Advanced')}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.skillLevelText,
                        experienceLevel === 'Advanced' && styles.skillLevelTextActive,
                      ]}
                    >
                      {advancedLabel}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>DUPR Rating (Optional)</Text>
                <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
                  Enter your DUPR rating (1.0 - 7.0)
                </Text>
                <TextInput
                  style={[commonStyles.input, duprError ? styles.inputError : null]}
                  placeholder="e.g., 3.5"
                  placeholderTextColor={colors.textSecondary}
                  value={duprRating}
                  onChangeText={handleDuprChange}
                  keyboardType="decimal-pad"
                  maxLength={4}
                  editable={!loading}
                />
                {duprError && (
                  <Text style={styles.errorText}>{duprError}</Text>
                )}
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={mode === 'signin' ? emailInputRef : undefined}
              style={commonStyles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <TouchableOpacity
                  style={styles.consentContainer}
                  onPress={() => setConsentAccepted(!consentAccepted)}
                  disabled={loading}
                >
                  <View style={[styles.checkbox, consentAccepted && styles.checkboxActive]}>
                    {consentAccepted && (
                      <IconSymbol 
                        ios_icon_name="checkmark" 
                        android_material_icon_name="check" 
                        size={16} 
                        color={colors.card} 
                      />
                    )}
                  </View>
                  <Text style={styles.consentText}>
                    I accept the{' '}
                    <Text
                      style={styles.linkText}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push('/legal/privacy-policy');
                      }}
                    >
                      Privacy Policy
                    </Text>
                    {' '}and{' '}
                    <Text
                      style={styles.linkText}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push('/legal/terms-of-service');
                      }}
                    >
                      Terms of Service
                    </Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[buttonStyles.primary, { marginTop: 24 }]}
              onPress={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={buttonStyles.text}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {mode === 'signin' && (
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={toggleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[buttonStyles.secondary, { marginTop: 16 }]}
              onPress={toggleMode}
              disabled={loading}
            >
              <Text style={[buttonStyles.text, { color: colors.text }]}>
                {mode === 'signin' 
                  ? "Don't have an account? Sign Up" 
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
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
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  successText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  skillLevelContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  skillLevelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  skillLevelButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  skillLevelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  skillLevelTextActive: {
    color: colors.card,
  },
  inputError: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 4,
  },
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: 16,
  },
});
