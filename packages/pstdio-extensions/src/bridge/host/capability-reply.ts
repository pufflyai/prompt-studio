import type { HostCapabilityReply } from "../contract";
import { normalizeRuntimeError } from "../normalize-error";

/** Keep error details in an ordinary RPC value so nested data survives serialization. */
export const capabilityReply = async (run: () => unknown) => {
  try {
    return { ok: true, value: await run() } satisfies HostCapabilityReply;
  } catch (error) {
    const details = error !== null && typeof error === "object" ? error : {};
    return {
      ok: false,
      error: {
        code: "code" in details && typeof details.code === "string" ? details.code : "webview_capability_failed",
        message: normalizeRuntimeError(error).message,
        ...("data" in details ? { data: details.data } : {}),
      },
    } satisfies HostCapabilityReply;
  }
};
