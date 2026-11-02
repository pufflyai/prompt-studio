import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkDocsLinks } from "./docs-links";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const topics = [
  { section: "Guides", label: "SDK", path: "/docs/guides/sdk/", pages: "documentation/guides/sdk" },
  {
    section: "Extensions",
    label: "Planner",
    path: "/docs/extensions/planner/",
    pages: "extensions/pstdio-planner/docs",
    overview: "extensions/pstdio-planner/README.md",
  },
];

const skill = "extensions/pstdio-skills/skills/create-extension";

// A small repository: one published guide, one private PRD, one extension overview, and one skill.
const baseFiles = (): Record<string, string> => ({
  "clients/landing-page/src/content/docs-topics.json": JSON.stringify(topics),
  "documentation/guides/sdk/0001-client.md": "# Client\n\nCreate a client.\n\n## Create a client\n",
  "documentation/requirements/platform/0001-sync.md": "# PRD: Sync\n",
  "extensions/pstdio-planner/README.md":
    "# Planner\n\nPlan work. See the [client](../../documentation/guides/sdk/0001-client.md).\n",
  [`${skill}/SKILL.md`]: "---\nname: create-extension\n---\n# Create\n\nRead [scope](references/scope.md).\n",
  [`${skill}/references/scope.md`]: "# Scope\n\n## Choose a scope\n",
});

