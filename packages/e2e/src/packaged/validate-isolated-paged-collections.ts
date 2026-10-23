import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { signInBrowser } from "./packaged-serve-helpers";
import { exercisePagedCollections } from "./paged-collections-browser";

const root = resolve(import.meta.dir, "../../../..");
const connection = JSON.parse(
  readFileSync(resolve(root, "__test-tmp__/dev-isolated/pstdio-playwright/connection.json"), "utf8"),
) as { apiPort: number; apiToken: string; dashboardUrl: string };
const api = `http://127.0.0.1:${connection.apiPort}`;
const headers = { authorization: `Bearer ${connection.apiToken}`, "content-type": "application/json" };
const response = await fetch(`${api}/v1/projects`, { headers });
if (!response.ok) throw new Error(`Could not read isolated projects: ${response.status}`);
const projects = await response.json();
const project = (Array.isArray(projects) ? projects : projects.items)[0] as { id: string };
for (let owner = 0; owner < 10; owner++) {
  const response = await fetch(
    `${api}/v1/projects/${project.id}/extensions/commands/example.paged-owner-${owner}.command.seed/execute`,
    { method: "POST", headers, body: JSON.stringify({ params: {} }) },
  );
  const result = await response.json();
  if (!result.outcome?.ok) throw new Error(`Seed owner ${owner} failed: ${JSON.stringify(result)}`);
}
const browser = await chromium.launch(PROVISIONED_CHROMIUM);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (error) => console.error(error.message));
  if (new URL(connection.dashboardUrl).port === String(connection.apiPort))
    await signInBrowser(page, { origin: api, token: connection.apiToken });
  const evidence = await exercisePagedCollections(
    page,
    connection.dashboardUrl.replace(/\/$/, ""),
    project.id,
    async (samples) => {
      await Bun.write(resolve(root, "__test-tmp__/paged-collections-browser.json"), JSON.stringify(samples, null, 2));
      await page.screenshot({ path: resolve(root, "__test-tmp__/paged-collections-board.png") });
    },
    async (rank) => {
      const response = await fetch(
        `${api}/v1/projects/${project.id}/extensions/commands/example.paged-owner-0.command.move/execute`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ params: { id: "row-0000", rank } }),
        },
      );
      if (!(await response.json()).outcome?.ok) throw new Error("Move command failed");
    },
  ).catch(async (error) => {
    await page.screenshot({ path: resolve(root, "__test-tmp__/paged-collections-failure.png") });
    console.error((await page.locator("body").innerText()).slice(0, 12000));
    throw error;
  });
  const path = resolve(root, "__test-tmp__/paged-collections-browser.json");
  await Bun.write(path, JSON.stringify(evidence, null, 2));
  await page.screenshot({ path: resolve(root, "__test-tmp__/paged-collections-final.png") });
  console.log(JSON.stringify({ evidence, path }, null, 2));
} finally {
  await browser.close();
}
