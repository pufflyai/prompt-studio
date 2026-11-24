import { CommandOutcomeError } from "@pstdio/sdk/extensions";

export const isDefiniteGateLaunchRefusal = (error: unknown) => {
  if (!(error instanceof CommandOutcomeError) || error.outcome.status !== "error") return false;
  const name = error.outcome.error?.name;
  return name === "GateLaunchRefused" || name === "SessionCreateRefused";
};
