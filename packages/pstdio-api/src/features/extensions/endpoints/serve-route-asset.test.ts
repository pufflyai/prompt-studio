import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;

const FIXTURE_SOURCE = `export default {
  id: "pstdio.lab",
  namespace: "lab",
  name: "Lab",
  routes: {
    labPage: {
      path: "lab",
      label: "Lab",
      webview: {
        entry: {
          kind: "package-asset",
          path: "./dist/lab-page.html",
          baseUrl: import.meta.url,
        },
      },
    },
  },
};`;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-route-asset-test-"));
  const homeRoot = join(tempRoot, "home");
  const labDir = join(homeRoot, "extensions", "lab");
  mkdirSync(join(labDir, "dist"), { recursive: true });
  writeFileSync(join(labDir, "extension.ts"), FIXTURE_SOURCE);
  writeFileSync(join(labDir, "dist", "lab-page.html"), '<script type="module" src="./lab-page.js"></script>');
  writeFileSync(join(labDir, "dist", "lab-page.js"), 'document.body.textContent = "lab";');

  process.env.PSTDIO_HOME = homeRoot;

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(async () => {
  delete process.env.PSTDIO_HOME;
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/extensions/routes/:routeId/assets/*", () => {
  test("serves files next to a route webview entry", async () => {
    const html = await app.request("/v1/extensions/routes/lab.labPage/assets/lab-page.html");
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(await html.text()).toContain("lab-page.js");

    const script = await app.request("/v1/extensions/routes/lab.labPage/assets/lab-page.js");
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("application/javascript");
    expect(await script.text()).toContain("document.body");
  });
});
