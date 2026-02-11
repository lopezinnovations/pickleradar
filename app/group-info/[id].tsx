
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Modal, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { MuteOptionsModal } from '@/components/MuteOptionsModal';

interface GroupMember {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  created_by: string;
}

export default function GroupInfoScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams();
  const { user } = useAuth();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [muteUntil, setMuteUntil] = useState<string | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageModalText, setMessageModalText] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const fetchGroupInfo = useCallback(async () => {
    if (!groupId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching group info for:', groupId);
      
      // Fetch group info
      const { data: groupData, error: groupError } = await supabase
        .from('group_chats')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) {
        console.log('Error fetching group info:', groupError);
        throw groupError;
      }

      console.log('Group info fetched:', groupData);
      setGroupInfo(groupData);
      setNewGroupName(groupData.name);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select(`
          id,
          user_id,
          users!group_members_user_id_fkey(id, first_name, last_name, pickleballer_nickname)
        `)
        .eq('group_id', groupId);

      if (membersError) {
        console.log('Error fetching members:', membersError);
        throw membersError;
      }

      console.log('Members fetched:', membersData?.length || 0);
      const membersList: GroupMember[] = (membersData || []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        firstName: item.users.first_name,
        lastName: item.users.last_name,
        nickname: item.users.pickleballer_nickname,
      }));

      setMembers(membersList);

      // Check mute status
      if (user) {
        const { data: muteData, error: muteError } = await supabase
          .from('conversation_mutes')
          .select('*')
          .eq('user_id', user.id)
          .eq('conversation_type', 'group')
          .eq('conversation_id', groupId)
          .maybeSingle();

        if (muteError && muteError.code !== 'PGRST116') {
          console.log('Error fetching mute status:', muteError);
        }

        if (muteData) {
          const mutedUntil = muteData.muted_until;
          const isMutedNow = !mutedUntil || new Date(mutedUntil) > new Date();
          setIsMuted(isMutedNow);
          setMuteUntil(mutedUntil);
        }
      }
    } catch (error) {
      console.log('Error in fetchGroupInfo:', error);
      setMessageModalText('Failed to load group information.');
      setShowMessageModal(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  useFocusEffect(
    useCallback(() => {
      fetchGroupInfo();
    }, [fetchGroupInfo])
  );

  useEffect(() => {
    fetchGroupInfo();
  }, [fetchGroupInfo]);

  const handleRenameGroup = async () => {
    if (!newGroupName.trim() || !groupId || !isSupabaseConfigured()) {
      setMessageModalText('Please enter a valid group name.');
      setShowMessageModal(true);
      return;
    }

    console.log('User renaming group to:', newGroupName);
    setRenaming(true);

    try {
      const { error } = await supabase
        .from('group_chats')
        .update({ name: newGroupName.trim(), updated_at: new Date().toISOString() })
        .eq('id', groupId);

      if (error) {
        console.log('Error renaming group:', error);
        throw error;
      }

      setGroupInfo(prev => prev ? { ...prev, name: newGroupName.trim() } : null);
      setShowRenameModal(false);
      setMessageModalText('Group name updated successfully!');
      setShowMessageModal(true);
    } catch (error: any) {
      console.log('Error in handleRenameGroup:', error);
      setMessageModalText(`Failed to rename group: ${error.message}`);
      setShowMessageModal(true);
    } finally {
      setRenaming(false);
    }
  };

  const handleLeaveGroup = async () => {
    console.log('User leaving group:', groupId);
    setShowLeaveConfirm(false);
    
    try {
      if (!user || !groupId || !isSupabaseConfigured()) return;

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) {
        console.log('Error leaving group:', error);
        throw error;
      }

      setMessageModalText('You have left the group.');
      setShowMessageModal(true);
      
      setTimeout(() => {
        router.replace('/(tabs)/messages');
      }, 1500);
    } catch (error: any) {
      console.log('Error in handleLeaveGroup:', error);
      setMessageModalText(`Failed to leave group: ${error.message}`);
      setShowMessageModal(true);
    }
  };

  const handleMuteConversation = async (minutes: number | null) => {
    console.log('User muting group for:', minutes, 'minutes');
    try {
      if (!user || !groupId || !isSupabaseConfigured()) return;

      const mutedUntil = minutes ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : null;

      const { error } = await supabase
        .from('conversation_mutes')
        .upsert({
          user_id: user.id,
          conversation_type: 'group',
          conversation_id: groupId,
          muted_until: mutedUntil,
        }, {
          onConflict: 'user_id,conversation_type,conversation_id',
        });

      if (error) {
        console.log('Error muting conversation:', error);
        throw error;
      }

      setIsMuted(true);
      setMuteUntil(mutedUntil);
      
      const muteMessage = minutes 
        ? `Muted for ${minutes >= 1440 ? '24 hours' : minutes >= 480 ? '8 hours' : '1 hour'}`
        : 'Muted until you turn it back on';
      setMessageModalText(muteMessage);
      setShowMessageModal(true);
    } catch (error: any) {
      console.log('Error in handleMuteConversation:', error);
      setMessageModalText(`Failed to mute conversation: ${error.message}`);
      setShowMessageModal(true);
    }
  };

  const handleUnmute = async () => {
    console.log('User unmuting group');
    try {
      if (!user || !groupId || !isSupabaseConfigured()) return;

      const { error } = await supabase
        .from('conversation_mutes')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_type', 'group')
        .eq('conversation_id', groupId);

      if (error) {
        console.log('Error unmuting conversation:', error);
        throw error;
      }

      setIsMuted(false);
      setMuteUntil(null);
      setMessageModalText('Notifications enabled for this group.');
      setShowMessageModal(true);
    } catch (error: any) {
      console.log('Error in handleUnmute:', error);
      setMessageModalText(`Failed to unmute conversation: ${error.message}`);
      setShowMessageModal(true);
    }
  };

  const formatMemberName = (member: GroupMember) => {
    if (member.firstName && member.lastName) {
      const name = `${member.firstName} ${member.lastName.charAt(0)}.`;
      return name;
    }
    return member.nickname || 'Unknown User';
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const memberName = formatMemberName(item);
    const isCurrentUser = item.userId === user?.id;
    
    return (
      <View style={styles.memberItem}>
        <View style={styles.memberAvatar}>
          <IconSymbol
            ios_icon_name="person.fill"
            android_material_icon_name="person"
            size={24}
            color={colors.primary}
          />
        </View>
        <Text style={styles.memberName}>
          {memberName}
          {isCurrentUser && ' (You)'}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 16 }]}>Loading group info...</Text>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="chevron-left"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.groupHeader}>
          <View style={styles.groupAvatar}>
            <IconSymbol
              ios_icon_name="person.3.fill"
              android_material_icon_name="group"
              size={48}
              color={colors.primary}
            />
          </View>
          <Text style={styles.groupName}>{groupInfo?.name}</Text>
          <Text style={styles.memberCount}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.actionItem} onPress={() => setShowRenameModal(true)}>
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.actionText}>Rename Group</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => {
              console.log('User tapped Add Members');
              router.push(`/add-group-members/${groupId}`);
            }}
          >
            <IconSymbol
              ios_icon_name="person.badge.plus"
              android_material_icon_name="person-add"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.actionText}>Add Members</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={isMuted ? handleUnmute : () => setShowMuteModal(true)}
          >
            <IconSymbol
              ios_icon_name={isMuted ? "bell.fill" : "bell.slash.fill"}
              android_material_icon_name={isMuted ? "notifications" : "notifications-off"}
              size={24}
              color={colors.primary}
            />
            <Text style={styles.actionText}>
              {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
            </Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          <FlatList
            data={members}
            renderItem={renderMember}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.leaveButton} onPress={() => setShowLeaveConfirm(true)}>
            <IconSymbol
              ios_icon_name="rectangle.portrait.and.arrow.right"
              android_material_icon_name="exit-to-app"
              size={24}
              color={colors.error}
            />
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rename Modal */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Rename Group</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter new group name..."
              placeholderTextColor={colors.textSecondary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, renaming && styles.modalButtonDisabled]}
                onPress={handleRenameGroup}
                disabled={renaming}
              >
                {renaming ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leave Confirmation Modal */}
      <Modal
        visible={showLeaveConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLeaveConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Leave Group</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to leave this group? You won&apos;t be able to see messages or rejoin unless someone adds you back.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowLeaveConfirm(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleLeaveGroup}
              >
                <Text style={styles.modalButtonTextConfirm}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Message Modal */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalMessage}>{messageModalText}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => setShowMessageModal(false)}
            >
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mute Options Modal */}
      <MuteOptionsModal
        visible={showMuteModal}
        onClose={() => setShowMuteModal(false)}
        onSelectMute={handleMuteConversation}
      />
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
  groupHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberName: {
    fontSize: 16,
    color: colors.text,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  modalButtonDanger: {
    backgroundColor: colors.error,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
  },
});
