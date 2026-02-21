// app/(tabs)/profile.tsx
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { IconSymbol } from '@/components/IconSymbol';
import { LegalFooter } from '@/components/LegalFooter';
import * as ImagePicker from 'expo-image-picker';

type RemainingTime = { hours: number; minutes: number };

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pickleballerNickname, setPickleballerNickname] = useState('');
  const [duprRating, setDuprRating] = useState('');
  const [duprError, setDuprError] = useState('');
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);

  // Preferences
  const [privacyOptInValue, setPrivacyOptInValue] = useState(false);
  const [friendVisibilityDraft, setFriendVisibilityDraft] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Check-in
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState<RemainingTime | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // UI state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showConsentPrompt, setShowConsentPrompt] = useState(false);
  const [acceptingConsent, setAcceptingConsent] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  // Delete account
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // --- IMPORTANT: prevents Edge/web from wiping inputs while typing ---
  // Only initialize form once per userId (do NOT depend on needsConsentUpdate in deps).
  const initProfileRef = useRef<string | null>(null);

  const hasLoadedCheckIn = useRef(false);


  const validateDuprRating = (value: string) => {
    if (!value.trim()) {
      setDuprError('');
      return true;
    }
    const duprValue = parseFloat(value);
    if (Number.isNaN(duprValue)) {
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

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
    try {
      await Promise.all([refetchUser(), refetchCheckIns(), loadCurrentCheckIn()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchUser, refetchCheckIns, loadCurrentCheckIn]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) refetchUser();
    }, [refetchUser, user?.id])
  );

  // Initialize form ONCE per userId (prevents ?deleting while typing? in Edge)
  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId || authLoading) return;

    if (initProfileRef.current === userId) return;
    initProfileRef.current = userId;

    const fn = (user as any).firstName ?? (user as any).first_name ?? '';
    const ln = (user as any).lastName ?? (user as any).last_name ?? '';
    const nick = (user as any).pickleballerNickname ?? (user as any).pickleballer_nickname ?? '';
    const dupr = (user as any).duprRating ?? (user as any).dupr_rating;
    setFirstName(typeof fn === 'string' ? fn : '');
    setLastName(typeof ln === 'string' ? ln : '');
    setPickleballerNickname(typeof nick === 'string' ? nick : '');
    setDuprRating(dupr != null && !Number.isNaN(Number(dupr)) ? String(dupr) : '');
    setDuprError('');
    setAgeRange((user as any)?.age_range ?? null);
    setGender((user as any)?.gender ?? null);
    setPrivacyOptInValue(!!((user as any)?.privacyOptIn ?? (user as any)?.privacy_opt_in ?? false));
    setFriendVisibilityDraft((user as any)?.friendVisibility ?? (user as any)?.friend_visibility ?? true);

    try {
      if (typeof needsConsentUpdate === 'function' && needsConsentUpdate()) setShowConsentPrompt(true);
    } catch {}
  }, [user?.id, authLoading]);

  // Reset init guard when signing out / switching accounts
  useEffect(() => {
    setFriendVisibilityDraft((user as any)?.friendVisibility ?? (user as any)?.friend_visibility ?? true);
  }, [(user as any)?.friendVisibility, (user as any)?.friend_visibility]);

  useEffect(() => {
    if (!user?.id && !authLoading) {
      initProfileRef.current = null;
      setIsEditing(false);
      setPrivacyOptInValue(false);
      setFriendVisibilityDraft(true);
      setCurrentCheckIn(null);
      setRemainingTime(null);
      hasLoadedCheckIn.current = false;
    }
  }, [user?.id, authLoading]);

  // Check-in load once per session
  useEffect(() => {
    if (user?.id && !hasLoadedCheckIn.current) {
      loadCurrentCheckIn();
      hasLoadedCheckIn.current = true;
    }
  }, [user?.id, loadCurrentCheckIn]);

  // Update remaining time
  useEffect(() => {
    if (currentCheckIn?.expires_at) {
      const updateTime = () => {
        const time = getRemainingTime(currentCheckIn.expires_at);
        setRemainingTime({ hours: time.hours, minutes: time.minutes });

        if ((time as any).totalMinutes !== undefined && (time as any).totalMinutes <= 0) {
          hasLoadedCheckIn.current = false;
          loadCurrentCheckIn();
        }
      };

      updateTime();
      const interval = setInterval(updateTime, 60000);
      return () => clearInterval(interval);
    }
  }, [currentCheckIn?.expires_at, getRemainingTime, loadCurrentCheckIn]);

  const handleAcceptConsent = async () => {
    setAcceptingConsent(true);
    try {
      const result = await acceptConsent();
      if ((result as any).success) {
        setShowConsentPrompt(false);
        Alert.alert('Success', 'Thank you for accepting the updated terms!');
      } else {
        Alert.alert('Error', (result as any).error || 'Failed to update consent. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to update consent. Please try again.');
    } finally {
      setAcceptingConsent(false);
    }
  };

  const handlePrivacyToggle = useCallback(
    async (next: boolean) => {
      if (!user?.id || savingPrefs) return;

      const prev = privacyOptInValue;
      setPrivacyOptInValue(next);
      setSavingPrefs(true);

      try {
        // DB-safe (public.users.privacy_opt_in)
        await updateUserProfile({ privacyOptIn: next });
      } catch (e: any) {
        setPrivacyOptInValue(prev);
        Alert.alert('Error', e?.message || 'Failed to update preference.');
      } finally {
        setSavingPrefs(false);
      }
    },
    [user?.id, savingPrefs, privacyOptInValue, updateUserProfile]
  );

  const handlePickImage = async () => {
    if (!isEditing) return;
    setShowImagePickerModal(true);
  };

  const handleTakePhoto = async () => {
    setShowImagePickerModal(false);
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Profile picture upload is not available on web.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access to take a photo.');
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
      }
    } catch (error) {
      console.error('[Profile] take photo error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChooseFromLibrary = async () => {
    setShowImagePickerModal(false);
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Profile picture upload is not available on web.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
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
      }
    } catch (error) {
      console.error('[Profile] pick image error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleManualCheckOut = () => {
    if (!currentCheckIn || !user) return;

    Alert.alert('Check Out', `Are you sure you want to check out?`, [
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
    if (duprValue !== undefined && (Number.isNaN(duprValue) || duprValue < 1 || duprValue > 7)) {
      return Alert.alert('Invalid DUPR Rating', 'DUPR rating must be between 1.0 and 7.0');
    }

    try {
      await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pickleballerNickname: pickleballerNickname.trim() || undefined,
        duprRating: duprValue,
        age_range: ageRange,
        gender,
        privacyOptIn: privacyOptInValue,
        friendVisibility: friendVisibilityDraft,
      });
      await refetchUser();
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile. Please try again.');
    }
  };

  const cancelEdits = () => {
    if (!user) return;
    setFirstName((user as any).firstName || (user as any).first_name || '');
    setLastName((user as any).lastName || (user as any).last_name || '');
    setPickleballerNickname((user as any).pickleballerNickname || (user as any).pickleballer_nickname || '');
    setDuprRating(
      (user as any).duprRating
        ? String((user as any).duprRating)
        : (user as any).dupr_rating
        ? String((user as any).dupr_rating)
        : ''
    );
    setDuprError('');
    setAgeRange((user as any)?.age_range ?? null);
    setGender((user as any)?.gender ?? null);
    setPrivacyOptInValue(!!((user as any)?.privacyOptIn ?? (user as any)?.privacy_opt_in ?? false));
    setFriendVisibilityDraft((user as any)?.friendVisibility ?? (user as any)?.friend_visibility ?? true);
    setIsEditing(false);
  };

  const handleDeleteAccountPress = () => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setShowDeleteModal(false);
    setDeleteConfirmText('');

    if (!user?.id) return;

    setDeletingAccount(true);
    try {
      // Your schema doesn?t show is_deleted; don?t write it unless you actually have it.
      // If you DO have it, change to: await updateUserProfile({ is_deleted: true });
      Alert.alert('Not Implemented', 'Account deletion flag is not available in your users table yet.');
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
            router.replace('/auth');
            Alert.alert('Signed Out', 'You have been signed out successfully.');
          } catch (err) {
            console.error('[Profile] handleSignOut error:', err);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  // ---------- UI STATES ----------
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

  const profilePictureUrl = (user as any)?.profilePictureUrl ?? (user as any)?.profile_picture_url ?? null;

  // While editing, show the live text fields in the header so it doesn?t feel ?stale?
  const headerName =
    firstName.trim() || lastName.trim()
      ? `${firstName.trim()} ${lastName.trim()}`.trim()
      : (user as any).firstName && (user as any).lastName
      ? `${(user as any).firstName} ${(user as any).lastName}`
      : (user as any).first_name && (user as any).last_name
      ? `${(user as any).first_name} ${(user as any).last_name}`
      : (user as any).phone || (user as any).email || 'User';

  const headerNickname =
    pickleballerNickname.trim()
      ? pickleballerNickname.trim()
      : (user as any).pickleballerNickname || (user as any).pickleballer_nickname || '';

  return (
    <View style={commonStyles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Profile</Text>

        <TouchableOpacity style={styles.gearButton} onPress={() => setIsEditing((p) => !p)}>
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(120, insets.bottom + 80) }]}
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
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickImage}
              disabled={uploadingImage || !isEditing}
            >
              {uploadingImage ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : profilePictureUrl ? (
                <Image source={{ uri: profilePictureUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <IconSymbol ios_icon_name="person.crop.circle.fill" android_material_icon_name="account-circle" size={64} color={colors.primary} />
              )}

              {isEditing && (
                <View style={styles.editIconContainer}>
                  <IconSymbol ios_icon_name="camera.fill" android_material_icon_name="photo-camera" size={16} color={colors.card} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={[commonStyles.title, { color: colors.primary, fontSize: 22 }]}>{headerName}</Text>

            {!!headerNickname && (
              <Text style={[commonStyles.textSecondary, { fontSize: 16, marginTop: 4 }]}>
                &quot;{headerNickname}&quot;
              </Text>
            )}

            <View style={styles.userStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{checkInHistory?.length || 0}</Text>
                <Text style={commonStyles.textSecondary}>Check-ins</Text>
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
              {!!duprError && (
                <Text style={[commonStyles.textSecondary, { color: colors.accent, marginTop: 6 }]}>{duprError}</Text>
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={commonStyles.text}>Age Range (optional)</Text>
              {isEditing ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 }}>
                  {[
                    { value: '18-24', label: '18–24' },
                    { value: '25-34', label: '25–34' },
                    { value: '35-44', label: '35–44' },
                    { value: '45-54', label: '45–54' },
                    { value: '55+', label: '55+' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8, marginBottom: 8 },
                        ageRange === opt.value ? { backgroundColor: colors.primary } : { backgroundColor: colors.border },
                      ]}
                      onPress={() => setAgeRange(ageRange === opt.value ? null : opt.value)}
                    >
                      <Text style={[commonStyles.text, ageRange === opt.value ? { color: colors.card } : {}]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={[commonStyles.textSecondary, { marginTop: 8 }]}>
                  {ageRange ? { '18-24': '18–24', '25-34': '25–34', '35-44': '35–44', '45-54': '45–54', '55+': '55+', prefer_not_to_say: 'Prefer not to say' }[ageRange] ?? ageRange : 'Not set'}
                </Text>
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={commonStyles.text}>Gender (optional)</Text>
              {isEditing ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 }}>
                  {[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8, marginBottom: 8 },
                        gender === opt.value ? { backgroundColor: colors.primary } : { backgroundColor: colors.border },
                      ]}
                      onPress={() => setGender(gender === opt.value ? null : opt.value)}
                    >
                      <Text style={[commonStyles.text, gender === opt.value ? { color: colors.card } : {}]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={[commonStyles.textSecondary, { marginTop: 8 }]}>
                  {gender ? { male: 'Male', female: 'Female', prefer_not_to_say: 'Prefer not to say' }[gender] ?? gender : 'Not set'}
                </Text>
              )}
            </View>

            {isEditing && (
              <TouchableOpacity style={[buttonStyles.primary, { marginTop: 18, width: '100%' }]} onPress={handleSaveProfile}>
                <Text style={buttonStyles.text}>Save</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Preferences */}
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Preferences</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={commonStyles.text}>Show my activity to friends</Text>
                <Text style={commonStyles.textSecondary}>Let friends see when you&apos;re playing</Text>
              </View>

              {isEditing ? (
                <Switch
                  value={friendVisibilityDraft}
                  onValueChange={setFriendVisibilityDraft}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.card}
                />
              ) : (
                <Text style={commonStyles.text}>
                  {((user as any)?.friendVisibility ?? (user as any)?.friend_visibility ?? true) ? 'On' : 'Off'}
                </Text>
              )}
            </View>

            <Text style={[commonStyles.textSecondary, { marginTop: 10 }]}>
              Location and Notifications can be managed in your phone&apos;s Settings.
            </Text>
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
                  You are checked in at{' '}
                  <Text style={{ fontWeight: '700' }}>{currentCheckIn.courts?.name || 'a court'}</Text>
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

          {/* Account */}
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Account</Text>

            <View style={{ marginTop: 12 }}>
              <Text style={commonStyles.textSecondary}>Email</Text>
              <Text style={commonStyles.text}>{(user as any).email || '?'}</Text>
            </View>
          </View>

          {/* Sign Out */}
          <TouchableOpacity style={[buttonStyles.primary, styles.signOutButton]} onPress={handleSignOut}>
            <Text style={buttonStyles.text}>Sign Out</Text>
          </TouchableOpacity>

          {/* Danger Zone */}
          <View style={[commonStyles.card, styles.dangerZone]}>
            <Text style={[commonStyles.subtitle, { color: colors.error }]}>Danger Zone</Text>
            <Text style={[commonStyles.textSecondary, { marginTop: 8 }]}>
              Permanently delete your account. This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[buttonStyles.danger, { marginTop: 16 }]}
              onPress={handleDeleteAccountPress}
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

            {Platform.OS === 'web' && (
              <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
                Profile picture upload is not available on web.
              </Text>
            )}

            <TouchableOpacity style={[buttonStyles.primary, { marginBottom: 10 }]} onPress={handleTakePhoto} disabled={Platform.OS === 'web'}>
              <Text style={buttonStyles.text}>Take Photo</Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={[buttonStyles.primary, { marginBottom: 10 }]}
              onPress={handleChooseFromLibrary}
              disabled={Platform.OS === 'web'}
            >
              <Text style={buttonStyles.text}>Choose from Library</Text>
            </TouchableOpacity>

            <TouchableOpacity style={buttonStyles.secondary} onPress={() => setShowImagePickerModal(false)}>
              <Text style={buttonStyles.text}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={[commonStyles.subtitle, { color: colors.error, marginBottom: 8 }]}>Delete Account</Text>
            <Text style={[commonStyles.textSecondary, { marginBottom: 16 }]}>
              Your profile will be removed from search, friends disconnected, and you will be signed out. Type DELETE to confirm.
            </Text>
            <TextInput
              style={[commonStyles.input, { marginBottom: 16 }]}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textSecondary}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[buttonStyles.secondary, { flex: 1 }]} onPress={() => setShowDeleteModal(false)}>
                <Text style={buttonStyles.textSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[buttonStyles.danger, { flex: 1, opacity: deleteConfirmText === 'DELETE' ? 1 : 0.5 }]}
                onPress={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'DELETE'}
              >
                <Text style={buttonStyles.text}>Delete Account</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  },
  signOutButton: {
    marginTop: 8,
    marginBottom: 8,
  },
  dangerZone: {
    borderColor: colors.error,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 24,
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