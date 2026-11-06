import type { Section } from "./book-model";

export interface ReviewItem {
  id: string;
  section: Section;
  kind: string;
  palette: string;
  title: string;
  summary: string;
  evidence: string;
  requirements: string[];
  tests: string[];
  action: string;
}
export const reviewItems: ReviewItem[] = [
  {
    id: "F-1",
    section: "Findings",
    kind: "Potential conflict",
    palette: "orange",
    title: "Persistence may block typing",
    summary:
      "Saving on every edit could compete with local typing. The save policy and synchronization contract need to be reviewed together.",
    evidence:
      "Source inspection found a persistence request on each edit. No executed timing measurement is attached, so this is a potential conflict rather than a demonstrated violation.",
    requirements: ["RB 11.A.1", "RB 8.A.2"],
    tests: ["extensions/pstdio-notes/src/text-source.p0.test.ts"],
    action: "Review save policy",
  },
  {
    id: "F-2",
    section: "Findings",
    kind: "Stale evidence",
    palette: "orange",
    title: "Recovery evidence needs rechecking",
    summary:
      "The retained recovery observation predates the latest notes update. It cannot establish the current recovery behavior.",
    evidence:
      "The recovery path changed after the observation was recorded. Reinspect the current source and attach a fresh test result before using it as evidence.",
    requirements: ["RB 11.A.5"],
    tests: ["extensions/pstdio-notes/src/text-source.p0.test.ts"],
    action: "Review recovery rule",
  },
];
export const unreadCounts = (readIds: string[], records: { id: string; section: Section }[] = reviewItems) => {
  const counts: Record<Section, number> = { Findings: 0, Undocumented: 0, Suggestions: 0 };
  for (const item of records) if (!readIds.includes(item.id)) counts[item.section] += 1;
  return counts;
};
