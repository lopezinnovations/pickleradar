import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useCheckIn, getCheckInMutationPending } from '@/hooks/useCheckIn';
import { useFriends } from '@/hooks/useFriends';
import { useFavorites } from '@/hooks/useFavorites';
import { IconSymbol } from '@/components/IconSymbol';
import { SkillLevelBars } from '@/components/SkillLevelBars';
import { Court } from '@/types';
import { supabase, isSupabaseConfigured } from "@/app/integrations/supabase/client";
import { calculateDistance } from '@/utils/locationUtils';

const DURATION_OPTIONS = [60, 90, 120] as const;
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
type SkillLevel = (typeof SKILL_LEVELS)[number];

const withTimeout = async <T,>(p: Promise<T>, ms = 12000): Promise<T> => {
  return (await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms)
    ),
  ])) as T;
};

const skillLevelToNumber = (skillLevel: string): number => {
  switch (skillLevel) {
    case 'Beginner':
      return 1;
    case 'Intermediate':
      return 2;
    case 'Advanced':
      return 3;
    default:
      return 2;
  }
};

async function fetchCourtById(courtId: string, userId?: string): Promise<Court | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: courtRow, error: courtError } = await withTimeout(
      supabase
        .from('courts')
        .select(
          'id, name, address, city, state, zip_code, latitude, longitude, description, open_time, close_time, google_place_id'
        )
        .eq('id', courtId)
        .maybeSingle(),
      12000
    );

    if (courtError || !courtRow) return null;

    const { data: checkIns } = await withTimeout(
      supabase
        .from('check_ins')
        .select('skill_level, user_id, users(dupr_rating)')
        .eq('court_id', courtId)
        .gte('expires_at', new Date().toISOString()),
      12000
    );

    const currentPlayers = checkIns?.length || 0;

    let friendsPlayingCount = 0;
    if (userId) {
      const { data: friendsData } = await withTimeout(
        supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', userId)
          .eq('status', 'accepted'),
        12000
      );
      const friendIds = new Set((friendsData || []).map((f: any) => f.friend_id));
      friendsPlayingCount = (checkIns || []).filter((c: any) => friendIds.has(c.user_id)).length;
    }

    let averageSkillLevel = 0;
    if (currentPlayers > 0 && checkIns) {
      const skillSum = (checkIns as any[]).reduce(
        (sum, c) => sum + skillLevelToNumber(c.skill_level),
        0
      );
      averageSkillLevel = skillSum / currentPlayers;
    }

    let averageDupr: number | undefined;
    if (checkIns && checkIns.length > 0) {
      const ratings = (checkIns as any[])
        .map((c) => c.users?.dupr_rating)
        .filter((r): r is number => r != null);
      if (ratings.length > 0) averageDupr = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }

    let activityLevel: 'low' | 'medium' | 'high' = 'low';
    if (currentPlayers >= 6) activityLevel = 'high';
    else if (currentPlayers >= 3) activityLevel = 'medium';

    let isFavorite = false;
    if (userId) {
      const { data: fav } = await withTimeout(
        supabase
          .from('court_favorites')
          .select('court_id')
          .eq('user_id', userId)
          .eq('court_id', courtId)
          .maybeSingle(),
        12000
      );
      isFavorite = !!fav;
    }

    return {
      id: courtRow.id,
      name: courtRow.name,
      address: courtRow.address,
      city: courtRow.city,
      state: (courtRow as { state?: string | null }).state ?? null,
      zip_code: courtRow.zip_code,
      latitude: courtRow.latitude,
      longitude: courtRow.longitude,
      activityLevel,
      currentPlayers,
      averageSkillLevel,
      friendsPlayingCount,
      description: courtRow.description,
      openTime: courtRow.open_time,
      closeTime: courtRow.close_time,
      googlePlaceId: courtRow.google_place_id,
      averageDupr,
      isFavorite,
    };
  } catch (e) {
    console.warn('[COURT] fetchCourtById failed:', e);
    return null;
  }
}

