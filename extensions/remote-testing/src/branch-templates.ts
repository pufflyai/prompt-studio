import { createHash } from "node:crypto";
import type { ExtensionContextBase, JsonObject } from "@pstdio/sdk/extensions";
import { connectionApi, templatePublisher } from "./connection";

export type BranchKind = "tests" | "preview";
export type TemplateRef = { name: string; version: string };
export type BranchSource = { sha256: string; revision: string };
type Manifest = JsonObject & {
  metadata: { name: string; description?: string };
  spec: JsonObject & { version: string };
};

const nameOf = { tests: "remote-tests", preview: "prompt-studio-preview" };

export function branchTemplate(base: Manifest, { sha256, revision }: BranchSource) {
  const hash = createHash("sha256").update(JSON.stringify({ base, sha256, revision })).digest("hex").slice(0, 24);
  const release = base.spec.version.split("-")[0];
  const description = `${(base.metadata.description ?? base.metadata.name).slice(0, 320)} from ${revision.slice(0, 12)} (source ${sha256})`;
  return {
    ...base,
    metadata: { ...base.metadata, name: `${base.metadata.name}-branch`, description },
    spec: { ...base.spec, version: `${release}-branch-${hash}` },
  };
}

async function basesOf(ctx: ExtensionContextBase, kind: BranchKind) {
  if (!ctx.extensionFiles) throw new Error("Open the project before publishing a branch template.");
  const file = `branch-templates/${kind}.json`;
  if (!(await ctx.extensionFiles.exists(file)))
    throw new Error(`Ask the operator to install the approved ${kind} template.`);
  const base = JSON.parse(await ctx.extensionFiles.readText(file)) as Manifest;
  if (base.metadata.name !== nameOf[kind]) throw new Error(`The approved ${kind} template has the wrong name.`);
  return base;
}

export async function publishBranchTemplate(
  ctx: ExtensionContextBase,
  kind: BranchKind,
  source: BranchSource,
  signal?: AbortSignal,
): Promise<TemplateRef> {
  const manifest = branchTemplate(await basesOf(ctx, kind), source);
  const result = await connectionApi(
    ctx.connections,
    templatePublisher.id,
  )<TemplateRef>({
    method: "POST",
    path: "/v1/templates",
    body: { manifest },
    signal,
  });
  return { name: result.name, version: result.version };
}
