import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { validateImageAssets } from "@/lib/validation/asset-gate";
import type { Tables } from "@/types/database";

type EditableImageJob = Pick<Tables<"content_jobs">, "id" | "format" | "status">;

async function loadEditableJob(jobId: string): Promise<EditableImageJob> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .select("id,format,status")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Failed to load editable content job ${jobId}: ${error.message}`);
  }

  return data;
}

export async function prepareFinalImageUrls(jobId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const job = await loadEditableJob(jobId);

  if (!["image", "carousel"].includes(job.format ?? "")) {
    throw new Error(
      `Image editing is not implemented for format ${job.format ?? "null"}.`,
    );
  }

  const { data: assets, error } = await supabase
    .from("assets")
    .select("id,type,public_url,width,height")
    .eq("job_id", jobId)
    .eq("type", "image")
    .eq("validation_passed", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load image assets for editing: ${error.message}`);
  }

  const validation = validateImageAssets({
    job,
    assets: assets ?? [],
  });

  if (!validation.ok) {
    throw new Error(`Image edit gate failed: ${validation.reasons.join(" | ")}`);
  }

  const finalImageUrls = (assets ?? [])
    .map((asset) => asset.public_url)
    .filter((url): url is string => Boolean(url));

  if (finalImageUrls.length === 0) {
    throw new Error("No public image URLs are available for final output.");
  }

  return finalImageUrls;
}