export default function CourtDetailScreen() {
  const router = useRouter();
  const { id: courtId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { userLocation } = useLocation();
  const { toggleFavorite, isFavorite } = useFavorites(user?.id);

  const { checkIn, checkOut, getUserCheckIn, getRemainingTime, loading: checkInLoading, refetch } =
    useCheckIn(user?.id);

  const { friends } = useFriends(user?.id);

  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedSkill, setSelectedSkill] = useState<SkillLevel>('Intermediate');
  const [selectedDuration, setSelectedDuration] = useState<(typeof DURATION_OPTIONS)[number]>(90);

  const [currentCheckIn, setCurrentCheckIn] = useState<{
    courtId: string;
    courtName: string;
    skillLevel: string;
    expiresAt: string;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const isMutating = actionLoading || checkInLoading;

  // Prevent flicker: don't overwrite optimistic UI with a read right after mutation
  const optimisticUntilRef = useRef<number>(0);

  const loadCourt = useCallback(async () => {
    if (!courtId) return null;
    const c = await fetchCourtById(courtId, user?.id);
    setCourt(c);
    return c;
  }, [courtId, user?.id]);

  const loadCurrentCheckIn = useCallback(async () => {
    if (!user) return;

    if (Date.now() < optimisticUntilRef.current) return;
    if (getCheckInMutationPending() === user.id) return;

    const data = await getUserCheckIn(user.id);
    if (data) {
      setCurrentCheckIn({
        courtId: data.court_id,
        courtName: (data.courts as any)?.name || 'Unknown',
        skillLevel: data.skill_level,
        expiresAt: data.expires_at,
      });
    } else {
      setCurrentCheckIn(null);
    }
  }, [user, getUserCheckIn]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCourt(), loadCurrentCheckIn(), refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadCourt, loadCurrentCheckIn, refetch]);

  useEffect(() => {
    setLoading(true);
    loadCourt()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadCourt]);

  useEffect(() => {
    loadCurrentCheckIn().catch(() => {});
  }, [loadCurrentCheckIn, courtId]);

  const isCheckedInHere = useMemo(() => {
    return !!currentCheckIn && String(currentCheckIn.courtId) === String(courtId);
  }, [currentCheckIn, courtId]);

  const remaining = isCheckedInHere && currentCheckIn ? getRemainingTime(currentCheckIn.expiresAt) : null;

  const handleCheckIn = async () => {
    if (!user || !courtId || !court) return;
    if (isMutating) return;

    setActionLoading(true);
    try {
      const result = await checkIn(user.id, courtId, selectedSkill, selectedDuration);

      if (result.success) {
        optimisticUntilRef.current = Date.now() + 2500;

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + selectedDuration);

        setCurrentCheckIn({
          courtId,
          courtName: court.name,
          skillLevel: selectedSkill,
          expiresAt: expiresAt.toISOString(),
        });

        await refresh().catch(() => {});
        Alert.alert('Checked In', `You're checked in at ${court.name}.`);
      } else if (result.code === 'ALREADY_CHECKED_IN' && result.courtId) {
        Alert.alert(
          'Already Checked In',
          `You're checked in at ${result.courtName || 'another court'}. Check out first to check in here.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to that court', onPress: () => router.push(`/court/${result.courtId}` as any) },
          ]
        );
      } else {
        Alert.alert('Check-in Failed', result.error || 'Please try again');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !courtId) return;
    if (isMutating) return;

    setActionLoading(true);
    try {
      const result = await checkOut(user.id, courtId, court?.name);

      if (result.success) {
        optimisticUntilRef.current = Date.now() + 2500;
        setCurrentCheckIn(null);
        await refresh().catch(() => {});
        Alert.alert('Checked Out', "You've been checked out.");
      } else {
        Alert.alert('Check-out Failed', result.error || 'Please try again');
      }
    } catch {
      Alert.alert('Check-out Failed', 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  };

  const distance =
    court && userLocation?.latitude && userLocation?.longitude
      ? calculateDistance(userLocation.latitude, userLocation.longitude, court.latitude, court.longitude)
      : undefined;

  const friendsAtCourt = (friends || []).filter((f: any) => f.currentCourtId === courtId);

  if (!courtId) {
    return (
      <View style={[commonStyles.container, commonStyles.centered]}>
        <Stack.Screen options={{ title: 'Court' }} />
        <Text style={commonStyles.textSecondary}>Invalid court</Text>
      </View>
    );
  }

  if (loading || !court) {
    return (
      <View style={[commonStyles.container, commonStyles.centered]}>
        <Stack.Screen options={{ title: 'Court' }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 12 }]}>
          {loading ? 'Loading court...' : 'Court not found'}
        </Text>
        {!loading && (
          <TouchableOpacity style={[buttonStyles.primary, { marginTop: 16 }]} onPress={() => router.back()}>
            <Text style={buttonStyles.text}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <Stack.Screen options={{ title: court.name }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.courtName}>{court.name}</Text>
            <TouchableOpacity
              onPress={() => toggleFavorite(court.id)}
              style={styles.favButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol
                ios_icon_name={isFavorite(court.id) ? 'heart.fill' : 'heart'}
                android_material_icon_name={isFavorite(court.id) ? 'favorite' : 'favorite-border'}
                size={24}
                color={isFavorite(court.id) ? colors.error : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {court.address && <Text style={styles.address}>{court.address}</Text>}
          {(court.city || court.state || court.zip_code) && (
            <Text style={styles.city}>
              {[court.city, court.state].filter(Boolean).join(', ') + (court.zip_code ? ` ${court.zip_code}` : '')}
            </Text>
          )}
        </View>

        <View style={styles.metaRow}>
          {typeof distance === 'number' && (
            <View style={styles.metaPill}>
              <IconSymbol ios_icon_name="location.fill" android_material_icon_name="location-on" size={14} color={colors.primary} />
              <Text style={styles.metaText}>{distance.toFixed(1)} mi</Text>
            </View>
          )}
          <View style={styles.metaPill}>
            <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="people" size={14} color={colors.primary} />
            <Text style={styles.metaText}>{court.currentPlayers} players</Text>
          </View>
          {(court.friendsPlayingCount ?? 0) > 0 && (
            <View style={styles.metaPill}>
              <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="people" size={14} color={colors.accent} />
              <Text style={[styles.metaText, { color: colors.accent }]}>{court.friendsPlayingCount} friends</Text>
            </View>
          )}
        </View>

        {court.currentPlayers > 0 && (
          <View style={styles.skillRow}>
            <Text style={commonStyles.textSecondary}>Avg skill: </Text>
            <SkillLevelBars averageSkillLevel={court.averageSkillLevel} size={14} />
            {court.averageDupr != null && (
              <Text style={[commonStyles.textSecondary, { marginLeft: 8 }]}>DUPR {court.averageDupr.toFixed(1)}</Text>
            )}
          </View>
        )}

        {user && (
          <View style={styles.checkInArea}>
            {isCheckedInHere && remaining && (
              <Text style={styles.checkedInText}>
                You're checked in • {remaining.hours}h {remaining.minutes}m remaining
              </Text>
            )}

            {!isCheckedInHere && (
              <>
                <Text style={commonStyles.subtitle}>Check in</Text>

                <Text style={commonStyles.textSecondary}>Select your skill level</Text>
                <View style={styles.skillPills}>
                  {SKILL_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.pill, selectedSkill === level && styles.pillActive]}
                      onPress={() => setSelectedSkill(level)}
                      disabled={isMutating}
                    >
                      <Text style={[styles.pillText, selectedSkill === level && styles.pillTextActive]}>{level}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[commonStyles.textSecondary, { marginTop: 12 }]}>Duration (minutes)</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[styles.durationPill, selectedDuration === mins && styles.durationPillActive]}
                      onPress={() => setSelectedDuration(mins)}
                      disabled={isMutating}
                    >
                      <Text style={[styles.durationText, selectedDuration === mins && styles.durationTextActive]}>{mins}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                buttonStyles.primary,
                styles.toggleButton,
                isCheckedInHere && styles.toggleButtonCheckedIn,
              ]}
              onPress={isCheckedInHere ? handleCheckOut : handleCheckIn}
              disabled={isMutating}
            >
              {isMutating ? (
                <ActivityIndicator color={colors.card} size="small" />
              ) : (
                <Text style={buttonStyles.text}>{isCheckedInHere ? 'Check Out' : 'Check In'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!user && (
          <Text style={[commonStyles.textSecondary, styles.signInHint]}>Sign in to check in at this court</Text>
        )}

        {friendsAtCourt.length > 0 && (
          <View style={styles.friendsSection}>
            <Text style={commonStyles.subtitle}>Friends at this court</Text>
            {friendsAtCourt.map((f: any) => (
              <View key={f.id} style={styles.friendRow}>
                <Text style={styles.friendName}>
                  {f.friendNickname || f.friendFirstName || f.friendEmail || 'Friend'}
                </Text>
                {f.friendDuprRating != null && (
                  <Text style={commonStyles.textSecondary}>DUPR {f.friendDuprRating}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },

  header: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courtName: { fontSize: 24, fontWeight: '700', color: colors.text, flex: 1 },
  favButton: { padding: 4 },

  address: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  city: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: { fontSize: 13, color: colors.text },

  skillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },

  checkInArea: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  checkedInText: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 12 },

  toggleButton: { marginTop: 16 },
  toggleButtonCheckedIn: { backgroundColor: colors.accent, borderColor: colors.accent },

  skillPills: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.text },
  pillTextActive: { color: colors.card },

  durationRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  durationPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  durationPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationText: { fontSize: 14, fontWeight: '600', color: colors.text },
  durationTextActive: { color: colors.card },

  signInHint: { fontStyle: 'italic', marginTop: 8 },

  friendsSection: { marginTop: 16 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  friendName: { fontSize: 15, fontWeight: '600', color: colors.text },
});
