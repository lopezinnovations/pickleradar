import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useCourtsQuery } from '@/hooks/useCourtsQuery';
import { useLocation } from '@/hooks/useLocation';
import { useFavorites } from '@/hooks/useFavorites';

import { IconSymbol } from '@/components/IconSymbol';
import { AddCourtModal } from '@/components/AddCourtModal';
import { LegalFooter } from '@/components/LegalFooter';

import { debounce } from '@/utils/performanceLogger';
import { SortOption, FilterOptions, Court } from '@/types';

const INITIAL_DISPLAY_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const RADIUS_MILES = 25;
const AUTO_REFRESH_INTERVAL = 90000;

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

  const debouncedSearchHandler = useMemo(() => debounce(debouncedSearch, 400), [debouncedSearch]);

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

  // Ask for location only when user is signed in (avoids alert on auth screen after sign out)
  useEffect(() => {
    if (!user || hasLocation || requestingPermission) return;
    requestLocation();
  }, [user, hasLocation, requestingPermission, requestLocation]);

  const getSkillLevelLabel = (averageSkillLevel: number): 'Beginner' | 'Intermediate' | 'Advanced' => {
    if (averageSkillLevel < 1.5) return 'Beginner';
    if (averageSkillLevel < 2.5) return 'Intermediate';
    return 'Advanced';
  };

  const processedCourts = useMemo(() => {
    let filtered: Court[] = courts ?? [];

    // Search
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (court) =>
          court.name?.toLowerCase().includes(query) ||
          court.address?.toLowerCase().includes(query) ||
          court.city?.toLowerCase().includes(query)
      );
    }

    // Skill level filter
    if (filters.skillLevels.length > 0) {
      filtered = filtered.filter((court) => {
        if (!court.averageSkillLevel || court.averageSkillLevel === 0) return false;
        const skillLabel = getSkillLevelLabel(court.averageSkillLevel);
        return filters.skillLevels.includes(skillLabel);
      });
    }

    // Friends-only filter
    if (filters.showFriendsOnly) {
      filtered = filtered.filter((court) => (court.friendsPlayingCount ?? 0) > 0);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          return (b.currentPlayers ?? 0) - (a.currentPlayers ?? 0);
        case 'nearest':
          return (a.distance ?? 9999) - (b.distance ?? 9999);
        case 'az':
          return (a.name ?? '').localeCompare(b.name ?? '');
        case 'favorites':
          // favorites first, then activity
          return (isFavorite(b.id) ? 1 : 0) - (isFavorite(a.id) ? 1 : 0) || (b.currentPlayers ?? 0) - (a.currentPlayers ?? 0);
        default:
          return (b.currentPlayers ?? 0) - (a.currentPlayers ?? 0);
      }
    });

    return sorted;
  }, [courts, debouncedSearchQuery, filters, sortBy, isFavorite]);

  const displayedCourts = processedCourts.slice(0, displayCount);

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
  };

  const handleOpenCourt = (courtId: string) => {
    router.push(`/(tabs)/(home)/court/${courtId}`);
  };

  const handleOpenMap = () => {
    // ✅ Map is optional view launched from list
    router.push('/(tabs)/(home)/courts-map');
  };

  const toggleSkillFilter = (skill: 'Beginner' | 'Intermediate' | 'Advanced') => {
    setFilters((prev) => {
      const exists = prev.skillLevels.includes(skill);
      return {
        ...prev,
        skillLevels: exists ? prev.skillLevels.filter((s) => s !== skill) : [...prev.skillLevels, skill],
      };
    });
  };

  const setSort = (value: SortOption) => setSortBy(value);

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 12 }]}>Loading courts...</Text>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={styles.header}>
          <Text style={commonStyles.title}>Courts</Text>
          <Text style={commonStyles.textSecondary}>
            {userLocation ? 'Showing courts within 25 miles' : 'Location needed to show nearby courts'}
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search courts..."
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
        </View>

        {/* Sort + Map + Add Court */}
        <View style={styles.row}>
          <View style={styles.sortRow}>
            <TouchableOpacity
              style={[styles.pill, sortBy === 'favorites' && styles.pillActive]}
              onPress={() => setSort('favorites')}
            >
              <Text style={[styles.pillText, sortBy === 'favorites' && styles.pillTextActive]}>Favorites</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, sortBy === 'activity' && styles.pillActive]}
              onPress={() => setSort('activity')}
            >
              <Text style={[styles.pillText, sortBy === 'activity' && styles.pillTextActive]}>Activity</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, sortBy === 'nearest' && styles.pillActive]}
              onPress={() => setSort('nearest')}
            >
              <Text style={[styles.pillText, sortBy === 'nearest' && styles.pillTextActive]}>Nearest</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, sortBy === 'az' && styles.pillActive]}
              onPress={() => setSort('az')}
            >
              <Text style={[styles.pillText, sortBy === 'az' && styles.pillTextActive]}>A-Z</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRight}>
            <TouchableOpacity style={styles.smallButton} onPress={handleOpenMap}>
              <IconSymbol ios_icon_name="map" android_material_icon_name="map" size={18} color={colors.primary} />
              <Text style={styles.smallButtonText}>Map</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.smallButton} onPress={() => setShowAddCourtModal(true)}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color={colors.primary} />
              <Text style={styles.smallButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersHeaderRow}>
          <Text style={[commonStyles.subtitle, { marginBottom: 8 }]}>Filter by Skill Level</Text>

          <TouchableOpacity onPress={() => setShowFilters((p) => !p)}>
            <Text style={[commonStyles.textSecondary, { fontWeight: '600' }]}>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <>
            <View style={styles.filterRow}>
              {(['Beginner', 'Intermediate', 'Advanced'] as const).map((level) => {
                const active = filters.skillLevels.includes(level);
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => toggleSkillFilter(level)}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{level}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFilters((p) => ({ ...p, showFriendsOnly: !p.showFriendsOnly }))}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, filters.showFriendsOnly && styles.checkboxChecked]} />
              <Text style={commonStyles.text}>Show only courts with friends</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.countRow}>
          <Text style={commonStyles.subtitle}>{processedCourts.length} Courts</Text>
        </View>

        {/* Court Cards */}
        {displayedCourts.map((court) => (
          <TouchableOpacity
            key={court.id}
            style={styles.courtCard}
            onPress={() => handleOpenCourt(court.id)}
            activeOpacity={0.85}
          >
            <View style={styles.courtTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.courtName}>{court.name}</Text>
                {!!court.address && <Text style={styles.courtAddress}>{court.address}</Text>}
              </View>

              <TouchableOpacity
                onPress={() => toggleFavorite(court.id)}
                style={styles.favoriteButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol
                  ios_icon_name={isFavorite(court.id) ? 'heart.fill' : 'heart'}
                  android_material_icon_name={isFavorite(court.id) ? 'favorite' : 'favorite-border'}
                  size={22}
                  color={isFavorite(court.id) ? colors.error : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.metaRow}>
              {typeof court.distance === 'number' && (
                <View style={styles.metaPill}>
                  <IconSymbol ios_icon_name="location.fill" android_material_icon_name="location-on" size={14} color={colors.primary} />
                  <Text style={styles.metaText}>{court.distance.toFixed(1)} mi</Text>
                </View>
              )}
              <View style={styles.metaPill}>
                <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="people" size={14} color={colors.primary} />
                <Text style={styles.metaText}>{court.currentPlayers ?? 0} players</Text>
              </View>
              {(court.friendsPlayingCount ?? 0) > 0 && (
                <View style={styles.metaPill}>
                  <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="people" size={14} color={colors.accent} />
                  <Text style={[styles.metaText, { color: colors.accent }]}>{court.friendsPlayingCount} friends</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {displayCount < processedCourts.length && (
          <TouchableOpacity style={[buttonStyles.primary, styles.loadMore]} onPress={handleLoadMore}>
            <Text style={buttonStyles.text}>Load More</Text>
          </TouchableOpacity>
        )}

        <LegalFooter />
      </ScrollView>

      <AddCourtModal
        visible={showAddCourtModal}
        onClose={() => setShowAddCourtModal(false)}
        onSuccess={() => {
          setShowAddCourtModal(false);
          refetch();
          router.replace('/(tabs)/(home)/');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  searchContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },

  row: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pillTextActive: {
    color: colors.card,
  },

  actionsRight: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  filtersHeaderRow: {
    paddingHorizontal: 20,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  filterRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  filterPillTextActive: {
    color: colors.card,
  },

  checkboxRow: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.highlight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  countRow: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 6,
  },

  courtCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  courtTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  courtName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  courtAddress: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
  },
  favoriteButton: {
    paddingLeft: 8,
    paddingTop: 2,
  },

  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.highlight,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },

  loadMore: {
    marginTop: 18,
    marginHorizontal: 20,
  },
});
