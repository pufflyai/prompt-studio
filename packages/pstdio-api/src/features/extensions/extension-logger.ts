import type { ExtensionLoggerApi } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";

export const createExtensionLogger = (extensionId: string): ExtensionLoggerApi => ({
  info: (message, metadata) =>
    apiLogger.info({ event: "extension.log", extensionId, metadata: metadata ?? {} }, message),
  warn: (message, metadata) =>
    apiLogger.warn({ event: "extension.log", extensionId, metadata: metadata ?? {} }, message),
  error: (message, metadata) =>
    apiLogger.error({ event: "extension.log", extensionId, metadata: metadata ?? {} }, message),
});
