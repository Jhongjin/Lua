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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics: {
        Row: {
          collected_at: string | null
          comments: number | null
          follower_delta: number | null
          id: string
          likes: number | null
          platform: Database["public"]["Enums"]["platform"]
          publication_id: string
          saves: number | null
          shares: number | null
          views: number | null
          watch_completion_rate: number | null
        }
        Insert: {
          collected_at?: string | null
          comments?: number | null
          follower_delta?: number | null
          id?: string
          likes?: number | null
          platform: Database["public"]["Enums"]["platform"]
          publication_id: string
          saves?: number | null
          shares?: number | null
          views?: number | null
          watch_completion_rate?: number | null
        }
        Update: {
          collected_at?: string | null
          comments?: number | null
          follower_delta?: number | null
          id?: string
          likes?: number | null
          platform?: Database["public"]["Enums"]["platform"]
          publication_id?: string
          saves?: number | null
          shares?: number | null
          views?: number | null
          watch_completion_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          face_similarity: number | null
          height: number | null
          id: string
          job_id: string
          prompt_used: string | null
          public_url: string | null
          storage_path: string
          type: Database["public"]["Enums"]["asset_type"]
          validation_note: string | null
          validation_passed: boolean | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          face_similarity?: number | null
          height?: number | null
          id?: string
          job_id: string
          prompt_used?: string | null
          public_url?: string | null
          storage_path: string
          type: Database["public"]["Enums"]["asset_type"]
          validation_note?: string | null
          validation_passed?: boolean | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          face_similarity?: number | null
          height?: number | null
          id?: string
          job_id?: string
          prompt_used?: string | null
          public_url?: string | null
          storage_path?: string
          type?: Database["public"]["Enums"]["asset_type"]
          validation_note?: string | null
          validation_passed?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "content_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_jobs: {
        Row: {
          ai_disclosure: boolean | null
          axis: Database["public"]["Enums"]["content_axis"] | null
          best_post_time: string | null
          captions_on_screen: string[] | null
          concept: string | null
          created_at: string | null
          error_message: string | null
          final_image_urls: string[] | null
          final_video_url: string | null
          format: Database["public"]["Enums"]["content_format"] | null
          hashtags_instagram: string[] | null
          hashtags_youtube: string[] | null
          id: string
          image_prompt: string | null
          image_source: Database["public"]["Enums"]["image_source"]
          instagram_caption: string | null
          max_retries: number | null
          persona_id: string
          prompt_template_id: string | null
          published_at: string | null
          retry_count: number | null
          review_note: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          target_platforms: Database["public"]["Enums"]["platform"][] | null
          title: string | null
          updated_at: string | null
          video_prompt: string | null
          video_source: Database["public"]["Enums"]["video_source"]
          youtube_description: string | null
          youtube_title: string | null
        }
        Insert: {
          ai_disclosure?: boolean | null
          axis?: Database["public"]["Enums"]["content_axis"] | null
          best_post_time?: string | null
          captions_on_screen?: string[] | null
          concept?: string | null
          created_at?: string | null
          error_message?: string | null
          final_image_urls?: string[] | null
          final_video_url?: string | null
          format?: Database["public"]["Enums"]["content_format"] | null
          hashtags_instagram?: string[] | null
          hashtags_youtube?: string[] | null
          id?: string
          image_prompt?: string | null
          image_source?: Database["public"]["Enums"]["image_source"]
          instagram_caption?: string | null
          max_retries?: number | null
          persona_id: string
          prompt_template_id?: string | null
          published_at?: string | null
          retry_count?: number | null
          review_note?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          target_platforms?: Database["public"]["Enums"]["platform"][] | null
          title?: string | null
          updated_at?: string | null
          video_prompt?: string | null
          video_source?: Database["public"]["Enums"]["video_source"]
          youtube_description?: string | null
          youtube_title?: string | null
        }
        Update: {
          ai_disclosure?: boolean | null
          axis?: Database["public"]["Enums"]["content_axis"] | null
          best_post_time?: string | null
          captions_on_screen?: string[] | null
          concept?: string | null
          created_at?: string | null
          error_message?: string | null
          final_image_urls?: string[] | null
          final_video_url?: string | null
          format?: Database["public"]["Enums"]["content_format"] | null
          hashtags_instagram?: string[] | null
          hashtags_youtube?: string[] | null
          id?: string
          image_prompt?: string | null
          image_source?: Database["public"]["Enums"]["image_source"]
          instagram_caption?: string | null
          max_retries?: number | null
          persona_id?: string
          prompt_template_id?: string | null
          published_at?: string | null
          retry_count?: number | null
          review_note?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          target_platforms?: Database["public"]["Enums"]["platform"][] | null
          title?: string | null
          updated_at?: string | null
          video_prompt?: string | null
          video_source?: Database["public"]["Enums"]["video_source"]
          youtube_description?: string | null
          youtube_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_jobs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_jobs_prompt_template_id_fkey"
            columns: ["prompt_template_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          cost_credits: number | null
          created_at: string | null
          duration_ms: number | null
          id: string
          job_id: string | null
          message: string | null
          status: string
          step: string
        }
        Insert: {
          cost_credits?: number | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          job_id?: string | null
          message?: string | null
          status: string
          step: string
        }
        Update: {
          cost_credits?: number | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          job_id?: string | null
          message?: string | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "content_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          active_prompt_template_id: string | null
          content_axes: Database["public"]["Enums"]["content_axis"][] | null
          created_at: string | null
          description: string | null
          forbidden_rules: string | null
          handle: string | null
          id: string
          is_active: boolean | null
          name: string
          reference_image_urls: string[] | null
          tone: string | null
          updated_at: string | null
          visual_guide: string | null
        }
        Insert: {
          active_prompt_template_id?: string | null
          content_axes?: Database["public"]["Enums"]["content_axis"][] | null
          created_at?: string | null
          description?: string | null
          forbidden_rules?: string | null
          handle?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          reference_image_urls?: string[] | null
          tone?: string | null
          updated_at?: string | null
          visual_guide?: string | null
        }
        Update: {
          active_prompt_template_id?: string | null
          content_axes?: Database["public"]["Enums"]["content_axis"][] | null
          created_at?: string | null
          description?: string | null
          forbidden_rules?: string | null
          handle?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          reference_image_urls?: string[] | null
          tone?: string | null
          updated_at?: string | null
          visual_guide?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_active_prompt_template"
            columns: ["active_prompt_template_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          output_schema: Json | null
          persona_id: string | null
          system_prompt: string
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          output_schema?: Json | null
          persona_id?: string | null
          system_prompt: string
          version: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          output_schema?: Json | null
          persona_id?: string | null
          system_prompt?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_templates_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_post_id: string | null
          id: string
          job_id: string
          platform: Database["public"]["Enums"]["platform"]
          post_url: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["publication_status"]
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          job_id: string
          platform: Database["public"]["Enums"]["platform"]
          post_url?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          job_id?: string
          platform?: Database["public"]["Enums"]["platform"]
          post_url?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
        }
        Relationships: [
          {
            foreignKeyName: "publications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "content_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_type: "image" | "video"
      content_axis: "daily" | "office" | "food" | "beauty"
      content_format: "image" | "carousel" | "reels"
      image_source: "manual" | "hedra" | "fal" | "auto"
      job_status:
        | "QUEUED"
        | "PLANNED"
        | "ASSETS_GENERATING"
        | "ASSETS_READY"
        | "EDITING"
        | "EDITED"
        | "PENDING_REVIEW"
        | "APPROVED"
        | "REJECTED"
        | "PUBLISHING"
        | "PUBLISHED"
        | "FAILED"
      platform: "instagram" | "youtube" | "tiktok" | "x"
      publication_status: "pending" | "success" | "failed"
      video_source: "manual" | "veo" | "auto"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_type: ["image", "video"],
      content_axis: ["daily", "office", "food", "beauty"],
      content_format: ["image", "carousel", "reels"],
      image_source: ["manual", "hedra", "fal", "auto"],
      job_status: [
        "QUEUED",
        "PLANNED",
        "ASSETS_GENERATING",
        "ASSETS_READY",
        "EDITING",
        "EDITED",
        "PENDING_REVIEW",
        "APPROVED",
        "REJECTED",
        "PUBLISHING",
        "PUBLISHED",
        "FAILED",
      ],
      platform: ["instagram", "youtube", "tiktok", "x"],
      publication_status: ["pending", "success", "failed"],
      video_source: ["manual", "veo", "auto"],
    },
  },
} as const
