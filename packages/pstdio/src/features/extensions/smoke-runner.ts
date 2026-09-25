import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createClient, createRequest } from "@pstdio/sdk/client";
import type { BrowserContext } from "playwright-core";
import { toExtensionEnableInput } from "pstdio-api/extensions/install-extension-source";
import { CLI_VERSION } from "../cli-version";
import { exerciseSmokeDashboard } from "./smoke-browser";
import { finishExtensionSmoke } from "./smoke-cleanup";
import { startSmokeHost } from "./smoke-host";
import { installSmokeSource, SmokeInstallError } from "./smoke-install";
import { createSmokeContext } from "./smoke-isolation";
import type { SmokeResult } from "./smoke-result";

export const runExtensionSmoke = async (input: {
  source: string;
  projectPath?: string;
  keepHome?: boolean;
  signal: AbortSignal;
}) => {
  const result: SmokeResult = {
    host: { version: CLI_VERSION },
    result: "failed",
    exitCode: 0,
    checks: [],
    coverage: { projectContext: input.projectPath ? "fixture" : "scratch", visited: [], unexercised: [], counts: {} },
    durations: {},
  };
  let context: Awaited<ReturnType<typeof createSmokeContext>> | undefined;
  let host: Awaited<ReturnType<typeof startSmokeHost>> | undefined;
  let browser: BrowserContext | undefined;
  let phase = "setup";
  let started = performance.now();
  const next = (name: string) => {
    result.durations[phase] = Math.round(performance.now() - started);
    phase = name;
    started = performance.now();
    process.stderr.write(`Extension smoke: ${name}\n`);
  };
  try {
    const { chromium } = await import("playwright-core");
    const executablePath = chromium.executablePath();
    if (!existsSync(executablePath))
      throw new Error(`Chromium is missing. Run: pst extensions install-browser\nExpected browser: ${executablePath}`);
    context = await createSmokeContext(input);
    const evidence = join(context.root, "evidence");
    mkdirSync(evidence);
    const hostLog = join(evidence, "host.log");
    const browserLog = join(evidence, "browser.jsonl");
    writeFileSync(hostLog, "");
    writeFileSync(browserLog, "");
    if (input.keepHome) result.evidence = { directory: context.root, hostLog, browserLog };
    next("install-check");
    const installed = await installSmokeSource(context, input.signal);
    result.extension = { id: installed.metadata.id, sourceHash: installed.sourceHash };
    result.checks.push({ id: "install-check", status: "passed", extensionId: installed.metadata.id });
    next("host-setup");
    host = await startSmokeHost({
      home: context.home,
      project: context.project,
      env: context.env,
      logPath: hostLog,
      signal: input.signal,
    });
    const client = createClient({ baseUrl: host.origin, token: host.token });
    const project = await client.projects.create({ name: "Extension smoke test" });
    await client.projects.registerRepo(project.id, { name: "smoke-fixture", path: context.project });
    await client.extensions.enableInstalled(project.id, installed.installName, toExtensionEnableInput(installed));
    const request = createRequest({ baseUrl: host.origin, token: host.token });
    const inventory = await request<WorkbenchExtensionMetadata>(`/v1/projects/${project.id}/extensions/ui`, {
      signal: input.signal,
    });
    next("browser-setup");
    browser = await chromium.launchPersistentContext(join(context.root, "browser-profile"), {
      headless: true,
      executablePath,
      env: context.env,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
    result.browser = { name: "chromium", version: browser.browser()!.version() };
    const dashboard = await browser.request.get(host.origin);
    if (!dashboard.ok() || !dashboard.headers()["content-type"]?.includes("text/html"))
      throw new Error(
        "Dashboard assets are missing. Reinstall the packaged CLI, or build the dashboard before running from source.",
      );
    next("dashboard");
    await exerciseSmokeDashboard({
      context: browser,
      origin: host.origin,
      projectId: project.id,
      inventory,
      result,
      logPath: browserLog,
      signal: input.signal,
    });
    if (!result.checks.some((check) => check.id === "runtime-diagnostics" && check.status === "failed"))
      result.checks.push({
        id: "runtime-diagnostics",
        status: "passed",
        message: "No failures observed during the listed initial-load steps.",
      });
  } catch (error) {
    input.signal.throwIfAborted();
    const message = error instanceof Error ? error.message : String(error);
    let exitCode = 3;
    if (error instanceof SmokeInstallError) exitCode = error.exitCode;
    if (phase === "dashboard") exitCode = 1;
    result.exitCode = Math.max(result.exitCode, exitCode);
    result.checks.push({ id: phase === "install-check" ? "install-check" : "setup", status: "failed", phase, message });
  } finally {
    result.durations[phase] = Math.round(performance.now() - started);
    await finishExtensionSmoke({
      root: context?.root,
      keepHome: input.keepHome,
      result,
      closeBrowser: () => browser?.close() ?? Promise.resolve(),
      closeHost: () => host?.close() ?? Promise.resolve(),
    });
  }
  return result;
};
