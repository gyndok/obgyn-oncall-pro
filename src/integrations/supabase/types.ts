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
          created_at: string
          created_by: string | null
          deadline: string | null
          end_sunday_date: string
          id: string
          start_monday_date: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          end_sunday_date: string
          id?: string
          start_monday_date: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          end_sunday_date?: string
          id?: string
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
          active: boolean
          created_at: string
          email: string
          id: string
          is_admin: boolean
          mobile: string | null
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean
          mobile?: string | null
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
