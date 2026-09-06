import { describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

// The macOS Intel release runner can spend over a minute extracting and loading all bundled core extensions.
const CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT = 120_000;
const REPO_ROOT = join(import.meta.dirname, "../../../..");
const CORE_DEFAULT_EXTENSION_NAMES = [
  "harness-claude-code",
  "harness-codex",
  "harness-open-code",
  "pstdio-base-themes",
  "pstdio-planner",
  "pstdio-reports",
  "pstdio-skills",
];

export const registerCoreDefaultExtensionSmokeTests = () => {
  describe("packaged pstdio — core default extensions", () => {
    test(
      "loads packaged core default extensions",
      async () => {
        const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
        let child: ChildProcess | null = null;
        let closeRegistry: (() => Promise<void>) | null = null;

        try {
          const npmConfigPath = join(tempRoot, ".npmrc");
          const started = await startPackagedServe(tempRoot, {
            NPM_CONFIG_USERCONFIG: npmConfigPath,
            PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
              defaultExtensions: CORE_DEFAULT_EXTENSION_NAMES.map((installName) => ({
                installName,
                source: join(REPO_ROOT, "extensions", installName),
              })),
            }),
          });
          child = started.child;
          const registry = await startLocalWorkspaceRegistry({
            configPath: npmConfigPath,
            outputRoot: tempRoot,
            packagePaths: [join(REPO_ROOT, "packages/sdk"), join(REPO_ROOT, "packages/ui")],
          });
          closeRegistry = registry.close;

          const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
            method: "POST",
            headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
            body: JSON.stringify({ name: "packaged-core-extensions-project" }),
          });
          expect(createRes.status).toBe(201);

          const project = (await createRes.json()) as { extension_warnings?: unknown[]; id: string };
          expect(project.extension_warnings).toBeUndefined();
          const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
            headers: runtimeAuthorization(started.descriptor),
          });
          expect(extensionsRes.status).toBe(200);

          const body = (await extensionsRes.json()) as {
            extensions: Array<{ canUpgrade: boolean; enabled: boolean; installName: string; name: string }>;
          };

          expect(body.extensions).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ enabled: true, installName: "harness-claude-code" }),
              expect.objectContaining({ enabled: true, installName: "harness-codex" }),
              expect.objectContaining({ enabled: true, installName: "harness-open-code" }),
              expect.objectContaining({ enabled: true, installName: "pstdio-base-themes" }),
              expect.objectContaining({ canUpgrade: false, enabled: true, installName: "pstdio-planner" }),
              expect.objectContaining({ enabled: true, installName: "pstdio-reports" }),
              expect.objectContaining({ enabled: true, installName: "pstdio-skills" }),
            ]),
          );

          const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`, {
            headers: runtimeAuthorization(started.descriptor),
          });
          expect(skillsRes.status).toBe(200);
          const skills = (await skillsRes.json()) as Array<{
            files: Array<{ path: string }>;
            name: string;
          }>;
          expect(skills).toContainEqual(
            expect.objectContaining({
              name: "create-pstdio-extension",
              files: expect.arrayContaining([
                expect.objectContaining({ path: "SKILL.md" }),
                expect.objectContaining({ path: "references/extension-api.md" }),
                expect.objectContaining({ path: "references/examples.md" }),
                expect.objectContaining({ path: "references/examples/scribble.ts" }),
                expect.objectContaining({ path: "references/examples/zipline.ts" }),
                expect.objectContaining({ path: "references/examples/pigeon.ts" }),
                expect.objectContaining({ path: "references/examples/controls.ts" }),
                expect.objectContaining({ path: "references/examples/table-navigation.ts" }),
                expect.objectContaining({ path: "references/pages.md" }),
              ]),
            }),
          );

          const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
            headers: runtimeAuthorization(started.descriptor),
          });
          expect(metadataRes.status).toBe(200);
          const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
          expect(metadata.pages).toContainEqual(
            expect.objectContaining({
              extensionId: "pstdio.pstdio-planner",
              localId: "tickets",
              path: "tickets",
            }),
          );
          expect(metadata.pages).toContainEqual(
            expect.objectContaining({
              extensionId: "pstdio.pstdio-planner",
              localId: "ticket",
              path: "ticket",
            }),
          );
          expect(metadata.navigationTrees).toContainEqual(
            expect.objectContaining({
              id: "pstdio.pstdio-planner.navigation-tree.ticket-files",
              owner: expect.objectContaining({ kind: "page", id: "ticket" }),
              slot: "content",
              view: expect.objectContaining({ kind: "view", id: "ticket-files" }),
            }),
          );
          expect(metadata.settingsPanels).toContainEqual(
            expect.objectContaining({ id: "pstdio.pstdio-planner.settings-panel.ticket-tags" }),
          );
          const refineTicket = metadata.commands.find((command) => command.id.endsWith(".command.refine-ticket"));
          expect(refineTicket?.params?.template).toEqual({
            type: "template",
            label: "Ticket template",
            required: false,
            templateType: "pstdio.pstdio-planner.template-type.ticket",
          });
          const tagsRes = await fetch(
            `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/pstdio.pstdio-planner.command.ticket-tag.read/execute`,
            {
              method: "POST",
              headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
              body: JSON.stringify({ source: "api", params: {} }),
            },
          );
          expect(tagsRes.status).toBe(200);
          expect(await tagsRes.json()).toMatchObject({
            outcome: {
              ok: true,
              value: {
                tags: expect.arrayContaining([
                  expect.objectContaining({
                    id: "default-human-requested",
                    options: [
                      expect.objectContaining({ id: "default-human-requested-true", color: "gray", icon: "bell" }),
                    ],
                  }),
                ]),
              },
            },
          });
          const reportType = metadata.templateTypes.find((type) => type.localId === "report");
          expect(reportType?.commands).toEqual(
            expect.objectContaining({
              list: "pstdio.pstdio-reports.command.templates.list",
              read: "pstdio.pstdio-reports.command.templates.read",
              save: "pstdio.pstdio-reports.command.templates.save",
              delete: "pstdio.pstdio-reports.command.templates.delete",
            }),
          );

          const listTemplatesRes = await fetch(
            `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/${encodeURIComponent(reportType!.commands!.list)}/execute`,
            {
              method: "POST",
              headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
              body: JSON.stringify({ source: "api", params: {} }),
            },
          );
          expect(listTemplatesRes.status).toBe(200);
          const listTemplates = (await listTemplatesRes.json()) as {
            outcome: { ok: boolean; value?: Array<{ name: string; type: string }> };
          };
          expect(listTemplates.outcome).toEqual(
            expect.objectContaining({
              ok: true,
              value: expect.arrayContaining([
                expect.objectContaining({ name: "review", type: "report" }),
                expect.objectContaining({ name: "change-request", type: "report" }),
              ]),
            }),
          );
          const settingsPanel = metadata.settingsPanels.find((panel) => panel.view);
          const settingsViewId = settingsPanel
            ? `${settingsPanel.view.extensionId}.view.${settingsPanel.view.id}`
            : undefined;
          const settingsView = metadata.views.find((view) => view.id === settingsViewId);
          const webview = settingsView?.body.kind === "webview" ? settingsView.body.webview : undefined;
          expect(webview?.runtimeUrl).toBeTruthy();

          const runtimeRes = await fetch(`${started.baseUrl}${webview!.runtimeUrl}`, {
            headers: runtimeAuthorization(started.descriptor),
          });
          expect(runtimeRes.status).toBe(200);

          const runtimeScript = await runtimeRes.text();
          expect(runtimeScript).toContain("notification.action");
          expect(runtimeScript).toContain("notification.resolve");
          expect(runtimeScript).toContain("notification.dismiss");
          expect(runtimeScript).toContain("terminal.session");
        } finally {
          if (child) {
            await stopProcess(child);
          }
          if (closeRegistry) {
            await closeRegistry();
          }
          rmSync(tempRoot, { recursive: true, force: true });
        }
      },
      CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT,
    );
  });
};
