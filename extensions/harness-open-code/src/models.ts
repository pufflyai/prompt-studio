import type { AgentModel, HarnessParamDescriptor } from "@pstdio/sdk/extensions";

const variantMetadata: Record<string, { label: string; icon: string }> = {
  none: { label: "None", icon: "CircleSlash" },
  minimal: { label: "Minimal", icon: "CircleDot" },
  low: { label: "Low", icon: "Gauge" },
  medium: { label: "Medium", icon: "Brain" },
  high: { label: "High", icon: "Zap" },
  xhigh: { label: "XHigh", icon: "Flame" },
  max: { label: "Max", icon: "Sparkles" },
};

const variantParam = (variants: string[]): HarnessParamDescriptor => {
  const values = variants.filter((variant) => variant !== "default");
  return {
    type: "select",
    label: "Thinking",
    defaultValue: values.includes("medium") ? "medium" : values[0],
    options: values.map((value) => ({
      label: variantMetadata[value]?.label ?? value,
      value,
      icon: variantMetadata[value]?.icon,
    })),
  };
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

const parseCandidates = (items: unknown[]): AgentModel[] => {
  const models = items.flatMap((item) => {
    if (typeof item === "string" && item.includes("/")) return [{ id: item.trim() }];
    const record = asRecord(item);
    const id = record?.id ?? record?.model ?? record?.name;
    return typeof id === "string" && id.includes("/") ? [{ id: id.trim() }] : [];
  });
  return [...new Map(models.map((model) => [model.id, model])).values()];
};

const parseVerboseBlocks = (output: string) => {
  const lines = output.split("\n");
  const models: AgentModel[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const id = lines[index]?.trim() ?? "";
    if (!id.includes("/") || lines[index + 1]?.trim() !== "{") continue;

    let json = "";
    let depth = 0;
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      json += `${line}\n`;
      depth += [...line].filter((character) => character === "{").length;
      depth -= [...line].filter((character) => character === "}").length;
      if (depth === 0) break;
    }

    try {
      const metadata = asRecord(JSON.parse(json));
      const variants = asRecord(metadata?.variants);
      const variantIds = variants ? Object.keys(variants) : [];
      models.push({
        id,
        label: id,
        paramOverrides: {
          variant: variantIds.some((variant) => variant !== "default") ? variantParam(variantIds) : null,
        },
      });
    } catch {
      models.push({ id });
    }
  }

  return models;
};

export const parseOpencodeModels = (output: string): AgentModel[] => {
  if (!output.trim()) return [];

  try {
    const parsed = JSON.parse(output) as unknown;
    if (Array.isArray(parsed)) return parseCandidates(parsed);
    const models = asRecord(parsed)?.models;
    if (Array.isArray(models)) return parseCandidates(models);
  } catch {
    // Fall back to verbose or plain line output.
  }

  const verbose = parseVerboseBlocks(output);
  if (verbose.length > 0) return verbose;

  const ids = output
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0] ?? "")
    .filter((line) => line.includes("/"));
  return [...new Set(ids)].map((id) => ({ id }));
};
