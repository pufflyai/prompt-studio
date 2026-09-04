import { createShowcaseStore } from "./showcase-store";

export const pigeonStore = createShowcaseStore({
  query: "",
  archivedIds: [] as string[],
  draft: { to: "", subject: "", body: "" },
});
