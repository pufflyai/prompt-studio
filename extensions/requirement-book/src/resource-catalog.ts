import { type Chapter, chapterReference, type Rule, type Section } from "./model";

export const resourceSpecs = [
  { id: "requirement", label: "Rule", plural: "Rules", icon: "list-checks", section: null },
  { id: "chapter", label: "Chapter", plural: "Chapters", icon: "library", section: null },
  { id: "finding", label: "Finding", plural: "Findings", icon: "triangle-alert", section: "Findings" },
  { id: "suggestion", label: "Suggestion", plural: "Suggestions", icon: "git-pull-request", section: "Suggestions" },
] as const;
export type BookResourceType = (typeof resourceSpecs)[number]["id"];
interface ResourceData {
  chapters: Chapter[];
  rules: Rule[];
  findings: { id: string; title: string; requirements: string[] }[];
  suggestions: {
    id: string;
    title: string;
    reason: string;
    operations: { before: Rule | null; after: Rule | null }[];
  }[];
}
export const resourceEntries = (data: ResourceData, type: BookResourceType) => {
  if (type === "requirement")
    return data.rules.map((rule) => ({
      id: rule.ref,
      label: rule.title,
      text: `${rule.ref} ${rule.statement}`,
      chapter: rule.chapter,
    }));
  if (type === "chapter")
    return data.chapters.map((chapter) => ({
      id: String(chapter.id),
      label: `${chapterReference(chapter)} ${chapter.title}`,
      text: chapter.group,
      chapter: chapter.id,
    }));
  if (type === "suggestion")
    return data.suggestions.map((item) => ({
      id: item.id,
      label: item.title,
      text: item.reason,
      chapter: item.operations[0]?.after?.chapter ?? item.operations[0]?.before?.chapter ?? 1,
    }));
  return data.findings.map((item) => ({
    id: item.id,
    label: item.title,
    text: item.requirements.join(" "),
    chapter: data.rules.find((rule) => item.requirements.includes(rule.ref))?.chapter ?? 1,
  }));
};
export const resourceSelection = (
  data: ResourceData | undefined,
  resource: { type: string; id: string } | undefined,
  pageParams: Record<string, unknown>,
) => {
  const spec = resourceSpecs.find((item) => item.id === resource?.type);
  const entry = data && spec ? resourceEntries(data, spec.id).find((item) => item.id === resource?.id) : undefined;
  const review = String(pageParams.review ?? "");
  const section: Section | null =
    spec?.section ?? (["Findings", "Suggestions"].includes(review) ? (review as Section) : null);
  return {
    chapter: entry?.chapter ?? Number(pageParams.chapter ?? 1),
    section,
    focusedId: spec?.section ? resource?.id : undefined,
  };
};
