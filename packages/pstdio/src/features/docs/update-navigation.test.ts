import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DocsConfig } from "./types";
import { addToNavigation } from "./update-navigation";

let tempDir: string;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

const setup = (config: DocsConfig) => {
  tempDir = mkdtempSync(join(tmpdir(), "nav-test-"));
  writeFileSync(join(tempDir, "navigation.json"), JSON.stringify(config, null, 2));
  return tempDir;
};

const readNav = (dir: string): DocsConfig => JSON.parse(readFileSync(join(dir, "navigation.json"), "utf8"));

describe("addToNavigation", () => {
  test("adds entry to existing group", () => {
    const dir = setup({ sidebar: [{ text: "Prd", items: [] }] });

    addToNavigation(dir, "prd/cli/templates", "CLI Templates");

    const nav = readNav(dir);
    const prd = nav.sidebar[0];
    const cli = prd.items![0];
    expect(cli.text).toBe("Cli");
    expect(cli.items![0]).toEqual({ text: "CLI Templates", link: "/prd/cli/templates" });
  });

  test("creates missing groups", () => {
    const dir = setup({ sidebar: [] });

    addToNavigation(dir, "guides/getting-started", "Getting Started");

    const nav = readNav(dir);
    expect(nav.sidebar[0].text).toBe("Guides");
    expect(nav.sidebar[0].items![0]).toEqual({ text: "Getting Started", link: "/guides/getting-started" });
  });

  test("does not duplicate existing entries", () => {
    const dir = setup({
      sidebar: [{ text: "Prd", items: [{ text: "Existing", link: "/prd/existing" }] }],
    });

    addToNavigation(dir, "prd/existing", "Existing");

    const nav = readNav(dir);
    expect(nav.sidebar[0].items).toHaveLength(1);
  });
});
