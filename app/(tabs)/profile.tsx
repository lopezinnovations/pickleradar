
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, ActivityIndicator, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, updateUserProfile, uploadProfilePicture, loading: authLoading } = useAuth();
  const { checkInHistory, getUserCheckIn, checkOut, getRemainingTime, loading: historyLoading } = useCheckIn(user?.id);
  
  const [skillLevel, setSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [duprRating, setDuprRating] = useState('');
  const [privacyOptIn, setPrivacyOptIn] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState<{ hours: number; minutes: number } | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const hasLoadedUserData = useRef(false);
  const hasLoadedCheckIn = useRef(false);

  useEffect(() => {
    if (user && !hasLoadedUserData.current) {
      console.log('ProfileScreen: User data loaded:', user);
      setSkillLevel(user.skillLevel || 'Beginner');
      setDuprRating(user.duprRating ? user.duprRating.toString() : '');
      setPrivacyOptIn(user.privacyOptIn);
      setNotificationsEnabled(user.notificationsEnabled);
      setLocationEnabled(user.locationEnabled);
      hasLoadedUserData.current = true;
    } else if (!user) {
      hasLoadedUserData.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && !hasLoadedCheckIn.current) {
      loadCurrentCheckIn();
      hasLoadedCheckIn.current = true;
    } else if (!user) {
      hasLoadedCheckIn.current = false;
      setCurrentCheckIn(null);
      setRemainingTime(null);
    }
  }, [user?.id]);

  const loadCurrentCheckIn = async () => {
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
  };

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
  }, [currentCheckIn?.expires_at]);

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library to upload a profile picture.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
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
      console.log('ProfileScreen: Error picking image:', error);
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
              console.log('ProfileScreen: Manual checkout error:', error);
              Alert.alert('Error', 'Failed to check out. Please try again.');
            } finally {
              setCheckingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveSettings = async () => {
    const duprValue = duprRating.trim() ? parseFloat(duprRating) : undefined;
    
    if (duprValue !== undefined && (isNaN(duprValue) || duprValue < 0 || duprValue > 8.0)) {
      Alert.alert('Invalid DUPR Rating', 'DUPR rating must be between 0.0 and 8.0');
      return;
    }

    await updateUserProfile({
      skillLevel,
      duprRating: duprValue,
      privacyOptIn,
      notificationsEnabled,
      locationEnabled,
    });
    Alert.alert('Success', 'Settings saved successfully!');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/welcome');
          },
        },
      ]
    );
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
            android_material_icon_name="account_circle" 
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

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : user.profilePictureUrl ? (
              <Image 
                source={{ uri: user.profilePictureUrl }} 
                style={styles.avatarImage}
              />
            ) : (
              <IconSymbol 
                ios_icon_name="person.crop.circle.fill" 
                android_material_icon_name="account_circle" 
                size={64} 
                color={colors.primary} 
              />
            )}
            <View style={styles.editIconContainer}>
              <IconSymbol 
                ios_icon_name="camera.fill" 
                android_material_icon_name="photo_camera" 
                size={16} 
                color={colors.card} 
              />
            </View>
          </TouchableOpacity>
          <Text style={[commonStyles.title, { color: colors.primary, fontSize: 22 }]}>
            {user.email}
          </Text>
          <View style={styles.userStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{checkInHistory?.length || 0}</Text>
              <Text style={commonStyles.textSecondary}>Check-ins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{skillLevel}</Text>
              <Text style={commonStyles.textSecondary}>Skill Level</Text>
            </View>
            {duprRating && (
              <React.Fragment>
                <View style={styles.statDivider} />
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
                android_material_icon_name="check_circle" 
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
          <Text style={commonStyles.subtitle}>Player Information</Text>
          
          <Text style={[commonStyles.text, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
            Skill Level
          </Text>
          <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
            Select your pickleball skill level
          </Text>
          
          <View style={styles.skillLevelContainer}>
            {(['Beginner', 'Intermediate', 'Advanced'] as const).map((level, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.skillLevelButton,
                  skillLevel === level && styles.skillLevelButtonActive,
                ]}
                onPress={() => setSkillLevel(level)}
              >
                <Text
                  style={[
                    styles.skillLevelText,
                    skillLevel === level && styles.skillLevelTextActive,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[commonStyles.text, { marginTop: 20, marginBottom: 8, fontWeight: '600' }]}>
            DUPR Rating (Optional)
          </Text>
          <Text style={[commonStyles.textSecondary, { marginBottom: 12 }]}>
            Enter your DUPR rating (0.0 - 8.0)
          </Text>
          <TextInput
            style={commonStyles.input}
            placeholder="e.g., 3.5"
            placeholderTextColor={colors.textSecondary}
            value={duprRating}
            onChangeText={setDuprRating}
            keyboardType="decimal-pad"
            maxLength={4}
          />
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
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={commonStyles.text}>Push Notifications</Text>
              <Text style={commonStyles.textSecondary}>
                Get notified when friends check in
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>

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
            />
          </View>
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
                      android_material_icon_name="location_on" 
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

        <TouchableOpacity
          style={buttonStyles.primary}
          onPress={handleSaveSettings}
        >
          <Text style={buttonStyles.text}>Save Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.secondary, { marginTop: 12 }]}
          onPress={handleSignOut}
        >
          <Text style={[buttonStyles.text, { color: colors.accent }]}>Sign Out</Text>
        </TouchableOpacity>
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
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 20,
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
  skillLevelContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  skillLevelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    alignItems: 'center',
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
});
