import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { sessionBrowser, sessionBrowserId } from "@pstdio/sdk/extensions";
import { loadExtensionSources } from "./loader";
import { normalizeExtensionSources } from "./normalize";

test("the production Sessions provider normalizes native chat, shared Side and public navigation refs", async () => {
  const loaded = await loadExtensionSources({
    extensionPackages: [
      { path: resolve(import.meta.dir, "../../../../extensions/pstdio-session-browser"), sourceKind: "local_path" },
    ],
  });
  const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
  expect(runtime.diagnostics).toEqual([]);
  expect(runtime.extensions.map((extension) => extension.id)).toEqual([sessionBrowserId]);
  expect(runtime.views.find((view) => view.localId === "conversation")?.contribution.body.kind).toBe("chat");
  expect(runtime.pages.find((page) => page.localId === "conversation")?.contribution).toMatchObject({
    main: { view: sessionBrowser.views.conversation },
    panelView: sessionBrowser.panels.conversation,
  });
  expect(runtime.placements.find((placement) => placement.localId === "conversation")?.contribution).toMatchObject({
    region: "side",
    item: { kind: "binding", binding: { view: sessionBrowser.views.conversation } },
  });
  expect(runtime.navigationItems).toHaveLength(1);
  expect(runtime.commandPaletteResources).toHaveLength(1);
});
