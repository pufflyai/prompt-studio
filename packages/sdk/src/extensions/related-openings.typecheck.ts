import type { RelatedResourceOpenings } from "./index";
import { defineCommand, defineResourceKind } from "./index";

const related = defineCommand({
  id: "related",
  title: "Select related resources",
  async run(ctx) {
    const source = ctx.resource;
    if (!source) return [] satisfies RelatedResourceOpenings;
    return [
      {
        resource: { type: "session", id: source.id, extensionId: "pstdio", projectId: ctx.project.id },
        autoOpen: true,
        region: "side",
        open: "preview",
      },
    ] satisfies RelatedResourceOpenings;
  },
});
defineResourceKind({ id: "note", relatedOpenings: related.ref });
