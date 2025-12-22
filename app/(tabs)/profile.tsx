
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useCheckIn } from '@/hooks/useCheckIn';
import { IconSymbol } from '@/components/IconSymbol';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, updateUserProfile } = useAuth();
  const { checkInHistory, loading: historyLoading } = useCheckIn(user?.id);
  
  const [skillLevel, setSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>(
    user?.skillLevel || 'Beginner'
  );
  const [privacyOptIn, setPrivacyOptIn] = useState(user?.privacyOptIn || false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled || false);
  const [locationEnabled, setLocationEnabled] = useState(user?.locationEnabled || false);

  useEffect(() => {
    if (user) {
      setSkillLevel(user.skillLevel || 'Beginner');
      setPrivacyOptIn(user.privacyOptIn);
      setNotificationsEnabled(user.notificationsEnabled);
      setLocationEnabled(user.locationEnabled);
    }
  }, [user]);

  const handleSaveSettings = async () => {
    await updateUserProfile({
      skillLevel,
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
          Please log in to view profile
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
          <View style={styles.avatarContainer}>
            <IconSymbol 
              ios_icon_name="person.crop.circle.fill" 
              android_material_icon_name="account_circle" 
              size={64} 
              color={colors.primary} 
            />
          </View>
          <Text style={[commonStyles.title, { color: colors.primary }]}>{user.email}</Text>
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
          </View>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.subtitle}>Skill Level</Text>
          <Text style={[commonStyles.textSecondary, { marginTop: 4, marginBottom: 12 }]}>
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
    borderWidth: 3,
    borderColor: colors.primary,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
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
    marginHorizontal: 16,
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
