import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  RefreshControl,
  Platform,
} from 'react-native';
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
  clearNotificationsPromptDismissedAt,
} from '@/utils/notifications';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    user,
    signOut,
    updateUserProfile,
    uploadProfilePicture,
    authLoading,
    needsConsentUpdate,
    acceptConsent,
    refetchUser,
  } = useAuth();

  const {
    checkInHistory,
    getUserCheckIn,
    checkOut,
    getRemainingTime,
    loading: historyLoading,
    refetch: refetchCheckIns,
  } = useCheckIn(user?.id);

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
      const { data, error } = await supabase.from('users').select('push_token').eq('id', user.id).single();

      if (error) {
        console.error('[Profile] Error fetching user data:', error);
        return;
      }

      const pushToken = data?.push_token || null;
      setUserPushToken(pushToken);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchUser(), refetchCheckIns(), loadCurrentCheckIn(), fetchAdminStatusAndPushToken()]);
    setRefreshing(false);
  }, [refetchUser, refetchCheckIns, loadCurrentCheckIn, fetchAdminStatusAndPushToken]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
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
      setSkillLevel((user.experienceLevel as any) || (user.skillLevel as any) || 'Beginner');
      setDuprRating(user.duprRating ? user.duprRating.toString() : '');
      setDuprError('');
      setPrivacyOptIn(!!user.privacyOptIn);
      setLocationEnabled(!!user.locationEnabled);
      setFriendVisibility(user.friendVisibility !== false);

      hasLoadedUserData.current = true;

      if (needsConsentUpdate()) setShowConsentPrompt(true);
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
    } catch {
      Alert.alert('Error', 'Failed to update consent. Please try again.');
    } finally {
      setAcceptingConsent(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!user) return;
    setEnablingNotifications(true);

    try {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await registerPushToken(user.id);
        await clearNotificationsPromptDismissedAt();
        setNotificationsEnabled(true);
        await fetchAdminStatusAndPushToken();

        Alert.alert('Notifications Enabled', 'You will now receive notifications when friends check in and send you messages.');
      } else {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings to receive updates.');
      }
    } catch (error) {
      console.error('[Profile] Error enabling notifications:', error);
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    } finally {
      setEnablingNotifications(false);
    }
  };

  const handlePickImage = async () => {
    setShowImagePickerModal(true);
  };

  const handleTakePhoto = async () => {
    setShowImagePickerModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera access to take photos. Camera access is only used when you choose to take a photo and is never used in the background.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        const uploadResult = await uploadProfilePicture(result.assets[0].uri);

        if (uploadResult.success) Alert.alert('Success', 'Profile picture updated successfully!');
        else Alert.alert('Error', uploadResult.error || 'Failed to upload profile picture');

        setUploadingImage(false);
      }
    } catch (error) {
      console.error('[Profile] Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      setUploadingImage(false);
    }
  };

  const handleChooseFromLibrary = async () => {
    setShowImagePickerModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        setUploadingImage(true);
        const uploadResult = await uploadProfilePicture(result.assets[0].uri);

        if (uploadResult.success) Alert.alert('Success', 'Profile picture updated successfully!');
        else Alert.alert('Error', uploadResult.error || 'Failed to upload profile picture');

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

    Alert.alert('Check Out', `Are you sure you want to check out from ${currentCheckIn.courts?.name || 'this court'}?`, [
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
          } catch {
            Alert.alert('Error', 'Failed to check out. Please try again.');
          } finally {
            setCheckingOut(false);
          }
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim()) return Alert.alert('Validation Error', 'First name is required');
    if (!lastName.trim()) return Alert.alert('Validation Error', 'Last name is required');

    const duprValue = duprRating.trim() ? parseFloat(duprRating) : undefined;
    if (duprValue !== undefined && (isNaN(duprValue) || duprValue < 1 || duprValue > 7)) {
      return Alert.alert('Invalid DUPR Rating', 'DUPR rating must be between 1.0 and 7.0');
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
        { text: 'Delete Permanently', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);

    try {
      const { error: deleteError } = await supabase.from('users').delete().eq('id', user.id);
      if (deleteError) throw deleteError;

      try {
        // NOTE: This typically won't work client-side unless you have admin privileges / service role.
        // Keeping as non-critical, similar to your original code.
        // @ts-ignore
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
        if (authError) console.log('[Profile] Auth delete error (non-critical):', authError);
      } catch {}

      await signOut();
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.', [
        { text: 'OK', onPress: () => router.replace('/welcome') },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            Alert.alert('Signed Out', 'You have been signed out successfully.', [
              { text: 'OK', onPress: () => router.replace('/auth') },
            ]);
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const cancelEdits = () => {
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setPickleballerNickname(user.pickleballerNickname || '');
    setSkillLevel((user.experienceLevel as any) || (user.skillLevel as any) || 'Beginner');
    setDuprRating(user.duprRating ? user.duprRating.toString() : '');
    setDuprError('');
    setPrivacyOptIn(!!user.privacyOptIn);
    setLocationEnabled(!!user.locationEnabled);
    setFriendVisibility(user.friendVisibility !== false);
    setIsEditing(false);
  };

  const handleOpenLegal = () => {
    setShowLegalModal(true);
  };

  const handleSendTestPush = async () => {
    if (!userPushToken) {
      Alert.alert(
        'No Push Token',
        "You don't have a push token registered yet. Push tokens are only available in Development Builds or Production builds, not in Expo Go on Android (SDK 53+).\n\nTo test push notifications:\n• iOS: Use TestFlight or a Development Build\n• Android: Use a Development Build"
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
        Alert.alert('Test Push Sent!', 'A test push notification has been sent to your device. You should receive it shortly.');
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
      Alert.alert('Error', `Failed to send test push: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setSendingTestPush(false);
    }
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
        <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>Not Logged In</Text>
        <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center' }]}>
          Sign in to access your profile and settings
        </Text>
        <TouchableOpacity style={[buttonStyles.primary, { marginTop: 24 }]} onPress={() => router.push('/auth')}>
          <Text style={buttonStyles.text}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.gearButton} onPress={() => setIsEditing(!isEditing)}>
          <IconSymbol
            ios_icon_name={isEditing ? 'xmark.circle.fill' : 'gearshape.fill'}
            android_material_icon_name={isEditing ? 'cancel' : 'settings'}
            size={28}
            color={isEditing ? colors.accent : colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={styles.content}>
          {/* Consent Prompt */}
          {showConsentPrompt && (
            <View
              style={[
                commonStyles.card,
                {
                  backgroundColor: colors.accent,
                  marginBottom: 16,
                  borderWidth: 2,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={styles.consentPromptHeader}>
                <IconSymbol ios_icon_name="exclamationmark.triangle.fill" android_material_icon_name="warning" size={24} color={colors.card} />
                <Text style={[commonStyles.subtitle, { marginLeft: 12, color: colors.card, flex: 1 }]}>Action Required</Text>
              </View>

              <Text style={[commonStyles.text, { marginTop: 12, color: colors.card, lineHeight: 22 }]}>
                Our Privacy Policy and Terms of Service have been updated. Please review and accept to continue using the app.
              </Text>

              <View style={styles.consentButtonsContainer}>
                <TouchableOpacity
                  style={[styles.consentButton, { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.card }]}
                  onPress={() => router.push('/legal/privacy-policy')}
                >
                  <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={18} color={colors.accent} />
                  <Text style={[styles.consentButtonText, { color: colors.accent }]} numberOfLines={1}>
                    Privacy Policy
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.consentButton, { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.card }]}
                  onPress={() => router.push('/legal/terms-of-service')}
                >
                  <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={18} color={colors.accent} />
                  <Text style={[styles.consentButtonText, { color: colors.accent }]} numberOfLines={1}>
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
                  <>
                    <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={20} color={colors.accent} />
                    <Text style={[buttonStyles.text, { color: colors.accent, marginLeft: 8 }]}>I Accept the Terms</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Header / Avatar */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={uploadingImage || !isEditing}>
              {uploadingImage ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : user.profilePictureUrl ? (
                <Image source={{ uri: user.profilePictureUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <IconSymbol ios_icon_name="person.crop.circle.fill" android_material_icon_name="account-circle" size={64} color={colors.primary} />
              )}

              {isEditing && (
                <View style={styles.editIconContainer}>
                  <IconSymbol ios_icon_name="camera.fill" android_material_icon_name="photo-camera" size={16} color={colors.card} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={[commonStyles.title, { color: colors.primary, fontSize: 22 }]}>
              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.phone || user.email || 'User'}
            </Text>

            {user.pickleballerNickname && (
              <Text style={[commonStyles.textSecondary, { fontSize: 16, marginTop: 4 }]}>&quot;{user.pickleballerNickname}&quot;</Text>
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

              {!!duprRating && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{duprRating}</Text>
                    <Text style={commonStyles.textSecondary}>DUPR</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Profile Details */}
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Profile Details</Text>

            <View style={{ marginTop: 12 }}>
              <Text style={commonStyles.text}>First Name</Text>
              <TextInput
                style={[commonStyles.input, { marginTop: 8 }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                editable={isEditing}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={commonStyles.text}>Last Name</Text>
              <TextInput
                style={[commonStyles.input, { marginTop: 8 }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                editable={isEditing}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={commonStyles.text}>Pickleballer Nickname</Text>
              <TextInput
                style={[commonStyles.input, { marginTop: 8 }]}
                value={pickleballerNickname}
                onChangeText={setPickleballerNickname}
                placeholder='e.g. "Dink Master"'
                editable={isEditing}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={commonStyles.text}>Skill Level</Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => {
                  const selected = skillLevel === lvl;
                  return (
                    <TouchableOpacity
                      key={lvl}
                      onPress={() => isEditing && setSkillLevel(lvl)}
                      disabled={!isEditing}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : colors.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isEditing ? 1 : 0.7,
                      }}
                    >
                      <Text style={{ color: selected ? colors.card : colors.text, fontWeight: '600' }}>{lvl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={commonStyles.text}>DUPR Rating (optional)</Text>
              <TextInput
                style={[
                  commonStyles.input,
                  { marginTop: 8, borderColor: duprError ? colors.accent : colors.border, borderWidth: 1 },
                ]}
                value={duprRating}
                onChangeText={handleDuprChange}
                placeholder="1.0 - 7.0"
                keyboardType="decimal-pad"
                editable={isEditing}
                placeholderTextColor={colors.textSecondary}
              />
              {!!duprError && <Text style={[commonStyles.textSecondary, { color: colors.accent, marginTop: 6 }]}>{duprError}</Text>}
            </View>

            {isEditing && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <TouchableOpacity style={[buttonStyles.primary, { flex: 1 }]} onPress={handleSaveProfile}>
                  <Text style={buttonStyles.text}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[buttonStyles.secondary, { flex: 1 }]} onPress={cancelEdits}>
                  <Text style={buttonStyles.text}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Privacy & Permissions */}
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Privacy & Permissions</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={commonStyles.text}>Friend Visibility</Text>
                <Text style={commonStyles.textSecondary}>Let friends see when you&apos;re playing</Text>
              </View>
              <Switch
                value={friendVisibility}
                onValueChange={setFriendVisibility}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
                disabled={!isEditing}
              />
            </View>

            <View style={[styles.settingRow, { borderTopWidth: 2, borderTopColor: colors.primary, marginTop: 16, paddingTop: 16 }]}>
              <View style={styles.settingInfo}>
                <Text style={[commonStyles.text, { fontWeight: '600' }]}>Push Notifications</Text>
                <Text style={commonStyles.textSecondary}>
                  {notificationsEnabled ? 'Enabled - You will receive notifications' : 'Disabled - enable to receive updates'}
                </Text>
              </View>

              <Switch
                value={notificationsEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
                disabled={enablingNotifications}
                onValueChange={async (nextValue) => {
                  if (nextValue) {
                    await handleEnableNotifications();
                    return;
                  }

                  Alert.alert(
                    'Turn Off Notifications',
                    Platform.OS === 'ios'
                      ? 'To turn off notifications, open iPhone Settings > Notifications > PickleRadar and disable Allow Notifications.'
                      : 'To turn off notifications, open Android Settings > Notifications > PickleRadar and disable notifications.',
                    [{ text: 'OK' }]
                  );

                  const status = await checkNotificationPermissionStatus();
                  setNotificationsEnabled(status === 'granted');
                }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={commonStyles.text}>Location Services</Text>
                <Text style={commonStyles.textSecondary}>Show nearby courts first</Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
                disabled={!isEditing}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={commonStyles.text}>Privacy Opt-in</Text>
                <Text style={commonStyles.textSecondary}>Allow basic profile info to be visible to friends</Text>
              </View>
              <Switch
                value={privacyOptIn}
                onValueChange={setPrivacyOptIn}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
                disabled={!isEditing}
              />
            </View>
          </View>

          {/* Current Check-in */}
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Current Session</Text>

            {historyLoading ? (
              <View style={{ paddingVertical: 14 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : currentCheckIn ? (
              <>
                <Text style={[commonStyles.text, { marginTop: 8 }]}>
                  You are checked in at <Text style={{ fontWeight: '700' }}>{currentCheckIn.courts?.name || 'a court'}</Text>
                </Text>

                <Text style={[commonStyles.textSecondary, { marginTop: 6 }]}>
                  Expires: {formatDate(currentCheckIn.expires_at)}{' '}
                  {remainingTime ? `(${remainingTime.hours}h ${remainingTime.minutes}m remaining)` : ''}
                </Text>

                <TouchableOpacity
                  style={[buttonStyles.danger, { marginTop: 14 }]}
                  onPress={handleManualCheckOut}
                  disabled={checkingOut}
                >
                  {checkingOut ? <ActivityIndicator color={colors.card} /> : <Text style={buttonStyles.text}>Check Out</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[commonStyles.textSecondary, { marginTop: 8 }]}>You are not currently checked in.</Text>
            )}
          </View>

          {/* Admin Tools */}
          {isAdmin && (
            <View style={commonStyles.card}>
              <Text style={commonStyles.subtitle}>Admin Tools</Text>

              <Text style={[commonStyles.textSecondary, { marginTop: 8 }]}>
                Push Token: {userPushToken ? 'Present ✅' : 'Not set ❌'}
              </Text>

              <TouchableOpacity
                style={[buttonStyles.secondary, { marginTop: 14 }]}
                onPress={handleSendTestPush}
                disabled={sendingTestPush}
              >
                {sendingTestPush ? <ActivityIndicator color={colors.primary} /> : <Text style={buttonStyles.text}>Send Test Push</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Account */}
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Account</Text>

            <View style={{ marginTop: 12 }}>
              <Text style={commonStyles.textSecondary}>Email</Text>
              <Text style={commonStyles.text}>{user.email || '—'}</Text>
            </View>

            <TouchableOpacity style={[buttonStyles.secondary, { marginTop: 16 }]} onPress={handleOpenLegal}>
              <Text style={buttonStyles.text}>Legal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[buttonStyles.secondary, { marginTop: 12 }]} onPress={handleSignOut}>
              <Text style={buttonStyles.text}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[buttonStyles.danger, { marginTop: 12 }]}
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? <ActivityIndicator color={colors.card} /> : <Text style={buttonStyles.text}>Delete Account</Text>}
            </TouchableOpacity>
          </View>

          <LegalFooter />
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal visible={showImagePickerModal} transparent animationType="fade" onRequestClose={() => setShowImagePickerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[commonStyles.subtitle, { marginBottom: 12 }]}>Update Profile Picture</Text>

            <TouchableOpacity style={[buttonStyles.primary, { marginBottom: 10 }]} onPress={handleTakePhoto}>
              <Text style={buttonStyles.text}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[buttonStyles.primary, { marginBottom: 10 }]} onPress={handleChooseFromLibrary}>
              <Text style={buttonStyles.text}>Choose from Library</Text>
            </TouchableOpacity>

            <TouchableOpacity style={buttonStyles.secondary} onPress={() => setShowImagePickerModal(false)}>
              <Text style={buttonStyles.text}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Legal Modal (simple placeholder) */}
      <Modal visible={showLegalModal} transparent animationType="slide" onRequestClose={() => setShowLegalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={[commonStyles.subtitle, { marginBottom: 12 }]}>Legal</Text>

            <TouchableOpacity style={[buttonStyles.secondary, { marginBottom: 10 }]} onPress={() => router.push('/legal/privacy-policy')}>
              <Text style={buttonStyles.text}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[buttonStyles.secondary, { marginBottom: 10 }]} onPress={() => router.push('/legal/terms-of-service')}>
              <Text style={buttonStyles.text}>Terms of Service</Text>
            </TouchableOpacity>

            <TouchableOpacity style={buttonStyles.primary} onPress={() => setShowLegalModal(false)}>
              <Text style={buttonStyles.text}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    width: '100%',
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
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
