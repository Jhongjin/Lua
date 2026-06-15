"use server";

import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import {
  DEFAULT_LUA_PERSONA_ID,
  PLAN_CONTENT_EVENT_NAME,
} from "@/config/constants";
import { uploadManualImageAssets } from "@/lib/assets/manual-upload";
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
