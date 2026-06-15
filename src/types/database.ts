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
      analytics: {
        Row: {
          id: string;
          publication_id: string;
          platform: Database["public"]["Enums"]["platform"];
          views: number | null;
          likes: number | null;
          comments: number | null;
          shares: number | null;
          saves: number | null;
          watch_completion_rate: number | null;
          follower_delta: number | null;
          collected_at: string | null;
        };
        Insert: {
          id?: string;
          publication_id: string;
          platform: Database["public"]["Enums"]["platform"];
          views?: number | null;
          likes?: number | null;
          comments?: number | null;
          shares?: number | null;
          saves?: number | null;
          watch_completion_rate?: number | null;
          follower_delta?: number | null;
          collected_at?: string | null;
        };
        Update: {
          id?: string;
          publication_id?: string;
          platform?: Database["public"]["Enums"]["platform"];
          views?: number | null;
          likes?: number | null;
          comments?: number | null;
          shares?: number | null;
          saves?: number | null;
          watch_completion_rate?: number | null;
          follower_delta?: number | null;
          collected_at?: string | null;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          job_id: string;
          type: Database["public"]["Enums"]["asset_type"];
          storage_path: string;
          public_url: string | null;
          prompt_used: string | null;
          width: number | null;
          height: number | null;
          duration_seconds: number | null;
          validation_passed: boolean | null;
          validation_note: string | null;
          face_similarity: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          type: Database["public"]["Enums"]["asset_type"];
          storage_path: string;
          public_url?: string | null;
          prompt_used?: string | null;
          width?: number | null;
          height?: number | null;
          duration_seconds?: number | null;
          validation_passed?: boolean | null;
          validation_note?: string | null;
          face_similarity?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          type?: Database["public"]["Enums"]["asset_type"];
          storage_path?: string;
          public_url?: string | null;
          prompt_used?: string | null;
          width?: number | null;
          height?: number | null;
          duration_seconds?: number | null;
          validation_passed?: boolean | null;
          validation_note?: string | null;
          face_similarity?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      content_jobs: {
        Row: {
          id: string;
          persona_id: string;
          prompt_template_id: string | null;
          status: Database["public"]["Enums"]["job_status"];
          title: string | null;
          concept: string | null;
          axis: Database["public"]["Enums"]["content_axis"] | null;
          format: Database["public"]["Enums"]["content_format"] | null;
          image_prompt: string | null;
          video_prompt: string | null;
          captions_on_screen: string[] | null;
          instagram_caption: string | null;
          youtube_title: string | null;
          youtube_description: string | null;
          hashtags_instagram: string[] | null;
          hashtags_youtube: string[] | null;
          best_post_time: string | null;
          ai_disclosure: boolean | null;
          final_video_url: string | null;
          final_image_urls: string[] | null;
          scheduled_at: string | null;
          target_platforms: Database["public"]["Enums"]["platform"][] | null;
          retry_count: number | null;
          max_retries: number | null;
          error_message: string | null;
          review_note: string | null;
          created_at: string | null;
          updated_at: string | null;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          persona_id: string;
          prompt_template_id?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          title?: string | null;
          concept?: string | null;
          axis?: Database["public"]["Enums"]["content_axis"] | null;
          format?: Database["public"]["Enums"]["content_format"] | null;
          image_prompt?: string | null;
          video_prompt?: string | null;
          captions_on_screen?: string[] | null;
          instagram_caption?: string | null;
          youtube_title?: string | null;
          youtube_description?: string | null;
          hashtags_instagram?: string[] | null;
          hashtags_youtube?: string[] | null;
          best_post_time?: string | null;
          ai_disclosure?: boolean | null;
          final_video_url?: string | null;
          final_image_urls?: string[] | null;
          scheduled_at?: string | null;
          target_platforms?: Database["public"]["Enums"]["platform"][] | null;
          retry_count?: number | null;
          max_retries?: number | null;
          error_message?: string | null;
          review_note?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          persona_id?: string;
          prompt_template_id?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          title?: string | null;
          concept?: string | null;
          axis?: Database["public"]["Enums"]["content_axis"] | null;
          format?: Database["public"]["Enums"]["content_format"] | null;
          image_prompt?: string | null;
          video_prompt?: string | null;
          captions_on_screen?: string[] | null;
          instagram_caption?: string | null;
          youtube_title?: string | null;
          youtube_description?: string | null;
          hashtags_instagram?: string[] | null;
          hashtags_youtube?: string[] | null;
          best_post_time?: string | null;
          ai_disclosure?: boolean | null;
          final_video_url?: string | null;
          final_image_urls?: string[] | null;
          scheduled_at?: string | null;
          target_platforms?: Database["public"]["Enums"]["platform"][] | null;
          retry_count?: number | null;
          max_retries?: number | null;
          error_message?: string | null;
          review_note?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          published_at?: string | null;
        };
        Relationships: [];
      };
      job_logs: {
        Row: {
          id: string;
          job_id: string | null;
          step: string;
          status: string;
          message: string | null;
          duration_ms: number | null;
          cost_credits: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          step: string;
          status: string;
          message?: string | null;
          duration_ms?: number | null;
          cost_credits?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string | null;
          step?: string;
          status?: string;
          message?: string | null;
          duration_ms?: number | null;
          cost_credits?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      personas: {
        Row: {
          id: string;
          name: string;
          handle: string | null;
          description: string | null;
          tone: string | null;
          content_axes: Database["public"]["Enums"]["content_axis"][] | null;
          forbidden_rules: string | null;
          reference_image_urls: string[] | null;
          visual_guide: string | null;
          active_prompt_template_id: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          handle?: string | null;
          description?: string | null;
          tone?: string | null;
          content_axes?: Database["public"]["Enums"]["content_axis"][] | null;
          forbidden_rules?: string | null;
          reference_image_urls?: string[] | null;
          visual_guide?: string | null;
          active_prompt_template_id?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          handle?: string | null;
          description?: string | null;
          tone?: string | null;
          content_axes?: Database["public"]["Enums"]["content_axis"][] | null;
          forbidden_rules?: string | null;
          reference_image_urls?: string[] | null;
          visual_guide?: string | null;
          active_prompt_template_id?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      prompt_templates: {
        Row: {
          id: string;
          persona_id: string | null;
          version: string;
          system_prompt: string;
          output_schema: Json | null;
          notes: string | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          persona_id?: string | null;
          version: string;
          system_prompt: string;
          output_schema?: Json | null;
          notes?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          persona_id?: string | null;
          version?: string;
          system_prompt?: string;
          output_schema?: Json | null;
          notes?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      publications: {
        Row: {
          id: string;
          job_id: string;
          platform: Database["public"]["Enums"]["platform"];
          status: Database["public"]["Enums"]["publication_status"];
          external_post_id: string | null;
          post_url: string | null;
          error_message: string | null;
          published_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          platform: Database["public"]["Enums"]["platform"];
          status?: Database["public"]["Enums"]["publication_status"];
          external_post_id?: string | null;
          post_url?: string | null;
          error_message?: string | null;
          published_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          platform?: Database["public"]["Enums"]["platform"];
          status?: Database["public"]["Enums"]["publication_status"];
          external_post_id?: string | null;
          post_url?: string | null;
          error_message?: string | null;
          published_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      set_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: {
      asset_type: "image" | "video";
      content_axis: "daily" | "office" | "food" | "beauty";
      content_format: "image" | "carousel" | "reels";
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
        | "FAILED";
      platform: "instagram" | "youtube" | "tiktok" | "x";
      publication_status: "pending" | "success" | "failed";
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<TableName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TableName]["Row"];

export type TablesInsert<TableName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TableName]["Insert"];

export type TablesUpdate<TableName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TableName]["Update"];

export type Enums<EnumName extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][EnumName];
