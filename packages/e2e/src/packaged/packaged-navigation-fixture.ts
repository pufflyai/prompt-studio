import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeNavigationExtension = (root: string) => {
  const source = join(root, "extension-sources", "navigation-probe");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "navigation-probe",
      version: "1.0.0",
      publisher: "test",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default {
      modes: [{ id: "policy", ref: { kind: "mode", id: "policy" }, label: "Policy", basePage: { kind: "page", id: "home" }, regions: ["main", "side", "secondary"], regionSettings: { side: { canOpen: true, canClose: false, acceptsTabs: true, resizable: false, floatable: false } } }],
      resourceKinds: [{ id: "record", ref: { kind: "resource-kind", id: "record" } }],
      views: [{ id: "document", ref: { kind: "view", id: "document" }, title: "Document", instancePolicy: "per-resource", body: { kind: "file", resourceKind: { kind: "resource-kind", id: "record" }, load: () => ({ content: "probe", editable: false }) } }],
      pages: [{ id: "home", ref: { kind: "page", id: "home" }, title: "Home", path: "home", mode: { kind: "mode", id: "policy" }, modes: [{ kind: "mode", id: "policy" }], main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" }, slots: [], panels: {} }, { id: "record", ref: { kind: "page", id: "record" }, title: "Record", path: "record", parent: { kind: "page", extensionId: "pstdio", id: "start" }, mode: { kind: "mode", extensionId: "pstdio", id: "project" }, modes: [{ kind: "mode", extensionId: "pstdio", id: "project" }, { kind: "mode", id: "policy" }], resource: { kinds: [{ kind: "resource-kind", id: "record" }] }, document: { metadataKey: "documentId" }, main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" }, slots: [], panels: {} }],
      commands: [{
      id: "open-document", ref: { kind: "command", id: "open-document" }, title: "Open document",
      run(ctx: { navigation: { open(target: unknown): void } }) {
        ctx.navigation.open({ kind: "page", page: { kind: "page", id: "record" }, mode: { kind: "mode", id: "policy" }, resource: { type: "record", id: "record-1", metadata: { documentId: "file-1" } }, position: { line: 2, column: 3 } });
      },
    }, {
      id: "open", ref: { kind: "command", id: "open" }, title: "Open", cli: true,
      params: { href: { type: "text" } },
      run(ctx: { navigation: { open(target: unknown): void } }, params: { href?: string }) {
        ctx.navigation.open({ kind: "href", href: params.href ?? "https://example.com/created" });
        return { id: "created" };
      },
    }] };\n`,
  );
  return source;
};
