import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canvases } from "../src/canvases/definitions";
import { extensionRoot, generatedRoot } from "./story-catalog";

interface SourceNode {
  key: string;
  source: string;
  rootId: string;
  parentId: string | null;
  id: string;
  name: string;
  reusable: boolean;
  ref: string | null;
  properties: Record<string, unknown>;
}
interface SourceAsset {
  sourcePath: string;
  artifact: string;
  sha256: string;
  bytes: number;
}
interface Inventory {
  snapshot: unknown;
  nodes: SourceNode[];
  componentMappings: { key: string; candidateStoryGroups: string[] }[];
  designFiles: {
    source: string;
    name: string;
    sha256: string;
    roots: { id: string }[];
    assets: SourceAsset[];
    variables?: unknown;
    themes?: unknown;
  }[];
  nativeCanvases: { id: string; items: { id: string }[] }[];
  stories: { id: string; source: string; exportName: string }[];
}
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const generateMigrationLedger = async (inventoryPath: string) => {
  const raw = await readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(raw) as Inventory;
  const sourceFiles = new Map(inventory.designFiles.map((file, index) => [file.source, index]));
  const candidates = new Map(inventory.componentMappings.map((entry) => [entry.key, entry.candidateStoryGroups]));
  const assets = new Map<string, SourceAsset & { destination: string }>();
  const assetDirectory = resolve(extensionRoot, "assets/migration");
  await mkdir(assetDirectory, { recursive: true });
  for (const file of inventory.designFiles) {
    for (const asset of file.assets) {
      const source = resolve(dirname(inventoryPath), asset.artifact);
      const bytes = await readFile(source);
      if (digest(bytes) !== asset.sha256) throw new Error(`Asset snapshot hash differs: ${asset.sourcePath}`);
      const destination = `assets/migration/${asset.artifact.split("/").at(-1)}`;
      await copyFile(source, resolve(extensionRoot, destination));
      assets.set(asset.sha256, { ...asset, destination });
    }
  }
  const entries = inventory.nodes.map((node) => ({
    key: node.key,
    file: sourceFiles.get(node.source),
    id: node.id,
    name: node.name,
    parent: node.parentId,
    root: node.rootId,
    reusable: node.reusable,
    master: node.ref,
    propertiesHash: digest(JSON.stringify(node.properties)),
    ...(node.ref ? { overrides: node.properties } : {}),
    candidates: candidates.get(node.key),
    reference: `design-${fileId(node.source)}-${node.rootId}`,
    destination: null,
  }));
  const stories = canvases.flatMap((canvas) =>
    canvas.items.flatMap((item) =>
      item.preview?.kind === "story"
        ? [
            {
              source: item.preview.source,
              exportName: item.preview.exportName,
              canvas: canvas.id,
              item: item.id,
            },
          ]
        : [],
    ),
  );
  const documents = canvases.flatMap((canvas) =>
    canvas.items.flatMap((item) =>
      item.preview?.kind === "document" ? [{ source: item.preview.source, canvas: canvas.id, item: item.id }] : [],
    ),
  );
  const native = inventory.nativeCanvases.flatMap((canvas) =>
    canvas.items.map((item) => {
      if (!canvases.find((current) => current.id === canvas.id)?.items.some((current) => current.id === item.id)) {
        throw new Error(`Original native preview was removed: ${canvas.id}#${item.id}`);
      }
      return { canvas: canvas.id, item: item.id };
    }),
  );
  const fixtureFactories: Record<string, string> = {
    "packages/pstdio-workbench/src/react/region/drop-feedback.stories.tsx#createDropFeedbackWorkbench":
      "PreviewInsertion",
    "packages/pstdio-workbench/src/react/region/panel-arrangement.stories.tsx#createArrangementWorkbench":
      "HeaderlessMain",
  };
  const inventoriedStories = inventory.stories.map((story) => {
    const key = `${story.source}#${story.exportName}`;
    const sharedExport = fixtureFactories[key];
    const targetExport = sharedExport ?? story.exportName;
    const destination = stories.find(
      (binding) => binding.source === story.source && binding.exportName === targetExport,
    );
    if (!destination) throw new Error(`Inventoried source export has no destination: ${key}`);
    return {
      id: story.id,
      source: story.source,
      exportName: story.exportName,
      destination,
      mapping: sharedExport ? "shared" : "direct",
      ...(sharedExport
        ? { reason: `Fixture factory used by ${sharedExport}; excluded from renderable CSF exports.` }
        : {}),
    };
  });
  const ledger = {
    schemaVersion: 1,
    evidence: { report: "RP-1", inventoryHash: digest(raw), snapshot: inventory.snapshot },
    designFreshness: "Requires Pencil verification against current originals",
    files: inventory.designFiles.map(({ source, name, sha256, roots, variables, themes }) => ({
      source,
      name,
      sha256,
      roots: roots.map((root) => root.id),
      variables,
      themes,
    })),
    assets: [...assets.values()],
    entries,
    inventoriedStories,
    stories,
    documents,
    native,
  };
  await writeFile(resolve(generatedRoot, "migration-ledger.json"), `${JSON.stringify(ledger)}\n`);
  console.log(
    JSON.stringify({
      nodes: entries.length,
      reusable: entries.filter((entry) => entry.reusable).length,
      native: native.length,
      stories: stories.length,
      documents: documents.length,
      assets: assets.size,
      remainingDesignNodes: entries.filter((entry) => !entry.destination).length,
    }),
  );
  return ledger;
};
const fileId = (source: string) =>
  ({
    "design/prompt-studio-design-system.pen": "design-system",
    "design/prompt-studio-website.pen": "website",
    "design/autobuilder.pen": "autobuilder",
    "design/social-radar.pen": "social-radar",
  })[source];
if (import.meta.main) {
  const input = process.argv[2];
  if (!input) throw new Error("Pass the RP-1 inventory JSON path. This command does not read or modify Pencil files.");
  await generateMigrationLedger(resolve(input));
}
