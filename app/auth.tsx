
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { LegalFooter } from '@/components/LegalFooter';
import { supabase } from '@/app/integrations/supabase/client';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const prefilledEmail = params.email as string;
  const successMessage = params.message as string;
  const { signUp, signIn, isConfigured } = useAuth();
  
  const [email, setEmail] = useState(prefilledEmail || '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pickleballerNickname, setPickleballerNickname] = useState('');
  const [duprRating, setDuprRating] = useState('');
  const [duprError, setDuprError] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Refs to track loading states for timeout checks
  const isVerificationSuccessfulRef = useRef(false);
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resendIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Show success message if present
  useEffect(() => {
    if (successMessage) {
      Alert.alert('Success', successMessage);
    }
  }, [successMessage]);

  // Clear any existing sessions on mount to ensure clean state
  useEffect(() => {
    const clearOldSessions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user.phone) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.log('Error clearing old sessions:', error);
      }
    };
    clearOldSessions();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
      }
    };
  }, []);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const validateDuprRating = (value: string) => {
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

    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return;
    }

    if (!lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return;
    }

    if (!pickleballerNickname.trim()) {
      Alert.alert('Error', 'Please enter your pickleballer nickname');
      return;
    }

    if (duprRating.trim()) {
      const duprValue = parseFloat(duprRating);
      if (isNaN(duprValue) || duprValue < 1 || duprValue > 7) {
        Alert.alert('Error', 'DUPR rating must be between 1.0 and 7.0');
        return;
      }
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
      const result = await signUp(
        email, 
        password, 
        consentAccepted,
        firstName,
        lastName,
        pickleballerNickname,
        experienceLevel,
        duprRating.trim() ? parseFloat(duprRating) : undefined
      );
      
      if (result.success) {
        // Clear form
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setPickleballerNickname('');
        setDuprRating('');
        setDuprError('');
        setExperienceLevel('Beginner');
        setConsentAccepted(false);
        
        // Show success message and redirect to sign in
        Alert.alert(
          'Account Created!',
          'Your account has been created successfully. You can now sign in.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsSignUp(false);
              },
            },
          ]
        );
      } else {
        Alert.alert('Sign Up Failed', result.message || 'Failed to create account. Please try again.');
      }
    } catch (error: any) {
      console.log('Sign up error:', error);
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
      const result = await signIn(email, password);
      
      if (result.success) {
        console.log('User signed in successfully');
        // Clear form
        setEmail('');
        setPassword('');
        // Show success message before redirect
        Alert.alert(
          'Welcome Back!',
          'You have successfully signed in.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(tabs)/(home)/');
              },
            },
          ]
        );
      } else {
        // Show generic error message
        Alert.alert('Sign In Failed', 'Incorrect email or password. Please try again.');
      }
    } catch (error: any) {
      console.log('Sign in error:', error);
      Alert.alert('Sign In Failed', 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    console.log('User tapped Send Code button for password reset');

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

    setIsSendingCode(true);
    setResendDisabled(true);
    setResendCountdown(30);

    // Start countdown timer
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
    }
    
    resendIntervalRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (resendIntervalRef.current) {
            clearInterval(resendIntervalRef.current);
          }
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      console.log('Sending OTP to email:', email);
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: { 
          shouldCreateUser: false
        }
      });

      if (error) {
        console.log('Error sending OTP:', error);
        
        // Clear countdown on error
        if (resendIntervalRef.current) {
          clearInterval(resendIntervalRef.current);
        }
        setResendDisabled(false);
        setResendCountdown(0);
        
        Alert.alert(
          'Error',
          error.message || 'Unable to send reset code. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('OTP sent successfully');
      setShowCodeInput(true);
      Alert.alert(
        'Check Your Email',
        'We sent a six-digit code to your email. Enter it below to reset your password.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.log('Unexpected error sending OTP:', error);
      
      // Clear countdown on error
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
      }
      setResendDisabled(false);
      setResendCountdown(0);
      
      Alert.alert(
        'Error',
        'Unable to send reset code. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    console.log('User tapped Verify Code button');

    if (!loginCode.trim() || loginCode.length !== 6) {
      Alert.alert('Error', 'Please enter the six-digit code from your email');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    isVerificationSuccessfulRef.current = false;

    // Set timeout for verification (15 seconds)
    verificationTimeoutRef.current = setTimeout(() => {
      if (!isVerificationSuccessfulRef.current) {
        console.log('OTP verification timeout exceeded');
        setVerificationError('This is taking longer than expected. Please try again.');
        setIsVerifying(false);
      }
    }, 15000);

    try {
      console.log('Verifying OTP code');
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: loginCode,
        type: 'email'
      });

      if (error) {
        console.log('OTP verification error:', error);
        
        // Check for specific error types
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          setVerificationError('Too many attempts. Please wait 30-60 seconds before retrying.');
        } else if (errorMessage.includes('invalid') || errorMessage.includes('token')) {
          setVerificationError('Invalid code. Please check your email and try again.');
        } else if (errorMessage.includes('expired')) {
          setVerificationError('The code has expired. Please request a new one.');
        } else {
          setVerificationError(error.message || 'Failed to verify code. Please try again.');
        }
        isVerificationSuccessfulRef.current = false;
        return;
      }

      if (!data.session && !data.user) {
        console.log('No session or user after OTP verification');
        setVerificationError('Verification successful, but no session found. Please try again.');
        isVerificationSuccessfulRef.current = false;
        return;
      }

      console.log('OTP verified successfully, routing to Reset Password screen');
      isVerificationSuccessfulRef.current = true;

      // Clear code input
      setLoginCode('');
      setVerificationError(null);

      // Route directly to Reset Password screen (no modal)
      router.replace({
        pathname: '/reset-password',
        params: { email }
      });
    } catch (error: any) {
      console.log('Unexpected error during OTP verification:', error);
      setVerificationError(error.message || 'An unexpected error occurred during verification.');
      isVerificationSuccessfulRef.current = false;
    } finally {
      // Clear timeout
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    setShowCodeInput(false);
    setEmail('');
    setPassword('');
    setLoginCode('');
    setFirstName('');
    setLastName('');
    setPickleballerNickname('');
    setDuprRating('');
    setDuprError('');
    setExperienceLevel('Beginner');
    setConsentAccepted(false);
    setVerificationError(null);
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setIsSignUp(false);
    setShowCodeInput(false);
    setPassword('');
    setLoginCode('');
    setConsentAccepted(false);
    setVerificationError(null);
  };

  const experienceLevels: ('Beginner' | 'Intermediate' | 'Advanced')[] = ['Beginner', 'Intermediate', 'Advanced'];

  // Compute button text and disabled state
  const verifyButtonText = isVerifying ? 'Verifying...' : 'Verify Code';
  const verifyButtonDisabled = isVerifying || !loginCode || loginCode.length !== 6;
  
  const resendButtonText = resendDisabled && resendCountdown > 0 
    ? `Resend (${resendCountdown}s)` 
    : 'Resend Code';

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
            android_material_icon_name="chevron-left" 
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
            {isForgotPassword ? 'Forgot Password?' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={commonStyles.textSecondary}>
            {isForgotPassword 
              ? showCodeInput 
                ? 'Enter the six-digit code from your email'
                : 'Enter your email to receive a reset code' 
              : isSignUp 
                ? 'Sign up to start finding pickleball courts' 
                : 'Sign in to continue'}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignUp && (
            <React.Fragment>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="John"
                placeholderTextColor={colors.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="Doe"
                placeholderTextColor={colors.textSecondary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />

              <Text style={styles.label}>Pickleballer Nickname</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="The Dink Master"
                placeholderTextColor={colors.textSecondary}
                value={pickleballerNickname}
                onChangeText={setPickleballerNickname}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />

              <Text style={styles.label}>DUPR Rating (Optional)</Text>
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
              {duprError ? (
                <Text style={styles.errorText}>{duprError}</Text>
              ) : (
                <Text style={styles.helperText}>Enter a value between 1.0 and 7.0</Text>
              )}

              <Text style={styles.label}>Experience Level</Text>
              <View style={styles.experienceLevelContainer}>
                {experienceLevels.map((level, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.experienceLevelButton,
                      experienceLevel === level && styles.experienceLevelButtonActive,
                    ]}
                    onPress={() => setExperienceLevel(level)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.experienceLevelText,
                        experienceLevel === level && styles.experienceLevelTextActive,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </React.Fragment>
          )}

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
            editable={!loading && !showCodeInput && !isVerifying}
          />

          {isForgotPassword && showCodeInput && (
            <React.Fragment>
              <Text style={styles.label}>Six-Digit Code</Text>
              <TextInput
                style={[commonStyles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor={colors.textSecondary}
                value={loginCode}
                onChangeText={(text) => setLoginCode(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isVerifying}
              />
              <Text style={styles.helperText}>
                Check your email for a six-digit code and enter it here
              </Text>
              
              {verificationError && (
                <View style={styles.errorContainer}>
                  <IconSymbol 
                    ios_icon_name="exclamationmark.triangle.fill" 
                    android_material_icon_name="warning" 
                    size={20} 
                    color={colors.accent} 
                  />
                  <Text style={styles.errorMessage}>{verificationError}</Text>
                </View>
              )}
            </React.Fragment>
          )}

          {!isForgotPassword && (
            <React.Fragment>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={commonStyles.input}
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
                activeOpacity={0.7}
              >
                <Text style={styles.showPasswordText}>
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
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
              ((loading || isVerifying || isSendingCode) || (isSignUp && !consentAccepted) || (isForgotPassword && showCodeInput && verifyButtonDisabled)) && { opacity: 0.6 }
            ]}
            onPress={
              isForgotPassword 
                ? showCodeInput 
                  ? handleVerifyCode 
                  : handleSendCode 
                : isSignUp 
                  ? handleSignUp 
                  : handleSignIn
            }
            disabled={
              loading || 
              isVerifying || 
              isSendingCode || 
              (isSignUp && !consentAccepted) || 
              (isForgotPassword && showCodeInput && verifyButtonDisabled)
            }
            activeOpacity={0.8}
          >
            {(loading || isVerifying || isSendingCode) ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.card} size="small" />
                <Text style={[buttonStyles.text, { marginLeft: 8 }]}>
                  {isForgotPassword && showCodeInput ? verifyButtonText : isSendingCode ? 'Sending...' : 'Loading...'}
                </Text>
              </View>
            ) : (
              <Text style={buttonStyles.text}>
                {isForgotPassword 
                  ? showCodeInput 
                    ? verifyButtonText
                    : 'Send Code' 
                  : isSignUp 
                    ? 'Sign Up' 
                    : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {isForgotPassword && showCodeInput && (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleSendCode}
              disabled={resendDisabled || isSendingCode}
              activeOpacity={0.7}
            >
              <Text style={[styles.resendText, (resendDisabled || isSendingCode) && { opacity: 0.5 }]}>
                {resendButtonText}
              </Text>
            </TouchableOpacity>
          )}

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
  inputError: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 4,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: 'Courier New',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.accent,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  experienceLevelContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  experienceLevelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    minWidth: 0,
  },
  experienceLevelButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  experienceLevelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  experienceLevelTextActive: {
    color: colors.card,
  },
  showPasswordButton: {
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  showPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
  resendButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
