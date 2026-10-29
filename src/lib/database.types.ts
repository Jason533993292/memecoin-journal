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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      coin_research: {
        Row: {
          ca: string
          created_at: string
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          ca: string
          created_at?: string
          data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          ca?: string
          created_at?: string
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_journal_entries: {
        Row: {
          confidence_level: number | null
          content_html: string
          created_at: string
          details: Json
          emotion_intensity: number | null
          emotions: string[]
          energy_level: number | null
          entry_date: string
          entry_type: string
          id: string
          linked_trade_ids: string[]
          plain_text: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_level?: number | null
          content_html?: string
          created_at?: string
          details?: Json
          emotion_intensity?: number | null
          emotions?: string[]
          energy_level?: number | null
          entry_date: string
          entry_type: string
          id: string
          linked_trade_ids?: string[]
          plain_text?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_level?: number | null
          content_html?: string
          created_at?: string
          details?: Json
          emotion_intensity?: number | null
          emotions?: string[]
          energy_level?: number | null
          entry_date?: string
          entry_type?: string
          id?: string
          linked_trade_ids?: string[]
          plain_text?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_admin_audit: {
        Row: {
          action: string
          actor_email: string
          actor_uid: string
          created_at: string
          feedback_id: number
          id: number
          new_status: string
          note: string | null
          previous_status: string
        }
        Insert: {
          action: string
          actor_email: string
          actor_uid: string
          created_at?: string
          feedback_id: number
          id?: never
          new_status: string
          note?: string | null
          previous_status: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_uid?: string
          created_at?: string
          feedback_id?: number
          id?: never
          new_status?: string
          note?: string | null
          previous_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_admin_audit_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "user_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      revoked_journal_users: {
        Row: {
          revoked_at: string
          user_id: string
        }
        Insert: {
          revoked_at?: string
          user_id: string
        }
        Update: {
          revoked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          bought_sol: number
          bought_usd: number | null
          ca: string
          created_at: string | null
          date: string
          dex: string | null
          duration_minutes: number | null
          entry_liquidity_usd: number | null
          entry_market_cap_usd: number | null
          entry_time: string | null
          entry_timezone_offset: number | null
          execution_type: string | null
          exit_liquidity_usd: number | null
          exit_market_cap_usd: number | null
          exit_time: string | null
          extra: Json
          fees_sol: number | null
          good_tags: Json
          id: string
          initial_risk_sol: number | null
          is_paper: boolean | null
          liquidity: number | null
          mcap: number | null
          mistakes: Json
          name: string
          notes: string | null
          pnl_sol: number
          pnl_usd: number
          price: number | null
          result: string
          screenshot_url: string | null
          setup_type: string
          slippage_pct: number | null
          sol_usd_rate: number | null
          sol_usd_rate_source: string | null
          sold_sol: number | null
          sold_usd: number | null
          stop_price: number | null
          symbol: string
          trade_mode: string | null
          trade_quality_score: number | null
          traded_at: string | null
          user_id: string
          wallet: string
          would_take_again: boolean | null
        }
        Insert: {
          bought_sol?: number
          bought_usd?: number | null
          ca?: string
          created_at?: string | null
          date: string
          dex?: string | null
          duration_minutes?: number | null
          entry_liquidity_usd?: number | null
          entry_market_cap_usd?: number | null
          entry_time?: string | null
          entry_timezone_offset?: number | null
          execution_type?: string | null
          exit_liquidity_usd?: number | null
          exit_market_cap_usd?: number | null
          exit_time?: string | null
          extra?: Json
          fees_sol?: number | null
          good_tags?: Json
          id: string
          initial_risk_sol?: number | null
          is_paper?: boolean | null
          liquidity?: number | null
          mcap?: number | null
          mistakes?: Json
          name: string
          notes?: string | null
          pnl_sol?: number
          pnl_usd?: number
          price?: number | null
          result: string
          screenshot_url?: string | null
          setup_type: string
          slippage_pct?: number | null
          sol_usd_rate?: number | null
          sol_usd_rate_source?: string | null
          sold_sol?: number | null
          sold_usd?: number | null
          stop_price?: number | null
          symbol: string
          trade_mode?: string | null
          trade_quality_score?: number | null
          traded_at?: string | null
          user_id: string
          wallet: string
          would_take_again?: boolean | null
        }
        Update: {
          bought_sol?: number
          bought_usd?: number | null
          ca?: string
          created_at?: string | null
          date?: string
          dex?: string | null
          duration_minutes?: number | null
          entry_liquidity_usd?: number | null
          entry_market_cap_usd?: number | null
          entry_time?: string | null
          entry_timezone_offset?: number | null
          execution_type?: string | null
          exit_liquidity_usd?: number | null
          exit_market_cap_usd?: number | null
          exit_time?: string | null
          extra?: Json
          fees_sol?: number | null
          good_tags?: Json
          id?: string
          initial_risk_sol?: number | null
          is_paper?: boolean | null
          liquidity?: number | null
          mcap?: number | null
          mistakes?: Json
          name?: string
          notes?: string | null
          pnl_sol?: number
          pnl_usd?: number
          price?: number | null
          result?: string
          screenshot_url?: string | null
          setup_type?: string
          slippage_pct?: number | null
          sol_usd_rate?: number | null
          sol_usd_rate_source?: string | null
          sold_sol?: number | null
          sold_usd?: number | null
          stop_price?: number | null
          symbol?: string
          trade_mode?: string | null
          trade_quality_score?: number | null
          traded_at?: string | null
          user_id?: string
          wallet?: string
          would_take_again?: boolean | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          assigned_to: string | null
          browser: string
          category: string
          contact_email: string | null
          created_at: string
          device: string
          email_delivered_at: string | null
          email_delivery_attempts: number
          email_delivery_error: string | null
          email_delivery_status: string
          id: number
          idempotency_key: string
          message: string
          page: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
          theme: string
          updated_at: string
          user_id: string
          viewport: string
        }
        Insert: {
          assigned_to?: string | null
          browser?: string
          category: string
          contact_email?: string | null
          created_at?: string
          device?: string
          email_delivered_at?: string | null
          email_delivery_attempts?: number
          email_delivery_error?: string | null
          email_delivery_status?: string
          id?: never
          idempotency_key: string
          message: string
          page?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          theme?: string
          updated_at?: string
          user_id: string
          viewport?: string
        }
        Update: {
          assigned_to?: string | null
          browser?: string
          category?: string
          contact_email?: string | null
          created_at?: string
          device?: string
          email_delivered_at?: string | null
          email_delivery_attempts?: number
          email_delivery_error?: string | null
          email_delivery_status?: string
          id?: never
          idempotency_key?: string
          message?: string
          page?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          theme?: string
          updated_at?: string
          user_id?: string
          viewport?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          data: Json
          setting_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          data: Json
          setting_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          setting_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_sol: number
          amount_usd: number | null
          created_at: string
          date: string
          extra: Json
          id: string
          notes: string | null
          type: string
          user_id: string
          wallet_id: string
          wallet_name: string
        }
        Insert: {
          amount_sol: number
          amount_usd?: number | null
          created_at: string
          date: string
          extra?: Json
          id: string
          notes?: string | null
          type: string
          user_id: string
          wallet_id: string
          wallet_name: string
        }
        Update: {
          amount_sol?: number
          amount_usd?: number | null
          created_at?: string
          date?: string
          extra?: Json
          id?: string
          notes?: string | null
          type?: string
          user_id?: string
          wallet_id?: string
          wallet_name?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          address: string
          balance_sol: number
          extra: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          balance_sol?: number
          extra?: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Update: {
          address?: string
          balance_sol?: number
          extra?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_wallet_transaction: {
        Args: {
          p_amount_usd: number
          p_created_at: string
          p_date: string
          p_delta_sol: number
          p_notes: string
          p_transaction_id: string
          p_user_id: string
          p_wallet_id: string
          p_wallet_name: string
        }
        Returns: undefined
      }
      is_bounded_text_array: {
        Args: { input_value: Json; max_item_length: number; max_items: number }
        Returns: boolean
      }
      is_trusted_journal_jwt: { Args: never; Returns: boolean }
      patch_user_preferences: {
        Args: { p_patch: Json; p_user_id: string }
        Returns: undefined
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
    Enums: {},
  },
} as const

