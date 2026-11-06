import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { Rule } from "./model";
import { type Chapter, chapterReference } from "./model";
import type { BookResourceType } from "./resource-catalog";

export const bookTarget = {
  kind: "page" as const,
  page: { kind: "page" as const, id: "book", extensionId: "pstdio.requirement-book" },
};
export const resourceTarget = (type: BookResourceType, id: string, label: string, projectId: string) => ({
  kind: "page" as const,
  page: { kind: "page" as const, id: type, extensionId: "pstdio.requirement-book" },
  resource: { type, id, label, extensionId: "pstdio.requirement-book", projectId },
  parent: bookTarget,
});
export const ruleTarget = (id: string, label: string, projectId: string, chapter: Chapter) => ({
  ...resourceTarget("requirement", id, `${id} ${label}`, projectId),
  parent: resourceTarget("chapter", String(chapter.id), `${chapterReference(chapter)} ${chapter.title}`, projectId),
});

export const ruleSelectionTarget = (
  rule: Rule,
  chapter: Chapter,
  projectId: string,
  current?: Rule,
  source?: ResourceRef,
) => {
  const target = ruleTarget(rule.ref, rule.title, projectId, chapter);
  if (source?.type === "requirement" && current?.chapter === rule.chapter)
    return {
      kind: "viewer" as const,
      operation: "replace" as const,
      from: source,
      resource: target.resource,
      page: target.page,
    };
  return target;
};
