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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          block_id: string
          created_at: string
          date: string
          doctor_id: string
          id: string
          is_weekend: boolean
          week_index: number
          weekday_name: string
        }
        Insert: {
          block_id: string
          created_at?: string
          date: string
          doctor_id: string
          id?: string
          is_weekend?: boolean
          week_index: number
          weekday_name: string
        }
        Update: {
          block_id?: string
          created_at?: string
          date?: string
          doctor_id?: string
          id?: string
          is_weekend?: boolean
          week_index?: number
          weekday_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          calendar_events: Json | null
          created_at: string
          created_by: string | null
          deadline: string | null
          end_sunday_date: string
          id: string
          published_at: string | null
          start_monday_date: string
          status: string
        }
        Insert: {
          calendar_events?: Json | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          end_sunday_date: string
          id?: string
          published_at?: string | null
          start_monday_date: string
          status?: string
        }
        Update: {
          calendar_events?: Json | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          end_sunday_date?: string
          id?: string
          published_at?: string | null
          start_monday_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_publishes: {
        Row: {
          block_id: string
          created_at: string
          date: string
          doctor_id: string
          event_hash: string | null
          google_calendar_id: string
          google_event_id: string
          id: string
        }
        Insert: {
          block_id: string
          created_at?: string
          date: string
          doctor_id: string
          event_hash?: string | null
          google_calendar_id: string
          google_event_id: string
          id?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          date?: string
          doctor_id?: string
          event_hash?: string | null
          google_calendar_id?: string
          google_event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_publishes_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_publishes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_assignments: {
        Row: {
          block_id: string
          date: string
          doctor_id: string
          updated_at: string
        }
        Insert: {
          block_id: string
          date: string
          doctor_id: string
          updated_at?: string
        }
        Update: {
          block_id?: string
          date?: string
          doctor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_assignments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "cs_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_assignments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "cs_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_blocks: {
        Row: {
          created_at: string
          deadline: string | null
          id: string
          published_at: string | null
          start_date: string
          status: string
          weeks: number
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          id?: string
          published_at?: string | null
          start_date: string
          status?: string
          weeks: number
        }
        Update: {
          created_at?: string
          deadline?: string | null
          id?: string
          published_at?: string | null
          start_date?: string
          status?: string
          weeks?: number
        }
        Relationships: []
      }
      cs_changes: {
        Row: {
          block_id: string
          created_at: string
          date: string
          from_doctor: string | null
          id: number
          to_doctor: string | null
        }
        Insert: {
          block_id: string
          created_at?: string
          date: string
          from_doctor?: string | null
          id?: never
          to_doctor?: string | null
        }
        Update: {
          block_id?: string
          created_at?: string
          date?: string
          from_doctor?: string | null
          id?: never
          to_doctor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_changes_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "cs_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_changes_from_doctor_fkey"
            columns: ["from_doctor"]
            isOneToOne: false
            referencedRelation: "cs_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_changes_to_doctor_fkey"
            columns: ["to_doctor"]
            isOneToOne: false
            referencedRelation: "cs_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_doctors: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          name: string
          sort: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          name: string
          sort?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          name?: string
          sort?: number
        }
        Relationships: []
      }
      cs_login_codes: {
        Row: {
          email: string
          id: number
          sent_at: string
        }
        Insert: {
          email: string
          id?: never
          sent_at?: string
        }
        Update: {
          email?: string
          id?: never
          sent_at?: string
        }
        Relationships: []
      }
      cs_requests: {
        Row: {
          block_id: string
          doctor_id: string
          notes: string
          submitted_at: string | null
          unavailable_dates: string[]
          updated_at: string
          weekend_ranks: number[]
        }
        Insert: {
          block_id: string
          doctor_id: string
          notes?: string
          submitted_at?: string | null
          unavailable_dates?: string[]
          updated_at?: string
          weekend_ranks?: number[]
        }
        Update: {
          block_id?: string
          doctor_id?: string
          notes?: string
          submitted_at?: string | null
          unavailable_dates?: string[]
          updated_at?: string
          weekend_ranks?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "cs_requests_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "cs_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "cs_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      cs_trades: {
        Row: {
          block_id: string
          calendar_status: string | null
          created_at: string
          decided_at: string | null
          give_dates: string[]
          id: string
          note: string
          partner_id: string
          proposer_id: string
          status: string
          take_dates: string[]
        }
        Insert: {
          block_id: string
          calendar_status?: string | null
          created_at?: string
          decided_at?: string | null
          give_dates: string[]
          id?: string
          note?: string
          partner_id: string
          proposer_id: string
          status?: string
          take_dates: string[]
        }
        Update: {
          block_id?: string
          calendar_status?: string | null
          created_at?: string
          decided_at?: string | null
          give_dates?: string[]
          id?: string
          note?: string
          partner_id?: string
          proposer_id?: string
          status?: string
          take_dates?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "cs_trades_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "cs_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_trades_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "cs_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_trades_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "cs_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_requests: {
        Row: {
          block_id: string
          created_at: string
          doctor_id: string
          id: string
          notes: string | null
          preferred_weekends: Json | null
          status: string
          submitted_at: string | null
          unavailable_dates: Json | null
          updated_at: string
        }
        Insert: {
          block_id: string
          created_at?: string
          doctor_id: string
          id?: string
          notes?: string | null
          preferred_weekends?: Json | null
          status?: string
          submitted_at?: string | null
          unavailable_dates?: Json | null
          updated_at?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
          notes?: string | null
          preferred_weekends?: Json | null
          status?: string
          submitted_at?: string | null
          unavailable_dates?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_requests_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          account_setup_completed: boolean | null
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string
          first_login_at: string | null
          google_email: string | null
          id: string
          is_admin: boolean
          mobile: string | null
          name: string
        }
        Insert: {
          account_setup_completed?: boolean | null
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email: string
          first_login_at?: string | null
          google_email?: string | null
          id?: string
          is_admin?: boolean
          mobile?: string | null
          name: string
        }
        Update: {
          account_setup_completed?: boolean | null
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          first_login_at?: string | null
          google_email?: string | null
          id?: string
          is_admin?: boolean
          mobile?: string | null
          name?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          body_preview: string | null
          id: string
          sent_at: string | null
          subject: string
          success: boolean
          to_email: string
          type: string
        }
        Insert: {
          body_preview?: string | null
          id?: string
          sent_at?: string | null
          subject: string
          success?: boolean
          to_email: string
          type: string
        }
        Update: {
          body_preview?: string | null
          id?: string
          sent_at?: string | null
          subject?: string
          success?: boolean
          to_email?: string
          type?: string
        }
        Relationships: []
      }
      google_credentials: {
        Row: {
          access_token: string | null
          doctor_id: string
          expires_at: string | null
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          doctor_id: string
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          doctor_id?: string
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_credentials_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: true
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      group_email_log: {
        Row: {
          created_at: string
          failed_count: number
          id: string
          recipient_count: number
          sent_by: string | null
          sent_count: number
          subject: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by?: string | null
          sent_count?: number
          subject: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by?: string | null
          sent_count?: number
          subject?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cs_apply_trade: { Args: { p_trade: string }; Returns: undefined }
      cs_calendar_feed: {
        Args: { p_token: string }
        Returns: {
          date: string
          doctor_id: string
          doctor_name: string
        }[]
      }
      cs_is_admin: { Args: never; Returns: boolean }
      cs_me: { Args: never; Returns: string }
      cs_replace_assignments: {
        Args: { p_block: string; p_rows: Json }
        Returns: undefined
      }
      get_block_request_summary: { Args: { p_block_id: string }; Returns: Json }
      link_my_doctor_account: { Args: never; Returns: undefined }
      replace_block_assignments: {
        Args: { p_block_id: string; p_rows: Json }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "doctor"
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
      app_role: ["admin", "doctor"],
    },
  },
} as const
