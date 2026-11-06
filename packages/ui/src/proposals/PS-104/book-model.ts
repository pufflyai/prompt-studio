import { chapterFixtures } from "./book.fixture";

export type Section = "Findings" | "Undocumented" | "Suggestions";
export interface Acceptance {
  statement: string;
  tests: string[];
}
export interface Rule {
  ref: string;
  chapter: number;
  title: string;
  statement: string;
  acceptance: Acceptance[];
  related: string[];
  section: string;
}
export const chapters = chapterFixtures.map((fixture, index) => ({ ...fixture, id: index + 1 }));
export const chapterGroups = ["Core", "Extensions"];
export const initialRules: Rule[] = chapters.flatMap((chapter) =>
  chapter.topics.map(([title, statement, acceptance], index) => ({
    ref: `RB ${chapter.id}.A.${index + 1}`,
    chapter: chapter.id,
    title,
    statement,
    acceptance: [{ statement: acceptance, tests: [chapter.test] }],
    related: chapter.id === 11 ? ["RB 8.A.2", "RB 19.A.3"] : ["RB 4.A.1"],
    section: index < 2 ? "Behavior" : "Contracts",
  })),
);
export const findRule = (rules: Rule[], ref: string) => rules.find((rule) => rule.ref === ref);
export const saveRule = (rules: Rule[], rule: Rule) =>
  findRule(rules, rule.ref) ? rules.map((item) => (item.ref === rule.ref ? rule : item)) : [...rules, rule];
export const removeRule = (rules: Rule[], ref: string) =>
  rules
    .filter((rule) => rule.ref !== ref)
    .map((rule) => ({ ...rule, related: rule.related.filter((target) => target !== ref) }));
export const ruleSearchEntries = (rules: Rule[]) =>
  rules.map((rule) => ({
    id: rule.ref,
    label: rule.title,
    secondaryLabel: rule.ref,
    searchText: `${rule.statement} ${chapters[rule.chapter - 1].title}`,
    assetType: "requirement",
  }));
export const testSourceHref = (path: string) =>
  `https://github.com/pufflyai/prompt-studio/blob/main/${path.split("/").map(encodeURIComponent).join("/")}`;
