import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findReferenceGaps, readContractGroups } from "./docs-sdk-reference";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const writeTree = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "sdk-reference-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
};

const declarations = `
interface ProjectClient {
  list(): Promise<string[]>;
  get(id: string): Promise<string>;
  archive: (id: string) => Promise<void>;
  /** @deprecated Use archive. */
  remove(id: string): Promise<void>;
  readonly count: number;
}
interface SessionClient { create(): Promise<void>; followUp(): Promise<void> }
export type PstdioClient = {
  projects: ProjectClient;
  sessions?: SessionClient;
  version: string;
  navigation: { open(target: string): void };
  mount: HTMLElement;
};
`;

describe("public contract", () => {
  test("lists groups and their methods, without data fields, platform types, or deprecated methods", () => {
    const root = writeTree({ "client.d.ts": declarations });

    expect(readContractGroups(join(root, "client.d.ts"), "PstdioClient")).toEqual([
      { group: "projects", type: "ProjectClient", methods: ["list", "get", "archive"] },
      { group: "sessions", type: "SessionClient", methods: ["create", "followUp"] },
      { group: "navigation", methods: ["open"] },
    ]);
  });

  test("reads groups whose type combines other types", () => {
    const root = writeTree({
      "client.d.ts": `
declare const createQueries: () => { query(): Promise<string[]> };
type SessionClient = ReturnType<typeof createQueries> & { create(): Promise<void> };
export type PstdioClient = { sessions: SessionClient };
`,
    });

    expect(readContractGroups(join(root, "client.d.ts"), "PstdioClient")).toEqual([
      { group: "sessions", type: "SessionClient", methods: ["query", "create"] },
    ]);
  });
});

describe("reference coverage", () => {
  const groups = [
    { group: "projects", methods: ["list", "get", "archive"] },
    { group: "sessions", methods: ["create", "followUp"] },
  ];

  test("reports a method missing from its group's row, even when another group documents that name", () => {
    const reference = [
      "# Method reference",
      "",
      "| Group | Methods |",
      "| --- | --- |",
      "| `projects` | `list`, `get` |",
      "| `sessions` | `create`, `followUp`, `archive` |",
    ].join("\n");

    expect(findReferenceGaps("client", groups, [reference])).toEqual(["client.projects.archive"]);
  });

  test("accepts a group section or a qualified call in an example", () => {
    const reference = [
      "## Projects",
      "Use `client.projects` to `list`, `get`, and `archive` projects.",
      "## Follow-ups",
      "```ts",
      "await client.sessions.create();",
      "await client.sessions.followUp();",
      "```",
    ].join("\n");

    expect(findReferenceGaps("client", groups, [reference])).toEqual([]);
  });

  test("accepts methods documented on the group's named type", () => {
    const mounts = [{ group: "projectFiles", type: "ArtifactMount", methods: ["readText"] }];
    const reference =
      "## File mounts\n`ctx.projectFiles` is an `ArtifactMount`.\n## `ArtifactMount`\nCall `readText(path)`.";

    expect(findReferenceGaps("ctx", mounts, [reference])).toEqual([]);
  });

  test("reports a whole group once when the reference never mentions it", () => {
    expect(findReferenceGaps("client", groups, ["| `projects` | `list`, `get`, `archive` |"])).toEqual([
      "client.sessions (create, followUp)",
    ]);
  });

  test("ignores names that only appear in prose", () => {
    expect(findReferenceGaps("client", groups.slice(0, 1), ["Projects can list, get, and archive items."])).toEqual([
      "client.projects (list, get, archive)",
    ]);
  });
});
