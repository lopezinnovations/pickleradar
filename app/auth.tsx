
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
  const { sendOtp, verifyOtp, isConfigured } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Clear any existing sessions on mount to ensure clean state
  useEffect(() => {
    const clearOldSessions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && !session.user.phone) {
          console.log('AuthScreen: Clearing old non-phone session');
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.log('AuthScreen: Error clearing old sessions:', error);
      }
    };
    clearOldSessions();
  }, []);

  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const getCleanPhoneNumber = (formatted: string) => {
    // Remove all non-numeric characters and add +1 prefix
    const cleaned = formatted.replace(/\D/g, '');
    return `+1${cleaned}`;
  };

  const validatePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
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
      const cleanPhone = getCleanPhoneNumber(phoneNumber);
      console.log('AuthScreen: Sending OTP to:', cleanPhone);
      
      const result = await sendOtp(cleanPhone);
      
      if (result.success) {
        setOtpSent(true);
        Alert.alert(
          'Verification Code Sent',
          'Please check your phone for the verification code.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('AuthScreen: Send OTP failed:', result.message);
        Alert.alert('Error', result.message || 'Failed to send verification code. Please try again.');
      }
    } catch (error: any) {
      console.log('AuthScreen: Send OTP error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Verification code must be 6 digits');
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = getCleanPhoneNumber(phoneNumber);
      console.log('AuthScreen: Verifying OTP for:', cleanPhone);
      console.log('AuthScreen: OTP code:', otpCode);
      
      const result = await verifyOtp(cleanPhone, otpCode, consentAccepted);
      
      if (result.success) {
        Alert.alert(
          'Success',
          'Phone number verified. Welcome to PickleRadar.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear form
                setPhoneNumber('');
                setOtpCode('');
                setOtpSent(false);
                setConsentAccepted(false);
                // Redirect to home
                router.replace('/(tabs)/(home)/');
              },
            },
          ]
        );
      } else {
        console.log('AuthScreen: Verify OTP failed:', result.message);
        Alert.alert('Verification Failed', result.message || 'Invalid or expired verification code. Please try again.');
      }
    } catch (error: any) {
      console.log('AuthScreen: Verify OTP error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (otpSent) {
      // Go back to phone number entry
      setOtpSent(false);
      setOtpCode('');
    } else {
      router.back();
    }
  };

  const handleResendOtp = async () => {
    setOtpCode('');
    await handleSendOtp();
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
            {otpSent ? 'Verify Your Phone' : 'Welcome to PickleRadar'}
          </Text>
          <Text style={commonStyles.textSecondary}>
            {otpSent 
              ? 'Enter the 6-digit code sent to your phone' 
              : 'Sign in with your phone number'}
          </Text>
        </View>

        <View style={styles.form}>
          {!otpSent ? (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor={colors.textSecondary}
                value={phoneNumber}
                onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                maxLength={14}
              />

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

              <TouchableOpacity
                style={[
                  buttonStyles.primary, 
                  { marginTop: 8 }, 
                  (loading || !consentAccepted) && { opacity: 0.6 }
                ]}
                onPress={handleSendOtp}
                disabled={loading || !consentAccepted}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={buttonStyles.text}>Send Verification Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[commonStyles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor={colors.textSecondary}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={[
                  buttonStyles.primary, 
                  { marginTop: 8 }, 
                  loading && { opacity: 0.6 }
                ]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={buttonStyles.text}>Verify Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResendOtp}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>
                  Didn&apos;t receive the code?{' '}
                  <Text style={styles.resendLink}>Resend</Text>
                </Text>
              </TouchableOpacity>
            </>
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
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
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
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resendLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
