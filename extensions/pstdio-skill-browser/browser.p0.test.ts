import { expect, test } from "bun:test";
import type { Skill } from "@pstdio/sdk/resources";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "./extension";
import { commands } from "./src/browser";

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
    label: "Review",
    resource: { id: "review", projectId: "project" },
    target: { kind: "page", page: { id: "skill" }, resource: { id: "review" } },
  });
  const read = extension.commands?.find((command) => command.id === "read");
  expect(read?.cli).toBe(true);
  expect(await commands.read.run(context(), { name: "review" })).toEqual(skill);
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

test("keeps Info and Files in one native attached menu and selects the routed file", async () => {
  const view = extension.views?.find((view) => view.id === "skill-details")?.body;
  if (view?.kind !== "tree") throw new Error("Skills need a native details tree");
  const sections = await view.body(context(), {
    renderer: {
      rendererId: "skill-details",
      resource: { type: "skill", id: "review" },
      pageParams: { file: "references/examples.md" },
    },
  });
  expect(sections.map((section) => section.id)).toEqual(["info", "files"]);
  const directory = sections[1]?.nodes.find((node) => node.id === "dir:references");
  expect(directory?.children?.[0]).toMatchObject({
    selected: true,
    target: { kind: "page", page: { id: "skill" }, params: { file: "references/examples.md" } },
  });
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
