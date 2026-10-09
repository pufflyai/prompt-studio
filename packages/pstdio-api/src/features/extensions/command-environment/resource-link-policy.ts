import type { ResourceAnchor, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { legacyResourceOwner } from "pstdio-db";
import type { ExtensionsRouteDeps } from "../deps";
import { runAnchorValidator } from "./anchor-validator";

const hostKinds = new Set(["project", "workspace", "session"]);
const assertProject = (resource: ResourceRef, projectId: string) => {
  if (resource.projectId && resource.projectId !== projectId) throw new Error("Resource belongs to another project.");
};
const hostProject = async (deps: ExtensionsRouteDeps, resource: ResourceRef) => {
  if (!hostKinds.has(resource.type)) throw new Error(`Unknown host resource kind "${resource.type}".`);
  if (resource.type === "workspace") return (await deps.workspaceService.get(resource.id))?.project_id;
  if (resource.type === "session") return (await deps.sessionService.get(resource.id))?.project_id;
  return (await deps.projectService.get(resource.id))?.id;
};

export const canonicalResource = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string },
  resource: ResourceRef,
) => {
  assertProject(resource, input.projectId);
  const { runtime } = await deps.extensionRuntimeCatalog.get(input.projectId);
  const owners = runtime.resourceKinds.filter((kind) => kind.localId === resource.type);
  let extensionId = resource.extensionId;
  if (!extensionId && hostKinds.has(resource.type)) extensionId = "pstdio";
  if (!extensionId && owners.some((kind) => kind.extensionId === input.extensionId)) extensionId = input.extensionId;
  if (!extensionId && owners.length === 1) extensionId = owners[0]!.extensionId;
  if (!extensionId) throw new Error(`Resource owner is ambiguous for "${resource.type}".`);
  const ref = { ...resource, extensionId, projectId: input.projectId };
  if (extensionId === "pstdio") {
    const projectId = await hostProject(deps, ref);
    if (projectId && projectId !== input.projectId) throw new Error("Resource belongs to another project.");
  }
  return ref;
};

export const createAnchorPolicy = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const records = await deps.extensionService.listProjectExtensionInstances(projectId);
  const { runtime } = await deps.extensionRuntimeCatalog.get(projectId);
  const kindOf = (endpoint: ResourceRef) =>
    runtime.resourceKinds.find((kind) => kind.extensionId === endpoint.extensionId && kind.localId === endpoint.type);
  const validateEndpoint = async (
    endpoint: ResourceRef,
    source: ResourceRef,
    target: ResourceAnchor,
    operation: "add" | "remove",
  ) => {
    if (endpoint.extensionId === "pstdio") return;
    const owner = records.find((record) => record.installedSource.extension_id === endpoint.extensionId);
    if (!owner) {
      if (operation === "remove") return;
      throw new Error(`Resource owner ${endpoint.extensionId} is not installed.`);
    }
    if (!owner.instance.enabled) throw new Error(`Resource owner ${endpoint.extensionId} is disabled.`);
    const validator = kindOf(endpoint)?.contribution.validateAnchors;
    if (!validator) return;
    const ownerId = validator.extensionId ?? endpoint.extensionId;
    if (ownerId !== endpoint.extensionId) throw new Error("An anchor validator must belong to the resource owner.");
    await runAnchorValidator(deps, projectId, `${ownerId}.command.${validator.id}`, endpoint, {
      operation,
      source,
      target,
      role: target.role ?? "context",
    });
  };
  return {
    requireKind: (endpoint: ResourceRef) => {
      if (endpoint.extensionId !== "pstdio" && !kindOf(endpoint))
        throw new Error(`Resource kind "${endpoint.type}" is not declared by ${endpoint.extensionId}.`);
    },
    validate: async (source: ResourceRef, target: ResourceAnchor, operation: "add" | "remove") => {
      await validateEndpoint(source, source, target, operation);
      await validateEndpoint(target, source, target, operation);
    },
  };
};

// Released legacy callers can name known Planner kinds before declaring them.
export const validateLegacyAnchors = async (
  deps: ExtensionsRouteDeps,
  source: ResourceRef & { projectId: string },
  anchors: ResourceAnchor[],
) => {
  if (!anchors.length) return;
  const policy = await createAnchorPolicy(deps, source.projectId);
  for (const anchor of anchors) {
    const target = await canonicalResource(
      deps,
      { projectId: source.projectId },
      { ...anchor, extensionId: legacyResourceOwner(anchor) },
    );
    await policy.validate(source, target, "add");
  }
};
