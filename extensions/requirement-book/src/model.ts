import { z } from "zod";
import { contentJson } from "./content";

export const BOOK_PATH = "documentation/requirement-book/book.json";
export const chapterSchema = z
  .object({ id: z.number().int().positive(), title: z.string().trim().min(1), group: z.enum(["Core", "Extensions"]) })
  .strict();
export const ruleSchema = z
  .object({
    ref: z.string().regex(/^RBE? \d+\.[A-Z]+\.[a-zA-Z0-9]+$/),
    chapter: z.number().int().positive(),
    title: z.string().trim().min(1),
    level: z.number().int().min(0).max(3),
    statement: z.string().trim().min(1),
    rationale: z.string().default(""),
    status: z.enum(["accepted", "proposed"]),
    section: z.string().default("Behavior"),
    acceptance: z.array(z.object({ statement: z.string().trim().min(1), tests: z.array(z.string()) })),
    related: z.array(z.string()),
    governing: z.array(z.string()).default([]),
  })
  .strict();
export const bookSchema = z
  .object({
    version: z.literal(1),
    chapters: z.array(chapterSchema),
    rules: z.array(ruleSchema),
    retired: z.array(z.string()),
  })
  .strict();
export type Rule = z.infer<typeof ruleSchema>;
export type Book = z.infer<typeof bookSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export const chapterPrefix = (chapter: Chapter) => (chapter.group === "Extensions" ? "RBE" : "RB");
export const chapterReference = (chapter: Chapter) => `${chapterPrefix(chapter)}${chapter.id}`;
export const createRuleReference = (chapter: Chapter) =>
  `${chapterPrefix(chapter)} ${chapter.id}.A.${crypto.randomUUID().replaceAll("-", "")}`;
export type Section = "Findings" | "Undocumented" | "Suggestions";
export const operationSchema = z
  .object({
    type: z.enum(["ADD", "AMEND", "REMOVE", "MOVE"]),
    before: ruleSchema.nullable(),
    after: ruleSchema.nullable(),
  })
  .strict();
export type Operation = z.infer<typeof operationSchema>;
export const findRule = (rules: Rule[], ref: string) => rules.find((rule) => rule.ref === ref);
export const sameRule = (left: Rule | undefined | null, right: Rule | undefined | null) =>
  contentJson(left) === contentJson(right);
export const emptyBook = () => ({
  version: 1 as const,
  chapters: [] as Chapter[],
  rules: [] as Rule[],
  retired: [] as string[],
});

export const bookIssues = (book: Book) => {
  const issues: string[] = [];
  const refs = new Set<string>();
  const chapters = new Set(book.chapters.map((x) => x.id));
  if (chapters.size !== book.chapters.length) issues.push("Duplicate chapter identities.");
  for (const rule of book.rules) {
    if (refs.has(rule.ref) || book.retired.includes(rule.ref))
      issues.push(`${rule.ref}: duplicate or retired identity.`);
    refs.add(rule.ref);
    const chapter = book.chapters.find((item) => item.id === rule.chapter);
    if (!chapter) issues.push(`${rule.ref}: unknown chapter.`);
    else if (!rule.ref.startsWith(`${chapterPrefix(chapter)} `))
      issues.push(
        `${rule.ref}: ${chapter.group} chapters require the ${chapterPrefix(chapter)} prefix; move within the same group to preserve identity.`,
      );
    for (const ref of [...rule.related, ...rule.governing])
      if (ref === rule.ref || !findRule(book.rules, ref)) issues.push(`${rule.ref}: unresolved reference ${ref}.`);
  }
  return issues;
};
const applyUnchecked = (book: Book, operations: Operation[]) => {
  let rules = book.rules;
  const retired = [...book.retired];
  for (const operation of operations) {
    if (operation.type === "REMOVE") {
      rules = rules.filter((rule) => rule.ref !== operation.before?.ref);
      if (operation.before) retired.push(operation.before.ref);
    } else if (operation.after) {
      const after = operation.after;
      rules = findRule(rules, after.ref)
        ? rules.map((rule) => (rule.ref === after.ref ? after : rule))
        : [...rules, after];
    }
  }
  return { ...book, rules, retired: [...new Set(retired)] };
};
const targetIssues = (book: Book, operation: Operation) => {
  const ref = operation.after?.ref ?? operation.before?.ref ?? "";
  if (operation.type === "ADD") {
    if (operation.before || !operation.after) return [`${ref}: invalid ADD.`];
    if (book.retired.includes(ref)) return [`${ref}: identity is retired.`];
    if (findRule(book.rules, ref)) return [`${ref}: identity already exists.`];
    return [];
  }
  if (!operation.before) return [`${ref}: prior content is required.`];
  if (!sameRule(findRule(book.rules, operation.before.ref), operation.before))
    return [`${ref}: target changed. Reconcile against its current content.`];
  if (operation.type === "REMOVE") return operation.after ? [`${ref}: REMOVE has no after content.`] : [];
  if (operation.after?.ref !== operation.before.ref) return [`${ref}: preserve identity.`];
  if (
    operation.type === "MOVE" &&
    !sameRule(operation.before, { ...operation.after, chapter: operation.before.chapter })
  )
    return [`${ref}: MOVE preserves all content except placement.`];
  return [];
};
export const operationIssues = (book: Book, operations: Operation[]) => {
  const parsed = z.array(operationSchema).safeParse(operations);
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const refs = operations.map((op) => op.after?.ref ?? op.before?.ref);
  const duplicates = refs
    .filter((ref, index) => refs.indexOf(ref) !== index)
    .map((ref) => `${ref}: overlapping operations.`);
  return [
    ...new Set([
      ...duplicates,
      ...operations.flatMap((op) => targetIssues(book, op)),
      ...bookIssues(applyUnchecked(book, operations)),
    ]),
  ];
};
export const applyOperations = (book: Book, operations: Operation[]) => {
  const issues = operationIssues(book, operations);
  if (issues.length) throw new Error(issues.join("\n"));
  return bookSchema.parse(applyUnchecked(book, operations));
};
export const reconcileOperations = (book: Book, operations: Operation[]) =>
  operations.map((operation) => {
    if (operation.type === "ADD") return operation;
    const before = findRule(book.rules, operation.before!.ref);
    if (!before) throw new Error("The target was removed. Prepare a new change.");
    const after = operation.type === "MOVE" ? { ...before, chapter: operation.after!.chapter } : operation.after;
    return { ...operation, before, after };
  });
export const removalOperations = (book: Book, target: Rule) => [
  { type: "REMOVE" as const, before: target, after: null },
  ...book.rules
    .filter((rule) => rule.related.includes(target.ref) || rule.governing.includes(target.ref))
    .map((before) => ({
      type: "AMEND" as const,
      before,
      after: {
        ...before,
        related: before.related.filter((ref) => ref !== target.ref),
        governing: before.governing.filter((ref) => ref !== target.ref),
      },
    })),
];
export const serializeBook = (book: Book) => `${JSON.stringify(book, null, 2)}\n`;
export const parseBook = (content: string) => {
  const book = bookSchema.parse(JSON.parse(content));
  const issues = bookIssues(book);
  if (issues.length) throw new Error(issues.join("\n"));
  return book;
};
