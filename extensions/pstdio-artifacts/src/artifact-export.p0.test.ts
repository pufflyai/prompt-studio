import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { decodeHTML } from "entities";
import { artifactExportFilename, buildArtifactExport } from "./artifact-export";
import { commands } from "./commands";

const innerDocument = async (html: string) => {
  let content = "";
  await new HTMLRewriter()
    .on("iframe", {
      element(element) {
        content = decodeHTML(element.getAttribute("srcdoc") ?? "");
      },
    })
    .transform(new Response(html))
    .text();
  return content;
};

test("portable exports preserve full documents, embedded assets, scripts and their theme", async () => {
  const script =
    '<script>document.querySelector("button").onclick = () => { document.body.dataset.clicked = "yes"; };</script>';
  const source = `<!doctype html><html lang="fr"><head><title>Résumé</title></head><body><button>Continue</button><img src="data:image/svg+xml;base64,PHN2Zy8+">${script}</body></html>`;
  const html = await buildArtifactExport(source, {
    mode: "dark",
    variables: { "--artifact-bg": "#101820", "--artifact-fg": "#ffffff" },
  });
  const inner = await innerDocument(html);
  expect(inner).toContain(script);
  expect(inner).toContain('lang="fr"');
  expect(html).toContain('style="color-scheme:dark"');
  expect(html).toContain("#101820");
  expect(inner).toContain("data:image/svg+xml;base64,PHN2Zy8+");
  expect(html.match(/<!doctype/gi)).toHaveLength(1);
  expect(inner.match(/<!doctype/gi)).toHaveLength(1);
  expect(html).toContain('sandbox="allow-scripts"');
});

test("HTML fragments receive a complete portable document and theme fallbacks", async () => {
  const html = await buildArtifactExport("<title>Fragment</title><h1>Details</h1><script>window.ready=true;</script>");
  expect(html).toContain("<!doctype html>");
  expect(html).toContain("<html");
  expect(html).toContain("<head>");
  expect(await innerDocument(html)).toContain("<h1>Details</h1>");
  for (const name of ["bg", "surface", "fg", "muted", "border", "accent", "font"])
    expect(html).toContain(`--artifact-${name}`);
  expect(artifactExportFilename('  Next GB / audit: "critical"  ')).toBe("Next GB - audit- -critical-.html");
  expect(artifactExportFilename("... ")).toBe("artifact.html");
});

test("documents without a doctype keep standards mode while retaining author layout styles", async () => {
  const html = await buildArtifactExport(
    '<html style="--artifact-bg:red!important; margin:0"><head><style>:root{--artifact-bg:blue}</style></head><body>Audit</body></html>',
    { mode: "dark", variables: { "--artifact-bg": "#101820" } },
  );
  const inner = await innerDocument(html);
  expect(inner.trimStart().startsWith("<!doctype html>")).toBe(true);
  expect(inner).toContain("margin:0");
  expect(inner).toContain("--artifact-bg:red!important");
});

test("the export command reads the selected saved revision and writes within the workspace", async () => {
  const files = createMemoryRepoFiles();
  const snapshots = createMemoryRepoFiles();
  const [ctx] = makeCommandArgs({
    storage: createMemoryStorage(),
    params: {},
    overrides: { projectFiles: files, artifacts: { mount: () => snapshots } },
  });
  await files.writeText("page.html", "<title>First</title><h1>Earlier version</h1>");
  const first = await commands.publish.run(ctx, { file_path: "page.html" });
  await files.writeText("page.html", "<title>Latest</title><h1>Latest version</h1>");
  await commands.publish.run(ctx, { file_path: "page.html", url: first.url });
  await files.delete("page.html");
  const result = await commands.export.run(ctx, {
    url: first.url,
    revisionId: first.revisionId,
    file_path: "exports/report.html",
  });
  expect(result.path).toBe("exports/report.html");
  const exported = await files.readText(result.path!);
  expect(exported).toContain("Earlier version");
  expect(exported).not.toContain("Latest version");
  expect(await commands.revisions.run(ctx, { url: first.url })).toHaveLength(2);
  for (const path of ["../report.html", "/tmp/report.html"])
    await expect(commands.export.run(ctx, { url: first.url, file_path: path })).rejects.toThrow("workspace-relative");
  await expect(commands.export.run(ctx, { url: first.url, revisionId: "foreign" })).rejects.toThrow(
    "revision not found",
  );
});
