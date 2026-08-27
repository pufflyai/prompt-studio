import { createClient } from "@pstdio/sdk/client";
import { resolveApiUrl } from "@/features/api-url";

export const createMachineAutomationClient = () => {
  const token = process.env.PSTDIO_AUTOMATION_TOKEN;
  if (!token) throw new Error("Set PSTDIO_AUTOMATION_TOKEN to a scoped machine token.");
  return createClient({ baseUrl: resolveApiUrl(), token }).automation;
};
