import type { ExtensionCommandRecord } from "@pstdio/sdk/api";

type ParamDescriptor = NonNullable<ExtensionCommandRecord["params"]>[string];

export const formatParamName = (name: string) => `--${name.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`;

const normalizeParamName = (name: string) =>
  name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

const JSON_PARAM_TYPES = new Set(["json", "harness", "resource", "workspace"]);

export const describeParamValue = (param: ParamDescriptor) => {
  if ((param.type === "select" || param.type === "multi-select") && param.options && !Array.isArray(param.options))
    return " <value> (command-backed)";
  if (param.type === "boolean") return "";
  if (param.type === "number") return " <number>";
  if (param.type === "list") return " <value...>";
  if (JSON_PARAM_TYPES.has(param.type)) return " <json>";
  return " <value>";
};

const parseJsonParam = (name: string, value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${formatParamName(name)} expects a JSON value (got ${value})`);
  }
};

const coerceParam = (name: string, descriptor: ParamDescriptor | undefined, value: string | boolean) => {
  if (descriptor?.type === "number") {
    const number = typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
    if (Number.isNaN(number)) throw new Error(`${formatParamName(name)} expects a number (got ${value})`);
    return number;
  }
  if (descriptor?.type === "boolean") return value === true || value === "true";
  if (descriptor && JSON_PARAM_TYPES.has(descriptor.type) && typeof value === "string") {
    return parseJsonParam(name, value);
  }
  return value;
};

type ExtensionCommandParamDescriptor = NonNullable<ExtensionCommandRecord["params"]>[string];

const readBuiltinCliFlag = (arg: string | undefined) => {
  if (arg === "--help" || arg === "-h") return "help";
  if (arg === "--json") return "json";
  return null;
};

const readParamFlag = (command: ExtensionCommandRecord, args: string[], index: number) => {
  const arg = args[index];
  if (!arg?.startsWith("--")) return null;

  const [rawName, inlineValue] = arg.slice(2).split("=", 2);
  const name = normalizeParamName(rawName ?? "");
  const descriptor = command.params?.[name];
  if (inlineValue !== undefined) return { descriptor, name, nextIndex: index, value: inlineValue };
  const next = args[index + 1];
  // A boolean flag takes the next word only when it is an explicit `true` or `false`.
  const explicitBoolean = descriptor?.type === "boolean" && (next === "true" || next === "false");
  if (explicitBoolean) return { descriptor, name, nextIndex: index + 1, value: next };
  if (descriptor?.type === "boolean") return { descriptor, name, nextIndex: index, value: true };
  if (descriptor && next === undefined) throw new Error(`${formatParamName(name)} expects a value`);
  return { descriptor, name, nextIndex: index + 1, value: next };
};

const assignParamValue = (
  params: Record<string, unknown>,
  name: string,
  descriptor: ExtensionCommandParamDescriptor | undefined,
  value: unknown,
) => {
  if (descriptor?.type !== "list") {
    const scalarValue = typeof value === "string" || typeof value === "boolean" ? value : true;
    params[name] = coerceParam(name, descriptor, scalarValue);
    return;
  }

  const existing = Array.isArray(params[name]) ? (params[name] as unknown[]) : [];
  existing.push(typeof value === "string" ? value : String(value ?? ""));
  params[name] = existing;
};

export const parseExtensionCommandArgs = (command: ExtensionCommandRecord, args: string[]) => {
  const params: Record<string, unknown> = {};
  let help = false;
  let json = false;
  let stream = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--stream") {
      stream = true;
      continue;
    }
    const builtinFlag = readBuiltinCliFlag(arg);
    if (builtinFlag === "help") {
      help = true;
      continue;
    }
    if (builtinFlag === "json") {
      json = true;
      continue;
    }

    const paramFlag = readParamFlag(command, args, index);
    if (!paramFlag) continue;
    assignParamValue(params, paramFlag.name, paramFlag.descriptor, paramFlag.value);
    index = paramFlag.nextIndex;
  }

  return { help, json, stream, params };
};
