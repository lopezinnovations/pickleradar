
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
const RADIUS_MILES = 25; // Search radius for nearby courts
const AUTO_REFRESH_INTERVAL = 90000; // 90 seconds (1.5 minutes)

// Check if maps are available (not in Expo Go)
const isExpoGo = Constants.appOwnership === 'expo';
const mapsAvailable = !isExpoGo;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { userLocation, hasLocation, requestLocation, requestingPermission } = useLocation();
  
  // FAVORITES: Use the favorites hook
  const { toggleFavorite, isFavorite } = useFavorites(user?.id);
  
  // REACT QUERY: Use the new query hook with nearby filtering
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
  
  // Auto-refresh timer
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search handler
  const debouncedSearch = React.useCallback(
    debounce((query: string) => {
      console.log('HomeScreen: Debounced search query:', query);
      setDebouncedSearchQuery(query);
    }, 400),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // AUTO-REFRESH: Set up periodic refresh while Map tab is active
  useFocusEffect(
    React.useCallback(() => {
      console.log('HomeScreen: Map tab focused, setting up auto-refresh');
      
      // Clear any existing timer
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
      
      // Set up auto-refresh every 90 seconds
      autoRefreshTimerRef.current = setInterval(() => {
        console.log('HomeScreen: Auto-refresh triggered');
        refetch();
      }, AUTO_REFRESH_INTERVAL);
      
      // Cleanup on blur
      return () => {
        console.log('HomeScreen: Map tab blurred, clearing auto-refresh');
        if (autoRefreshTimerRef.current) {
          clearInterval(autoRefreshTimerRef.current);
          autoRefreshTimerRef.current = null;
        }
      };
    }, [refetch])
  );

  // Process and filter courts
  const processedCourts = useMemo(() => {
    let filtered = courts;

    // Apply search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(court =>
        court.name.toLowerCase().includes(query) ||
        court.address?.toLowerCase().includes(query) ||
        court.city?.toLowerCase().includes(query)
      );
    }

    // Apply skill level filter
    if (filters.skillLevels.length > 0) {
      filtered = filtered.filter(court => {
        if (court.averageSkillLevel === 0) return false;
        
        const skillLabel = getSkillLevelLabel(court.averageSkillLevel);
        return filters.skillLevels.includes(skillLabel);
      });
    }

    // Apply friends filter
    if (filters.showFriendsOnly) {
      filtered = filtered.filter(court => court.friendsPlayingCount > 0);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'favorites':
          // FAVORITES SORT: Favorites first, then apply secondary sort
          const aFav = a.isFavorite ? 1 : 0;
          const bFav = b.isFavorite ? 1 : 0;
          
          if (aFav !== bFav) {
            return bFav - aFav; // Favorites first
          }
          
          // Secondary sort by activity
          return b.currentPlayers - a.currentPlayers;
          
        case 'activity':
          return b.currentPlayers - a.currentPlayers;
          
        case 'nearest':
          // NEAREST SORT: Only available when location exists
          if (!hasLocation || a.distance === undefined || b.distance === undefined) {
            return 0; // No sorting if no location
          }
          return a.distance - b.distance;
          
        case 'alphabetical':
          return a.name.localeCompare(b.name);
          
        default:
          return 0;
      }
    });

    return sorted;
  }, [courts, debouncedSearchQuery, filters, sortBy, hasLocation]);

  const displayedCourts = processedCourts.slice(0, displayCount);

  const handleLoadMore = () => {
    console.log('User tapped Load More Courts');
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  };

  const openGoogleMaps = (latitude: number, longitude: number, name: string) => {
    console.log('User tapped Get Directions for:', name);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const getSkillLevelLabel = (averageSkillLevel: number): 'Beginner' | 'Intermediate' | 'Advanced' => {
    if (averageSkillLevel < 1.5) return 'Beginner';
    if (averageSkillLevel < 2.5) return 'Intermediate';
    return 'Advanced';
  };

  const toggleSkillLevelFilter = (level: 'Beginner' | 'Intermediate' | 'Advanced') => {
    console.log('User toggled skill level filter:', level);
    setFilters(prev => {
      const newLevels = prev.skillLevels.includes(level)
        ? prev.skillLevels.filter(l => l !== level)
        : [...prev.skillLevels, level];
      return { ...prev, skillLevels: newLevels };
    });
  };

  const handleRequestLocation = () => {
    console.log('User tapped Enable Location button');
    requestLocation();
  };

  const handleToggleFavorite = async (courtId: string, e: any) => {
    e.stopPropagation();
    console.log('User tapped favorite for court:', courtId);
    await toggleFavorite(courtId);
  };

  const handleOpenMapView = () => {
    console.log('User tapped Map View button');
    
    // Navigate to map screen - it will handle the fallback if maps aren't available
    const courtsForMap = processedCourts.slice(0, 50);
    
    const courtsParam = JSON.stringify(courtsForMap);
    const userLocationParam = userLocation
      ? JSON.stringify({ latitude: userLocation.latitude, longitude: userLocation.longitude })
      : null;
    
    router.push({
      pathname: '/(tabs)/(home)/courts-map',
      params: {
        courts: courtsParam,
        userLocation: userLocationParam || '',
      },
    });
  };

  const renderSkeletonLoaders = () => {
    return (
      <View style={{ paddingHorizontal: 20 }}>
        {[1, 2, 3, 4, 5].map((_, index) => (
          <CourtCardSkeleton key={index} />
        ))}
      </View>
    );
  };

  // Show skeleton loaders while loading
  if (loading) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.header}>
          <Text style={commonStyles.title}>Courts</Text>
          <Text style={commonStyles.textSecondary}>
            Find pickleball courts near you
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courts..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {renderSkeletonLoaders()}
      </View>
    );
  }

  const beginnerLabel = 'Beginner';
  const intermediateLabel = 'Intermediate';
  const advancedLabel = 'Advanced';
  const activityLabel = 'Activity';
  const nearestLabel = 'Nearest';
  const alphabeticalLabel = 'A-Z';
  const favoritesLabel = 'Favorites';
  const enableLocationText = 'Enable location to sort by distance';
  const mapViewLabel = 'Map';
  const courtsCountText = processedCourts.length === 1 ? 'Court' : 'Courts';
  const mapNotAvailableText = '(Not available in Expo Go)';
  const hideFiltersLabel = 'Hide Filters';
  const showFiltersLabel = 'Show Filters';

  return (
    <View style={commonStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={commonStyles.title}>Courts</Text>
          <Text style={commonStyles.textSecondary}>
            {hasLocation ? `Showing courts within ${RADIUS_MILES} miles` : 'Enable location to see nearby courts'}
          </Text>
        </View>

        {!hasLocation && (
          <TouchableOpacity
            style={[commonStyles.card, styles.locationPromptCard]}
            onPress={handleRequestLocation}
            disabled={requestingPermission}
            activeOpacity={0.7}
          >
            <View style={styles.locationPromptHeader}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={24}
                color={colors.primary}
              />
              <Text style={[commonStyles.subtitle, { marginLeft: 12 }]}>
                Enable Location
              </Text>
            </View>
            <Text style={[commonStyles.textSecondary, { marginTop: 8 }]}>
              Enable location to see courts near you and sort by distance
            </Text>
            <View style={styles.locationButtonContainer}>
              {requestingPermission ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on"
                    size={20}
                    color={colors.card}
                  />
                  <Text style={styles.locationButtonText}>
                    Enable Location
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.searchContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courts..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filtersContainer}>
          <View style={styles.filtersHeader}>
            <Text style={styles.sectionHeader}>Sort By</Text>
            <TouchableOpacity
              style={styles.toggleFiltersButton}
              onPress={() => {
                console.log('User toggled filters visibility');
                setShowFilters(!showFilters);
              }}
            >
              <IconSymbol
                ios_icon_name={showFilters ? "chevron.up" : "chevron.down"}
                android_material_icon_name={showFilters ? "expand-less" : "expand-more"}
                size={20}
                color={colors.primary}
              />
              <Text style={styles.toggleFiltersText}>
                {showFilters ? hideFiltersLabel : showFiltersLabel}
              </Text>
            </TouchableOpacity>
          </View>

          {showFilters && (
            <>
              <View style={styles.sortButtons}>
                <TouchableOpacity
                  style={[
                    styles.sortButton,
                    sortBy === 'favorites' && styles.sortButtonActive,
                  ]}
                  onPress={() => setSortBy('favorites')}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      sortBy === 'favorites' && styles.sortButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {favoritesLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sortButton,
                    sortBy === 'activity' && styles.sortButtonActive,
                  ]}
                  onPress={() => setSortBy('activity')}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      sortBy === 'activity' && styles.sortButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {activityLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sortButton,
                    sortBy === 'nearest' && styles.sortButtonActive,
                    !hasLocation && styles.sortButtonDisabled,
                  ]}
                  onPress={() => hasLocation && setSortBy('nearest')}
                  disabled={!hasLocation}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      sortBy === 'nearest' && styles.sortButtonTextActive,
                      !hasLocation && styles.sortButtonTextDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {nearestLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sortButton,
                    sortBy === 'alphabetical' && styles.sortButtonActive,
                  ]}
                  onPress={() => setSortBy('alphabetical')}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      sortBy === 'alphabetical' && styles.sortButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {alphabeticalLabel}
                  </Text>
                </TouchableOpacity>
              </View>

              {!hasLocation && (
                <Text style={[commonStyles.textSecondary, { fontSize: 12, marginTop: 4, fontStyle: 'italic' }]}>
                  {enableLocationText}
                </Text>
              )}

              <Text style={[styles.sectionHeader, { marginTop: 12 }]}>Filter by Skill Level</Text>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    filters.skillLevels.includes('Beginner') && styles.filterButtonActive,
                  ]}
                  onPress={() => toggleSkillLevelFilter('Beginner')}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.skillLevels.includes('Beginner') && styles.filterButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {beginnerLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    filters.skillLevels.includes('Intermediate') && styles.filterButtonActive,
                  ]}
                  onPress={() => toggleSkillLevelFilter('Intermediate')}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.skillLevels.includes('Intermediate') && styles.filterButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {intermediateLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    filters.skillLevels.includes('Advanced') && styles.filterButtonActive,
                  ]}
                  onPress={() => toggleSkillLevelFilter('Advanced')}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.skillLevels.includes('Advanced') && styles.filterButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {advancedLabel}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.friendsFilterButton, { height: null }]}
                onPress={() => {
                  console.log('User toggled friends filter');
                  setFilters(prev => ({ ...prev, showFriendsOnly: !prev.showFriendsOnly }));
                }}
              >
                <IconSymbol
                  ios_icon_name={filters.showFriendsOnly ? "checkmark.square.fill" : "square"}
                  android_material_icon_name={filters.showFriendsOnly ? "check-box" : "check-box-outline-blank"}
                  size={22}
                  color={filters.showFriendsOnly ? colors.primary : colors.textSecondary}
                />
                <Text style={[commonStyles.text, { marginLeft: 10, fontSize: 15, paddingTop: 2, marginBottom: null }]}>
                  Show only courts with friends
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.courtsList}>
          <View style={styles.courtsHeader}>
            <Text style={[commonStyles.subtitle, { fontSize: 18 }]}>
              {processedCourts.length} {courtsCountText}
            </Text>
            <View style={styles.courtsHeaderButtons}>
              <TouchableOpacity
                style={styles.mapButton}
                onPress={handleOpenMapView}
                disabled={processedCourts.length === 0}
              >
                <IconSymbol
                  ios_icon_name="map.fill"
                  android_material_icon_name="map"
                  size={16}
                  color={processedCourts.length === 0 ? colors.textSecondary : colors.primary}
                />
                <Text
                  style={[
                    styles.mapButtonText,
                    processedCourts.length === 0 && styles.mapButtonTextDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {mapViewLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addCourtButton}
                onPress={() => {
                  console.log('User tapped Add Court button');
                  setShowAddCourtModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.addCourtText} numberOfLines={1}>Add Court</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!mapsAvailable && (
            <View style={styles.mapNotice}>
              <IconSymbol
                ios_icon_name="info.circle"
                android_material_icon_name="info"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.mapNoticeText}>{mapNotAvailableText}</Text>
            </View>
          )}

          {displayedCourts.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="map"
                android_material_icon_name="map"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>
                No Courts Found
              </Text>
              <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }]}>
                {searchQuery.trim()
                  ? 'Try adjusting your search or filters'
                  : hasLocation
                  ? `No courts found within ${RADIUS_MILES} miles`
                  : 'Enable location to see nearby courts'}
              </Text>
            </View>
          ) : (
            <>
              {displayedCourts.map((court) => {
                const activityColor =
                  court.activityLevel === 'high'
                    ? colors.success
                    : court.activityLevel === 'medium'
                    ? colors.warning
                    : colors.textSecondary;

                const distanceText = court.distance !== undefined
                  ? `${court.distance.toFixed(1)} mi`
                  : null;

                const courtIsFavorite = isFavorite(court.id);

                return (
                  <TouchableOpacity
                    key={court.id}
                    style={styles.courtCard}
                    onPress={() => {
                      console.log('User tapped court:', court.name);
                      router.push(`/(tabs)/(home)/court/${court.id}`);
                    }}
                  >
                    <View style={styles.courtHeader}>
                      <View style={styles.courtTitleRow}>
                        <Text style={[commonStyles.subtitle, { flex: 1 }]} numberOfLines={1}>
                          {court.name}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => handleToggleFavorite(court.id, e)}
                          style={styles.favoriteButton}
                        >
                          <IconSymbol
                            ios_icon_name={courtIsFavorite ? "heart.fill" : "heart"}
                            android_material_icon_name={courtIsFavorite ? "favorite" : "favorite-border"}
                            size={20}
                            color={courtIsFavorite ? colors.error : colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.courtAddressRow}>
                        <IconSymbol
                          ios_icon_name="location.fill"
                          android_material_icon_name="location-on"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={[commonStyles.textSecondary, { marginLeft: 4, flex: 1 }]} numberOfLines={1}>
                          {court.address}
                        </Text>
                      </View>
                      {distanceText && (
                        <View style={styles.distanceBadge}>
                          <IconSymbol
                            ios_icon_name="location.fill"
                            android_material_icon_name="location-on"
                            size={12}
                            color={colors.primary}
                          />
                          <Text style={styles.distanceText}>{distanceText}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.courtStats}>
                      <View style={styles.statBadge}>
                        <View style={[styles.activityDot, { backgroundColor: activityColor }]} />
                        <Text style={styles.statText}>
                          {court.currentPlayers} {court.currentPlayers === 1 ? 'player' : 'players'}
                        </Text>
                      </View>

                      {court.friendsPlayingCount > 0 && (
                        <View style={[styles.statBadge, { backgroundColor: colors.highlight }]}>
                          <IconSymbol
                            ios_icon_name="person.2.fill"
                            android_material_icon_name="group"
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={[styles.statText, { color: colors.primary, marginLeft: 4 }]}>
                            {court.friendsPlayingCount} {court.friendsPlayingCount === 1 ? 'friend' : 'friends'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {court.averageSkillLevel > 0 && (
                      <View style={styles.skillLevelContainer}>
                        <Text style={[commonStyles.textSecondary, { fontSize: 12, marginBottom: 4 }]}>
                          Avg Skill: {getSkillLevelLabel(court.averageSkillLevel)}
                        </Text>
                        <SkillLevelBars level={court.averageSkillLevel} size="small" />
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.directionsButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        openGoogleMaps(court.latitude, court.longitude, court.name);
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="arrow.triangle.turn.up.right.circle.fill"
                        android_material_icon_name="directions"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.directionsText}>Get Directions</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}

              {displayedCourts.length < processedCourts.length && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={handleLoadMore}
                >
                  <Text style={styles.loadMoreText}>
                    Load More ({processedCourts.length - displayedCourts.length} remaining)
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="expand-more"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

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
  locationPromptCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.highlight,
  },
  locationPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    marginRight: 12,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  toggleFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  toggleFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  sortButton: {
    minWidth: 80,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortButtonDisabled: {
    opacity: 0.5,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  sortButtonTextActive: {
    color: colors.card,
  },
  sortButtonTextDisabled: {
    color: colors.textSecondary,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    minWidth: 90,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  filterButtonTextActive: {
    color: colors.card,
  },
  friendsFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.highlight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  courtsList: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  courtsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  courtsHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  mapButtonTextDisabled: {
    color: colors.textSecondary,
  },
  mapNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  mapNoticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  addCourtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addCourtText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  courtCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  courtHeader: {
    marginBottom: 12,
  },
  courtTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  favoriteButton: {
    padding: 4,
    marginLeft: 8,
  },
  courtAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  courtStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.highlight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  skillLevelContainer: {
    marginBottom: 12,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  directionsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlight,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
});
