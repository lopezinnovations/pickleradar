
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      check_ins: {
        Row: {
          court_id: string
          created_at: string
          expires_at: string
          id: string
          skill_level: string
          user_id: string
          duration_minutes: number
          notification_id: string | null
        }
        Insert: {
          court_id: string
          created_at?: string
          expires_at: string
          id?: string
          skill_level: string
          user_id: string
          duration_minutes?: number
          notification_id?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          skill_level?: string
          user_id?: string
          duration_minutes?: number
          notification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          address: string
          city: string | null
          zip_code: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          description: string | null
          open_time: string | null
          close_time: string | null
          google_place_id: string | null
        }
        Insert: {
          address: string
          city?: string | null
          zip_code?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          description?: string | null
          open_time?: string | null
          close_time?: string | null
          google_place_id?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          zip_code?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          description?: string | null
          open_time?: string | null
          close_time?: string | null
          google_place_id?: string | null
        }
        Relationships: []
      }
      user_submitted_courts: {
        Row: {
          id: string
          user_id: string
          name: string
          address: string
          city: string | null
          zip_code: string | null
          latitude: number | null
          longitude: number | null
          photo_url: string | null
          skill_level: string | null
          dupr_rating: number | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          address: string
          city?: string | null
          zip_code?: string | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          skill_level?: string | null
          dupr_rating?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          address?: string
          city?: string | null
          zip_code?: string | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          skill_level?: string | null
          dupr_rating?: number | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_submitted_courts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          type: string
          data: Json | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body: string
          type: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          type?: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string
          content: string
          read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id: string
          content: string
          read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_id?: string
          content?: string
          read?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      group_chats: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      group_messages: {
        Row: {
          id: string
          group_id: string
          sender_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          sender_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          sender_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      conversation_mutes: {
        Row: {
          id: string
          user_id: string
          conversation_type: 'direct' | 'group'
          conversation_id: string
          muted_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_type: 'direct' | 'group'
          conversation_id: string
          muted_until?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_type?: 'direct' | 'group'
          conversation_id?: string
          muted_until?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string
          platform: string
          token: string
          active: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: string
          token: string
          active?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          token?: string
          active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          phone: string | null
          id: string
          first_name: string | null
          last_name: string | null
          pickleballer_nickname: string | null
          location_enabled: boolean | null
          notifications_enabled: boolean | null
          privacy_opt_in: boolean | null
          skill_level: string | null
          experience_level: string | null
          updated_at: string
          latitude: number | null
          longitude: number | null
          zip_code: string | null
          dupr_rating: number | null
          location_permission_requested: boolean | null
          profile_picture_url: string | null
          terms_accepted: boolean | null
          privacy_accepted: boolean | null
          accepted_at: string | null
          accepted_version: string | null
          messages_visit_count: number
          notification_prompt_shown: boolean
          is_deleted: boolean | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          phone?: string | null
          id: string
          first_name?: string | null
          last_name?: string | null
          pickleballer_nickname?: string | null
          location_enabled?: boolean | null
          notifications_enabled?: boolean | null
          privacy_opt_in?: boolean | null
          skill_level?: string | null
          experience_level?: string | null
          updated_at?: string
          latitude?: number | null
          longitude?: number | null
          zip_code?: string | null
          dupr_rating?: number | null
          location_permission_requested?: boolean | null
          profile_picture_url?: string | null
          terms_accepted?: boolean | null
          privacy_accepted?: boolean | null
          accepted_at?: string | null
          accepted_version?: string | null
          messages_visit_count?: number
          notification_prompt_shown?: boolean
          is_deleted?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string | null
          phone?: string | null
          id?: string
          first_name?: string | null
          last_name?: string | null
          pickleballer_nickname?: string | null
          location_enabled?: boolean | null
          notifications_enabled?: boolean | null
          privacy_opt_in?: boolean | null
          skill_level?: string | null
          experience_level?: string | null
          updated_at?: string
          latitude?: number | null
          longitude?: number | null
          zip_code?: string | null
          dupr_rating?: number | null
          location_permission_requested?: boolean | null
          profile_picture_url?: string | null
          terms_accepted?: boolean | null
          privacy_accepted?: boolean | null
          accepted_at?: string | null
          accepted_version?: string | null
          messages_visit_count?: number
          notification_prompt_shown?: boolean
          is_deleted?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_expired_check_ins: { Args: never; Returns: undefined }
      create_group_with_members: {
        Args: {
          group_name: string
          member_ids: string[]
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
