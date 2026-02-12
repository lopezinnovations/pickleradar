import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Linking, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useCourtsQuery } from '@/hooks/useCourtsQuery';
import { useLocation } from '@/hooks/useLocation';
import { useFavorites } from '@/hooks/useFavorites';
import { IconSymbol } from '@/components/IconSymbol';
import { SkillLevelBars, CourtCardSkeleton } from '@/components/SkillLevelBars';
import { AddCourtModal } from '@/components/AddCourtModal';
import { LegalFooter } from '@/components/LegalFooter';
import { debounce } from '@/utils/performanceLogger';
import { SortOption, FilterOptions } from '@/types';

const INITIAL_DISPLAY_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const RADIUS_MILES = 25;
const AUTO_REFRESH_INTERVAL = 90000;

const isExpoGo = Constants.appOwnership === 'expo';
const mapsAvailable = !isExpoGo;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { userLocation, hasLocation, requestLocation, requestingPermission } = useLocation();
  const { toggleFavorite, isFavorite } = useFavorites(user?.id);

  const { courts, loading, refetch, isRefetching } = useCourtsQuery(
    user?.id,
    userLocation?.latitude,
    userLocation?.longitude,
    RADIUS_MILES
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('activity');
  const [filters, setFilters] = useState<FilterOptions>({
    skillLevels: [],
    showFriendsOnly: false,
  });
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [showAddCourtModal, setShowAddCourtModal] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback((query: string) => {
    setDebouncedSearchQuery(query);
  }, []);

  const debouncedSearchHandler = useMemo(
    () => debounce(debouncedSearch, 400),
    [debouncedSearch]
  );

  useEffect(() => {
    debouncedSearchHandler(searchQuery);
  }, [searchQuery, debouncedSearchHandler]);

  useFocusEffect(
    useCallback(() => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);

      autoRefreshTimerRef.current = setInterval(() => {
        refetch();
      }, AUTO_REFRESH_INTERVAL);

      return () => {
        if (autoRefreshTimerRef.current) {
          clearInterval(autoRefreshTimerRef.current);
          autoRefreshTimerRef.current = null;
        }
      };
    }, [refetch])
  );

  const processedCourts = useMemo(() => {
    let filtered = courts;

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(court =>
        court.name.toLowerCase().includes(query) ||
        court.address?.toLowerCase().includes(query) ||
        court.city?.toLowerCase().includes(query)
      );
    }

    if (filters.skillLevels.length > 0) {
      filtered = filtered.filter(court => {
        if (court.averageSkillLevel === 0) return false;
        const skillLabel = getSkillLevelLabel(court.averageSkillLevel);
        return filters.skillLevels.includes(skillLabel);
      });
    }

    if (filters.showFriendsOnly) {
      filtered = filtered.filter(court => court.friendsPlayingCount > 0);
    }

    return [...filtered].sort((a, b) => b.currentPlayers - a.currentPlayers);
  }, [courts, debouncedSearchQuery, filters]);

  const displayedCourts = processedCourts.slice(0, displayCount);

  const getSkillLevelLabel = (averageSkillLevel: number): 'Beginner' | 'Intermediate' | 'Advanced' => {
    if (averageSkillLevel < 1.5) return 'Beginner';
    if (averageSkillLevel < 2.5) return 'Intermediate';
    return 'Advanced';
  };

  if (loading) {
    return (
      <View style={commonStyles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={commonStyles.title}>Courts</Text>
        </View>

        {displayedCourts.map((court) => (
          <TouchableOpacity key={court.id} style={styles.courtCard}>
            <Text style={commonStyles.subtitle}>{court.name}</Text>
          </TouchableOpacity>
        ))}

        <LegalFooter />
      </ScrollView>

      <AddCourtModal
        visible={showAddCourtModal}
        onClose={() => setShowAddCourtModal(false)}
        onCourtAdded={() => {
          setShowAddCourtModal(false);
          refetch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  courtCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    margin: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
