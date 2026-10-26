import {
  inspectManagedWebviewBuildInputs,
  prepareManagedWebviewBuildSource,
} from "../../authoring/extension-webview-build-source";
import { hashExtensionSource } from "../../authoring/hash-extension-source";
import { extensionLoadKey } from "../loader";

export const preparationOperations = {
  loadKey: extensionLoadKey,
  sourceHash: hashExtensionSource,
  inspectWebview: inspectManagedWebviewBuildInputs,
  prepareWebview: prepareManagedWebviewBuildSource,
};
export type PreparationOperations = typeof preparationOperations;
