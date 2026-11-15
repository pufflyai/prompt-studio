import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { tagsCollection } from "./collections";
import { readTagDefinitions } from "./definition-query";

// Requests own pending input. Retire its old tag projection while keeping custom flags.
export const cleanupAttentionTag = async (storage: ExtensionStorageApi) => {
  const optionId = "default-human-requested-true";
  const tags = tagsCollection(storage);
  for (const tag of await readTagDefinitions(storage)) {
    const options = tag.options.filter(({ id }) => id !== optionId);
    if (tag.id === "default-human-requested" && options.length === 0) {
      await tags.delete(tag.id);
    } else if (options.length !== tag.options.length) {
      await tags.put(tag.id, { ...tag, options });
    }
  }
};
