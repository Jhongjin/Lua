"use server";

import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import {
  DEFAULT_LUA_PERSONA_ID,
  PLAN_CONTENT_EVENT_NAME,
} from "@/config/constants";
import { uploadManualImageAssets } from "@/lib/assets/manual-upload";
import {
  createManualVideoUploadTarget,
  finalizeManualVideoUpload,
} from "@/lib/assets/video-manual-upload";
import { submitReviewDecision } from "@/lib/review/decisions";
import { createAuthenticatedServerClient } from "@/lib/supabase/server";

export async function triggerManualContentPlan() {
  const supabase = await createAuthenticatedServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required to trigger content planning.");
  }

  await inngest.send({
    name: PLAN_CONTENT_EVENT_NAME,
    data: {
      personaId: DEFAULT_LUA_PERSONA_ID,
      requestedBy: user.email ?? user.id,
      source: "dashboard",
    },
  });

  revalidatePath("/review");
}

export async function uploadManualImagesForJob(formData: FormData) {
  const supabase = await createAuthenticatedServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required to upload image assets.");
  }

  const jobId = formData.get("jobId");

  if (typeof jobId !== "string" || !jobId) {
    throw new Error("Missing jobId for manual upload.");
  }

  const files = formData
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);

  await uploadManualImageAssets({
    jobId,
    files,
    requestedBy: user.email ?? user.id,
  });

  revalidatePath("/review");
}

async function getAuthenticatedReviewer() {
  const supabase = await createAuthenticatedServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required for review dashboard actions.");
  }

  return user.email ?? user.id;
}

export async function createManualVideoUploadTargetForJob(input: {
  jobId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}) {
  const requestedBy = await getAuthenticatedReviewer();

  if (!input.jobId) {
    throw new Error("Missing jobId for manual video upload.");
  }

  if (!input.filename) {
    throw new Error("Missing filename for manual video upload.");
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("Manual video upload file is empty.");
  }

  return createManualVideoUploadTarget({
    jobId: input.jobId,
    filename: input.filename,
    contentType: input.contentType || "video/mp4",
    requestedBy,
  });
}

export async function finalizeManualVideoUploadForJob(input: {
  jobId: string;
  storagePath: string;
  publicUrl: string;
  filename: string;
  contentType: string;
  width: number;
  height: number;
  durationSeconds: number;
  sizeBytes: number;
}) {
  const requestedBy = await getAuthenticatedReviewer();

  await finalizeManualVideoUpload({
    jobId: input.jobId,
    storagePath: input.storagePath,
    publicUrl: input.publicUrl,
    filename: input.filename,
    contentType: input.contentType || "video/mp4",
    metadata: {
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      sizeBytes: input.sizeBytes,
    },
    requestedBy,
  });

  revalidatePath("/review");
}

export async function approveContentJob(formData: FormData) {
  const requestedBy = await getAuthenticatedReviewer();
  const jobId = formData.get("jobId");

  if (typeof jobId !== "string" || !jobId) {
    throw new Error("Missing jobId for approval.");
  }

  await submitReviewDecision({
    jobId,
    decision: "approve",
    requestedBy,
  });

  revalidatePath("/review");
}

export async function rejectContentJob(formData: FormData) {
  const requestedBy = await getAuthenticatedReviewer();
  const jobId = formData.get("jobId");
  const reviewNote = formData.get("reviewNote");

  if (typeof jobId !== "string" || !jobId) {
    throw new Error("Missing jobId for rejection.");
  }

  await submitReviewDecision({
    jobId,
    decision: "reject",
    reviewNote: typeof reviewNote === "string" ? reviewNote : "",
    requestedBy,
  });

  revalidatePath("/review");
}
