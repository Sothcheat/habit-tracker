export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      daily_logs: {
        Row: {
          created_at: string;
          id: string;
          log_date: string;
          status: Database["public"]["Enums"]["log_status"];
          task_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          log_date: string;
          status?: Database["public"]["Enums"]["log_status"];
          task_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          log_date?: string;
          status?: Database["public"]["Enums"]["log_status"];
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_logs: {
        Row: {
          direction: Database["public"]["Enums"]["tap_direction"];
          id: string;
          log_date: string;
          logged_at: string;
          task_id: string;
        };
        Insert: {
          direction: Database["public"]["Enums"]["tap_direction"];
          id?: string;
          log_date: string;
          logged_at?: string;
          task_id: string;
        };
        Update: {
          direction?: Database["public"]["Enums"]["tap_direction"];
          id?: string;
          log_date?: string;
          logged_at?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          freeze_balance: number;
          id: string;
          timezone: string;
          week_start: number;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          freeze_balance?: number;
          id: string;
          timezone?: string;
          week_start?: number;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          freeze_balance?: number;
          id?: string;
          timezone?: string;
          week_start?: number;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_tags: {
        Row: {
          tag_id: string;
          task_id: string;
        };
        Insert: {
          tag_id: string;
          task_id: string;
        };
        Update: {
          tag_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_tags_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          archived_at: string | null;
          completed_at: string | null;
          created_at: string;
          direction: Database["public"]["Enums"]["habit_direction"] | null;
          due_date: string | null;
          every_n_days: number | null;
          frequency: Database["public"]["Enums"]["frequency_type"] | null;
          id: string;
          notes: string | null;
          position: number;
          priority: Database["public"]["Enums"]["priority_level"] | null;
          repeat_days: number[] | null;
          start_date: string | null;
          title: string;
          type: Database["public"]["Enums"]["task_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          direction?: Database["public"]["Enums"]["habit_direction"] | null;
          due_date?: string | null;
          every_n_days?: number | null;
          frequency?: Database["public"]["Enums"]["frequency_type"] | null;
          id?: string;
          notes?: string | null;
          position?: number;
          priority?: Database["public"]["Enums"]["priority_level"] | null;
          repeat_days?: number[] | null;
          start_date?: string | null;
          title: string;
          type: Database["public"]["Enums"]["task_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          direction?: Database["public"]["Enums"]["habit_direction"] | null;
          due_date?: string | null;
          every_n_days?: number | null;
          frequency?: Database["public"]["Enums"]["frequency_type"] | null;
          id?: string;
          notes?: string | null;
          position?: number;
          priority?: Database["public"]["Enums"]["priority_level"] | null;
          repeat_days?: number[] | null;
          start_date?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["task_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      owns_task: { Args: { p_task_id: string }; Returns: boolean };
    };
    Enums: {
      frequency_type: "daily" | "weekdays" | "every_n_days";
      habit_direction: "positive" | "negative" | "both";
      log_status: "done" | "frozen";
      priority_level: "low" | "normal" | "essential" | "urgent";
      tap_direction: "plus" | "minus";
      task_type: "habit" | "daily" | "todo";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      frequency_type: ["daily", "weekdays", "every_n_days"],
      habit_direction: ["positive", "negative", "both"],
      log_status: ["done", "frozen"],
      priority_level: ["low", "normal", "essential", "urgent"],
      tap_direction: ["plus", "minus"],
      task_type: ["habit", "daily", "todo"],
    },
  },
} as const;
