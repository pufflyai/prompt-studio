import { expect, test } from "bun:test";
import { defineTextSource, params } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

test("source callbacks are registered without a view and validate their declared params", async () => {
  const body = defineTextSource({
    id: "body",
    params: { id: params.text({ required: true }) },
    resolve: async (_ctx, { params }) => ({
      source: { kind: "record", recordId: params.id, field: "/content" },
      content: "source",
      editable: true,
    }),
    project: async () => {},
  });
  const source: LoadedExtensionSource = {
    packagePath: "/fixture",
    sourcePath: "/fixture/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "acme.notes",
      name: "notes",
      publisher: "acme",
      version: "1.0.0",
      main: "extension.ts",
      enginesPstdio: "^0.3.0",
    },
    definition: {
      textSources: [body],
    },
  };
  const runtime = normalizeExtensionSources([source]);
  expect(runtime.diagnostics).toEqual([]);
  const resolve = runtime.privateHandlers.find(
    (handler) => handler.id === "acme.notes.text-source.body.textSource.resolve",
  )!;
  expect(resolve).toBeDefined();
  await expect(resolve.handler({} as never, { params: {} } as never)).rejects.toThrow("Missing required param");
  expect(await resolve.handler({} as never, { params: { id: "note" } } as never)).toMatchObject({
    source: { recordId: "note" },
  });
});
