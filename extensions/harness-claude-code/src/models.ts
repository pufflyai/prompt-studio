import { spawn } from "node:child_process";
import type { AgentModel, HarnessParamDescriptor } from "@pstdio/sdk/extensions";

const effortMetadata: Record<string, { label: string; icon: string }> = {
  low: { label: "Low", icon: "Gauge" },
  medium: { label: "Medium", icon: "Brain" },
  high: { label: "High", icon: "Zap" },
  xhigh: { label: "XHigh", icon: "Flame" },
  max: { label: "Max", icon: "Sparkles" },
};

const modelIdentity = (value: string, displayName: unknown) => {
  if (value === "default") return { id: "opus", label: "Opus", isDefault: true };
  if (value.toLowerCase().includes("fable")) return { id: value, label: "Fable" };
  return {
    id: value,
    ...(typeof displayName === "string" ? { label: displayName } : {}),
  };
};

const thinkingParam = (levels: string[]): HarnessParamDescriptor => ({
  type: "select",
  label: "Thinking",
  defaultValue: levels.includes("high") ? "high" : levels[0],
  options: levels.map((value) => ({
    label: effortMetadata[value]?.label ?? value,
    value,
    icon: effortMetadata[value]?.icon,
  })),
});

const asRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

export const parseClaudeModels = (input: unknown): AgentModel[] => {
  const models = asRecord(input)?.models;
  if (!Array.isArray(models)) return [];

  return models.flatMap((entry) => {
    const model = asRecord(entry);
    if (!model || typeof model.value !== "string") return [];
    const levels = Array.isArray(model.supportedEffortLevels)
      ? model.supportedEffortLevels.filter((level): level is string => typeof level === "string")
      : [];
    const supportsEffort = model.supportsEffort === true && levels.length > 0;

    return [
      {
        ...modelIdentity(model.value, model.displayName),
        ...(typeof model.description === "string" ? { description: model.description } : {}),
        paramOverrides: { thinking: supportsEffort ? thinkingParam(levels) : null },
      },
    ];
  });
};

export const discoverClaudeModels = () =>
  new Promise<AgentModel[]>((resolve, reject) => {
    const child = spawn(
      "claude",
      [
        "--output-format",
        "stream-json",
        "--verbose",
        "--input-format",
        "stream-json",
        "--print",
        "--no-session-persistence",
      ],
      { env: { ...process.env, CLAUDECODE: "" }, stdio: ["pipe", "pipe", "pipe"] },
    );
    let buffer = "";
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Claude model discovery timed out.")), 10_000);

    const finish = (error?: Error, models?: AgentModel[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve(models ?? []);
    };

    child.on("error", (error) => finish(error));
    child.on("exit", (code) => {
      if (!settled) finish(new Error(`Claude exited before listing models (${code ?? "unknown"}).`));
    });
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        try {
          const message = asRecord(JSON.parse(line));
          const response = asRecord(message?.response);
          if (message?.type !== "control_response" || response?.request_id !== "models") continue;
          const payload = asRecord(response.response);
          finish(undefined, parseClaudeModels(payload));
        } catch {
          // Ignore non-protocol output from the CLI.
        }
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        type: "control_request",
        request_id: "models",
        request: { subtype: "initialize" },
      })}\n`,
    );
  });
