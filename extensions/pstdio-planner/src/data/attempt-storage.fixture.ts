import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readAttemptPage } from "./attempt-page";

export const listAttempts = async (storage: ExtensionStorageApi) => (await readAttemptPage(storage)).variants;
