import type { ResourceRef } from "../extensions/types";

export type ExecuteExtensionCommandInput = {
  params?: Record<string, unknown>;
  target?: ResourceRef;
};

export type ExecuteExtensionCommandResponse = {
  result?: unknown;
};
