import { defineResourceKind, l10n, type NavigationTarget, type ResourceRef } from "@pstdio/sdk/extensions";

export const shaderVersion = defineResourceKind({
  id: "shader-lab.version",
  label: l10n("version.label", "Shader version"),
  icon: "blend",
});

/** A version resource id is `<shader>/<version>`. */
export const versionId = (shader: string, version: string) => `${shader}/${version}`;
export const parseVersionId = (id: string) => {
  const [shader = "", version = ""] = id.split("/");
  return { shader, version };
};

export const resource = (id: string, projectId?: string, label?: string) =>
  ({ type: shaderVersion.ref.id, id, label, extensionId: "pstdio.pstdio-shader-lab", projectId }) satisfies ResourceRef;
export const target = (id: string, projectId?: string, label?: string) =>
  ({
    kind: "page",
    page: { kind: "page", id: "version" },
    resource: resource(id, projectId, label),
  }) satisfies NavigationTarget;

interface LabShader {
  id: string;
  versions: { id: string }[];
}

// Opens the requested version, or the first one in the lab when none is requested or it was deleted.
export const resolveOpenVersion = (shaders: LabShader[], requested?: string) => {
  const wanted = requested ? parseVersionId(requested) : undefined;
  const exists = shaders.some(
    (shader) => shader.id === wanted?.shader && shader.versions.some((version) => version.id === wanted.version),
  );
  if (wanted && exists) return wanted;
  const first = shaders.find((shader) => shader.versions.length > 0);
  return first ? { shader: first.id, version: first.versions[0].id } : null;
};
