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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string
          feature: string
          id: string
          updated_at: string
          usage_count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature?: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      christian_profiles: {
        Row: {
          christian_values: string[]
          church_attendance: string | null
          couple_vision: string | null
          created_at: string
          denomination: string | null
          extra: Json
          faith_commitment: string | null
          faith_importance: string | null
          marriage_vision: string | null
          prayer_practice: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          christian_values?: string[]
          church_attendance?: string | null
          couple_vision?: string | null
          created_at?: string
          denomination?: string | null
          extra?: Json
          faith_commitment?: string | null
          faith_importance?: string | null
          marriage_vision?: string | null
          prayer_practice?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          christian_values?: string[]
          church_attendance?: string | null
          couple_vision?: string | null
          created_at?: string
          denomination?: string | null
          extra?: Json
          faith_commitment?: string | null
          faith_importance?: string | null
          marriage_vision?: string | null
          prayer_practice?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "christian_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_unlocks: {
        Row: {
          amount: number
          conversation_id: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          paid_by_user_id: string
          payment_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["unlock_status"]
        }
        Insert: {
          amount?: number
          conversation_id: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          paid_by_user_id: string
          payment_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["unlock_status"]
        }
        Update: {
          amount?: number
          conversation_id?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          paid_by_user_id?: string
          payment_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["unlock_status"]
        }
        Relationships: [
          {
            foreignKeyName: "conversation_unlocks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_unlocks_paid_by_user_id_fkey"
            columns: ["paid_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_unlocks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_user_usage: {
        Row: {
          conversation_id: string
          created_at: string
          free_messages_used: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          free_messages_used?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          free_messages_used?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_user_usage_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_user_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          free_messages_used: number
          id: string
          last_message_at: string | null
          match_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
          user_1_id: string
          user_2_id: string
        }
        Insert: {
          created_at?: string
          free_messages_used?: number
          id?: string
          last_message_at?: string | null
          match_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
          user_1_id: string
          user_2_id: string
        }
        Update: {
          created_at?: string
          free_messages_used?: number
          id?: string
          last_message_at?: string | null
          match_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
          user_1_id?: string
          user_2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_1_id_fkey"
            columns: ["user_1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_2_id_fkey"
            columns: ["user_2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          favorite_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_favorite_user_id_fkey"
            columns: ["favorite_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["like_kind"]
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["like_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["like_kind"]
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["like_status"]
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["like_kind"]
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["like_status"]
        }
        Relationships: [
          {
            foreignKeyName: "likes_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["match_status"]
          user_1_id: string
          user_2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["match_status"]
          user_1_id: string
          user_2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["match_status"]
          user_1_id?: string
          user_2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_user_1_id_fkey"
            columns: ["user_1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_2_id_fkey"
            columns: ["user_2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          blocked_reason: string | null
          contains_phone_number: boolean
          content: string
          conversation_id: string
          created_at: string
          id: string
          moderation_flags: Json
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          blocked_reason?: string | null
          contains_phone_number?: boolean
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          moderation_flags?: Json
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          sender_id: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          blocked_reason?: string | null
          contains_phone_number?: boolean
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          moderation_flags?: Json
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          sender_id?: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action_type"]
          admin_id: string
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action_type"]
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action_type"]
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          provider: string
          provider_transaction_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          provider: string
          provider_transaction_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          provider?: string
          provider_transaction_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          position: number
          status: Database["public"]["Enums"]["photo_status"]
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          christian_criteria: Json
          city: string | null
          country: string | null
          created_at: string
          extra: Json
          family_project: string | null
          max_age: number
          max_distance_km: number | null
          min_age: number
          preferred_gender: Database["public"]["Enums"]["gender"] | null
          relationship_goal: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          christian_criteria?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          extra?: Json
          family_project?: string | null
          max_age?: number
          max_distance_km?: number | null
          min_age?: number
          preferred_gender?: Database["public"]["Enums"]["gender"] | null
          relationship_goal?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          christian_criteria?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          extra?: Json
          family_project?: string | null
          max_age?: number
          max_distance_km?: number | null
          min_age?: number
          preferred_gender?: Database["public"]["Enums"]["gender"] | null
          relationship_goal?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_visits: {
        Row: {
          id: string
          visited_at: string
          visited_user_id: string
          visitor_id: string
        }
        Insert: {
          id?: string
          visited_at?: string
          visited_user_id: string
          visitor_id: string
        }
        Update: {
          id?: string
          visited_at?: string
          visited_user_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_visits_visited_user_id_fkey"
            columns: ["visited_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          birth_date: string | null
          children_count: number | null
          city: string | null
          country: string | null
          created_at: string
          education_level: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          has_children: boolean | null
          interests: string[]
          latitude: number | null
          longitude: number | null
          marital_status: string | null
          onboarding_completed_at: string | null
          onboarding_step: number
          personality: Json
          profession: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["profile_visibility"]
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          children_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          education_level?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          has_children?: boolean | null
          interests?: string[]
          latitude?: number | null
          longitude?: number | null
          marital_status?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          personality?: Json
          profession?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          children_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          education_level?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          has_children?: boolean | null
          interests?: string[]
          latitude?: number | null
          longitude?: number | null
          marital_status?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          personality?: Json
          profession?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          description: string | null
          id: string
          message_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          message_id?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          message_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          payment_id: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          starts_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          events: Json
          is_online: boolean
          last_login_at: string | null
          last_seen_at: string | null
          login_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          events?: Json
          is_online?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          events?: Json
          is_online?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          login_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          last_active_at: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          last_active_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_active_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_browse_profiles: { Args: never; Returns: boolean }
      consume_ai_quota: { Args: { _feature?: string }; Returns: Json }
      consume_free_message: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      discover_profiles: {
        Args: { _limit?: number }
        Returns: {
          bio: string | null
          birth_date: string | null
          city: string | null
          country: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          interests: string[]
          user_id: string
        }[]
      }
      get_ai_quota: { Args: { _feature?: string }; Returns: Json }
      get_conversation_quota: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      get_favorited_by: {
        Args: never
        Returns: {
          created_at: string
          user_id: string
        }[]
      }
      get_presence: { Args: { _user_id: string }; Returns: string }
      get_profile_visitors: {
        Args: never
        Returns: {
          visited_at: string
          visitor_id: string
        }[]
      }
      has_active_conversation_unlock: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_account: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      has_mutual_like: { Args: { _other: string }; Returns: boolean }
      is_discoverable_profile: { Args: { _user_id: string }; Returns: boolean }
      is_premium: { Args: { _user_id: string }; Returns: boolean }
      record_profile_visit: {
        Args: { _visited_user_id: string }
        Returns: undefined
      }
      set_primary_photo: { Args: { _photo_id: string }; Returns: undefined }
      touch_activity: { Args: never; Returns: undefined }
    }
    Enums: {
      account_status: "active" | "suspended" | "disabled" | "deleted"
      app_role: "user" | "admin"
      conversation_status: "open" | "locked" | "closed"
      gender: "male" | "female"
      like_kind: "like" | "pass"
      like_status: "active" | "withdrawn"
      match_status: "active" | "unmatched" | "blocked"
      message_status: "delivered" | "blocked" | "deleted"
      moderation_action_type:
        | "warn"
        | "suspend"
        | "unsuspend"
        | "disable"
        | "delete_photo"
        | "hide_profile"
        | "note"
      moderation_status: "clean" | "flagged" | "rejected"
      payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
      payment_type: "conversation_unlock" | "subscription"
      photo_status: "pending" | "approved" | "rejected"
      profile_status: "incomplete" | "active" | "hidden" | "suspended"
      profile_visibility: "visible" | "hidden"
      report_reason:
        | "fake_profile"
        | "harassment"
        | "inappropriate_content"
        | "scam"
        | "suspicious_behavior"
        | "other"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      subscription_plan: "premium_monthly" | "premium_yearly"
      subscription_status: "pending" | "active" | "expired" | "cancelled"
      unlock_status: "pending" | "active" | "expired" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "disabled", "deleted"],
      app_role: ["user", "admin"],
      conversation_status: ["open", "locked", "closed"],
      gender: ["male", "female"],
      like_kind: ["like", "pass"],
      like_status: ["active", "withdrawn"],
      match_status: ["active", "unmatched", "blocked"],
      message_status: ["delivered", "blocked", "deleted"],
      moderation_action_type: [
        "warn",
        "suspend",
        "unsuspend",
        "disable",
        "delete_photo",
        "hide_profile",
        "note",
      ],
      moderation_status: ["clean", "flagged", "rejected"],
      payment_status: [
        "pending",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
      ],
      payment_type: ["conversation_unlock", "subscription"],
      photo_status: ["pending", "approved", "rejected"],
      profile_status: ["incomplete", "active", "hidden", "suspended"],
      profile_visibility: ["visible", "hidden"],
      report_reason: [
        "fake_profile",
        "harassment",
        "inappropriate_content",
        "scam",
        "suspicious_behavior",
        "other",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      subscription_plan: ["premium_monthly", "premium_yearly"],
      subscription_status: ["pending", "active", "expired", "cancelled"],
      unlock_status: ["pending", "active", "expired", "cancelled"],
    },
  },
} as const
