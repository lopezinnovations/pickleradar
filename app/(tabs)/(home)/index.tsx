
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput, Linking, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useCourts } from '@/hooks/useCourts';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { IconSymbol } from '@/components/IconSymbol';
import { SkillLevelBars } from '@/components/SkillLevelBars';
import { AddCourtModal } from '@/components/AddCourtModal';
import { LegalFooter } from '@/components/LegalFooter';
import { SortOption, FilterOptions } from '@/types';
import { calculateDistance } from '@/utils/locationUtils';
import { supabase } from '@/app/integrations/supabase/client';

const INITIAL_DISPLAY_COUNT = 10;
const LOAD_MORE_COUNT = 10;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { courts, loading, refetch } = useCourts(user?.id);
  const { hasLocation, userLocation, requestLocation, requestingPermission } = useLocation();
  
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [showAddCourtModal, setShowAddCourtModal] = useState(false);
  const [favoriteCourtIds, setFavoriteCourtIds] = useState<Set<string>>(new Set());
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  // Fetch user's favorites on mount and when screen comes into focus
  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      console.log('HomeScreen: No user ID, skipping favorites fetch');
      setLoadingFavorites(false);
      return;
    }

    try {
      console.log('HomeScreen: Fetching user favorites');
      const { data, error } = await supabase
        .from('court_favorites')
        .select('court_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('HomeScreen: Error fetching favorites:', error);
        setLoadingFavorites(false);
        return;
      }

      const favoriteIds = new Set(data?.map(fav => fav.court_id) || []);
      console.log('HomeScreen: Loaded favorites:', favoriteIds.size);
      setFavoriteCourtIds(favoriteIds);
      setLoadingFavorites(false);
    } catch (error) {
      console.error('HomeScreen: Exception fetching favorites:', error);
      setLoadingFavorites(false);
    }
  }, [user?.id]);

  // Fetch favorites on mount
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Only refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen: Screen focused, refreshing courts data and favorites');
      try {
        refetch();
        fetchFavorites();
      } catch (error) {
        console.error('HomeScreen: Error refetching data:', error);
      }
    }, [refetch, fetchFavorites])
  );

  // Calculate distances and apply sorting/filtering
  const processedCourts = useMemo(() => {
    try {
      let processed = courts.map(court => {
        let distance: number | undefined;
        
        if (userLocation) {
          try {
            distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              court.latitude,
              court.longitude
            );
          } catch (error) {
            console.error('HomeScreen: Error calculating distance for court:', court.id, error);
          }
        }
        
        return { ...court, distance };
      });

      // Apply unified search filter (ZIP code, city, or court name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        processed = processed.filter(court => {
          const nameMatch = court.name.toLowerCase().includes(query);
          const addressMatch = court.address.toLowerCase().includes(query);
          const cityMatch = court.city?.toLowerCase().includes(query);
          const zipMatch = court.zipCode?.includes(query);
          
          return nameMatch || addressMatch || cityMatch || zipMatch;
        });
      }

      // Apply distance filter
      if (filters.maxDistance !== undefined && userLocation) {
        processed = processed.filter(court => 
          court.distance !== undefined && court.distance <= filters.maxDistance!
        );
      }

      // Apply friends only filter
      if (filters.friendsOnly) {
        processed = processed.filter(court => court.friendsPlayingCount > 0);
      }

      // Apply favorites only filter
      if (filters.favoritesOnly) {
        processed = processed.filter(court => favoriteCourtIds.has(court.id));
      }

      // Apply skill level filter
      if (filters.skillLevels && filters.skillLevels.length > 0) {
        processed = processed.filter(court => {
          if (court.currentPlayers === 0) return false;
          
          const avgSkill = court.averageSkillLevel;
          return filters.skillLevels!.some(level => {
            if (level === 'Beginner') return avgSkill <= 1.5;
            if (level === 'Intermediate') return avgSkill > 1.5 && avgSkill <= 2.5;
            if (level === 'Advanced') return avgSkill > 2.5;
            return false;
          });
        });
      }

      // Apply sorting - default to distance if location is available
      switch (sortBy) {
        case 'favorites':
          // Sort favorites first, then by distance if available
          processed.sort((a, b) => {
            const aFavorited = favoriteCourtIds.has(a.id);
            const bFavorited = favoriteCourtIds.has(b.id);

            if (aFavorited && !bFavorited) return -1;
            if (!aFavorited && bFavorited) return 1;

            // Secondary sort by distance if available
            if (userLocation && a.distance !== undefined && b.distance !== undefined) {
              return a.distance - b.distance;
            }
            return 0;
          });
          break;
        case 'active-high':
          processed.sort((a, b) => b.currentPlayers - a.currentPlayers);
          break;
        case 'active-low':
          processed.sort((a, b) => a.currentPlayers - b.currentPlayers);
          break;
        case 'skill-high':
          processed.sort((a, b) => b.averageSkillLevel - a.averageSkillLevel);
          break;
        case 'skill-low':
          processed.sort((a, b) => a.averageSkillLevel - b.averageSkillLevel);
          break;
        case 'distance':
          if (userLocation) {
            processed.sort((a, b) => {
              if (a.distance === undefined) return 1;
              if (b.distance === undefined) return -1;
              return a.distance - b.distance;
            });
          }
          break;
      }

      return processed;
    } catch (error) {
      console.error('HomeScreen: Error processing courts:', error);
      return courts;
    }
  }, [courts, sortBy, filters, userLocation, searchQuery, favoriteCourtIds]);

  const displayedCourts = processedCourts.slice(0, displayCount);
  const hasMoreCourts = displayCount < processedCourts.length;

  const handleLoadMore = () => {
    console.log('HomeScreen: Loading more courts');
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  };

  const openGoogleMaps = () => {
    try {
      console.log('HomeScreen: Opening Google Maps');
      const url = 'https://www.google.com/maps/search/pickleball+courts';
      Linking.openURL(url).catch(err => {
        console.error('HomeScreen: Failed to open Google Maps:', err);
        Alert.alert('Error', 'Unable to open Google Maps');
      });
    } catch (error) {
      console.error('HomeScreen: Error opening Google Maps:', error);
    }
  };

  const getSkillLevelLabel = (averageSkillLevel: number) => {
    if (averageSkillLevel === 0) return 'No data';
    if (averageSkillLevel <= 1.5) return 'Beginner';
    if (averageSkillLevel <= 2.5) return 'Intermediate';
    return 'Advanced';
  };

  const toggleSkillLevelFilter = (level: 'Beginner' | 'Intermediate' | 'Advanced') => {
    const currentLevels = filters.skillLevels || [];
    const isSelected = currentLevels.includes(level);
    
    if (isSelected) {
      setFilters({
        ...filters,
        skillLevels: currentLevels.filter(l => l !== level),
      });
    } else {
      setFilters({
        ...filters,
        skillLevels: [...currentLevels, level],
      });
    }
  };

  const handleRequestLocation = () => {
    console.log('HomeScreen: User tapped Enable Location button');
    Alert.alert(
      'Enable Location',
      'Allow PickleRadar to access your location to find nearby courts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Enable Location', 
          onPress: () => {
            console.log('HomeScreen: User confirmed location request');
            requestLocation();
          }
        }
      ]
    );
  };

  const handleToggleFavorite = async (courtId: string, e: any) => {
    e.stopPropagation();
    
    if (!user?.id) {
      console.log('HomeScreen: User not logged in, cannot toggle favorite');
      Alert.alert('Sign In Required', 'Please sign in to save favorite courts.');
      return;
    }

    const wasFavorited = favoriteCourtIds.has(courtId);
    console.log('HomeScreen: Toggling favorite for court:', courtId, 'wasFavorited:', wasFavorited);

    // Optimistic UI update
    setFavoriteCourtIds(prev => {
      const newSet = new Set(prev);
      if (wasFavorited) {
        newSet.delete(courtId);
      } else {
        newSet.add(courtId);
      }
      return newSet;
    });

    try {
      if (wasFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('court_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('court_id', courtId);

        if (error) {
          throw error;
        }
        console.log('HomeScreen: Successfully removed favorite');
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('court_favorites')
          .insert({ user_id: user.id, court_id: courtId });

        if (error) {
          throw error;
        }
        console.log('HomeScreen: Successfully added favorite');
      }
    } catch (error) {
      console.error('HomeScreen: Error toggling favorite:', error);
      
      // Revert optimistic update on error
      setFavoriteCourtIds(prev => {
        const newSet = new Set(prev);
        if (wasFavorited) {
          newSet.add(courtId);
        } else {
          newSet.delete(courtId);
        }
        return newSet;
      });

      Alert.alert('Error', "Couldn't update favorite. Try again.");
    }
  };

  // Show empty state if no courts and no search query
  const showEmptyState = !loading && courts.length === 0 && !searchQuery.trim();
  
  // Show no results if search/filter returns nothing
  const showNoResults = !loading && processedCourts.length === 0 && (searchQuery.trim() || Object.keys(filters).length > 0);

  // Show location prompt if no location permission
  const showLocationPrompt = !loading && !hasLocation && courts.length === 0 && !searchQuery.trim();

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading courts...</Text>
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
          <Image 
            source={require('@/assets/images/d00ee021-be7a-42f9-a115-ea45cb937f7f.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[commonStyles.textSecondary, { textAlign: 'center', marginTop: 12 }]}>
            Find active pickleball courts near you
          </Text>
        </View>

        {/* Unified Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <IconSymbol 
              ios_icon_name="magnifyingglass" 
              android_material_icon_name="search" 
              size={20} 
              color={colors.textSecondary} 
            />
            <TextInput
              style={styles.searchInput}
              placeholder={hasLocation ? "Search by name, city, or ZIP..." : "Enter ZIP code, city, or court name..."}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
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
        </View>

        {/* Location Prompt - shown when no location permission and no courts */}
        {showLocationPrompt && (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateCard}>
              <IconSymbol 
                ios_icon_name="location.fill" 
                android_material_icon_name="location-on" 
                size={48} 
                color={colors.textSecondary} 
              />
              <Text style={styles.emptyStateTitle}>Enable Location Services</Text>
              <Text style={styles.emptyStateText}>
                Allow location access to find nearby courts, or search by ZIP code, city, or court name.
              </Text>
              <TouchableOpacity
                style={styles.addCourtButton}
                onPress={handleRequestLocation}
                disabled={requestingPermission}
              >
                {requestingPermission ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <>
                    <IconSymbol 
                      ios_icon_name="location.fill" 
                      android_material_icon_name="location-on" 
                      size={20} 
                      color={colors.card} 
                    />
                    <Text style={styles.addCourtButtonText}>Enable Location</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Empty State - shown when courts exist but none match location/search */}
        {showEmptyState && !showLocationPrompt && (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateCard}>
              <IconSymbol 
                ios_icon_name="map.fill" 
                android_material_icon_name="map" 
                size={48} 
                color={colors.textSecondary} 
              />
              <Text style={styles.emptyStateTitle}>No courts found near you yet</Text>
              <Text style={styles.emptyStateText}>
                You can search by ZIP code, city, or court name, or add a new court manually.
              </Text>
              <TouchableOpacity
                style={styles.addCourtButton}
                onPress={() => setShowAddCourtModal(true)}
              >
                <IconSymbol 
                  ios_icon_name="plus.circle.fill" 
                  android_material_icon_name="add-circle-outline" 
                  size={20} 
                  color={colors.card} 
                />
                <Text style={styles.addCourtButtonText}>Add New Court</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Controls - only show if we have courts or search query */}
        {!showEmptyState && !showLocationPrompt && (
          <>
            <View style={styles.controlsContainer}>
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={styles.mapButton}
                  onPress={openGoogleMaps}
                >
                  <IconSymbol 
                    ios_icon_name="map.fill" 
                    android_material_icon_name="map" 
                    size={20} 
                    color={colors.card} 
                  />
                  <Text style={styles.mapButtonText}>Open Maps</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={() => setShowFilters(!showFilters)}
                >
                  <IconSymbol 
                    ios_icon_name="slider.horizontal.2" 
                    android_material_icon_name="tune" 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={styles.filterButtonText}>
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addCourtIconButton}
                  onPress={() => setShowAddCourtModal(true)}
                >
                  <IconSymbol 
                    ios_icon_name="plus.circle.fill" 
                    android_material_icon_name="add-circle-outline" 
                    size={24} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.sortContainer}>
                <Text style={[commonStyles.textSecondary, { marginBottom: 8 }]}>Sort by:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.sortButtons}>
                    <TouchableOpacity
                      style={[styles.sortButton, sortBy === 'favorites' && styles.sortButtonActive]}
                      onPress={() => setSortBy('favorites')}
                    >
                      <Text style={[styles.sortButtonText, sortBy === 'favorites' && styles.sortButtonTextActive]}>
                        Favorites
                      </Text>
                    </TouchableOpacity>
                    {userLocation && (
                      <TouchableOpacity
                        style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
                        onPress={() => setSortBy('distance')}
                      >
                        <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>
                          Nearest
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.sortButton, sortBy === 'active-high' && styles.sortButtonActive]}
                      onPress={() => setSortBy('active-high')}
                    >
                      <Text style={[styles.sortButtonText, sortBy === 'active-high' && styles.sortButtonTextActive]}>
                        Most Active
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortButton, sortBy === 'active-low' && styles.sortButtonActive]}
                      onPress={() => setSortBy('active-low')}
                    >
                      <Text style={[styles.sortButtonText, sortBy === 'active-low' && styles.sortButtonTextActive]}>
                        Least Active
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortButton, sortBy === 'skill-high' && styles.sortButtonActive]}
                      onPress={() => setSortBy('skill-high')}
                    >
                      <Text style={[styles.sortButtonText, sortBy === 'skill-high' && styles.sortButtonTextActive]}>
                        Skill: High
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortButton, sortBy === 'skill-low' && styles.sortButtonActive]}
                      onPress={() => setSortBy('skill-low')}
                    >
                      <Text style={[styles.sortButtonText, sortBy === 'skill-low' && styles.sortButtonTextActive]}>
                        Skill: Low
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
              
              {favoriteCourtIds.size === 0 && sortBy === 'favorites' && (
                <Text style={styles.helperText}>Star courts to save favorites.</Text>
              )}

              {showFilters && (
                <View style={styles.filtersContainer}>
                  <Text style={[commonStyles.subtitle, { fontSize: 16, marginBottom: 12 }]}>Filters</Text>
                  
                  {userLocation && (
                    <View style={styles.filterSection}>
                      <Text style={[commonStyles.textSecondary, { marginBottom: 8 }]}>Distance Radius:</Text>
                      <View style={styles.filterButtons}>
                        {[2, 5, 10, 20, 50].map((distance, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.filterButton2,
                              filters.maxDistance === distance && styles.filterButton2Active,
                            ]}
                            onPress={() => setFilters({ ...filters, maxDistance: filters.maxDistance === distance ? undefined : distance })}
                          >
                            <Text style={[
                              styles.filterButton2Text,
                              filters.maxDistance === distance && styles.filterButton2TextActive,
                            ]}>
                              {distance} mi
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.filterSection}>
                    <TouchableOpacity
                      style={styles.filterCheckbox}
                      onPress={() => setFilters({ ...filters, friendsOnly: !filters.friendsOnly })}
                    >
                      <View style={[styles.checkbox, filters.friendsOnly && styles.checkboxActive]}>
                        {filters.friendsOnly && (
                          <IconSymbol 
                            ios_icon_name="checkmark" 
                            android_material_icon_name="check" 
                            size={16} 
                            color={colors.card} 
                          />
                        )}
                      </View>
                      <Text style={commonStyles.text}>Friends only</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.filterSection}>
                    <TouchableOpacity
                      style={styles.filterCheckbox}
                      onPress={() => setFilters({ ...filters, favoritesOnly: !filters.favoritesOnly })}
                    >
                      <View style={[styles.checkbox, filters.favoritesOnly && styles.checkboxActive]}>
                        {filters.favoritesOnly && (
                          <IconSymbol 
                            ios_icon_name="checkmark" 
                            android_material_icon_name="check" 
                            size={16} 
                            color={colors.card} 
                          />
                        )}
                      </View>
                      <Text style={commonStyles.text}>Favorites only</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.filterSection}>
                    <Text style={[commonStyles.textSecondary, { marginBottom: 8 }]}>Skill Level:</Text>
                    <View style={styles.skillLevelFilters}>
                      {(['Beginner', 'Intermediate', 'Advanced'] as const).map((level, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.skillLevelFilterButton,
                            filters.skillLevels?.includes(level) && styles.skillLevelFilterButtonActive,
                          ]}
                          onPress={() => toggleSkillLevelFilter(level)}
                        >
                          <Text style={[
                            styles.skillLevelFilterText,
                            filters.skillLevels?.includes(level) && styles.skillLevelFilterTextActive,
                          ]}>
                            {level}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    onPress={() => {
                      setFilters({});
                      setDisplayCount(INITIAL_DISPLAY_COUNT);
                    }}
                  >
                    <Text style={styles.clearFiltersText}>Clear All Filters</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.courtsSection}>
              <View style={styles.sectionHeader}>
                <Text style={commonStyles.subtitle}>
                  {processedCourts.length} {processedCourts.length === 1 ? 'Court' : 'Courts'}
                  {displayedCourts.length < processedCourts.length && ` (showing ${displayedCourts.length})`}
                </Text>
                <TouchableOpacity onPress={refetch}>
                  <IconSymbol 
                    ios_icon_name="arrow.clockwise" 
                    android_material_icon_name="refresh" 
                    size={24} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>

              {showNoResults ? (
                <View style={commonStyles.card}>
                  <Text style={[commonStyles.text, { textAlign: 'center', marginBottom: 16 }]}>
                    No courts found matching your search or filters.
                  </Text>
                  <TouchableOpacity
                    style={styles.addCourtButton}
                    onPress={() => setShowAddCourtModal(true)}
                  >
                    <IconSymbol 
                      ios_icon_name="plus.circle.fill" 
                      android_material_icon_name="add-circle-outline" 
                      size={20} 
                      color={colors.card} 
                    />
                    <Text style={styles.addCourtButtonText}>Add New Court</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {displayedCourts.map((court, index) => {
                    const isFavorited = favoriteCourtIds.has(court.id);
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={commonStyles.card}
                        onPress={() => router.push(`/(tabs)/(home)/court/${court.id}`)}
                      >
                        <View style={styles.courtHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.courtName}>{court.name}</Text>
                            <Text style={commonStyles.textSecondary}>{court.address}</Text>
                            {court.distance !== undefined && (
                              <Text style={[commonStyles.textSecondary, { marginTop: 4, fontWeight: '600' }]}>
                                📍 {court.distance.toFixed(1)} miles away
                              </Text>
                            )}
                          </View>
                          <View style={styles.courtActions}>
                            <TouchableOpacity
                              style={styles.courtActionIcon}
                              onPress={(e) => handleToggleFavorite(court.id, e)}
                            >
                              <IconSymbol 
                                ios_icon_name={isFavorited ? "star.fill" : "star"}
                                android_material_icon_name={isFavorited ? "star" : "star-border"}
                                size={24} 
                                color={isFavorited ? colors.accent : colors.textSecondary} 
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.courtActionIcon}
                              onPress={(e) => {
                                e.stopPropagation();
                                try {
                                  const url = `https://www.google.com/maps/dir/?api=1&destination=${court.latitude},${court.longitude}`;
                                  Linking.openURL(url).catch(err => {
                                    console.error('HomeScreen: Failed to open directions:', err);
                                    Alert.alert('Error', 'Unable to open directions');
                                  });
                                } catch (error) {
                                  console.error('HomeScreen: Error opening directions:', error);
                                }
                              }}
                            >
                              <IconSymbol 
                                ios_icon_name="map.fill" 
                                android_material_icon_name="map" 
                                size={24} 
                                color={colors.primary} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      
                      <View style={styles.courtFooter}>
                        <View style={styles.playerInfoContainer}>
                          <View style={styles.playerCount}>
                            <IconSymbol 
                              ios_icon_name="person.2.fill" 
                              android_material_icon_name="people" 
                              size={16} 
                              color={colors.textSecondary} 
                            />
                            <Text style={[commonStyles.textSecondary, { marginLeft: 6 }]}>
                              {court.currentPlayers} {court.currentPlayers === 1 ? 'player' : 'players'}
                            </Text>
                          </View>

                          {court.friendsPlayingCount > 0 && (
                            <View style={styles.friendsCount}>
                              <IconSymbol 
                                ios_icon_name="person.2.fill" 
                                android_material_icon_name="people" 
                                size={16} 
                                color={colors.accent} 
                              />
                              <Text style={[commonStyles.textSecondary, { marginLeft: 6, color: colors.accent, fontWeight: '600' }]}>
                                {court.friendsPlayingCount} {court.friendsPlayingCount === 1 ? 'friend' : 'friends'}
                              </Text>
                            </View>
                          )}
                          
                          {court.currentPlayers > 0 && (
                            <View style={styles.skillLevelContainer}>
                              <SkillLevelBars 
                                averageSkillLevel={court.averageSkillLevel} 
                                size={16}
                                color={colors.primary}
                              />
                              <Text style={[commonStyles.textSecondary, { fontSize: 12, marginLeft: 6 }]}>
                                {getSkillLevelLabel(court.averageSkillLevel)}
                              </Text>
                            </View>
                          )}

                          {court.averageDupr !== undefined && (
                            <View style={styles.duprContainer}>
                              <IconSymbol 
                                ios_icon_name="chart.bar.fill" 
                                android_material_icon_name="bar-chart" 
                                size={16} 
                                color={colors.accent} 
                              />
                              <Text style={[commonStyles.textSecondary, { marginLeft: 6, fontWeight: '600', color: colors.accent }]}>
                                DUPR: {court.averageDupr.toFixed(1)}
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        <IconSymbol 
                          ios_icon_name="chevron.right" 
                          android_material_icon_name="chevron-right" 
                          size={20} 
                          color={colors.textSecondary} 
                        />
                      </View>
                    </TouchableOpacity>
                    );
                  })}

                  {hasMoreCourts && (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={handleLoadMore}
                    >
                      <Text style={styles.loadMoreText}>Load More Courts</Text>
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
          </>
        )}

        <LegalFooter />
      </ScrollView>

      <AddCourtModal
        visible={showAddCourtModal}
        onClose={() => setShowAddCourtModal(false)}
        onSuccess={() => {
          refetch();
        }}
      />
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
    marginBottom: 24,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  emptyStateContainer: {
    marginTop: 40,
  },
  emptyStateCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  addCourtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    minHeight: 48,
  },
  addCourtButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  controlsContainer: {
    marginBottom: 24,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  mapButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 8,
  },
  filterButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  addCourtIconButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortContainer: {
    marginBottom: 16,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sortButtonTextActive: {
    color: colors.card,
  },
  filtersContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton2: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButton2Active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButton2Text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  filterButton2TextActive: {
    color: colors.card,
  },
  filterCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  skillLevelFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  skillLevelFilterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  skillLevelFilterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  skillLevelFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  skillLevelFilterTextActive: {
    color: colors.card,
  },
  clearFiltersButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 16,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  courtsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  courtName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  courtActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  courtActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courtMapIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  courtFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    flex: 1,
  },
  playerCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendsCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skillLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duprContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});
