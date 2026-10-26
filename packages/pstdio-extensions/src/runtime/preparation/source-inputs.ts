import { hashExtensionSource } from "../../authoring/hash-extension-source";
import { extensionLoadKey } from "../loader";
import { prepareExtensionWork } from "./supervisor";

export const extensionLoadKeyForHost = async (path: string) =>
  process.env.PSTDIO_EXTENSION_PROCESS_OWNERS === "1" ? prepareExtensionWork("loadKey", path) : extensionLoadKey(path);
export const hashExtensionSourceForHost = async (path: string) =>
  process.env.PSTDIO_EXTENSION_PROCESS_OWNERS === "1"
    ? prepareExtensionWork("sourceHash", path)
    : hashExtensionSource(path);
