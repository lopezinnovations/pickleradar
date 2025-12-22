
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useCourts } from '@/hooks/useCourts';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { SkillLevelBars } from '@/components/SkillLevelBars';

export default function CourtDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { courts, refetch } = useCourts();
  const { user } = useAuth();
  const { checkIn, checkOut, getUserCheckIn, loading } = useCheckIn();
  
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null);

  const court = courts.find(c => c.id === id);

  useEffect(() => {
    if (user && court) {
      checkCurrentCheckIn();
    }
  }, [user, court]);

  const checkCurrentCheckIn = async () => {
    if (!user || !court) return;
    const checkInData = await getUserCheckIn(user.id);
    if (checkInData && checkInData.court_id === court.id) {
      setIsCheckedIn(true);
      setCurrentCheckIn(checkInData);
    } else {
      setIsCheckedIn(false);
      setCurrentCheckIn(null);
    }
  };

  const handleCheckIn = async () => {
    if (!user || !court) {
      Alert.alert('Error', 'Please log in to check in');
      return;
    }

    const result = await checkIn(user.id, court.id, selectedSkillLevel);
    
    if (result.success) {
      setIsCheckedIn(true);
      Alert.alert('Success', `You're checked in at ${court.name}!`);
      // Refresh court data to update player count
      await refetch();
      await checkCurrentCheckIn();
    } else {
      Alert.alert('Error', result.error || 'Failed to check in');
    }
  };

  const handleCheckOut = async () => {
    if (!user || !court) return;

    const result = await checkOut(user.id, court.id);
    
    if (result.success) {
      setIsCheckedIn(false);
      setCurrentCheckIn(null);
      Alert.alert('Success', 'You've checked out!');
      // Refresh court data to update player count
      await refetch();
    } else {
      Alert.alert('Error', result.error || 'Failed to check out');
    }
  };

  if (!court) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={commonStyles.text}>Court not found</Text>
        <TouchableOpacity 
          style={[buttonStyles.primary, { marginTop: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={buttonStyles.text}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getActivityColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return colors.error;
      case 'medium': return colors.accent;
      case 'low': return colors.success;
    }
  };

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
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
          <Text style={commonStyles.title}>{court.name}</Text>
          <View style={styles.addressContainer}>
            <IconSymbol 
              ios_icon_name="location.fill" 
              android_material_icon_name="location_on" 
              size={20} 
              color={colors.textSecondary} 
            />
            <Text style={[commonStyles.textSecondary, { marginLeft: 6, flex: 1 }]}>
              {court.address}
            </Text>
          </View>
        </View>

        <View style={commonStyles.card}>
          <View style={styles.activityHeader}>
            <Text style={commonStyles.subtitle}>Current Activity</Text>
            <View style={[styles.activityBadge, { backgroundColor: getActivityColor(court.activityLevel) }]}>
              <Text style={styles.activityText}>
                {court.activityLevel.charAt(0).toUpperCase() + court.activityLevel.slice(1)}
              </Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <View style={styles.statIcon}>
                <IconSymbol 
                  ios_icon_name="person.2.fill" 
                  android_material_icon_name="people" 
                  size={24} 
                  color={colors.primary} 
                />
              </View>
              <View style={styles.statContent}>
                <Text style={commonStyles.textSecondary}>Active Players</Text>
                <Text style={[commonStyles.text, styles.statValue]}>
                  {court.currentPlayers} {court.currentPlayers === 1 ? 'player' : 'players'}
                </Text>
              </View>
            </View>

            {court.currentPlayers > 0 && (
              <View style={styles.statRow}>
                <View style={styles.statIcon}>
                  <IconSymbol 
                    ios_icon_name="chart.bar.fill" 
                    android_material_icon_name="bar_chart" 
                    size={24} 
                    color={colors.primary} 
                  />
                </View>
                <View style={styles.statContent}>
                  <Text style={commonStyles.textSecondary}>Average Skill Level</Text>
                  <View style={styles.skillLevelContainer}>
                    <SkillLevelBars 
                      averageSkillLevel={court.averageSkillLevel} 
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={[commonStyles.text, { marginLeft: 12 }]}>
                      {court.averageSkillLevel.toFixed(1)} / 3.0
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {!isCheckedIn ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Check In</Text>
            <Text style={[commonStyles.textSecondary, { marginBottom: 16 }]}>
              Select your skill level and let others know you're here!
            </Text>

            <View style={styles.skillLevelButtons}>
              {(['Beginner', 'Intermediate', 'Advanced'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.skillLevelButton,
                    selectedSkillLevel === level && styles.skillLevelButtonActive,
                  ]}
                  onPress={() => setSelectedSkillLevel(level)}
                >
                  <Text
                    style={[
                      styles.skillLevelText,
                      selectedSkillLevel === level && styles.skillLevelTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[buttonStyles.primary, { marginTop: 20 }]}
              onPress={handleCheckIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={buttonStyles.text}>Check In</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[commonStyles.card, { backgroundColor: colors.highlight }]}>
            <View style={styles.checkedInHeader}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check_circle" 
                size={32} 
                color={colors.success} 
              />
              <Text style={[commonStyles.subtitle, { marginLeft: 12 }]}>You're Checked In!</Text>
            </View>
            
            <Text style={[commonStyles.textSecondary, { marginTop: 12, marginBottom: 20 }]}>
              Your check-in will expire in 3 hours or you can check out manually.
            </Text>

            <TouchableOpacity
              style={[buttonStyles.secondary, { borderColor: colors.error }]}
              onPress={handleCheckOut}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <Text style={[buttonStyles.textSecondary, { color: colors.error }]}>Check Out</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={commonStyles.card}>
          <Text style={commonStyles.subtitle}>About This Court</Text>
          <Text style={[commonStyles.textSecondary, { marginTop: 8 }]}>
            This is a public pickleball court. Check in to let others know you're playing and see who else is here!
          </Text>
        </View>
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
    marginBottom: 24,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activityBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  activityText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.card,
  },
  statsContainer: {
    gap: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
    marginLeft: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  skillLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  skillLevelButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  skillLevelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  skillLevelButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  skillLevelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  skillLevelTextActive: {
    color: colors.card,
  },
  checkedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
