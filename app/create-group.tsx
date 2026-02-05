
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { requestNotificationPermissions, checkNotificationPermissionStatus } from '@/utils/notifications';

interface Friend {
  id: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  selected: boolean;
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFriends();
  }, [user]);

  const fetchFriends = async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          friend:users!friends_friend_id_fkey(id, first_name, last_name, pickleballer_nickname)
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) {
        console.log('Error fetching friends:', error);
        throw error;
      }

      const friendsList: Friend[] = (data || []).map((item: any) => ({
        id: item.friend.id,
        firstName: item.friend.first_name,
        lastName: item.friend.last_name,
        nickname: item.friend.pickleballer_nickname,
        selected: false,
      }));

      setFriends(friendsList);
    } catch (error) {
      console.log('Error in fetchFriends:', error);
      Alert.alert('Error', 'Failed to load friends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    console.log('User toggled friend selection:', friendId);
    setFriends(prev =>
      prev.map(f => (f.id === friendId ? { ...f, selected: !f.selected } : f))
    );
  };

  const handleCreateGroup = async () => {
    const selectedFriends = friends.filter(f => f.selected);
    
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for your group.');
      return;
    }

    if (selectedFriends.length === 0) {
      Alert.alert('Add Members', 'Please select at least one friend to add to the group.');
      return;
    }

    console.log('User tapped Create Group with name:', groupName, 'and', selectedFriends.length, 'members');
    setCreating(true);

    try {
      if (!user || !isSupabaseConfigured()) {
        throw new Error('User not authenticated');
      }

      // Use RPC function to create group and add members atomically
      // This bypasses RLS policies using SECURITY DEFINER
      const memberIds = [user.id, ...selectedFriends.map(f => f.id)];
      
      const { data: groupId, error: rpcError } = await supabase
        .rpc('create_group_with_members', {
          group_name: groupName.trim(),
          member_ids: memberIds,
        });

      if (rpcError) {
        console.log('Supabase RPC error creating group:', rpcError);
        throw rpcError;
      }

      if (!groupId) {
        throw new Error('Failed to create group - no ID returned');
      }

      // Check if we should prompt for notifications (first group created)
      const permissionStatus = await checkNotificationPermissionStatus();
      if (permissionStatus !== 'granted') {
        const granted = await requestNotificationPermissions();
        if (granted && isSupabaseConfigured()) {
          await supabase
            .from('users')
            .update({ notification_prompt_shown: true })
            .eq('id', user.id);
        }
      }

      console.log('Group created successfully:', groupId);
      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            router.replace(`/group-conversation/${groupId}`);
          },
        },
      ]);
    } catch (error: any) {
      console.log('Error in handleCreateGroup:', error);
      Alert.alert('Error', "Can't create group yet. Please try again in a moment.");
    } finally {
      setCreating(false);
    }
  };

  const formatFriendName = (friend: Friend) => {
    if (friend.firstName && friend.lastName) {
      const fullName = `${friend.firstName} ${friend.lastName.charAt(0)}.`;
      return fullName;
    }
    return friend.nickname || 'Unknown User';
  };

  // Live type-ahead search - filters as user types
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    
    const query = searchQuery.toLowerCase();
    return friends.filter(f => {
      const firstName = f.firstName?.toLowerCase() || '';
      const lastName = f.lastName?.toLowerCase() || '';
      const nickname = f.nickname?.toLowerCase() || '';
      
      return firstName.includes(query) || 
             lastName.includes(query) || 
             nickname.includes(query);
    });
  }, [friends, searchQuery]);

  const selectedCount = friends.filter(f => f.selected).length;

  const renderFriend = ({ item }: { item: Friend }) => {
    const friendName = formatFriendName(item);
    
    return (
      <TouchableOpacity
        style={[styles.friendItem, item.selected && styles.friendItemSelected]}
        onPress={() => toggleFriendSelection(item.id)}
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
        {item.selected && (
          <IconSymbol
            ios_icon_name="checkmark.circle.fill"
            android_material_icon_name="check_circle"
            size={24}
            color={colors.card}
          />
        )}
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
        <Text style={styles.headerTitle}>Create Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Group Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter group name..."
            placeholderTextColor={colors.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
            autoFocus
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Add Members ({selectedCount} selected)
          </Text>
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
              scrollEnabled={false}
              contentContainerStyle={styles.friendsList}
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color={colors.card} />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
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
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
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
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
  },
});
