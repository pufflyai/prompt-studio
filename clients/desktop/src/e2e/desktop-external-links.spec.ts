import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { _electron as electron, expect, test } from "@playwright/test";
import { removeTestDirectory } from "../testing/remove-test-directory";

const require = createRequire(import.meta.url);

test("opens chat website links in the external browser without creating app windows", async () => {
  const root = resolve("test-results/external-links");
  mkdirSync(root, { recursive: true });
  const entry = resolve(root, "main.mjs");
  const build = spawnSync("bun", [
    "build",
    resolve(import.meta.dirname, "external-links-fixture.ts"),
    "--outfile",
    entry,
    "--target=node",
    "--format=esm",
    "--external=electron",
  ]);
  expect(build.status, build.stderr.toString()).toBe(0);
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({
    executablePath: require("electron") as string,
    args: [entry, `--user-data-dir=${resolve(root, "profile")}`],
    env,
  });
  const opened: string[] = [];
  const output = createInterface({ input: application.process().stdout! });
  output.on("line", (line) => {
    if (line.startsWith("opened-external:")) opened.push(line.slice("opened-external:".length));
  });
  try {
    const page = await application.firstWindow();
    for (const url of [
      "https://example.com/docs",
      "http://example.com/docs",
      "http://localhost:3000/preview",
      "https://example.com:8443/docs",
    ]) {
      await page.evaluate((href) => {
        document.body.innerHTML = `<a href="${href}" target="_blank" rel="noopener noreferrer">Website</a>`;
      }, url);
      await page.getByRole("link", { name: "Website" }).click();
      await expect.poll(() => opened.at(-1)).toBe(url);
      await page.evaluate((href) => window.open(href, "_blank"), url);
      await expect.poll(() => opened.filter((value) => value === url).length).toBe(2);
    }
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    expect(page.url()).toBe("data:text/html,<main>Chat links</main>");
  } finally {
    output.close();
    await application.close();
    await removeTestDirectory(root);
  }
});
