import { redactSensitiveText } from "pstdio-logging";

export const workbenchErrorDetails = (value: unknown, secrets: string[]) => {
  if (!value || typeof value !== "object" || !("message" in value) || typeof value.message !== "string") return;
  const report = value as Record<string, unknown>;
  const text = (field: string, limit: number) => {
    const input = report[field];
    if (typeof input === "string") return redactSensitiveText(input.slice(0, limit * 2), secrets).slice(0, limit);
  };
  return {
    event: "desktop.workbench.error",
    projectId: text("projectId", 100),
    message: text("message", 2_000),
    stack: text("stack", 12_000),
    componentStack: text("componentStack", 12_000),
  };
};
