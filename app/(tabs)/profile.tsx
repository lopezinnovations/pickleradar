
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, ActivityIndicator, TextInput, Image, Modal, RefreshControl, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { IconSymbol } from '@/components/IconSymbol';
import { LegalFooter } from '@/components/LegalFooter';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/app/integrations/supabase/client';
import Constants from 'expo-constants';
import { 
  sendTestPushNotification, 
  isPushNotificationSupported,
  requestNotificationPermissions,
  checkNotificationPermissionStatus,
  registerPushToken,
  clearNotificationsPromptDismissedAt
} from '@/utils/notifications';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, updateUserProfile, uploadProfilePicture, authLoading, needsConsentUpdate, acceptConsent, refetchUser } = useAuth();
  const { checkInHistory, getUserCheckIn, checkOut, getRemainingTime, loading: historyLoading, refetch: refetchCheckIns } = useCheckIn(user?.id);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pickleballerNickname, setPickleballerNickname] = useState('');
  const [skillLevel, setSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [duprRating, setDuprRating] = useState('');
  const [duprError, setDuprError] = useState('');
  const [privacyOptIn, setPrivacyOptIn] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [friendVisibility, setFriendVisibility] = useState(true);
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState<{ hours: number; minutes: number } | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showConsentPrompt, setShowConsentPrompt] = useState(false);
  const [acceptingConsent, setAcceptingConsent] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPushToken, setUserPushToken] = useState<string | null>(null);
  const [sendingTestPush, setSendingTestPush] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  
  const hasLoadedUserData = useRef(false);
  const hasLoadedCheckIn = useRef(false);

  // Check if we're in a dev/TestFlight build (not production)
  const isDevOrTestFlightBuild = Constants.appOwnership !== 'standalone';

  const fetchAdminStatusAndPushToken = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('push_token')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[Profile] Error fetching user data:', error);
        return;
      }

      const pushToken = data?.push_token || null;
      setUserPushToken(pushToken);
      
      // Check current OS notification permission status
      const permissionStatus = await checkNotificationPermissionStatus();
      setNotificationsEnabled(permissionStatus === 'granted');
      
      const isAdminUser = user.email?.toLowerCase().includes('admin') || false;
      setIsAdmin(isAdminUser);
      
      console.log('[Profile] User push token:', pushToken ? 'Present' : 'Not set');
      console.log('[Profile] Notification permission:', permissionStatus);
      console.log('[Profile] Admin status:', isAdminUser);
      console.log('[Profile] Build type:', isDevOrTestFlightBuild ? 'Dev/TestFlight' : 'Production');
    } catch (error) {
      console.error('[Profile] Error in fetchAdminStatusAndPushToken:', error);
    }
  }, [user, isDevOrTestFlightBuild]);

  const loadCurrentCheckIn = useCallback(async () => {
    if (!user) return;
    const checkIn = await getUserCheckIn(user.id);
    if (checkIn) {
      setCurrentCheckIn(checkIn);
      const time = getRemainingTime(checkIn.expires_at);
      setRemainingTime({ hours: time.hours, minutes: time.minutes });
    } else {
      setCurrentCheckIn(null);
      setRemainingTime(null);
    }
  }, [user, getUserCheckIn, getRemainingTime]);

  // PULL-TO-REFRESH: Manual refetch
  const onRefresh = useCallback(async () => {
    console.log('ProfileScreen: Pull-to-refresh triggered');
    setRefreshing(true);
    await Promise.all([
      refetchUser(),
      refetchCheckIns(),
      loadCurrentCheckIn(),
      fetchAdminStatusAndPushToken(),
    ]);
    setRefreshing(false);
  }, [refetchUser, refetchCheckIns, loadCurrentCheckIn, fetchAdminStatusAndPushToken]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      
      console.log('ProfileScreen: Screen focused, refetching data');
      refetchUser();
      refetchCheckIns();
      loadCurrentCheckIn();
      fetchAdminStatusAndPushToken();
    }, [user, refetchUser, refetchCheckIns, loadCurrentCheckIn, fetchAdminStatusAndPushToken])
  );

  useEffect(() => {
    if (user && !hasLoadedUserData.current) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPickleballerNickname(user.pickleballerNickname || '');
      setSkillLevel(user.experienceLevel || user.skillLevel || 'Beginner');
      setDuprRating(user.duprRating ? user.duprRating.toString() : '');
      setDuprError('');
      setPrivacyOptIn(user.privacyOptIn);
      setLocationEnabled(user.locationEnabled);
      setFriendVisibility(user.friendVisibility);
      hasLoadedUserData.current = true;
      
      if (needsConsentUpdate()) {
        setShowConsentPrompt(true);
      }

      fetchAdminStatusAndPushToken();
    } else if (!user && !authLoading) {
      hasLoadedUserData.current = false;
      setIsAdmin(false);
      setUserPushToken(null);
    }
  }, [user, authLoading, needsConsentUpdate, fetchAdminStatusAndPushToken]);

  useEffect(() => {
    if (user && !hasLoadedCheckIn.current) {
      loadCurrentCheckIn();
      hasLoadedCheckIn.current = true;
    } else if (!user && !authLoading) {
      hasLoadedCheckIn.current = false;
      setCurrentCheckIn(null);
      setRemainingTime(null);
    }
  }, [user, authLoading, loadCurrentCheckIn]);

  useEffect(() => {
    if (currentCheckIn?.expires_at) {
      const updateTime = () => {
        const time = getRemainingTime(currentCheckIn.expires_at);
        setRemainingTime({ hours: time.hours, minutes: time.minutes });
        
        if (time.totalMinutes <= 0) {
          hasLoadedCheckIn.current = false;
          loadCurrentCheckIn();
        }
      };
      
      updateTime();
      const interval = setInterval(updateTime, 60000);
      
      return () => clearInterval(interval);
    }
  }, [currentCheckIn?.expires_at, getRemainingTime, loadCurrentCheckIn]);

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

  const handleAcceptConsent = async () => {
    setAcceptingConsent(true);
    
    try {
      const result = await acceptConsent();
      
      if (result.success) {
        setShowConsentPrompt(false);
        Alert.alert('Success', 'Thank you for accepting the updated terms!');
      } else {
        Alert.alert('Error', result.error || 'Failed to update consent. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update consent. Please try again.');
    } finally {
      setAcceptingConsent(false);
    }
  };

  const handleEnableNotifications = async () => {
    console.log('[Profile] User tapped Enable Notifications button');
    
    if (!user) return;
    
    setEnablingNotifications(true);
    
    try {
      const granted = await requestNotificationPermissions();
      
      if (granted) {
        console.log('[Profile] Notifications enabled, registering push token');
        await registerPushToken(user.id);
        
        // Clear any previous dismissal so prompt can show again if needed
        await clearNotificationsPromptDismissedAt();
        
        // Update local state
        setNotificationsEnabled(true);
        
        // Refresh to get the new push token
        await fetchAdminStatusAndPushToken();
        
        Alert.alert(
          'Notifications Enabled',
          'You will now receive notifications when friends check in and send you messages.'
        );
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings to receive updates.'
        );
      }
    } catch (error) {
      console.error('[Profile] Error enabling notifications:', error);
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    } finally {
      setEnablingNotifications(false);
    }
  };

  const handlePickImage = async () => {
    console.log('[Profile] User tapped to change profile picture');
    setShowImagePickerModal(true);
  };

  const handleTakePhoto = async () => {
    console.log('[Profile] User chose to take a photo with camera');
    setShowImagePickerModal(false);
    
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('[Profile] Camera permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access to take photos. Camera access is only used when you choose to take a photo and is never used in the background.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('[Profile] Photo taken, uploading...');
        setUploadingImage(true);
        const uploadResult = await uploadProfilePicture(result.assets[0].uri);
        
        if (uploadResult.success) {
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', uploadResult.error || 'Failed to upload profile picture');
        }
        setUploadingImage(false);
      }
    } catch (error) {
      console.error('[Profile] Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      setUploadingImage(false);
    }
  };

  const handleChooseFromLibrary = async () => {
    console.log('[Profile] User chose to pick from photo library');
    setShowImagePickerModal(false);
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Profile] Media library permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('[Profile] Photo selected from library, uploading...');
        setUploadingImage(true);
        const uploadResult = await uploadProfilePicture(result.assets[0].uri);
        
        if (uploadResult.success) {
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', uploadResult.error || 'Failed to upload profile picture');
        }
        setUploadingImage(false);
      }
    } catch (error) {
      console.error('[Profile] Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setUploadingImage(false);
    }
  };

  const handleManualCheckOut = () => {
    if (!currentCheckIn || !user) return;

    Alert.alert(
      'Check Out',
      `Are you sure you want to check out from ${currentCheckIn.courts?.name || 'this court'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            setCheckingOut(true);
            try {
              const result = await checkOut(user.id, currentCheckIn.court_id);
              if (result.success) {
                Alert.alert('Success', 'You have been checked out successfully!');
                hasLoadedCheckIn.current = false;
                await loadCurrentCheckIn();
              } else {
                Alert.alert('Error', result.error || 'Failed to check out. Please try again.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to check out. Please try again.');
            } finally {
              setCheckingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim()) {
      Alert.alert('Validation Error', 'First name is required');
      return;
    }
    
    if (!lastName.trim()) {
      Alert.alert('Validation Error', 'Last name is required');
      return;
    }

    const duprValue = duprRating.trim() ? parseFloat(duprRating) : undefined;
    
    if (duprValue !== undefined && (isNaN(duprValue) || duprValue < 1 || duprValue > 7)) {
      Alert.alert('Invalid DUPR Rating', 'DUPR rating must be between 1.0 and 7.0');
      return;
    }

    try {
      await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pickleballerNickname: pickleballerNickname.trim() || undefined,
        experienceLevel: skillLevel,
        duprRating: duprValue,
        privacyOptIn,
        locationEnabled,
        friendVisibility,
      });
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data, including check-ins, messages, and friend connections will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!user) return;

    setDeletingAccount(true);
    try {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;

      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
      
      if (authError) {
        console.log('[Profile] Auth delete error (non-critical):', authError);
      }

      await signOut();
      
      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/welcome'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              Alert.alert(
                'Signed Out',
                'You have been signed out successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/auth'),
                  },
                ]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSendTestPush = async () => {
    if (!userPushToken) {
      Alert.alert(
        'No Push Token',
        'You don\'t have a push token registered yet. Push tokens are only available in Development Builds or Production builds, not in Expo Go on Android (SDK 53+).\n\nTo test push notifications:\n• iOS: Use TestFlight or a Development Build\n• Android: Use a Development Build'
      );
      return;
    }

    if (!isPushNotificationSupported()) {
      Alert.alert(
        'Push Not Supported',
        'Push notifications are not supported in Expo Go on Android (SDK 53+).\n\nTo test push notifications:\n• iOS: Use TestFlight or a Development Build\n• Android: Use a Development Build'
      );
      return;
    }

    setSendingTestPush(true);
    try {
      const result = await sendTestPushNotification(
        userPushToken,
        'Test Push from PickleRadar',
        'If you see this, push notifications are working! 🎾'
      );

      if (result.success) {
        Alert.alert(
          'Test Push Sent!',
          'A test push notification has been sent to your device. You should receive it shortly.'
        );
      } else {
        const errorMessage = result.error || 'Failed to send test push notification. Please try again.';
        console.error('[Profile] Test push failed:', errorMessage);
        Alert.alert(
          'Failed to Send',
          `Error: ${errorMessage}\n\nPlease check:\n• Push token is valid\n• Device has internet connection\n• Notifications are enabled in device settings`
        );
      }
    } catch (error: any) {
      console.error('[Profile] Error sending test push:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      Alert.alert(
        'Error',
        `Failed to send test push: ${errorMessage}\n\nPlease check the console logs for more details.`
      );
    } finally {
      setSendingTestPush(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (authLoading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <View style={styles.emptyStateIcon}>
          <IconSymbol 
            ios_icon_name="person.crop.circle" 
            android_material_icon_name="account-circle" 
            size={64} 
            color={colors.textSecondary} 
          />
        </View>
        <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
          Not Logged In
        </Text>
        <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center' }]}>
          Sign in to access your profile and settings
        </Text>
        <TouchableOpacity
          style={[buttonStyles.primary, { marginTop: 24 }]}
          onPress={() => router.push('/auth')}
        >
          <Text style={buttonStyles.text}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const beginnerLabel = 'Beginner';
  const intermediateLabel = 'Intermediate';
  const advancedLabel = 'Advanced';

  return (
    <View style={commonStyles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.gearButton}
          onPress={() => setIsEditing(!isEditing)}
        >
          <IconSymbol 
            ios_icon_name={isEditing ? "xmark.circle.fill" : "gearshape.fill"} 
            android_material_icon_name={isEditing ? "cancel" : "settings"} 
            size={28} 
            color={isEditing ? colors.accent : colors.primary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {showConsentPrompt && (
          <View style={[commonStyles.card, { backgroundColor: colors.accent, marginBottom: 16, borderWidth: 2, borderColor: colors.primary }]}>
            <View style={styles.consentPromptHeader}>
              <IconSymbol 
                ios_icon_name="exclamationmark.triangle.fill" 
                android_material_icon_name="warning" 
                size={24} 
                color={colors.card} 
              />
              <Text style={[commonStyles.subtitle, { marginLeft: 12, color: colors.card, flex: 1 }]}>
                Action Required
              </Text>
            </View>
            <Text style={[commonStyles.text, { marginTop: 12, color: colors.card, lineHeight: 22 }]}>
              Our Privacy Policy and Terms of Service have been updated. Please review and accept to continue using the app.
            </Text>
            
            <View style={styles.consentButtonsContainer}>
              <TouchableOpacity
                style={[styles.consentButton, { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.card }]}
                onPress={() => router.push('/legal/privacy-policy')}
              >
                <IconSymbol 
                  ios_icon_name="doc.text.fill" 
                  android_material_icon_name="description" 
                  size={18} 
                  color={colors.accent} 
                />
                <Text style={[styles.consentButtonText, { color: colors.accent }]}>
                  Privacy Policy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.consentButton, { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.card }]}
                onPress={() => router.push('/legal/terms-of-service')}
              >
                <IconSymbol 
                  ios_icon_name="doc.text.fill" 
                  android_material_icon_name="description" 
                  size={18} 
                  color={colors.accent} 
                />
                <Text style={[styles.consentButtonText, { color: colors.accent }]}>
                  Terms of Service
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[buttonStyles.primary, { marginTop: 16, backgroundColor: colors.card }]}
              onPress={handleAcceptConsent}
              disabled={acceptingConsent}
            >
              {acceptingConsent ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <React.Fragment>
                  <IconSymbol 
                    ios_icon_name="checkmark.circle.fill" 
                    android_material_icon_name="check-circle" 
                    size={20} 
                    color={colors.accent} 
                  />
                  <Text style={[buttonStyles.text, { color: colors.accent, marginLeft: 8 }]}>
                    I Accept the Terms
                  </Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={uploadingImage || !isEditing}
          >
            {uploadingImage ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : user.profilePictureUrl ? (
              <Image 
                source={{ uri: user.profilePictureUrl }} 
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <IconSymbol 
                ios_icon_name="person.crop.circle.fill" 
                android_material_icon_name="account-circle" 
                size={64} 
                color={colors.primary} 
              />
            )}
            {isEditing && (
              <View style={styles.editIconContainer}>
                <IconSymbol 
                  ios_icon_name="camera.fill" 
                  android_material_icon_name="photo-camera" 
                  size={16} 
                  color={colors.card} 
                />
              </View>
            )}
          </TouchableOpacity>
          <Text style={[commonStyles.title, { color: colors.primary, fontSize: 22 }]}>
            {user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.phone || user.email || 'User'}
          </Text>
          {user.pickleballerNickname && (
            <Text style={[commonStyles.textSecondary, { fontSize: 16, marginTop: 4 }]}>
              &quot;{user.pickleballerNickname}&quot;
            </Text>
          )}
          
          <View style={styles.userStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{checkInHistory?.length || 0}</Text>
              <Text style={commonStyles.textSecondary}>Check-ins</Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{skillLevel}</Text>
              <Text style={commonStyles.textSecondary}>Experience</Text>
            </View>
            
            {duprRating && (
              <React.Fragment>
                <View style={styles.separator} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{duprRating}</Text>
                  <Text style={commonStyles.textSecondary}>DUPR</Text>
                </View>
              </React.Fragment>
            )}
          </View>
        </View>

        {currentCheckIn && remainingTime && remainingTime.hours >= 0 && remainingTime.minutes >= 0 && (
          <View style={[commonStyles.card, { backgroundColor: colors.highlight }]}>
            <View style={styles.currentCheckInHeader}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={24} 
                color={colors.success} 
              />
              <Text style={[commonStyles.subtitle, { marginLeft: 8 }]}>Currently Checked In</Text>
            </View>
            <Text style={[commonStyles.text, { marginTop: 8, fontWeight: '600' }]}>
              {currentCheckIn.courts?.name || 'Unknown Court'}
            </Text>
            <View style={styles.remainingTimeContainer}>
              <IconSymbol 
                ios_icon_name="clock.fill" 
                android_material_icon_name="schedule" 
                size={16} 
                color={colors.primary} 
              />
              <Text style={[commonStyles.textSecondary, { marginLeft: 6 }]}>
                {remainingTime.hours > 0 && `${remainingTime.hours}h `}
                {remainingTime.minutes}m remaining
              </Text>
            </View>
            
            <TouchableOpacity
              style={[buttonStyles.secondary, { marginTop: 16, backgroundColor: colors.accent }]}
              onPress={handleManualCheckOut}
              disabled={checkingOut}
            >
              {checkingOut ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <React.Fragment>
                  <IconSymbol 
                    ios_icon_name="xmark.circle.fill" 
                    android_material_icon_name="cancel" 
                    size={20} 
                    color={colors.card} 
                  />
                  <Text style={[buttonStyles.text, { marginLeft: 8, color: colors.card }]}>
                    Check Out Now
                  </Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={commonStyles.card}>
          <View style={styles.sectionHeader}>
            <Text style={commonStyles.subtitle}>Profile Information</Text>
            {isEditing && (
              <View style={styles.editBadge}>
                <IconSymbol 
                  ios_icon_name="pencil" 
                  android_material_icon_name="edit" 
                  size={14} 
                  color={colors.card} 
                />
                <Text style={styles.editBadgeText}>Editing</Text>
              </View>
            )}
          </View>
          
          <Text style={[commonStyles.text, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
            First Name *
          </Text>
          <TextInput
            style={[commonStyles.input, !isEditing && styles.inputDisabled]}
            placeholder="Enter your first name"
            placeholderTextColor={colors.textSecondary}
            value={firstName}
            onChangeText={setFirstName}
            editable={isEditing}
          />

          <Text style={[commonStyles.text, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
            Last Name *
          </Text>
          <TextInput
            style={[commonStyles.input, !isEditing && styles.inputDisabled]}
            placeholder="Enter your last name"
            placeholderTextColor={colors.textSecondary}
            value={lastName}
            onChangeText={setLastName}
            editable={isEditing}
          />

          <Text style={[commonStyles.text, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
            Pickleballer Nickname (Optional)
          </Text>
          <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
            Your fun pickleball nickname
          </Text>
          <TextInput
            style={[commonStyles.input, !isEditing && styles.inputDisabled]}
            placeholder="e.g., Dink Master, Ace, Smash King"
            placeholderTextColor={colors.textSecondary}
            value={pickleballerNickname}
            onChangeText={setPickleballerNickname}
            editable={isEditing}
          />
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.subtitle}>Player Information</Text>
          
          <Text style={[commonStyles.text, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
            Experience Level
          </Text>
          <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
            Select your pickleball experience level
          </Text>
          
          <View style={styles.skillLevelContainer}>
            <TouchableOpacity
              style={[
                styles.skillLevelButton,
                skillLevel === 'Beginner' && styles.skillLevelButtonActive,
                !isEditing && styles.buttonDisabled,
              ]}
              onPress={() => isEditing && setSkillLevel('Beginner')}
              disabled={!isEditing}
            >
              <Text
                style={[
                  styles.skillLevelText,
                  skillLevel === 'Beginner' && styles.skillLevelTextActive,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {beginnerLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.skillLevelButton,
                skillLevel === 'Intermediate' && styles.skillLevelButtonActive,
                !isEditing && styles.buttonDisabled,
              ]}
              onPress={() => isEditing && setSkillLevel('Intermediate')}
              disabled={!isEditing}
            >
              <Text
                style={[
                  styles.skillLevelText,
                  skillLevel === 'Intermediate' && styles.skillLevelTextActive,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {intermediateLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.skillLevelButton,
                skillLevel === 'Advanced' && styles.skillLevelButtonActive,
                !isEditing && styles.buttonDisabled,
              ]}
              onPress={() => isEditing && setSkillLevel('Advanced')}
              disabled={!isEditing}
            >
              <Text
                style={[
                  styles.skillLevelText,
                  skillLevel === 'Advanced' && styles.skillLevelTextActive,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {advancedLabel}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[commonStyles.text, { marginTop: 20, marginBottom: 8, fontWeight: '600' }]}>
            DUPR Rating (Optional)
          </Text>
          <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
            Enter your DUPR rating (1.0 - 7.0)
          </Text>
          <TextInput
            style={[commonStyles.input, !isEditing && styles.inputDisabled, duprError ? styles.inputError : null]}
            placeholder="e.g., 3.5"
            placeholderTextColor={colors.textSecondary}
            value={duprRating}
            onChangeText={handleDuprChange}
            keyboardType="decimal-pad"
            maxLength={4}
            editable={isEditing}
          />
          {duprError && isEditing && (
            <Text style={styles.errorText}>{duprError}</Text>
          )}
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.subtitle}>Tools</Text>
          
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => router.push('/code-assistant')}
          >
            <View style={styles.toolIconContainer}>
              <IconSymbol 
                ios_icon_name="chevron.left.forwardslash.chevron.right" 
                android_material_icon_name="code" 
                size={24} 
                color={colors.primary} 
              />
            </View>
            <View style={styles.toolInfo}>
              <Text style={[commonStyles.text, { fontWeight: '600' }]}>Code Assistant</Text>
              <Text style={commonStyles.textSecondary}>
                AI-powered coding help
              </Text>
            </View>
            <IconSymbol 
              ios_icon_name="chevron.right" 
              android_material_icon_name="chevron-right" 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.subtitle}>Privacy & Permissions</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={commonStyles.text}>Friend Visibility</Text>
              <Text style={commonStyles.textSecondary}>
                Let friends see when you&apos;re playing
              </Text>
            </View>
            <Switch
              value={privacyOptIn}
              onValueChange={setPrivacyOptIn}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
              disabled={!isEditing}
            />
          </View>

          <View style={[styles.settingRow, { borderTopWidth: 2, borderTopColor: colors.primary, marginTop: 16, paddingTop: 16 }]}>
            <View style={styles.settingInfo}>
              <Text style={[commonStyles.text, { fontWeight: '600' }]}>Push Notifications</Text>
              <Text style={commonStyles.textSecondary}>
                {notificationsEnabled 
                  ? 'Enabled - You will receive notifications' 
                  : 'Disabled - Tap button below to enable'}
              </Text>
            </View>
            {notificationsEnabled ? (
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={24} 
                color={colors.success} 
              />
            ) : (
              <IconSymbol 
                ios_icon_name="bell.slash.fill" 
                android_material_icon_name="notifications-off" 
                size={24} 
                color={colors.textSecondary} 
              />
            )}
          </View>

          {!notificationsEnabled && (
            <TouchableOpacity
              style={[buttonStyles.primary, { marginTop: 12 }]}
              onPress={handleEnableNotifications}
              disabled={enablingNotifications}
            >
              {enablingNotifications ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <React.Fragment>
                  <IconSymbol 
                    ios_icon_name="bell.fill" 
                    android_material_icon_name="notifications" 
                    size={20} 
                    color={colors.card} 
                  />
                  <Text style={[buttonStyles.text, { marginLeft: 8 }]}>
                    Enable Notifications
                  </Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={commonStyles.text}>Location Services</Text>
              <Text style={commonStyles.textSecondary}>
                Show nearby courts first
              </Text>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
              disabled={!isEditing}
            />
          </View>

          {isDevOrTestFlightBuild && (
            <React.Fragment>
              <View style={[styles.settingRow, { borderTopWidth: 2, borderTopColor: colors.primary, marginTop: 16, paddingTop: 16 }]}>
                <View style={styles.settingInfo}>
                  <Text style={[commonStyles.text, { fontWeight: '600' }]}>Push Token Status</Text>
                  <Text style={commonStyles.textSecondary}>
                    {userPushToken ? 'Registered ✓' : 'Not registered (use dev build)'}
                  </Text>
                </View>
                {userPushToken && (
                  <IconSymbol 
                    ios_icon_name="checkmark.circle.fill" 
                    android_material_icon_name="check-circle" 
                    size={24} 
                    color={colors.success} 
                  />
                )}
              </View>

              {userPushToken && (
                <TouchableOpacity
                  style={[buttonStyles.secondary, { marginTop: 16, backgroundColor: colors.primary }]}
                  onPress={handleSendTestPush}
                  disabled={sendingTestPush}
                >
                  {sendingTestPush ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <React.Fragment>
                      <IconSymbol 
                        ios_icon_name="bell.fill" 
                        android_material_icon_name="notifications" 
                        size={20} 
                        color={colors.card} 
                      />
                      <Text style={[buttonStyles.text, { marginLeft: 8 }]}>
                        Send Test Push
                      </Text>
                    </React.Fragment>
                  )}
                </TouchableOpacity>
              )}
            </React.Fragment>
          )}
        </View>

        <View style={commonStyles.card}>
          <View style={styles.historyHeader}>
            <Text style={commonStyles.subtitle}>Check-In History</Text>
            <Text style={commonStyles.textSecondary}>
              {checkInHistory?.length || 0} total
            </Text>
          </View>
          
          {historyLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : checkInHistory && checkInHistory.length > 0 ? (
            <View style={styles.historyList}>
              {checkInHistory.slice(0, 5).map((checkIn, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyIcon}>
                    <IconSymbol 
                      ios_icon_name="location.fill" 
                      android_material_icon_name="location-on" 
                      size={20} 
                      color={colors.primary} 
                    />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={commonStyles.text}>{checkIn.courtName}</Text>
                    <Text style={commonStyles.textSecondary}>
                      {new Date(checkIn.checkedInAt).toLocaleDateString()} • {checkIn.skillLevel}
                    </Text>
                  </View>
                </View>
              ))}
              {checkInHistory.length > 5 && (
                <Text style={[commonStyles.textSecondary, { textAlign: 'center', marginTop: 12 }]}>
                  And {checkInHistory.length - 5} more...
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyHistory}>
              <Text style={commonStyles.textSecondary}>
                No check-ins yet. Visit a court and check in to start tracking your activity!
              </Text>
            </View>
          )}
        </View>

        {isEditing ? (
          <React.Fragment>
            <TouchableOpacity
              style={buttonStyles.primary}
              onPress={handleSaveProfile}
            >
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={20} 
                color={colors.card} 
              />
              <Text style={[buttonStyles.text, { marginLeft: 8 }]}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[buttonStyles.secondary, { marginTop: 12 }]}
              onPress={() => {
                setFirstName(user.firstName || '');
                setLastName(user.lastName || '');
                setPickleballerNickname(user.pickleballerNickname || '');
                setSkillLevel(user.experienceLevel || user.skillLevel || 'Beginner');
                setDuprRating(user.duprRating ? user.duprRating.toString() : '');
                setDuprError('');
                setPrivacyOptIn(user.privacyOptIn);
                setLocationEnabled(user.locationEnabled);
                setFriendVisibility(user.friendVisibility);
                setIsEditing(false);
              }}
            >
              <Text style={[buttonStyles.text, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </React.Fragment>
        ) : (
          <View style={commonStyles.card}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}

        <LegalFooter 
          showLegalCompliance={user.termsAccepted && user.privacyAccepted && user.acceptedAt}
          onLegalCompliancePress={() => setShowLegalModal(true)}
          showDeleteAccount={true}
          onDeleteAccountPress={handleDeleteAccount}
          deletingAccount={deletingAccount}
        />
      </ScrollView>

      <Modal
        visible={showLegalModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLegalModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLegalModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <IconSymbol 
                ios_icon_name="checkmark.shield.fill" 
                android_material_icon_name="verified-user" 
                size={32} 
                color={colors.success} 
              />
              <Text style={[commonStyles.title, { marginTop: 12, fontSize: 20 }]}>
                Legal Compliance
              </Text>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.modalRow}>
                <Text style={[commonStyles.text, { fontWeight: '600' }]}>Terms Accepted:</Text>
                <Text style={commonStyles.text}>{formatDate(user.acceptedAt)}</Text>
              </View>
              
              <View style={styles.modalRow}>
                <Text style={[commonStyles.text, { fontWeight: '600' }]}>Version:</Text>
                <Text style={commonStyles.text}>{user.acceptedVersion || 'v1.0'}</Text>
              </View>
              
              <View style={styles.modalRow}>
                <Text style={[commonStyles.text, { fontWeight: '600' }]}>Privacy Policy:</Text>
                <Text style={[commonStyles.text, { color: colors.success }]}>✓ Accepted</Text>
              </View>
              
              <View style={styles.modalRow}>
                <Text style={[commonStyles.text, { fontWeight: '600' }]}>Terms of Service:</Text>
                <Text style={[commonStyles.text, { color: colors.success }]}>✓ Accepted</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[buttonStyles.primary, { marginTop: 20 }]}
              onPress={() => setShowLegalModal(false)}
            >
              <Text style={buttonStyles.text}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showImagePickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImagePickerModal(false)}
        >
          <View style={styles.imagePickerModalContent}>
            <Text style={[commonStyles.title, { fontSize: 20, marginBottom: 20 }]}>
              Choose Photo Source
            </Text>
            
            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={handleTakePhoto}
            >
              <IconSymbol 
                ios_icon_name="camera.fill" 
                android_material_icon_name="photo-camera" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={[commonStyles.text, { marginLeft: 12, fontWeight: '600' }]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={handleChooseFromLibrary}
            >
              <IconSymbol 
                ios_icon_name="photo.fill" 
                android_material_icon_name="photo-library" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={[commonStyles.text, { marginLeft: 12, fontWeight: '600' }]}>
                Choose from Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.imagePickerOption, { borderTopWidth: 2, borderTopColor: colors.border, marginTop: 12, paddingTop: 20 }]}
              onPress={() => setShowImagePickerModal(false)}
            >
              <Text style={[commonStyles.text, { fontWeight: '600', color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  gearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 80,
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  consentPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consentButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  consentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  consentButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentCheckInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  remainingTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  editBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.card,
  },
  inputDisabled: {
    backgroundColor: colors.highlight,
    opacity: 0.7,
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
  skillLevelContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  skillLevelButton: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 4,
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
  buttonDisabled: {
    opacity: 0.7,
  },
  skillLevelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
    textAlign: 'center',
  },
  skillLevelTextActive: {
    color: colors.card,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyList: {
    marginTop: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  emptyHistory: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalBody: {
    marginTop: 20,
    gap: 16,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  imagePickerModalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    marginBottom: 12,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    marginTop: 12,
  },
  toolIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  toolInfo: {
    flex: 1,
  },
});