const createRepository = (files: Record<string, string>, ignored: string[] = []) => {
  const root = mkdtempSync(join(tmpdir(), "docs-links-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  if (ignored.length > 0) writeFileSync(join(root, ".gitignore"), `${ignored.join("\n")}\n`);
  spawnSync("git", ["init", "-q"], { cwd: root });
  return root;
};

const messages = (root: string) =>
  checkDocsLinks(root).map((problem) => `${problem.file}:${problem.line} ${problem.message}`);

test("a repository with working links passes", () => {
  expect(messages(createRepository(baseFiles()))).toEqual([]);
});

describe("ADR numbering", () => {
  test("different decisions use unique numbers", () => {
    const root = createRepository({
      ...baseFiles(),
      "documentation/adrs/0066-first.md": "# First decision\n",
      "documentation/adrs/0067-next.md": "# Next decision\n",
      "documentation/guides/0066-guide.md": "# Guide\n",
    });

    expect(messages(root)).toEqual([]);
  });

  test("reports decisions that share an ADR number", () => {
    const root = createRepository({
      ...baseFiles(),
      "documentation/adrs/0066-first.md": "# First decision\n",
      "documentation/adrs/0066-other.md": "# Other decision\n",
      "documentation/adrs/0067-next.md": "# Next decision\n",
    });

    expect(messages(root)).toEqual([
      'documentation/adrs/0066-other.md:1 reuses ADR number 0066 from "documentation/adrs/0066-first.md". Use a new number.',
    ]);
  });
});

describe("relative links", () => {
  test("report missing files and missing heading anchors", () => {
    const root = createRepository({
      ...baseFiles(),
      "README.md":
        "# Repo\n\n[Gone](documentation/missing.md)\n[Anchor](documentation/guides/sdk/0001-client.md#nope)\n",
    });

    expect(messages(root)).toEqual([
      'README.md:3 links to "documentation/missing.md", which does not exist.',
      'README.md:4 links to "documentation/guides/sdk/0001-client.md#nope", but that page has no "nope" heading.',
    ]);
  });

  test("check anchors within the same page", () => {
    const root = createRepository({
      ...baseFiles(),
      "documentation/guides/0001-documentation.md": "# Docs\n\n## Start here\n\n[ok](#start-here) [bad](#later)\n",
    });

    expect(messages(root)).toEqual([
      'documentation/guides/0001-documentation.md:5 links to "#later", but that page has no "later" heading.',
    ]);
  });

  test("treat ignored files as missing, because other checkouts do not have them", () => {
    const root = createRepository(
      {
        ...baseFiles(),
        "documentation/guides/sdk/0002-assets.md": "# Assets\n\nSee ![demo](../../images/demo.gif).\n",
        "documentation/images/demo.gif": "GIF",
      },
      ["documentation/images/demo.gif"],
    );

    expect(messages(root)).toEqual([
      'documentation/guides/sdk/0002-assets.md:3 links to "../../images/demo.gif", which does not exist.',
    ]);
  });
});

describe("public pages", () => {
  test("must not link to private documentation", () => {
    const root = createRepository({
      ...baseFiles(),
      "documentation/guides/sdk/0002-sync.md": "# Sync\n\nRead the [PRD](../../requirements/platform/0001-sync.md).\n",
    });

    expect(messages(root)).toEqual([
      'documentation/guides/sdk/0002-sync.md:3 links to private documentation "documentation/requirements/platform/0001-sync.md". Public pages and skills must not depend on it.',
    ]);
  });

  test("may cite an ADR for the reason behind a decision", () => {
    const root = createRepository({
      ...baseFiles(),
      "documentation/adrs/0047-versioning.md": "# ADR: Versioning\n",
      "documentation/guides/sdk/0002-versions.md": "# Versions\n\nWhy: [ADR 0047](../../adrs/0047-versioning.md).\n",
    });

    expect(messages(root)).toEqual([]);
  });

  test("private pages may link to each other", () => {
    const root = createRepository({
      ...baseFiles(),
      "documentation/requirements/platform/0002-more.md": "# More\n\nSee [sync](0001-sync.md).\n",
    });

    expect(messages(root)).toEqual([]);
  });
});

describe("website and GitHub links", () => {
  test("must point to published routes and existing headings", () => {
    const root = createRepository({
      ...baseFiles(),
      "documentation/guides/sdk/0002-links.md": [
        "# Links",
        "",
        "[ok](https://prompt.studio/docs/guides/sdk/client/#create-a-client)",
        "[no slash](https://prompt.studio/docs/extensions/planner)",
        "[home](https://prompt.studio/docs/)",
        "[gone](https://prompt.studio/docs/guides/sdk/missing/)",
        "[bad anchor](https://prompt.studio/docs/guides/sdk/client/#nope)",
        "[repo](https://github.com/pufflyai/prompt-studio/blob/main/documentation/guides/sdk/0001-client.md#create-a-client)",
        "[repo gone](https://github.com/pufflyai/prompt-studio/tree/main/extensions/missing)",
      ].join("\n"),
    });

    expect(messages(root)).toEqual([
      'documentation/guides/sdk/0002-links.md:6 links to "https://prompt.studio/docs/guides/sdk/missing/", which the website does not publish.',
      'documentation/guides/sdk/0002-links.md:7 links to "https://prompt.studio/docs/guides/sdk/client/#nope", but that page has no "nope" heading.',
      'documentation/guides/sdk/0002-links.md:9 links to "https://github.com/pufflyai/prompt-studio/tree/main/extensions/missing", which does not exist.',
    ]);
  });
});

describe("exported skills", () => {
  test("a link that leaves the skill folder breaks when the skill is copied alone", () => {
    const files = baseFiles();
    files[`${skill}/SKILL.md`] += "Read the [client guide](../../../../documentation/guides/sdk/0001-client.md).\n";
    const root = createRepository(files);

    expect(messages(root)).toEqual([
      `${skill}/SKILL.md:7 links to "../../../../documentation/guides/sdk/0001-client.md", outside the skill folder. Exported skills contain only their own folder; use a https://prompt.studio/docs/ link.`,
    ]);
  });

  test("a referenced asset that is not exported is reported, then passes once it ships", () => {
    const files = baseFiles();
    files[`${skill}/SKILL.md`] += "Copy [the example](references/examples/pigeon.ts).\n";
    const missing = createRepository(files);
    expect(messages(missing)).toEqual([
      `${skill}/SKILL.md:7 links to "references/examples/pigeon.ts", which the exported skill does not contain.`,
    ]);

    const ignored = createRepository({ ...files, [`${skill}/references/examples/pigeon.ts`]: "export {};\n" }, [
      "*.ts",
    ]);
    expect(messages(ignored)).toEqual([
      `${skill}/SKILL.md:7 links to "references/examples/pigeon.ts", which the exported skill does not contain.`,
    ]);

    const fixed = createRepository({ ...files, [`${skill}/references/examples/pigeon.ts`]: "export {};\n" });
    expect(messages(fixed)).toEqual([]);
  });

  test("symbolic links are not exported", () => {
    const files = baseFiles();
    files[`${skill}/SKILL.md`] += "Read [shared](references/shared.md).\n";
    const root = createRepository(files);
    symlinkSync("scope.md", join(root, skill, "references/shared.md"));

    expect(messages(root)).toEqual([
      `${skill}/SKILL.md:7 links to "references/shared.md", which the exported skill does not contain.`,
    ]);
  });

  test("links to private documentation are reported even as GitHub URLs", () => {
    const files = baseFiles();
    files[`${skill}/references/scope.md`] +=
      "See https://github.com/pufflyai/prompt-studio/blob/main/documentation/requirements/platform/0001-sync.md\n";
    const root = createRepository(files);

    expect(messages(root)).toEqual([
      `${skill}/references/scope.md:4 links to private documentation "documentation/requirements/platform/0001-sync.md". Public pages and skills must not depend on it.`,
    ]);
  });

  test("binary files cannot be exported, because skills are copied as text", () => {
    const root = createRepository({ ...baseFiles(), [`${skill}/assets/logo.png`]: "\u0000\u0001PNG" });

    expect(messages(root)).toEqual([
      `${skill}/assets/logo.png:1 is not UTF-8 text. Skill files are exported as text, so this file would be corrupted.`,
    ]);
  });
});

test("the published allow-list must not include private folders or ADRs", () => {
  const privateTopic = (folder: string) => ({
    section: "References",
    label: folder,
    path: `/docs/${folder}/`,
    pages: folder,
  });
  const root = createRepository({
    ...baseFiles(),
    "clients/landing-page/src/content/docs-topics.json": JSON.stringify([
      ...topics,
      privateTopic("documentation/references/architecture"),
      privateTopic("documentation/adrs"),
    ]),
  });

  expect(messages(root)).toEqual([
    'clients/landing-page/src/content/docs-topics.json:1 publishes "documentation/references/architecture", which the website must not publish.',
    'clients/landing-page/src/content/docs-topics.json:1 publishes "documentation/adrs", which the website must not publish.',
  ]);
});
