/**
 * Supabase schema types for the habit tracker.
 *
 * Hand-derived from supabase/migrations/ so the app can be typed before the
 * project is reachable from the CLI. Once you can run the generator, replace
 * this file wholesale rather than editing it:
 *
 *   pnpm dlx supabase gen types typescript \
 *     --project-id artbewwpnuznjnkmvdxg > src/types/database.types.ts
 *
 * See docs/database_schema.md for the schema and the reasoning behind it.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          timezone: string;
          week_start: number;
          freeze_balance: number;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          timezone?: string;
          week_start?: number;
          freeze_balance?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          timezone?: string;
          week_start?: number;
          freeze_balance?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          type: Database["public"]["Enums"]["task_type"];
          title: string;
          notes: string | null;
          priority: Database["public"]["Enums"]["priority_level"] | null;
          direction: Database["public"]["Enums"]["habit_direction"] | null;
          frequency: Database["public"]["Enums"]["frequency_type"] | null;
          repeat_days: number[] | null;
          every_n_days: number | null;
          start_date: string | null;
          due_date: string | null;
          completed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          position: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: Database["public"]["Enums"]["task_type"];
          title: string;
          notes?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"] | null;
          direction?: Database["public"]["Enums"]["habit_direction"] | null;
          frequency?: Database["public"]["Enums"]["frequency_type"] | null;
          repeat_days?: number[] | null;
          every_n_days?: number | null;
          start_date?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          position?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: Database["public"]["Enums"]["task_type"];
          title?: string;
          notes?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"] | null;
          direction?: Database["public"]["Enums"]["habit_direction"] | null;
          frequency?: Database["public"]["Enums"]["frequency_type"] | null;
          repeat_days?: number[] | null;
          every_n_days?: number | null;
          start_date?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          position?: number;
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
      daily_logs: {
        Row: {
          id: string;
          task_id: string;
          log_date: string;
          status: Database["public"]["Enums"]["log_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          log_date: string;
          status?: Database["public"]["Enums"]["log_status"];
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          log_date?: string;
          status?: Database["public"]["Enums"]["log_status"];
          created_at?: string;
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
          id: string;
          task_id: string;
          direction: Database["public"]["Enums"]["tap_direction"];
          log_date: string;
          logged_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          direction: Database["public"]["Enums"]["tap_direction"];
          log_date: string;
          logged_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          direction?: Database["public"]["Enums"]["tap_direction"];
          log_date?: string;
          logged_at?: string;
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
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
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
          task_id: string;
          tag_id: string;
        };
        Insert: {
          task_id: string;
          tag_id: string;
        };
        Update: {
          task_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_tags_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      owns_task: {
        Args: { p_task_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      task_type: "habit" | "daily" | "todo";
      priority_level: "low" | "normal" | "essential" | "urgent";
      habit_direction: "positive" | "negative" | "both";
      frequency_type: "daily" | "weekdays" | "every_n_days";
      log_status: "done" | "frozen";
      tap_direction: "plus" | "minus";
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      task_type: ["habit", "daily", "todo"],
      priority_level: ["low", "normal", "essential", "urgent"],
      habit_direction: ["positive", "negative", "both"],
      frequency_type: ["daily", "weekdays", "every_n_days"],
      log_status: ["done", "frozen"],
      tap_direction: ["plus", "minus"],
    },
  },
} as const;
