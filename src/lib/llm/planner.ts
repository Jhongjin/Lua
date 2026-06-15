import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages/messages";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  contentPlanJsonSchema,
  parseContentPlan,
  type ContentPlan,
} from "@/types/content";

const SUBMIT_CONTENT_PLAN_TOOL_NAME = "submit_content_plan";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TIMEOUT_MS = 90_000;

let anthropicClient: Anthropic | null = null;

export type PlanningContext = {
  persona: {
    id: string;
    name: string;
    handle: string | null;
    description: string | null;
    tone: string | null;
    forbidden_rules: string | null;
    visual_guide: string | null;
  };
  promptTemplate: {
    id: string;
    version: string;
    system_prompt: string;
  };
};

export type CreateContentPlanOptions = {
  context?: PlanningContext;
  feedback?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: requireEnv("ANTHROPIC_API_KEY"),
      maxRetries: 0,
      timeout: Number(process.env.ANTHROPIC_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    });
  }

  return anthropicClient;
}

export async function loadPlanningContext(
  personaId: string,
): Promise<PlanningContext> {
  const supabase = getSupabaseServiceRoleClient();
  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select(
      "id,name,handle,description,tone,forbidden_rules,visual_guide,active_prompt_template_id",
    )
    .eq("id", personaId)
    .eq("is_active", true)
    .single();

  if (personaError) {
    throw new Error(
      `Failed to load active persona ${personaId}: ${personaError.message}`,
    );
  }

  if (!persona.active_prompt_template_id) {
    throw new Error(`Persona ${personaId} has no active prompt template.`);
  }

  const { data: promptTemplate, error: templateError } = await supabase
    .from("prompt_templates")
    .select("id,version,system_prompt")
    .eq("id", persona.active_prompt_template_id)
    .eq("is_active", true)
    .single();

  if (templateError) {
    throw new Error(
      `Failed to load active prompt template for persona ${personaId}: ${templateError.message}`,
    );
  }

  return {
    persona: {
      id: persona.id,
      name: persona.name,
      handle: persona.handle,
      description: persona.description,
      tone: persona.tone,
      forbidden_rules: persona.forbidden_rules,
      visual_guide: persona.visual_guide,
    },
    promptTemplate,
  };
}

export function getContentPlanTool(): Tool {
  return {
    name: SUBMIT_CONTENT_PLAN_TOOL_NAME,
    description:
      "Submit the complete LUA content plan. The input itself is the final structured output and must not omit any field.",
    input_schema: {
      ...contentPlanJsonSchema,
      required: [...contentPlanJsonSchema.required],
    },
    strict: true,
  };
}

function createUserPrompt(context: PlanningContext, feedback?: string) {
  const feedbackBlock = feedback
    ? `\n\n이전 기획안은 아래 이유로 검증에 실패했습니다. 같은 실패를 반복하지 말고 새 기획안을 생성하세요.\n${feedback}`
    : "";

  return [
    "루아의 다음 콘텐츠 기획안을 1건 생성하세요.",
    "출력은 반드시 submit_content_plan 도구 호출의 input으로만 제출하세요.",
    "도구를 실제 실행할 필요는 없으며, tool_use input이 최종 결과입니다.",
    "",
    `페르소나: ${context.persona.name} (${context.persona.handle ?? "no handle"})`,
    context.persona.description ? `설명: ${context.persona.description}` : "",
    context.persona.tone ? `톤: ${context.persona.tone}` : "",
    context.persona.visual_guide
      ? `비주얼 가이드: ${context.persona.visual_guide}`
      : "",
    context.persona.forbidden_rules
      ? `금지 규칙: ${context.persona.forbidden_rules}`
      : "",
    "title은 내부 식별용 제목이고, youtube_title은 유튜브 공개 제목입니다.",
    "axis는 DB content_jobs.axis와 동일하게 daily, office, food, beauty 중 하나만 사용하세요.",
    feedbackBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractToolInput(response: Anthropic.Messages.Message) {
  const toolUseBlock = response.content.find(
    (block) =>
      block.type === "tool_use" && block.name === SUBMIT_CONTENT_PLAN_TOOL_NAME,
  );

  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error(
      `Anthropic response did not include required ${SUBMIT_CONTENT_PLAN_TOOL_NAME} tool_use block.`,
    );
  }

  return toolUseBlock.input;
}

export async function createContentPlan(
  personaId: string,
  options: CreateContentPlanOptions = {},
): Promise<ContentPlan> {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";

  if (!["anthropic", "claude"].includes(provider)) {
    throw new Error(
      `Unsupported LLM_PROVIDER "${provider}". Phase 2 planner currently supports Anthropic tool use.`,
    );
  }

  const context = options.context ?? (await loadPlanningContext(personaId));
  const anthropic = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
  const maxTokens = Number(
    process.env.ANTHROPIC_MAX_TOKENS ?? DEFAULT_MAX_TOKENS,
  );

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: context.promptTemplate.system_prompt,
      messages: [
        {
          role: "user",
          content: createUserPrompt(context, options.feedback),
        },
      ],
      tools: [getContentPlanTool()],
      tool_choice: {
        type: "tool",
        name: SUBMIT_CONTENT_PLAN_TOOL_NAME,
        disable_parallel_tool_use: true,
      },
    });

    return parseContentPlan(extractToolInput(response));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Content planner LLM call failed: ${message}`, {
      cause: error,
    });
  }
}
