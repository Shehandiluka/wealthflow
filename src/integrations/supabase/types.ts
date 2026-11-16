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
      accounts: {
        Row: {
          balance: number
          color: string
          created_at: string
          currency: string
          icon: string
          id: string
          name: string
          transfer_charge: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          color?: string
          created_at?: string
          currency?: string
          icon?: string
          id?: string
          name: string
          transfer_charge?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          color?: string
          created_at?: string
          currency?: string
          icon?: string
          id?: string
          name?: string
          transfer_charge?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          currency: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          kind: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          kind?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          due_date: number
          emi_amount: number
          id: string
          interest_kind: string | null
          interest_paid: number
          interest_period: string | null
          interest_value: number | null
          is_hidden: boolean
          name: string
          remaining_amount: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: number
          emi_amount?: number
          id?: string
          interest_kind?: string | null
          interest_paid?: number
          interest_period?: string | null
          interest_value?: number | null
          is_hidden?: boolean
          name: string
          remaining_amount: number
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: number
          emi_amount?: number
          id?: string
          interest_kind?: string | null
          interest_paid?: number
          interest_period?: string | null
          interest_value?: number | null
          is_hidden?: boolean
          name?: string
          remaining_amount?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      draft_reminder_settings: {
        Row: {
          auto_post: boolean
          created_at: string
          cutoff_dow: number
          cutoff_time: string
          enabled: boolean
          id: string
          last_run_at: string | null
          reminder_lead_hours: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_post?: boolean
          created_at?: string
          cutoff_dow?: number
          cutoff_time?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          reminder_lead_hours?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_post?: boolean
          created_at?: string
          cutoff_dow?: number
          cutoff_time?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          reminder_lead_hours?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          id: string
          rates: Json
          updated_at: string
        }
        Insert: {
          base_currency?: string
          id?: string
          rates?: Json
          updated_at?: string
        }
        Update: {
          base_currency?: string
          id?: string
          rates?: Json
          updated_at?: string
        }
        Relationships: []
      }
      investment_contributions: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          id: string
          investment_id: string
          note: string
          user_id: string
          value_change: number
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          id?: string
          investment_id: string
          note?: string
          user_id: string
          value_change?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          id?: string
          investment_id?: string
          note?: string
          user_id?: string
          value_change?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_contributions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_types: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          created_at: string
          currency: string
          id: string
          invested: number
          name: string
          type: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          invested?: number
          name: string
          type: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          invested?: number
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      lending_contacts: {
        Row: {
          created_at: string
          id: string
          notes: string
          person_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          person_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          person_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lending_transactions: {
        Row: {
          account_id: string | null
          amount: number
          base_amount: number | null
          contact_id: string
          created_at: string
          currency: string
          date: string
          description: string
          exchange_rate: number | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          base_amount?: number | null
          contact_id: string
          created_at?: string
          currency?: string
          date?: string
          description?: string
          exchange_rate?: number | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          base_amount?: number | null
          contact_id?: string
          created_at?: string
          currency?: string
          date?: string
          description?: string
          exchange_rate?: number | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lending_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lending_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_later: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string
          due_date: string | null
          id: string
          is_paid: boolean
          paid_at: string | null
          person_or_store: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string
          due_date?: string | null
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          person_or_store: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string
          due_date?: string | null
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          person_or_store?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pay_later_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          pay_later_id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          pay_later_id: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          pay_later_id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_later_items_pay_later_id_fkey"
            columns: ["pay_later_id"]
            isOneToOne: false
            referencedRelation: "pay_later"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_later_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string
          paid_at: string
          pay_later_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string
          paid_at?: string
          pay_later_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string
          paid_at?: string
          pay_later_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_later_payments_pay_later_id_fkey"
            columns: ["pay_later_id"]
            isOneToOne: false
            referencedRelation: "pay_later"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          has_seen_onboarding: boolean
          id: string
          pin_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          has_seen_onboarding?: boolean
          id?: string
          pin_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          has_seen_onboarding?: boolean
          id?: string
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          currency: string
          debt_id: string | null
          description: string
          frequency: string
          id: string
          is_active: boolean
          next_due: string
          to_account_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          category: string
          created_at?: string
          currency?: string
          debt_id?: string | null
          description?: string
          frequency?: string
          id?: string
          is_active?: boolean
          next_due?: string
          to_account_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          debt_id?: string | null
          description?: string
          frequency?: string
          id?: string
          is_active?: boolean
          next_due?: string
          to_account_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goal_contributions: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          goal_id: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          date?: string
          goal_id: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          category: string
          created_at: string
          currency: string
          current_amount: number
          id: string
          is_archived: boolean
          is_pinned: boolean
          linked_account_id: string | null
          name: string
          notes: string | null
          start_date: string
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string
          current_amount?: number
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          linked_account_id?: string | null
          name: string
          notes?: string | null
          start_date?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          current_amount?: number
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          linked_account_id?: string | null
          name?: string
          notes?: string | null
          start_date?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_api_keys: {
        Row: {
          created_at: string
          default_account_id: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          default_account_id?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          default_account_id?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_api_keys_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_imports: {
        Row: {
          auto_post: boolean
          content_hash: string
          created_at: string
          error: string | null
          id: string
          message: string
          parsed_account_ref: string | null
          parsed_amount: number | null
          parsed_balance: number | null
          parsed_date: string | null
          parsed_type: string | null
          received_at: string
          sender: string
          status: string
          suggested_account_id: string | null
          suggested_category: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          auto_post?: boolean
          content_hash: string
          created_at?: string
          error?: string | null
          id?: string
          message: string
          parsed_account_ref?: string | null
          parsed_amount?: number | null
          parsed_balance?: number | null
          parsed_date?: string | null
          parsed_type?: string | null
          received_at?: string
          sender: string
          status?: string
          suggested_account_id?: string | null
          suggested_category?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          auto_post?: boolean
          content_hash?: string
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          parsed_account_ref?: string | null
          parsed_amount?: number | null
          parsed_balance?: number | null
          parsed_date?: string | null
          parsed_type?: string | null
          received_at?: string
          sender?: string
          status?: string
          suggested_account_id?: string | null
          suggested_category?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_imports_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          currency: string
          date: string
          debt_id: string | null
          description: string
          exchange_rate: number | null
          id: string
          investment_id: string | null
          is_interest_payment: boolean
          to_account_id: string | null
          transfer_charge: number | null
          trip_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category: string
          created_at?: string
          currency?: string
          date?: string
          debt_id?: string | null
          description?: string
          exchange_rate?: number | null
          id?: string
          investment_id?: string | null
          is_interest_payment?: boolean
          to_account_id?: string | null
          transfer_charge?: number | null
          trip_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          date?: string
          debt_id?: string | null
          description?: string
          exchange_rate?: number | null
          id?: string
          investment_id?: string | null
          is_interest_payment?: boolean
          to_account_id?: string | null
          transfer_charge?: number | null
          trip_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_planned_expenses: {
        Row: {
          category: string
          created_at: string
          currency: string
          day_number: number | null
          description: string
          id: string
          planned_amount: number
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          day_number?: number | null
          description?: string
          id?: string
          planned_amount?: number
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          day_number?: number | null
          description?: string
          id?: string
          planned_amount?: number
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_planned_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget: number
          created_at: string
          destination: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          notes: string
          start_date: string
          trip_currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number
          created_at?: string
          destination?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string
          start_date: string
          trip_currency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          created_at?: string
          destination?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string
          start_date?: string
          trip_currency?: string
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
      update_account_balance: {
        Args: { _account_id: string; _amount: number }
        Returns: undefined
      }
      update_debt_interest_paid: {
        Args: { _amount: number; _debt_id: string }
        Returns: undefined
      }
      update_debt_remaining: {
        Args: { _amount: number; _debt_id: string }
        Returns: undefined
      }
      update_goal_progress: {
        Args: { _amount: number; _goal_id: string }
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
