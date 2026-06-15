import {
  DEFAULT_LUA_PERSONA_ID,
  GENERATE_ASSETS_EVENT_NAME,
  PLAN_CONTENT_EVENT_NAME,
} from "@/config/constants";
import { inngest } from "@/inngest/client";
import {
  createContentPlan,
  loadPlanningContext,
  type PlanningContext,
} from "@/lib/llm/planner";
import { sendReviewNotification } from "@/lib/notify/slack";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { validateContentPlan } from "@/lib/validation/caption-gate";
import type { ContentPlan } from "@/types/content";

type PlanContentEventData = {
  personaId?: string;
  requestedBy?: string;
  source?: "cron" | "dashboard" | "api";
};

type CreatedJob = {
  id: string;
  persona_id: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function recordJobLog(input: {
  jobId: string;
  step: string;
  status: "started" | "success" | "failed" | "retry";
  message?: string;
  durationMs?: number;
  costCredits?: number;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("job_logs").insert({
    job_id: input.jobId,
    step: input.step,
    status: input.status,
    message: input.message,
    duration_ms: input.durationMs,
    cost_credits: input.costCredits,
  });

  if (error) {
    throw new Error(`Failed to write job log: ${error.message}`);
  }
}

async function markJobFailed(jobId: string, message: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      status: "FAILED",
      error_message: message,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to mark job ${jobId} as FAILED: ${error.message}`);
  }
}

async function createQueuedJob(personaId: string): Promise<CreatedJob> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .insert({
      persona_id: personaId,
      status: "QUEUED",
      max_retries: 3,
      retry_count: 0,
    })
    .select("id,persona_id")
    .single();

  if (error) {
    throw new Error(`Failed to create QUEUED content job: ${error.message}`);
  }

  await recordJobLog({
    jobId: data.id,
    step: "queue",
    status: "success",
    message: "Created QUEUED content job.",
  });

  return data;
}

async function updateJobToPlanned(input: {
  jobId: string;
  context: PlanningContext;
  plan: ContentPlan;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("content_jobs")
    .update({
      prompt_template_id: input.context.promptTemplate.id,
      status: "PLANNED",
      title: input.plan.title,
      concept: input.plan.concept,
      axis: input.plan.axis,
      format: input.plan.format,
      image_prompt: input.plan.image_prompt,
      video_prompt: input.plan.video_prompt,
      captions_on_screen: input.plan.captions_on_screen,
      instagram_caption: input.plan.instagram_caption,
      youtube_title: input.plan.youtube_title,
      youtube_description: input.plan.youtube_description,
      hashtags_instagram: input.plan.hashtags_instagram,
      hashtags_youtube: input.plan.hashtags_youtube,
      best_post_time: input.plan.best_post_time,
      ai_disclosure: input.plan.ai_disclosure,
      error_message: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(
      `Failed to update content job ${input.jobId} to PLANNED: ${error.message}`,
    );
  }
}

export const planContent = inngest.createFunction(
  {
    id: "lua-plan-content",
    retries: 3,
    triggers: [{ event: PLAN_CONTENT_EVENT_NAME }],
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as PlanContentEventData;
    const personaId = data.personaId ?? DEFAULT_LUA_PERSONA_ID;
    const job = await step.run("create-queued-job", () =>
      createQueuedJob(personaId),
    );

    try {
      const context = await step.run("load-persona-template", async () => {
        await recordJobLog({
          jobId: job.id,
          step: "load_persona_template",
          status: "started",
          message: `Loading persona ${personaId} and active prompt template.`,
        });
        const startedAt = Date.now();
        const loaded = await loadPlanningContext(personaId);
        await recordJobLog({
          jobId: job.id,
          step: "load_persona_template",
          status: "success",
          message: `Loaded prompt template ${loaded.promptTemplate.version}.`,
          durationMs: Date.now() - startedAt,
        });
        return loaded;
      });

      const firstPlan = await step.run("generate-content-plan", async () => {
        await recordJobLog({
          jobId: job.id,
          step: "llm_plan",
          status: "started",
          message: "Generating content plan with Anthropic tool use.",
        });
        const startedAt = Date.now();
        const plan = await createContentPlan(personaId, { context });
        await recordJobLog({
          jobId: job.id,
          step: "llm_plan",
          status: "success",
          message: "Generated initial content plan.",
          durationMs: Date.now() - startedAt,
        });
        return plan;
      });

      let finalPlan = firstPlan;
      let validation = await step.run("validate-content-plan", async () => {
        const result = validateContentPlan(firstPlan);
        await recordJobLog({
          jobId: job.id,
          step: "caption_gate",
          status: result.ok ? "success" : "failed",
          message: result.ok
            ? "Initial content plan passed validation."
            : result.reasons.join(" | "),
        });
        return result;
      });

      if (!validation.ok) {
        const feedback = validation.reasons.join("\n");
        finalPlan = await step.run(
          "regenerate-content-plan-after-validation-failure",
          async () => {
            await recordJobLog({
              jobId: job.id,
              step: "llm_plan_regenerate",
              status: "retry",
              message: feedback,
            });
            const startedAt = Date.now();
            const plan = await createContentPlan(personaId, {
              context,
              feedback,
            });
            await recordJobLog({
              jobId: job.id,
              step: "llm_plan_regenerate",
              status: "success",
              message: "Generated replacement content plan after gate failure.",
              durationMs: Date.now() - startedAt,
            });
            return plan;
          },
        );

        validation = await step.run("validate-regenerated-content-plan", async () => {
          const result = validateContentPlan(finalPlan);
          await recordJobLog({
            jobId: job.id,
            step: "caption_gate_regenerated",
            status: result.ok ? "success" : "failed",
            message: result.ok
              ? "Regenerated content plan passed validation."
              : result.reasons.join(" | "),
          });
          return result;
        });
      }

      if (!validation.ok) {
        const message = `Content plan validation failed after regeneration: ${validation.reasons.join(
          " | ",
        )}`;
        await step.run("mark-failed-after-validation", () =>
          markJobFailed(job.id, message),
        );
        await step.run("notify-planning-validation-failed", () =>
          sendReviewNotification({
            title: "LUA content planning failed",
            message,
            jobId: job.id,
          }),
        );
        return {
          jobId: job.id,
          status: "FAILED",
          reason: message,
        };
      }

      await step.run("mark-planned", async () => {
        await updateJobToPlanned({
          jobId: job.id,
          context,
          plan: finalPlan,
        });
        await recordJobLog({
          jobId: job.id,
          step: "plan",
          status: "success",
          message: "Updated content job to PLANNED.",
        });
      });

      await step.run("enqueue-generate-assets", () =>
        inngest.send({
          name: GENERATE_ASSETS_EVENT_NAME,
          data: {
            jobId: job.id,
            source: "plan_content",
          },
        }),
      );

      return {
        jobId: job.id,
        status: "PLANNED",
        source: data.source ?? "api",
        requestedBy: data.requestedBy,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      await step.run("mark-failed-after-planning-error", async () => {
        await markJobFailed(job.id, message);
        await recordJobLog({
          jobId: job.id,
          step: "plan",
          status: "failed",
          message,
        });
      });
      await step.run("notify-planning-error", () =>
        sendReviewNotification({
          title: "LUA content planning error",
          message,
          jobId: job.id,
        }),
      );
      return {
        jobId: job.id,
        status: "FAILED",
        reason: message,
      };
    }
  },
);
