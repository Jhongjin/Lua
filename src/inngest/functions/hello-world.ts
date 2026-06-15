import { inngest } from "@/inngest/client";

export const helloWorld = inngest.createFunction(
  {
    id: "lua-hello-world",
    triggers: [{ event: "lua/hello.world" }],
  },
  async ({ event, step }) => {
    const payload = await step.run("compose-hello-payload", () => ({
      message: "LUA Inngest harness is ready.",
      receivedData: event.data ?? {},
    }));

    return payload;
  },
);
