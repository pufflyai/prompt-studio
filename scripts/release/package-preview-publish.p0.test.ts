import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packagePreviewPlan, previewAlreadyPublished, publishPackagePreviews } from "./package-preview-publish";

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-preview-publication-"));
  const version = `0.46.0-preview.sha-${"a".repeat(40)}`;
  const write = (folder: string, manifest: object) => {
    const dir = join(root, "packages", folder, ".publish");
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "dist/index.js"), "export const value = 42;");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module", files: ["dist"], version, ...manifest }));
  };
  write("sdk", { name: "@pstdio/sdk", pstdio: { extensionApiVersion: "0.3.0" } });
  write("ui", { name: "@pstdio/ui", dependencies: { "@pstdio/sdk": version } });
  write("pstdio", { name: "pstdio" });
  return { root, version, write };
};

test("the publication plan contains SDK then its matching UI, without the host package", () => {
  const { root, version } = fixture();
  try {
    expect(packagePreviewPlan(root).map(({ name, version }) => ({ name, version }))).toEqual([
      { name: "@pstdio/sdk", version },
      { name: "@pstdio/ui", version },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a UI preview must depend on exactly the SDK preview being published", () => {
  const { root, write } = fixture();
  try {
    write("ui", { name: "@pstdio/ui", dependencies: { "@pstdio/sdk": "^0.45.0" } });
    expect(() => packagePreviewPlan(root)).toThrow("SDK dependency");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a package preview cannot accidentally publish a stable version", () => {
  const { root, write } = fixture();
  try {
    write("sdk", { name: "@pstdio/sdk", version: "0.46.0" });
    expect(() => packagePreviewPlan(root)).toThrow("preview");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dry run packs both real artifacts without registry credentials", async () => {
  const { root, version } = fixture();
  try {
    expect(await publishPackagePreviews(root, true)).toEqual([
      { name: "@pstdio/sdk", version },
      { name: "@pstdio/ui", version },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("only a registry 404 permits publication; existing versions are skipped and outages fail", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const status = Number(new URL(request.url).pathname.split("/").at(-1));
      return new Response("{}", { status });
    },
  });
  try {
    expect(await previewAlreadyPublished("@pstdio/sdk", "200", server.url.origin)).toBe(true);
    expect(await previewAlreadyPublished("@pstdio/sdk", "404", server.url.origin)).toBe(false);
    expect.assertions(3);
    try {
      await previewAlreadyPublished("@pstdio/sdk", "503", server.url.origin);
    } catch (error) {
      expect(String(error)).toContain("HTTP 503");
    }
  } finally {
    await server.stop(true);
  }
});
