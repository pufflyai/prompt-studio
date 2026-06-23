import type { ExtensionLoggerApi, SerializedError } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime } from "../../types/runtime";

export const consoleLogger: ExtensionLoggerApi = { info: () => {}, warn: () => {}, error: () => {} };

export const defaultGenerateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const serializeError = (err: unknown): SerializedError => {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { message: String(err) };
};

export const findCommand = (runtime: ExtensionRuntime, id: string) => runtime.commands.find((cmd) => cmd.id === id);

export const middlewaresFor = (runtime: ExtensionRuntime, commandId: string) =>
  runtime.middlewares.filter((middleware) => middleware.commandId === commandId);
