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
      activity_events: {
        Row: {
          country: string | null
          created_at: string
          event: string
          id: number
          ip: string | null
          ref_id: string | null
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          event: string
          id?: number
          ip?: string | null
          ref_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          event?: string
          id?: number
          ip?: string | null
          ref_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ad_events: {
        Row: {
          ad_id: string
          country: string | null
          created_at: string
          event: string
          id: number
          placement: string
          user_id: string | null
        }
        Insert: {
          ad_id: string
          country?: string | null
          created_at?: string
          event: string
          id?: number
          placement: string
          user_id?: string | null
        }
        Update: {
          ad_id?: string
          country?: string | null
          created_at?: string
          event?: string
          id?: number
          placement?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ad_settings: {
        Row: {
          discover_every: number
          id: boolean
          list_every: number
          updated_at: string
        }
        Insert: {
          discover_every?: number
          id?: boolean
          list_every?: number
          updated_at?: string
        }
        Update: {
          discover_every?: number
          id?: boolean
          list_every?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          changes: Json
          created_at: string
          id: number
          ip: string | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          changes?: Json
          created_at?: string
          id?: number
          ip?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          changes?: Json
          created_at?: string
          id?: number
          ip?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ads: {
        Row: {
          advertiser: string | null
          body: string | null
          created_at: string
          created_by: string | null
          cta_icon: string
          cta_label: string
          cta_url: string
          daily_cap: number
          ends_at: string | null
          id: string
          max_age: number | null
          media_path: string
          media_type: string
          min_age: number | null
          placements: string[]
          poster_path: string | null
          priority: number
          starts_at: string
          status: string
          target_countries: string[]
          target_gender: Database["public"]["Enums"]["gender"] | null
          title: string
          updated_at: string
        }
        Insert: {
          advertiser?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_icon?: string
          cta_label?: string
          cta_url: string
          daily_cap?: number
          ends_at?: string | null
          id?: string
          max_age?: number | null
          media_path: string
          media_type: string
          min_age?: number | null
          placements?: string[]
          poster_path?: string | null
          priority?: number
          starts_at?: string
          status?: string
          target_countries?: string[]
          target_gender?: Database["public"]["Enums"]["gender"] | null
          title: string
          updated_at?: string
        }
        Update: {
          advertiser?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_icon?: string
          cta_label?: string
          cta_url?: string
          daily_cap?: number
          ends_at?: string | null
          id?: string
          max_age?: number | null
          media_path?: string
          media_type?: string
          min_age?: number | null
          placements?: string[]
          poster_path?: string | null
          priority?: number
          starts_at?: string
          status?: string
          target_countries?: string[]
          target_gender?: Database["public"]["Enums"]["gender"] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      auth_events: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          event: string
          id: number
          ip: string | null
          method: string | null
          timezone: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          event: string
          id?: number
          ip?: string | null
          method?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          event?: string
          id?: number
          ip?: string | null
          method?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      contact_requests: {
        Row: {
          created_at: string
          id: string
          is_flash: boolean
          message: string | null
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_flash?: boolean
          message?: string | null
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_flash?: boolean
          message?: string | null
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      geo_timezones: {
        Row: {
          country_codes: string[]
          tz: string
        }
        Insert: {
          country_codes: string[]
          tz: string
        }
        Update: {
          country_codes?: string[]
          tz?: string
        }
        Relationships: []
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
      location_history: {
        Row: {
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          id: number
          inconsistency: string[]
          inconsistent: boolean
          ip_country: string | null
          retained_source: string
          source: string
          timezone: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: number
          inconsistency?: string[]
          inconsistent?: boolean
          ip_country?: string | null
          retained_source: string
          source: string
          timezone?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: number
          inconsistency?: string[]
          inconsistent?: boolean
          ip_country?: string | null
          retained_source?: string
          source?: string
          timezone?: string | null
          user_id?: string
        }
        Relationships: []
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
          audio_duration_seconds: number | null
          audio_path: string | null
          blocked_reason: string | null
          contains_phone_number: boolean
          content: string
          conversation_id: string
          created_at: string
          id: string
          kind: string
          moderation_flags: Json
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_path?: string | null
          blocked_reason?: string | null
          contains_phone_number?: boolean
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          kind?: string
          moderation_flags?: Json
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          sender_id: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_path?: string | null
          blocked_reason?: string | null
          contains_phone_number?: boolean
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
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
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount: number | null
          country: string | null
          created_at: string
          currency: string | null
          event: string
          id: number
          ip: string | null
          payment_id: string | null
          product: string | null
          provider: string | null
          provider_ref: string | null
          reason: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          event: string
          id?: number
          ip?: string | null
          payment_id?: string | null
          product?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          event?: string
          id?: number
          ip?: string | null
          payment_id?: string | null
          product?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      profile_boosts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_locations: {
        Row: {
          accuracy_m: number | null
          checked_at: string | null
          city: string | null
          country: string | null
          country_code: string | null
          inconsistency: string[]
          inconsistent: boolean
          ip_city: string | null
          ip_country: string | null
          language: string | null
          latitude: number
          longitude: number
          region: string | null
          source: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          checked_at?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          inconsistency?: string[]
          inconsistent?: boolean
          ip_city?: string | null
          ip_country?: string | null
          language?: string | null
          latitude: number
          longitude: number
          region?: string | null
          source?: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          checked_at?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          inconsistency?: string[]
          inconsistent?: boolean
          ip_city?: string | null
          ip_country?: string | null
          language?: string | null
          latitude?: number
          longitude?: number
          region?: string | null
          source?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_verifications: {
        Row: {
          created_at: string
          id: string
          method: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          method: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
          demo_photo_path: string | null
          demo_photo_source: string | null
          education_level: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          has_children: boolean | null
          interests: string[]
          is_virtual: boolean
          latitude: number | null
          longitude: number | null
          marital_status: string | null
          onboarding_completed_at: string | null
          onboarding_step: number
          origin: string | null
          personality: Json
          profession: string | null
          region: string | null
          status: Database["public"]["Enums"]["profile_status"]
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          visibility: Database["public"]["Enums"]["profile_visibility"]
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          children_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          demo_photo_path?: string | null
          demo_photo_source?: string | null
          education_level?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          has_children?: boolean | null
          interests?: string[]
          is_virtual?: boolean
          latitude?: number | null
          longitude?: number | null
          marital_status?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          origin?: string | null
          personality?: Json
          profession?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          children_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          demo_photo_path?: string | null
          demo_photo_source?: string | null
          education_level?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          has_children?: boolean | null
          interests?: string[]
          is_virtual?: boolean
          latitude?: number | null
          longitude?: number | null
          marital_status?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          origin?: string | null
          personality?: Json
          profession?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
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
      server_errors: {
        Row: {
          created_at: string
          details: Json
          id: number
          message: string
          path: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: number
          message: string
          path?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: number
          message?: string
          path?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      signup_events: {
        Row: {
          country: string | null
          created_at: string
          id: number
          method: string | null
          step: string
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: number
          method?: string | null
          step: string
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: number
          method?: string | null
          step?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_cleanup_queue: {
        Row: {
          bucket_id: string
          created_at: string
          done_at: string | null
          id: number
          path: string
          reason: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          done_at?: string | null
          id?: number
          path: string
          reason: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          done_at?: string | null
          id?: number
          path?: string
          reason?: string
        }
        Relationships: []
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
      support_tickets: {
        Row: {
          admin_reply: string | null
          answered_at: string | null
          created_at: string
          id: string
          message: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          answered_at?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          answered_at?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_settings: {
        Row: {
          activity_visible: boolean
          created_at: string
          marketing_emails: boolean
          notify_email: boolean
          notify_likes: boolean
          notify_matches: boolean
          notify_messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_visible?: boolean
          created_at?: string
          marketing_emails?: boolean
          notify_email?: boolean
          notify_likes?: boolean
          notify_matches?: boolean
          notify_messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_visible?: boolean
          created_at?: string
          marketing_emails?: boolean
          notify_email?: boolean
          notify_likes?: boolean
          notify_matches?: boolean
          notify_messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      activate_profile_boost: { Args: never; Returns: string }
      admin_ad_stats: {
        Args: { _ad_id: string | null; _bucket?: string; _from: string; _to: string; _tz?: string }
        Returns: Json
      }
      admin_dashboard: {
        Args: { _bucket?: string; _from: string; _to: string; _tz?: string }
        Returns: Json
      }
      admin_list_demo_profiles: {
        Args: never
        Returns: {
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          demo_photo_path: string | null
          demo_photo_source: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          user_id: string
        }[]
      }
      admin_list_payments: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          currency: string
          email: string | null
          id: string
          provider: string
          provider_transaction_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          user_id: string
        }[]
      }
      admin_list_pending_photos: {
        Args: never
        Returns: {
          created_at: string
          first_name: string | null
          id: string
          storage_path: string
          user_id: string
        }[]
      }
      admin_list_pending_verifications: {
        Args: never
        Returns: {
          created_at: string
          first_name: string | null
          id: string
          method: string
          storage_path: string
          user_id: string
        }[]
      }
      admin_list_reports: {
        Args: { _status?: string }
        Returns: {
          created_at: string
          description: string | null
          id: string
          message_content: string | null
          message_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reported_name: string | null
          reported_status: Database["public"]["Enums"]["account_status"] | null
          reported_user_id: string
          reporter_id: string
          reporter_name: string | null
          status: Database["public"]["Enums"]["report_status"]
        }[]
      }
      admin_list_subscriptions: {
        Args: never
        Returns: {
          active_now: boolean
          email: string | null
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          starts_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }[]
      }
      admin_list_support_tickets: {
        Args: never
        Returns: {
          admin_reply: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          message: string
          priority: string
          status: string
          subject: string
          user_id: string
        }[]
      }
      admin_list_unlocks: {
        Args: never
        Returns: {
          active_now: boolean
          conversation_id: string
          email: string | null
          expires_at: string | null
          id: string
          paid_by: string
          starts_at: string | null
          status: Database["public"]["Enums"]["unlock_status"]
        }[]
      }
      admin_list_users: {
        Args: { _limit?: number; _offset?: number; _search?: string; _status?: string }
        Returns: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_admin: boolean
          premium: boolean
          profile_status: Database["public"]["Enums"]["profile_status"] | null
          reports_count: number
          status: Database["public"]["Enums"]["account_status"]
        }[]
      }
      admin_location_flags: {
        Args: { _limit?: number }
        Returns: {
          checked_at: string | null
          city: string | null
          country: string | null
          declared_city: string | null
          declared_country: string | null
          email: string | null
          first_name: string | null
          inconsistency: string[]
          ip_city: string | null
          ip_country: string | null
          language: string | null
          region: string | null
          source: string
          timezone: string | null
          user_id: string
        }[]
      }
      admin_log_action: {
        Args: { _action: string; _details?: Json; _target_id: string; _target_table: string }
        Returns: undefined
      }
      admin_members: {
        Args: {
          _desc?: boolean
          _kind?: string
          _limit?: number
          _offset?: number
          _search?: string
          _sort?: string
          _status?: string
        }
        Returns: {
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          is_virtual: boolean
          last_login_at: string | null
          login_count: number
          premium: boolean
          reports_received: number
          status: Database["public"]["Enums"]["account_status"]
          total_count: number
          user_id: string
          verified: boolean
        }[]
      }
      admin_moderate_photo: {
        Args: { _approve: boolean; _photo_id: string; _reason?: string }
        Returns: Database["public"]["Enums"]["photo_status"]
      }
      admin_period_kpis: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      admin_reply_support_ticket: {
        Args: { _close?: boolean; _reply: string; _ticket_id: string }
        Returns: undefined
      }
      admin_resolve_report: {
        Args: { _note?: string; _report_id: string; _status: string }
        Returns: undefined
      }
      admin_review_verification: {
        Args: { _approve: boolean; _verification_id: string }
        Returns: string
      }
      admin_set_demo_photo: {
        Args: { _path: string | null; _source?: string; _user_id: string }
        Returns: string
      }
      admin_set_user_status: {
        Args: { _action: string; _reason?: string; _user_id: string }
        Returns: Database["public"]["Enums"]["account_status"]
      }
      admin_stats: { Args: never; Returns: Json }
      admin_user_detail: { Args: { _user_id: string }; Returns: Json }
      admin_user_history: {
        Args: { _user_id: string }
        Returns: Json
      }
      admin_user_location: {
        Args: { _user_id: string }
        Returns: Json
      }
      ai_usage_day: { Args: never; Returns: string }
      assert_admin: { Args: never; Returns: undefined }
      block_user: { Args: { _user_id: string }; Returns: boolean }
      can_browse_profiles: { Args: never; Returns: boolean }
      can_view_profile: { Args: { _other: string }; Returns: boolean }
      cancel_contact_request: { Args: { _request_id: string }; Returns: Json }
      confirm_payment: {
        Args: {
          _amount: number
          _currency: string
          _payment_id: string
          _provider: string
          _provider_transaction_id: string
        }
        Returns: Database["public"]["Enums"]["payment_status"]
      }
      consume_ai_quota: { Args: { _feature?: string }; Returns: Json }
      consume_free_message: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      clear_my_location: { Args: never; Returns: undefined }
      contains_phone_number: { Args: { _text: string }; Returns: boolean }
      create_support_ticket: {
        Args: { _message: string; _subject: string }
        Returns: string
      }
      discover_profiles: {
        Args: { _limit?: number }
        Returns: {
          bio: string | null
          birth_date: string | null
          city: string | null
          country: string | null
          demo_photo_path: string | null
          distance_km: number | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"]
          interests: string[]
          is_verified: boolean
          is_virtual: boolean
          photo_path: string | null
          region: string | null
          relationship_goal: string | null
          user_id: string
        }[]
      }
      distance_km: {
        Args: { _lat1: number; _lat2: number; _lng1: number; _lng2: number }
        Returns: number
      }
      expire_subscriptions: { Args: never; Returns: number }
      get_ads_for_me: {
        Args: { _limit?: number; _placement?: string }
        Returns: {
          advertiser: string | null
          body: string | null
          cta_icon: string
          cta_label: string
          cta_url: string
          every_n: number
          id: string
          media_path: string
          media_type: string
          poster_path: string | null
          title: string
        }[]
      }
      get_ai_quota: { Args: { _feature?: string }; Returns: Json }
      get_compatibility: { Args: { _other: string }; Returns: Json }
      get_compatibility_scores: {
        Args: { _user_ids: string[] }
        Returns: {
          score: number | null
          user_id: string
        }[]
      }
      get_contact_request_quota: { Args: never; Returns: Json }
      get_conversation_quota: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      get_favorited_by: {
        Args: never
        Returns: {
          birth_date: string | null
          city: string | null
          country: string | null
          favorited_at: string
          first_name: string | null
          user_id: string
        }[]
      }
      get_my_boost: { Args: never; Returns: Json }
      get_my_premium: { Args: never; Returns: Json }
      get_premium_badges: { Args: { _user_ids: string[] }; Returns: string[] }
      get_presence: { Args: { _user_id: string }; Returns: string }
      get_profile_visitors: {
        Args: never
        Returns: {
          birth_date: string | null
          city: string | null
          country: string | null
          first_name: string | null
          visit_count: number
          visited_at: string
          visitor_id: string
        }[]
      }
      get_unread_notification_count: { Args: never; Returns: number }
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
      is_activity_visible: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      is_boosted: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      get_message_quota: {
        Args: { _conversation_id: string }
        Returns: {
          exhausted: boolean
          last_unlock_expired_at: string | null
          premium: boolean
          quota_limit: number
          remaining: number
          unlock_expires_at: string | null
          unlocked: boolean
          unlocked_by: string | null
          used: number
        }[]
      }
      get_unread_counts: {
        Args: never
        Returns: {
          conversation_id: string
          unread: number
        }[]
      }
      has_mutual_like: { Args: { _other: string }; Returns: boolean }
      is_discoverable_profile: { Args: { _user_id: string }; Returns: boolean }
      is_premium: { Args: { _user_id: string }; Returns: boolean }
      is_real_member: {
        Args: { _user_id: string }
        Returns: boolean
      }
      list_blocked_users: {
        Args: never
        Returns: {
          blocked_at: string
          first_name: string | null
          user_id: string
        }[]
      }
      list_contact_requests: {
        Args: { _direction?: string }
        Returns: {
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          first_name: string | null
          id: string
          is_flash: boolean
          message: string | null
          other_user_id: string
          responded_at: string | null
          status: string
        }[]
      }
      list_notifications: {
        Args: { _limit?: number }
        Returns: {
          actor_first_name: string | null
          actor_id: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          type: string
        }[]
      }
      location_priority: {
        Args: { _source: string }
        Returns: number
      }
      log_server_error: {
        Args: { _details?: Json; _message: string; _path?: string; _source: string; _user_id?: string }
        Returns: undefined
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: { Args: { _id: string }; Returns: boolean }
      mark_offline: { Args: never; Returns: undefined }
      list_search_cities: {
        Args: { _country?: string }
        Returns: {
          city: string
          profiles: number
        }[]
      }
      list_search_countries: {
        Args: never
        Returns: {
          country: string
          profiles: number
        }[]
      }
      list_search_values: {
        Args: { _field: string }
        Returns: {
          profiles: number
          value: string
        }[]
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: string
      }
      normalize_place: { Args: { _value: string }; Returns: string }
      premium_plan_amount: {
        Args: { _plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      purge_old_logs: {
        Args: never
        Returns: number
      }
      recent_signups: {
        Args: never
        Returns: {
          country: string
          created_at: string
          first_name: string
        }[]
      }
      record_ad_event: {
        Args: { _ad_id: string; _event: string; _placement?: string }
        Returns: boolean
      }
      record_login_failure: {
        Args: { _email: string; _method?: string }
        Returns: undefined
      }
      record_logout: {
        Args: never
        Returns: undefined
      }
      record_payment_webhook: {
        Args: { _event_type: string; _payment_id?: string; _provider_ref?: string; _reason?: string }
        Returns: undefined
      }
      record_profile_visit: {
        Args: { _visited_user_id: string }
        Returns: boolean
      }
      record_session_context: {
        Args: { _timezone?: string }
        Returns: undefined
      }
      record_signup_step: {
        Args: { _step: number }
        Returns: undefined
      }
      refund_ai_quota: {
        Args: { _feature: string; _user_id: string }
        Returns: undefined
      }
      report_user: {
        Args: { 
          _description?: string
          _message_id?: string
          _reason: Database["public"]["Enums"]["report_reason"]
          _user_id: string
         }
        Returns: string
      }
      respond_contact_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: Json
      }
      search_profiles: {
        Args: { _filters?: Json; _limit?: number }
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
      send_contact_request: {
        Args: { _flash?: boolean; _message?: string; _receiver_id: string }
        Returns: Json
      }
      send_message: {
        Args: { _content: string; _conversation_id: string }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
        }[]
      }
      send_voice_message: {
        Args: {
          _audio_path: string
          _conversation_id: string
          _duration_seconds: number
        }
        Returns: string
      }
      set_member_location: {
        Args: {
          _accuracy_m?: number
          _city?: string
          _country_code?: string
          _ip_city?: string
          _ip_country?: string
          _language?: string
          _latitude?: number
          _longitude?: number
          _region?: string
          _source: string
          _timezone?: string
          _user_id: string
        }
        Returns: Json
      }
      set_primary_photo: { Args: { _photo_id: string }; Returns: undefined }
      start_conversation_unlock_payment: {
        Args: { _conversation_id: string; _provider: string }
        Returns: string
      }
      set_my_location: {
        Args: { _latitude: number; _longitude: number }
        Returns: undefined
      }
      start_premium_payment: {
        Args: {
          _plan: Database["public"]["Enums"]["subscription_plan"]
          _provider: string
        }
        Returns: string
      }
      touch_activity: { Args: never; Returns: boolean }
      unblock_user: { Args: { _user_id: string }; Returns: boolean }
      undo_last_pass: {
        Args: never
        Returns: string
      }
      utc_day_start: { Args: never; Returns: string }
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
