import { expect, test } from "bun:test";
import { type ChildProcess, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary, runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const extensionId = "pstdio.extension-lab";
const repo = resolve(import.meta.dir, "../../../..");
const extension = join(repo, "extensions", "extension-lab");
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("published Marmalade dependencies deliver authored SVG through the native document menu", async () => {
  const home = await mkdtemp(join(tmpdir(), "marmalade-published-export-"));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  let failed = false;
  try {
    buildBinary();
    const source = join(home, "source");
    const projectFolder = join(home, "project");
    await mkdir(projectFolder);
    await cp(extension, source, {
      recursive: true,
      filter: (path) => !["node_modules", "dist", "test-results"].includes(basename(path)),
    });
    // The owning runner also tests a source package registry. Use a private public-registry
    // config and the committed extension lockfile for this independent consumer.
    const npmConfig = join(home, ".npmrc");
    await writeFile(npmConfig, "registry=https://registry.npmjs.org/\n@pstdio:registry=https://registry.npmjs.org/\n");
    const env = {
      HOME: home,
      PSTDIO_HOME: home,
      NPM_CONFIG_USERCONFIG: npmConfig,
      BUN_CONFIG_REGISTRY: "https://registry.npmjs.org/",
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
    };
    const runtime = await startPackagedServe(home, env);
    child = runtime.child;
    const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Marmalade export qualification" }, projectFolder)),
    });
    expect(created.status).toBe(201);
    const { id: projectId } = (await created.json()) as { id: string };
    await runPackagedAsync(["extensions", "add", source, "--name", "extension-lab"], projectFolder, env, 90_000);
    const installed = join(home, "extensions", "extension-lab");
    const manifest = await Bun.file(join(source, "package.json")).json();
    const versions: Record<string, string> = {};
    for (const name of ["@pstdio/sdk", "@pstdio/ui"]) {
      const dependency = await realpath(join(installed, "node_modules", name));
      expect(dependency.startsWith(installed + sep)).toBe(true);
      const resolved = await Bun.file(join(dependency, "package.json")).json();
      expect(resolved.version).toBe(manifest.dependencies[name]);
      expect(resolved.version).toMatch(/-preview\.sha-[a-f0-9]{40}$/);
      if (name === "@pstdio/sdk") expect(resolved.pstdio.extensionApiVersion).toBe("0.5.1");
      else expect(resolved.dependencies["@pstdio/sdk"]).toBe(versions["@pstdio/sdk"]);
      versions[name] = resolved.version;
    }
    console.log(JSON.stringify({
      sourceRevision: execFileSync("git", ["rev-parse", "HEAD^"], { cwd: repo, encoding: "utf8" }).trim(),
      extensionLockSha256: digest(await readFile(join(source, "bun.lock"))),
      versions,
    }));
    const execute = async (command: string, params: object) => {
      const response = await fetch(
        `${runtime.baseUrl}/v1/projects/${projectId}/extensions/commands/${extensionId}.command.marmalade.${command}/execute`,
        { method: "POST", headers, body: JSON.stringify({ source: "api", params }) },
      );
      expect(response.ok).toBe(true);
      const { outcome } = await response.json() as { outcome: { status: string; value: unknown; reason?: string } };
      expect(outcome.status, outcome.reason).toBe("success");
      return outcome.value;
    };
    for (const action of [
      { type: "visibility", id: "credit", visible: false },
      { type: "properties", id: "title", changes: { rotation: 10 } },
      { type: "adjustments", id: "artwork", changes: { saturation: 0 } },
      { type: "viewport", zoom: 2, pan: { x: 75, y: 95 } },
    ]) await execute("edit", { action });

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ acceptDownloads: true });
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, projectId);
    await signInBrowser(page, runtime.descriptor);
    const resource = `pstdio://extension-resource/marmalade.document/great-wave?extensionId=${extensionId}&projectId=${projectId}`;
    await page.goto(
      `${runtime.baseUrl}/projects/${projectId}/extensions/${extensionId}/marmalade/resource?resource=${encodeURIComponent(resource)}`,
    );
    const canvas = page.frameLocator('iframe[title="Great Wave"]');
    await browserExpect(canvas.getByRole("application", { name: "Marmalade document canvas" })).toBeVisible();
    const inspector = page.frameLocator('iframe[title="Properties and layers"]');
    await inspector.getByRole("textbox", { name: "Layer text", exact: true }).fill("Wave < Våg & foam");
    const exportFromMenu = async () => {
      const actions = page.getByRole("button", { name: "Document actions", exact: true });
      const item = page.getByRole("menuitem", { name: "Export SVG", exact: true });
      await browserExpect(async () => {
        if (!(await item.isVisible())) await actions.click();
        await browserExpect(item).toBeVisible({ timeout: 750 });
      }).toPass({ timeout: 20_000 });
      await item.click();
    };
    const downloaded = page.waitForEvent("download");
    await exportFromMenu();
    const file = await downloaded;
    await browserExpect(canvas.getByRole("status")).toHaveText("Download started");
    expect(file.suggestedFilename()).toBe("great-wave.svg");
    expect(await file.failure()).toBeNull();
    const svg = await readFile((await file.path())!, "utf8");
    const exported = await execute("export", { documentId: "great-wave" }) as { fileName: string; mimeType: string; svg: string };
    expect(exported.fileName).toBe(file.suggestedFilename());
    expect(exported.mimeType).toBe("image/svg+xml");
    expect(digest(svg)).toBe(digest(exported.svg));
    const authored = await page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
      return {
        error: doc.querySelector("parsererror")?.textContent ?? null,
        viewBox: doc.documentElement.getAttribute("viewBox"),
        imageCount: doc.querySelectorAll("image").length,
        image: doc.querySelector("image")?.getAttribute("href"),
        text: doc.querySelector("text")?.textContent,
        transform: doc.querySelector("text")?.parentElement?.getAttribute("transform"),
        saturation: doc.querySelector("feColorMatrix")?.getAttribute("values"),
      };
    }, svg);
    expect(authored.error).toBeNull();
    expect(authored.viewBox).toBe("0 0 1200 810");
    expect(authored.imageCount).toBe(1);
    expect(authored.image?.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(digest(Buffer.from(authored.image!.split(",")[1]!, "base64")))
      .toBe(digest(await readFile(join(source, "assets", "great-wave.jpg"))));
    expect(authored.text).toBe("Wave < Våg & foam");
    expect(authored.transform).toBe("translate(85 620) rotate(10 315 27)");
    expect(authored.saturation).toBe("0");
    expect(svg.includes("Katsushika Hokusai")).toBe(false);
    expect(svg.includes("scale(2)")).toBe(false);

    await page.evaluate(() => {
      let calls = 0;
      const deliveries: { name: string; mimeType: string; data: string }[] = [];
      Object.assign(globalThis, {
        exportQualificationDeliveries: deliveries,
        promptStudioDesktop: {
          saveFile: async (input: { name: string; mimeType: string; data: Uint8Array }) => {
            calls++;
            deliveries.push({ name: input.name, mimeType: input.mimeType, data: new TextDecoder().decode(input.data) });
            if (calls === 1) return { status: "cancelled" };
            if (calls === 2) throw new Error("Controlled device write failure");
            return { status: "saved" };
          },
        },
      });
    });
    await exportFromMenu();
    await browserExpect(canvas.getByRole("status")).toHaveText("Export cancelled");
    await exportFromMenu();
    await browserExpect(canvas.getByText("Could not export SVG", { exact: true })).toBeVisible();
    await canvas.getByRole("button", { name: "Retry", exact: true }).click();
    await browserExpect(canvas.getByRole("status")).toHaveText("SVG saved");
    const deliveries = await page.evaluate(() => (globalThis as unknown as {
      exportQualificationDeliveries: { name: string; mimeType: string; data: string }[];
    }).exportQualificationDeliveries);
    expect(deliveries.map(({ name, mimeType, data }) => [name, mimeType, digest(data)]))
      .toEqual(Array.from({ length: 3 }, () => ["great-wave.svg", "image/svg+xml", digest(svg)]));
    const evidence = join(repo, "packages", "e2e", "test-results", "marmalade-export-qualification");
    await mkdir(evidence, { recursive: true });
    await writeFile(join(evidence, file.suggestedFilename()), svg);
    console.log(`Published Marmalade browser export and controlled native outcomes passed. SVG SHA-256 ${digest(svg)}.`);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    const errors: unknown[] = [];
    try {
      await browser?.close();
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        if (child) await stopProcess(child);
      } catch (error) {
        errors.push(error);
      } finally {
        await rm(home, { recursive: true, force: true }).catch((error) => errors.push(error));
      }
    }
    if (errors.length) {
      const cleanup = new AggregateError(errors, "Marmalade qualification fixture cleanup failed");
      if (!failed) throw cleanup;
      console.error(cleanup);
    }
  }
}, 150_000);
