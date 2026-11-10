from pathlib import Path

def replace(path, before, after):
    p = Path(path)
    s = p.read_text()
    assert s.count(before) == 1, (path, before)
    p.write_text(s.replace(before, after))

replace("packages/pstdio-dashboard/src/modules/projects/project-setup-command.ts",
        'import { getApiClient } from "@/lib/api";',
        'import { getApiClient } from "@/lib/api";\nimport { getCollection } from "@/lib/sync/collections";')
replace("packages/pstdio-dashboard/src/modules/projects/project-setup-command.ts",
        "        const client = getApiClient();",
        '        console.info("[cloud-retry] command-entry", JSON.stringify({ projectId, contextProject: context?.projectId }));\n        const client = getApiClient();')
replace("packages/pstdio-dashboard/src/modules/projects/project-setup-command.ts",
        '        if (sync.state !== "local" && !sync.offlineReady) {',
        '        console.info("[cloud-retry] sync-decoded", JSON.stringify({ state: sync.state, offlineReady: sync.offlineReady }));\n        if (sync.state !== "local" && !sync.offlineReady) {')
replace("packages/pstdio-dashboard/src/modules/projects/project-setup-command.ts",
        "          await client.account.retryProjectSync(projectId);",
        '          console.info("[cloud-retry] sync-retry-branch");\n          await client.account.retryProjectSync(projectId);')
replace("packages/pstdio-dashboard/src/modules/projects/project-setup-command.ts",
        "        const projects = client.projects;",
        '        const attached = isProjectWorkspaceAttached(projectId);\n        console.info("[cloud-retry] setup-branch", JSON.stringify({ attached, rows: [...getCollection("workspaces").state.values()].filter(row => row.project_id === projectId).map(row => ({ id: row.id, currentDefault: row.is_default && !row.deleted_at && !row.device, device: row.device, root: row.root_path, providerRef: Boolean(row.provider_ref_json), operation: row.provider_operation_id })) }));\n        const projects = client.projects;')
replace("packages/pstdio-dashboard/src/modules/projects/project-setup-command.ts",
        "        const workspace = isProjectWorkspaceAttached(projectId)",
        "        const workspace = attached")
replace("extensions/pstdio-cloud/src/cloud-project-recovery.tsx",
        "      await client.navigation.open({",
        '      console.info("[cloud-retry] guest-navigation-start");\n      await client.navigation.open({')
replace("extensions/pstdio-cloud/src/cloud-project-recovery.tsx",
        "    } catch (cause) {",
        '      console.info("[cloud-retry] guest-navigation-resolved");\n    } catch (cause) {\n      console.info("[cloud-retry] guest-navigation-rejected", String(cause));')
replace("extensions/pstdio-cloud/src/cloud-project-recovery.tsx",
        "      refresh();",
        '      console.info("[cloud-retry] guest-finally-refresh");\n      refresh();')
replace("packages/pstdio-workbench/src/extensions/bridge/webview-host-capabilities.ts",
        "      open: (target) => {",
        '      open: (target) => {\n        console.info("[cloud-retry] host-navigation", JSON.stringify({ kind: target.kind, projectId, currentProject: workbench.pages.store.getState().projectId, viewer: placement?.placementIdentity, captured: captured.isViewerCurrent?.(), overlay: overlayCurrent?.() }));')
replace("packages/pstdio-workbench/src/core/registries/navigation/navigation-registry.ts",
        "    async openTarget(target, context) {",
        '    async openTarget(target, context) {\n      console.info("[cloud-retry] registry-entry", JSON.stringify({ kind: target.kind, projectId: context?.projectId, currentProject: input.getProjectId?.(), current: context?.isViewerCurrent?.() }));')
replace("packages/e2e/src/packaged/packaged-cloud-project.fixture.ts",
        "    const page = await browser!.newPage();",
        '    const page = await browser!.newPage();\n    page.on("console", (message) => { if (message.text().includes("[cloud-retry]")) console.info(message.text()); });\n    const observedPath = (url: string) => ["/sync", "/retry", "/open", "/retry-setup"].some(end => new URL(url).pathname.endsWith(end));\n    page.on("request", (request) => { if (observedPath(request.url())) console.info("[cloud-retry] request", request.method(), new URL(request.url()).pathname); });\n    page.on("requestfailed", (request) => { if (observedPath(request.url())) console.info("[cloud-retry] request-failed", new URL(request.url()).pathname, request.failure()?.errorText); });')
