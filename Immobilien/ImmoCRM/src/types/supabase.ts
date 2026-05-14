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
      activity_log: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_followup"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_comments: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          text: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          text: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_comments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          email_normalized: string | null
          id: string
          kontakt_count: number
          lead_source: string | null
          letzter_kontakt: string | null
          name: string
          phone: string | null
          position: string | null
          status: Database["public"]["Enums"]["contact_status"]
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          email_normalized?: string | null
          id?: string
          kontakt_count?: number
          lead_source?: string | null
          letzter_kontakt?: string | null
          name: string
          phone?: string | null
          position?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          email_normalized?: string | null
          id?: string
          kontakt_count?: number
          lead_source?: string | null
          letzter_kontakt?: string | null
          name?: string
          phone?: string | null
          position?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string
        }
        Relationships: []
      }
      deal_notes: {
        Row: {
          content_html: string
          created_at: string
          deal_id: string
          id: string
          updated_at: string
        }
        Insert: {
          content_html: string
          created_at?: string
          deal_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          deal_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_followup"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          address: string | null
          angebot_datum: string | null
          besichtigung_datum: string | null
          city: string | null
          contact_id: string
          created_at: string
          deleted_at: string | null
          einheiten: number | null
          expose_local_path: string | null
          expose_source: string
          expose_url: string | null
          id: string
          inbox_message_id: string | null
          kalk_pro_m2: number | null
          kalk_verkaufspreis: number | null
          letzter_anruf: string | null
          mein_angebot: number | null
          notes_link: string | null
          object_type: string | null
          preis_kauf: number | null
          preis_pro_m2: number | null
          priority_reason: string | null
          priority_score: number | null
          status: Database["public"]["Enums"]["deal_status"]
          updated_at: string
          verwendung: string | null
          wohnflaeche_m2: number | null
          workspace_path: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          angebot_datum?: string | null
          besichtigung_datum?: string | null
          city?: string | null
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          einheiten?: number | null
          expose_local_path?: string | null
          expose_source?: string
          expose_url?: string | null
          id?: string
          inbox_message_id?: string | null
          kalk_pro_m2?: number | null
          kalk_verkaufspreis?: number | null
          letzter_anruf?: string | null
          mein_angebot?: number | null
          notes_link?: string | null
          object_type?: string | null
          preis_kauf?: number | null
          preis_pro_m2?: number | null
          priority_reason?: string | null
          priority_score?: number | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
          verwendung?: string | null
          wohnflaeche_m2?: number | null
          workspace_path?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          angebot_datum?: string | null
          besichtigung_datum?: string | null
          city?: string | null
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          einheiten?: number | null
          expose_local_path?: string | null
          expose_source?: string
          expose_url?: string | null
          id?: string
          inbox_message_id?: string | null
          kalk_pro_m2?: number | null
          kalk_verkaufspreis?: number | null
          letzter_anruf?: string | null
          mein_angebot?: number | null
          notes_link?: string | null
          object_type?: string | null
          preis_kauf?: number | null
          preis_pro_m2?: number | null
          priority_reason?: string | null
          priority_score?: number | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
          verwendung?: string | null
          wohnflaeche_m2?: number | null
          workspace_path?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      feiertage_nrw: {
        Row: {
          date: string
          name: string
        }
        Insert: {
          date: string
          name: string
        }
        Update: {
          date?: string
          name?: string
        }
        Relationships: []
      }
      mail_queue: {
        Row: {
          deal_id: string | null
          done_at: string | null
          enqueued_at: string
          error_msg: string | null
          graph_message_id: string | null
          message_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          deal_id?: string | null
          done_at?: string | null
          enqueued_at?: string
          error_msg?: string | null
          graph_message_id?: string | null
          message_id: string
          started_at?: string | null
          status: string
        }
        Update: {
          deal_id?: string | null
          done_at?: string | null
          enqueued_at?: string
          error_msg?: string | null
          graph_message_id?: string | null
          message_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_followup"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      deals_with_followup: {
        Row: {
          address: string | null
          angebot_datum: string | null
          besichtigung_datum: string | null
          city: string | null
          contact_id: string | null
          created_at: string | null
          deleted_at: string | null
          einheiten: number | null
          expose_local_path: string | null
          expose_url: string | null
          id: string | null
          kalk_pro_m2: number | null
          kalk_verkaufspreis: number | null
          last_activity: string | null
          letzter_anruf: string | null
          mein_angebot: number | null
          naechste_nachfass: string | null
          notes_link: string | null
          object_type: string | null
          preis_kauf: number | null
          preis_pro_m2: number | null
          status: Database["public"]["Enums"]["deal_status"] | null
          updated_at: string | null
          verwendung: string | null
          wohnflaeche_m2: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          angebot_datum?: string | null
          besichtigung_datum?: string | null
          city?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          einheiten?: number | null
          expose_local_path?: string | null
          expose_url?: string | null
          id?: string | null
          kalk_pro_m2?: number | null
          kalk_verkaufspreis?: number | null
          last_activity?: never
          letzter_anruf?: string | null
          mein_angebot?: number | null
          naechste_nachfass?: never
          notes_link?: string | null
          object_type?: string | null
          preis_kauf?: number | null
          preis_pro_m2?: number | null
          status?: Database["public"]["Enums"]["deal_status"] | null
          updated_at?: string | null
          verwendung?: string | null
          wohnflaeche_m2?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          angebot_datum?: string | null
          besichtigung_datum?: string | null
          city?: string | null
          contact_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          einheiten?: number | null
          expose_local_path?: string | null
          expose_url?: string | null
          id?: string | null
          kalk_pro_m2?: number | null
          kalk_verkaufspreis?: number | null
          last_activity?: never
          letzter_anruf?: string | null
          mein_angebot?: number | null
          naechste_nachfass?: never
          notes_link?: string | null
          object_type?: string | null
          preis_kauf?: number | null
          preis_pro_m2?: number | null
          status?: Database["public"]["Enums"]["deal_status"] | null
          updated_at?: string | null
          verwendung?: string | null
          wohnflaeche_m2?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      compute_followup: {
        Args: { angebot: string; last_activity: string; status: string }
        Returns: string
      }
      next_business_day: { Args: { d: string }; Returns: string }
    }
    Enums: {
      activity_type: "new_lead" | "anruf" | "besichtigung" | "angebot"
      contact_status: "kalt" | "warm" | "heiß" | "nr1"
      deal_status: "pre_screened" | "offen" | "berechnet" | "absage"
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
    Enums: {
      activity_type: ["new_lead", "anruf", "besichtigung", "angebot"],
      contact_status: ["kalt", "warm", "heiß", "nr1"],
      deal_status: ["pre_screened", "offen", "berechnet", "absage"],
    },
  },
} as const
