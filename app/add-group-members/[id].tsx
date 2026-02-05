
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';

interface Friend {
  id: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  selected: boolean;
  alreadyMember: boolean;
}

export default function AddGroupMembersScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFriendsAndMembers();
  }, [user, groupId]);

  const fetchFriendsAndMembers = async () => {
    if (!user || !groupId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      // Fetch user's friends
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select(`
          id,
          friend:users!friends_friend_id_fkey(id, first_name, last_name, pickleballer_nickname)
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (friendsError) {
        console.log('Error fetching friends:', friendsError);
        throw friendsError;
      }

      // Fetch current group members
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (membersError) {
        console.log('Error fetching group members:', membersError);
        throw membersError;
      }

      const memberIds = new Set((membersData || []).map((m: any) => m.user_id));

      const friendsList: Friend[] = (friendsData || []).map((item: any) => ({
        id: item.friend.id,
        firstName: item.friend.first_name,
        lastName: item.friend.last_name,
        nickname: item.friend.pickleballer_nickname,
        selected: false,
        alreadyMember: memberIds.has(item.friend.id),
      }));

      setFriends(friendsList);
    } catch (error) {
      console.log('Error in fetchFriendsAndMembers:', error);
      Alert.alert('Error', 'Failed to load friends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    console.log('User toggled friend selection:', friendId);
    setFriends(prev =>
      prev.map(f => (f.id === friendId && !f.alreadyMember ? { ...f, selected: !f.selected } : f))
    );
  };

  const handleAddMembers = async () => {
    const selectedFriends = friends.filter(f => f.selected);
    
    if (selectedFriends.length === 0) {
      Alert.alert('No Members Selected', 'Please select at least one friend to add.');
      return;
    }

    console.log('User adding', selectedFriends.length, 'members to group');
    setAdding(true);

    try {
      if (!groupId || !isSupabaseConfigured()) {
        throw new Error('Invalid group ID');
      }

      const membersToAdd = selectedFriends.map(f => ({
        group_id: groupId,
        user_id: f.id,
      }));

      const { error } = await supabase
        .from('group_members')
        .insert(membersToAdd);

      if (error) {
        console.log('Error adding members:', error);
        throw error;
      }

      console.log('Members added successfully');
      Alert.alert('Success', 'Members added successfully!', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.log('Error in handleAddMembers:', error);
      Alert.alert('Error', `Failed to add members: ${error.message}`);
    } finally {
      setAdding(false);
    }
  };

  const formatFriendName = (friend: Friend) => {
    if (friend.firstName && friend.lastName) {
      const name = `${friend.firstName} ${friend.lastName.charAt(0)}.`;
      return name;
    }
    return friend.nickname || 'Unknown User';
  };

  const filteredFriends = friends.filter(f => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = formatFriendName(f).toLowerCase();
    return name.includes(query);
  });

  const selectedCount = friends.filter(f => f.selected).length;

  const renderFriend = ({ item }: { item: Friend }) => {
    const friendName = formatFriendName(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.friendItem,
          item.selected && styles.friendItemSelected,
          item.alreadyMember && styles.friendItemDisabled,
        ]}
        onPress={() => toggleFriendSelection(item.id)}
        disabled={item.alreadyMember}
      >
        <View style={styles.friendAvatar}>
          <IconSymbol
            ios_icon_name="person.fill"
            android_material_icon_name="person"
            size={24}
            color={item.selected ? colors.card : colors.primary}
          />
        </View>
        <Text style={[styles.friendName, item.selected && styles.friendNameSelected]}>
          {friendName}
        </Text>
        {item.alreadyMember ? (
          <Text style={styles.alreadyMemberText}>Already a member</Text>
        ) : item.selected ? (
          <IconSymbol
            ios_icon_name="checkmark.circle.fill"
            android_material_icon_name="check_circle"
            size={24}
            color={colors.card}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading friends...</Text>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="chevron_left"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Members</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.selectedCount}>
          {selectedCount} {selectedCount === 1 ? 'friend' : 'friends'} selected
        </Text>

        {filteredFriends.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="person.2"
              android_material_icon_name="group"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[commonStyles.textSecondary, { marginTop: 16, textAlign: 'center' }]}>
              {searchQuery.trim() ? 'No friends match your search' : 'No friends to add'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            renderItem={renderFriend}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.friendsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addButton, (adding || selectedCount === 0) && styles.addButtonDisabled]}
          onPress={handleAddMembers}
          disabled={adding || selectedCount === 0}
        >
          {adding ? (
            <ActivityIndicator size="small" color={colors.card} />
          ) : (
            <Text style={styles.addButtonText}>Add Members</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  friendsList: {
    paddingBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  friendItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  friendItemDisabled: {
    opacity: 0.5,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  friendNameSelected: {
    color: colors.card,
  },
  alreadyMemberText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
  },
});
