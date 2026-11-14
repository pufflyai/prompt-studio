import { expect, test } from "bun:test";
import type { Skill } from "@pstdio/sdk/resources";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "./extension";
import { commands } from "./src/browser";
import { skillInfo } from "./src/skill-content";

const skill: Skill = {
  id: "skill-id",
  project_id: "project",
  name: "review",
  title: "Review",
  description: "Review a change",
  source_kind: "project",
  editable: true,
  files: [
    { path: "SKILL.md", content: "# Review", encoding: "utf8" },
    { path: "references/examples.md", content: "# Examples", encoding: "utf8" },
  ],
  created_at: "",
  updated_at: "",
  deleted_at: null,
};
const context = () =>
  makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: { name: "review" },
    overrides: { skills: { list: async () => [skill] } },
  });

test("opens the skill browser from the project navigation footer", () => {
  expect(extension.navigationItems?.find((item) => item.id === "skills")).toMatchObject({
    slot: "footer",
    owner: { id: "project", extensionId: "pstdio" },
    action: { kind: "page", page: { id: "skills" } },
  });
});

test("opens a project skill from its browser tree and reads its files through the CLI command", async () => {
  const tree = extension.views?.find((view) => view.id === "skill-list")?.body;
  if (tree?.kind !== "tree") throw new Error("Skills need a navigation tree");
  const sections = await tree.body(context());
  expect(sections[0]?.nodes[0]).toMatchObject({
    id: "skill-id",
    label: "Review",
    resource: { id: "skill-id", projectId: "project" },
    target: { kind: "page", page: { id: "skill" }, resource: { id: "skill-id" } },
  });
  const read = extension.commands?.find((command) => command.id === "read");
  expect(read?.cli).toBe(true);
  expect(await commands.read.run(context(), { name: "review" })).toEqual(skill);
});

test("opens each extension's skill when two extensions provide the same name", async () => {
  const duplicate = {
    ...skill,
    id: "other-skill-id",
    source_kind: "extension" as const,
    extension_id: "other.extension",
    files: [{ path: "SKILL.md", content: "# Other review", encoding: "utf8" as const }],
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: {},
    overrides: { skills: { list: async () => [skill, duplicate] } },
  });
  const tree = extension.views?.find((view) => view.id === "skill-list")?.body;
  if (tree?.kind !== "tree") throw new Error("Skills need a navigation tree");
  const sections = await tree.body(ctx);
  const nodes = sections.flatMap((section) => section.nodes);
  expect(nodes.map((node) => node.id)).toEqual([skill.id, duplicate.id]);
  const view = extension.views?.find((view) => view.id === "skill")?.body;
  if (view?.kind !== "file") throw new Error("Skills need a native file view");
  const loaded = await view.load(ctx, { renderer: { rendererId: "skill", resource: nodes[1]!.resource } });
  expect(loaded).toMatchObject({ content: "# Other review" });
  expect(await commands.read.run(ctx, { name: "review" })).toEqual(skill);
});

test("selects the first skill when opening the browser without a selection", async () => {
  expect(await commands.read.run(context(), {})).toEqual(skill);
});

test("reads a supporting file through the native file view using the page route", async () => {
  const view = extension.views?.find((view) => view.id === "skill")?.body;
  if (view?.kind !== "file") throw new Error("Skills need a native file view");
  const loaded = await view.load(context(), {
    renderer: {
      rendererId: "skill",
      resource: { type: "skill", id: "review" },
      pageParams: { file: "references/examples.md" },
    },
  });
  expect(loaded).toMatchObject({ fileName: "references/examples.md", content: "# Examples", editable: false });
});

test("renders metadata as read-only parameters in a collapsible Info section", () => {
  expect(skillInfo(skill, (_key, fallback) => fallback ?? "")).toMatchObject({
    id: "info",
    title: "Info",
    collapsible: true,
    params: [
      { id: "name", name: "Name", type: "text", singleLine: true, defaultValue: "review" },
      { id: "description", name: "Description", type: "text", singleLine: false, defaultValue: "Review a change" },
    ],
  });
});

test("groups skills by source extension display name and keeps project skills separate", async () => {
  const tree = extension.views?.find((view) => view.id === "skill-list")?.body;
  if (tree?.kind !== "tree") throw new Error("Skills need a navigation tree");
  const installed = (id: string, displayName: string) => ({
    id,
    projectId: "project",
    extensionId: id,
    installedExtensionId: id,
    installName: id,
    name: id,
    displayName,
    sourcePath: "/extensions",
    scope: "global" as const,
    status: "loaded" as const,
    enabled: true,
    config: {},
    canUpgrade: false,
    updateAvailable: false,
  });
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: {},
    overrides: {
      skills: {
        list: async () => [
          { ...skill, id: "canvas-id", name: "canvas", source_kind: "extension", extension_id: "pstdio.canvas" },
          skill,
          {
            ...skill,
            id: "ticket-id",
            name: "create-ticket",
            source_kind: "extension",
            extension_id: "pstdio.pstdio-skills",
          },
          {
            ...skill,
            id: "proposal-id",
            name: "create-proposal",
            source_kind: "extension",
            extension_id: "pstdio.pstdio-skills",
          },
        ],
      },
      extensions: {
        list: async () => ({
          marketplace: [],
          extensions: [
            installed("pstdio.canvas", "UI Canvas"),
            installed("pstdio.pstdio-skills", "Prompt Studio Skills"),
          ],
        }),
        install: async () => {},
      },
    },
  });
  const sections = await tree.body(ctx);
  expect(
    sections.map((section) => ({
      label: typeof section.label === "string" ? section.label : section.label?.default,
      names: section.nodes.map((node) => node.resource?.id),
    })),
  ).toEqual([
    { label: "UI Canvas", names: ["canvas-id"] },
    { label: "Project", names: ["skill-id"] },
    { label: "Prompt Studio Skills", names: ["ticket-id", "proposal-id"] },
  ]);
});

test("opens an empty browser when the project has no skills", async () => {
  const empty = makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: {},
    overrides: { skills: { list: async () => [] } },
  });
  expect(await commands.read.run(empty, {})).toBeNull();
});
