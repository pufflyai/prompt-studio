import { spawn } from "node:child_process";
import type { AgentModel, HarnessParamDescriptor } from "@pstdio/sdk/extensions";

const effortMetadata: Record<string, { label: string; icon: string }> = {
  minimal: { label: "Minimal", icon: "CircleDot" },
  low: { label: "Low", icon: "Gauge" },
  medium: { label: "Medium", icon: "Brain" },
  high: { label: "High", icon: "Zap" },
  xhigh: { label: "XHigh", icon: "Flame" },
  max: { label: "Max", icon: "Sparkles" },
};

const reasoningEffortParam = (efforts: string[], defaultValue?: string): HarnessParamDescriptor => ({
  type: "select",
  label: "Reasoning effort",
  defaultValue: defaultValue && efforts.includes(defaultValue) ? defaultValue : efforts[0],
  options: efforts.map((value) => ({
    label: effortMetadata[value]?.label ?? value,
    value,
    icon: effortMetadata[value]?.icon,
  })),
});

const asRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

export const parseCodexModels = (input: unknown): AgentModel[] => {
  const data = asRecord(input)?.data;
  if (!Array.isArray(data)) return [];

  return data.flatMap((entry) => {
    const model = asRecord(entry);
    if (!model || typeof model.id !== "string") return [];

    const supported = Array.isArray(model.supportedReasoningEfforts)
      ? model.supportedReasoningEfforts.flatMap((item) => {
          if (typeof item === "string") return [item];
          const effort = asRecord(item)?.reasoningEffort ?? asRecord(item)?.effort;
          return typeof effort === "string" ? [effort] : [];
        })
      : [];

    return [
      {
        id: model.id,
        ...(typeof model.displayName === "string" ? { label: model.displayName } : {}),
        ...(typeof model.description === "string" ? { description: model.description } : {}),
        ...(typeof model.isDefault === "boolean" ? { isDefault: model.isDefault } : {}),
        paramOverrides: {
          model_reasoning_effort:
            supported.length > 0
              ? reasoningEffortParam(
                  supported,
                  typeof model.defaultReasoningEffort === "string" ? model.defaultReasoningEffort : undefined,
                )
              : null,
        },
      },
    ];
  });
};

export const discoverCodexModels = () =>
  new Promise<AgentModel[]>((resolve, reject) => {
    const child = spawn("codex", ["app-server", "--stdio"], { stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "";
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Codex model discovery timed out.")), 10_000);

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
      if (!settled) finish(new Error(`Codex app server exited before listing models (${code ?? "unknown"}).`));
    });
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        try {
          const message = JSON.parse(line) as Record<string, unknown>;
          if (message.id === 0) {
            child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
            child.stdin.write(
              `${JSON.stringify({ id: 1, method: "model/list", params: { limit: 100, includeHidden: false } })}\n`,
            );
          }
          if (message.id === 1) finish(undefined, parseCodexModels(message.result));
        } catch {
          // Ignore non-protocol output from the CLI.
        }
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        id: 0,
        method: "initialize",
        params: { clientInfo: { name: "pstdio", title: "Prompt Studio", version: "1.0.0" } },
      })}\n`,
    );
  });
