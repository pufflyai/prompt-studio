import { chooseHarnessAuthentication, type HarnessAuthentication, type HarnessContext } from "@pstdio/sdk/extensions";
import { runCodexAccountAction } from "./account-action";
import { readCodexAccount } from "./account-status";
export const getCodexAuthentication = async (
  _ctx: HarnessContext,
  _input?: { model?: string },
  read = readCodexAccount,
) => {
  let status: HarnessAuthentication["status"] = "unknown";
  const managed = Boolean(process.env.OPENAI_API_KEY);
  try {
    const result = await read();
    if (result.requiresOpenaiAuth === false) status = "not_required";
    else status = result.account || managed ? "signed_in" : "signed_out";
  } catch {}
  return {
    status,
    provider: "openai",
    providers: [
      {
        id: "openai",
        label: "OpenAI",
        status,
        canLogout: !managed && status === "signed_in",
        methods: [
          { id: "chatgpt", label: "ChatGPT", kind: "oauth" },
          { id: "api_key", label: "API key", kind: "api_key" },
        ],
      },
    ],
  } satisfies HarnessAuthentication;
};
export const authenticateCodex: NonNullable<import("@pstdio/sdk/extensions").HarnessProvider["authenticate"]> = async (
  ctx,
  input,
  channel,
) => {
  const choice = await chooseHarnessAuthentication(await getCodexAuthentication(ctx), input, channel);
  if (!choice) return;
  await runCodexAccountAction(input.action, channel, undefined, choice.method);
};
