
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useCourts } from '@/hooks/useCourts';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { IconSymbol } from '@/components/IconSymbol';
import { SkillLevelBars } from '@/components/SkillLevelBars';

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180]; // Duration options in minutes

export default function CourtDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { courts, refetch } = useCourts(user?.id);
  const { checkIn, checkOut, getUserCheckIn, getRemainingTime, loading } = useCheckIn();
  const { friends } = useFriends(user?.id);
  
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [selectedDuration, setSelectedDuration] = useState(90); // Default 90 minutes (1.5 hours)
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null);
  const [isLoadingCourt, setIsLoadingCourt] = useState(true);
  const [remainingTime, setRemainingTime] = useState<{ hours: number; minutes: number } | null>(null);
  
  const hasCheckedInitialCheckIn = useRef(false);

  const court = courts.find(c => c.id === id);

  // Get friends playing at this court
  const friendsAtCourt = friends.filter(friend => friend.currentCourtId === id);

  // Refresh court data when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('CourtDetailScreen: Screen focused, refreshing court data');
      refetch();
    }, [refetch])
  );

  // Set loading to false once courts are loaded
  useEffect(() => {
    if (courts.length > 0) {
      setIsLoadingCourt(false);
    }
  }, [courts.length]);

  // Check current check-in only once when user and court are available
  useEffect(() => {
    if (user && court && !hasCheckedInitialCheckIn.current) {
      hasCheckedInitialCheckIn.current = true;
      checkCurrentCheckIn();
    }
  }, [user?.id, court?.id]);

  // Update remaining time every minute
  useEffect(() => {
    if (currentCheckIn?.expires_at) {
      const updateTime = () => {
        const time = getRemainingTime(currentCheckIn.expires_at);
        setRemainingTime({ hours: time.hours, minutes: time.minutes });
      };
      
      updateTime();
      const interval = setInterval(updateTime, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [currentCheckIn?.expires_at]);

  const checkCurrentCheckIn = async () => {
    if (!user || !court) return;
    const checkInData = await getUserCheckIn(user.id);
    if (checkInData && checkInData.court_id === court.id) {
      setIsCheckedIn(true);
      setCurrentCheckIn(checkInData);
      const time = getRemainingTime(checkInData.expires_at);
      setRemainingTime({ hours: time.hours, minutes: time.minutes });
    } else {
      setIsCheckedIn(false);
      setCurrentCheckIn(null);
      setRemainingTime(null);
    }
  };

  const handleCheckIn = async () => {
    if (!user || !court) {
      Alert.alert('Error', 'Please log in to check in');
      return;
    }

    const result = await checkIn(user.id, court.id, selectedSkillLevel, selectedDuration);
    
    if (result.success) {
      setIsCheckedIn(true);
      const hours = Math.floor(selectedDuration / 60);
      const minutes = selectedDuration % 60;
      let durationText = '';
      if (hours > 0) {
        durationText = `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) {
          durationText += ` and ${minutes} minutes`;
        }
      } else {
        durationText = `${minutes} minutes`;
      }
      Alert.alert('Success', `You're checked in at ${court.name} for ${durationText}!`);
      await refetch();
      hasCheckedInitialCheckIn.current = false;
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
      setRemainingTime(null);
      Alert.alert('Success', 'You have checked out!');
      await refetch();
    } else {
      Alert.alert('Error', result.error || 'Failed to check out');
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  // Show loading state while courts are being fetched
  if (isLoadingCourt) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading court details...</Text>
      </View>
    );
  }

  // Show error state if court is not found after loading
  if (!court) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }]}>
        <IconSymbol 
          ios_icon_name="exclamationmark.triangle.fill" 
          android_material_icon_name="warning" 
          size={64} 
          color={colors.error} 
        />
        <Text style={[commonStyles.title, { marginTop: 24, textAlign: 'center' }]}>Court Not Found</Text>
        <Text style={[commonStyles.textSecondary, { marginTop: 12, textAlign: 'center' }]}>
          The court you're looking for could not be found. It may have been removed or the ID is incorrect.
        </Text>
        <TouchableOpacity 
          style={[buttonStyles.primary, { marginTop: 32 }]}
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

  const skillLevels: Array<'Beginner' | 'Intermediate' | 'Advanced'> = ['Beginner', 'Intermediate', 'Advanced'];

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

            {court.friendsPlayingCount > 0 && (
              <View style={styles.statRow}>
                <View style={styles.statIcon}>
                  <IconSymbol 
                    ios_icon_name="person.2.fill" 
                    android_material_icon_name="people" 
                    size={24} 
                    color={colors.accent} 
                  />
                </View>
                <View style={styles.statContent}>
                  <Text style={commonStyles.textSecondary}>Friends Playing</Text>
                  <Text style={[commonStyles.text, styles.statValue, { color: colors.accent }]}>
                    {court.friendsPlayingCount} {court.friendsPlayingCount === 1 ? 'friend' : 'friends'}
                  </Text>
                </View>
              </View>
            )}

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

        {friendsAtCourt.length > 0 && (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Friends at This Court</Text>
            {friendsAtCourt.map((friend, index) => (
              <View key={index} style={styles.friendItem}>
                <View style={styles.friendIcon}>
                  <IconSymbol 
                    ios_icon_name="person.fill" 
                    android_material_icon_name="person" 
                    size={20} 
                    color={colors.primary} 
                  />
                </View>
                <View style={styles.friendInfo}>
                  <Text style={commonStyles.text}>{friend.friendEmail}</Text>
                  {friend.remainingTime && (
                    <Text style={commonStyles.textSecondary}>
                      {friend.remainingTime.hours > 0 && `${friend.remainingTime.hours}h `}
                      {friend.remainingTime.minutes}m remaining
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {!isCheckedIn ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Check In</Text>
            <Text style={[commonStyles.textSecondary, { marginBottom: 16 }]}>
              Select your skill level and how long you plan to stay
            </Text>

            <Text style={[commonStyles.text, { marginBottom: 8, fontWeight: '600' }]}>Skill Level</Text>
            <View style={styles.skillLevelButtons}>
              {skillLevels.map((level, index) => (
                <TouchableOpacity
                  key={index}
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

            <Text style={[commonStyles.text, { marginTop: 20, marginBottom: 8, fontWeight: '600' }]}>
              Duration
            </Text>
            <View style={styles.durationGrid}>
              {DURATION_OPTIONS.map((duration, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.durationButton,
                    selectedDuration === duration && styles.durationButtonActive,
                  ]}
                  onPress={() => setSelectedDuration(duration)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      selectedDuration === duration && styles.durationTextActive,
                    ]}
                  >
                    {formatDuration(duration)}
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
              <Text style={[commonStyles.subtitle, { marginLeft: 12 }]}>You&apos;re Checked In!</Text>
            </View>
            
            {remainingTime && (
              <View style={styles.remainingTimeContainer}>
                <IconSymbol 
                  ios_icon_name="clock.fill" 
                  android_material_icon_name="schedule" 
                  size={20} 
                  color={colors.primary} 
                />
                <Text style={[commonStyles.text, { marginLeft: 8, fontWeight: '600' }]}>
                  {remainingTime.hours > 0 && `${remainingTime.hours}h `}
                  {remainingTime.minutes}m remaining
                </Text>
              </View>
            )}
            
            <Text style={[commonStyles.textSecondary, { marginTop: 12, marginBottom: 20 }]}>
              You will be automatically checked out when your time expires, or you can check out manually.
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
            This is a public pickleball court. Check in to let others know you&apos;re playing and see who else is here!
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
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  friendIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.highlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
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
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  durationButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  durationTextActive: {
    color: colors.card,
  },
  checkedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  remainingTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
});
