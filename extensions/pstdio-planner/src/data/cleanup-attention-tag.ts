import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { tagsCollection } from "./collections";

// Requests own pending input. Retire its old tag projection while keeping custom flags.
// Ticket reads drop the retired option, because it no longer belongs to any tag.
export const cleanupAttentionTag = async (storage: ExtensionStorageApi) => {
  const optionId = "default-human-requested-true";
  const tags = tagsCollection(storage);
  for (const tag of await tags.list()) {
    const options = tag.options.filter(({ id }) => id !== optionId);
    if (tag.id === "default-human-requested" && options.length === 0) {
      await tags.delete(tag.id);
    } else if (options.length !== tag.options.length) {
      await tags.put(tag.id, { ...tag, options });
    }
  }
};
