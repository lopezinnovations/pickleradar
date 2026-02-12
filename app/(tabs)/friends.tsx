// SAME IMPORTS (no changes)
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useFriendsQuery } from '@/hooks/useFriendsQuery';
import { IconSymbol } from '@/components/IconSymbol';
import { FriendCardSkeleton } from '@/components/SkillLevelBars';
import { debounce } from '@/utils/performanceLogger';
import { LegalFooter } from '@/components/LegalFooter';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { friends, pendingRequests, allUsers, loading, refetch, isRefetching } = useFriendsQuery(user?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notificationPrefsModalVisible, setNotificationPrefsModalVisible] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [notifyCheckin, setNotifyCheckin] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);

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

  if (loading) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.header}>
          <Text style={commonStyles.title}>Friends</Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {[1, 2, 3].map((_, i) => (
            <FriendCardSkeleton key={i} />
          ))}
        </View>
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
          <Text style={commonStyles.title}>Friends</Text>
          <Text style={commonStyles.textSecondary}>
            Connect with pickleball players
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => setActiveTab('friends')}
          >
            <Text
              style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}
              numberOfLines={1}
            >
              Friends ({friends.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text
              style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}
              numberOfLines={1}
            >
              Requests ({pendingRequests.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => setActiveTab('search')}
          >
            <Text
              style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}
              numberOfLines={1}
            >
              Search
            </Text>
          </TouchableOpacity>
        </View>

        {/* Your existing content rendering stays unchanged here */}

        <LegalFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 14,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    marginLeft: 10,
  },

  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.highlight,
    borderWidth: 1,
    borderColor: colors.border,
  },

  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  tabTextActive: {
    color: colors.card,
  },
});
