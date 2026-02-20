import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { useFriendsQuery } from '@/hooks/useFriendsQuery';
import { IconSymbol } from '@/components/IconSymbol';
import { FriendCardSkeleton } from '@/components/SkillLevelBars';
import { debounce } from '@/utils/performanceLogger';
import { formatDisplayName } from '@/utils/formatDisplayName';
import { LegalFooter } from '@/components/LegalFooter';

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // ✅ state must be declared BEFORE any hook that uses it
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');

  // ✅ if your hook doesn't accept a 2nd param yet, change to: useFriendsQuery(user?.id)
  const { friends, pendingRequests, allUsers, loading, refetch, isRefetching } = useFriendsQuery(
    user?.id,
    activeTab === 'search'
  );

  const debouncedSearch = useCallback((query: string) => {
    setDebouncedSearchQuery(query);
  }, []);

  const debouncedSearchHandler = useMemo(() => debounce(debouncedSearch, 400), [debouncedSearch]);

  useEffect(() => {
    debouncedSearchHandler(searchQuery);
  }, [searchQuery, debouncedSearchHandler]);

  const filteredFriends = useMemo(() => {
    if (activeTab !== 'friends') return [];
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return friends;

    return friends.filter((f) => {
      const name =
        [f.friendFirstName, f.friendLastName, f.friendNickname].filter(Boolean).join(' ') ||
        f.friendId;
      return name.toLowerCase().includes(q);
    });
  }, [activeTab, friends, debouncedSearchQuery]);

  const filteredUsers = useMemo(() => {
    if (activeTab !== 'search') return [];
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];

    return (allUsers || [])
      .filter((u: any) => u?.id && u.id !== user?.id)
      .filter((u: any) => {
        const name = [u.first_name, u.last_name, u.pickleballer_nickname]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const email = (u.email ?? '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
  }, [activeTab, allUsers, debouncedSearchQuery, user?.id]);

  const getFriendDisplayName = useCallback((f: (typeof friends)[0]) => {
    return formatDisplayName({
      first_name: f.friendFirstName ?? null,
      last_name: f.friendLastName ?? null,
      pickleballer_nickname: f.friendNickname ?? null,
    });
  }, []);

  const getUserDisplayName = useCallback((u: any) => {
    return formatDisplayName({
      first_name: u?.first_name ?? null,
      last_name: u?.last_name ?? null,
      pickleballer_nickname: u?.pickleballer_nickname ?? null,
    });
  }, []);

  const searchPlaceholder =
    activeTab === 'friends' ? 'Search friends...' : activeTab === 'search' ? 'Search players...' : 'Search...';

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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={commonStyles.title}>Friends</Text>
          <Text style={commonStyles.textSecondary}>Connect with pickleball players</Text>
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
            style={styles.searchInput}
            placeholder={searchPlaceholder}
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
            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]} numberOfLines={1}>
              Friends ({friends.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]} numberOfLines={1}>
              Requests ({pendingRequests.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => setActiveTab('search')}
          >
            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]} numberOfLines={1}>
              Search
            </Text>
          </TouchableOpacity>
        </View>

        {/* Friends tab */}
        {activeTab === 'friends' && (
          <View style={styles.content}>
            {filteredFriends.length === 0 ? (
              <Text style={[commonStyles.textSecondary, styles.emptyText]}>
                {friends.length === 0 ? 'No friends yet. Use Search to find players.' : 'No friends match your search.'}
              </Text>
            ) : (
              filteredFriends.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.friendCard}
                  onPress={() => router.push(`/user/${f.friendId}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.friendCardContent}>
                    <View style={styles.friendAvatar}>
                      <IconSymbol
                        ios_icon_name="person.fill"
                        android_material_icon_name="person"
                        size={28}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {getFriendDisplayName(f)}
                      </Text>
                      {f.friendNickname && (
                        <Text style={commonStyles.textSecondary} numberOfLines={1}>
                          &quot;{f.friendNickname}&quot;
                        </Text>
                      )}
                      {f.isAtCourt && <Text style={styles.atCourtText}>At a court</Text>}
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Requests tab */}
        {activeTab === 'requests' && (
          <View style={styles.content}>
            <Text style={[commonStyles.textSecondary, styles.emptyText]}>
              {pendingRequests.length === 0 ? 'No pending requests.' : `${pendingRequests.length} pending request(s).`}
            </Text>
          </View>
        )}

        {/* Search tab */}
        {activeTab === 'search' && (
          <View style={styles.content}>
            {debouncedSearchQuery.trim().length < 2 ? (
              <Text style={[commonStyles.textSecondary, styles.emptyText]}>
                Type at least 2 letters to search players.
              </Text>
            ) : filteredUsers.length === 0 ? (
              <Text style={[commonStyles.textSecondary, styles.emptyText]}>
                No players match “{debouncedSearchQuery.trim()}”.
              </Text>
            ) : (
              filteredUsers.map((u: any) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.friendCard}
                  onPress={() => router.push(`/user/${u.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.friendCardContent}>
                    <View style={styles.friendAvatar}>
                      <IconSymbol
                        ios_icon_name="person.fill"
                        android_material_icon_name="person"
                        size={28}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {getUserDisplayName(u)}
                      </Text>
                      {u.pickleballer_nickname && (
                        <Text style={commonStyles.textSecondary} numberOfLines={1}>
                          &quot;{u.pickleballer_nickname}&quot;
                        </Text>
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
              ))
            )}
          </View>
        )}

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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  friendCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  friendCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  atCourtText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
});
