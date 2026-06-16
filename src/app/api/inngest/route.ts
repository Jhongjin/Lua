import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { editContent } from "@/inngest/functions/edit-content";
import { generateAssets } from "@/inngest/functions/generate-assets";
import { helloWorld } from "@/inngest/functions/hello-world";
import { planContent } from "@/inngest/functions/plan-content";
import { publishContent } from "@/inngest/functions/publish-content";
import { requestReview } from "@/inngest/functions/request-review";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    helloWorld,
    planContent,
    generateAssets,
    editContent,
    requestReview,
    publishContent,
  ],
});
