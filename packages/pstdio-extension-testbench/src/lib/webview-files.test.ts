import { expect, test } from "bun:test";
import { createPreviewWebviewFileHost } from "./webview-files";

test("preview files expose complete metadata and keep scopes separate", () => {
  const host = createPreviewWebviewFileHost();
  const file = host.upload({ name: "sample.txt", data: new Uint8Array([1, 2]), scope: { type: "import", id: "one" } });
  expect(file).toMatchObject({ name: "sample.txt", size: 2, mimeType: null, hash: null });
  expect(Number.isNaN(Date.parse(file.createdAt))).toBe(false);
  expect(file.updatedAt).toBe(file.createdAt);
  expect(host.list({ scope: { type: "import", id: "one" } })).toEqual({ files: [file] });
  expect(host.list({})).toEqual({ files: [] });
  host.delete({ id: file.id });
  expect(host.list({ scope: { type: "import", id: "one" } })).toEqual({ files: [] });
});
