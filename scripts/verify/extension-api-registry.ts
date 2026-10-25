export interface SdkRegistryMetadata {
  versions: Record<string, { pstdio?: { extensionApiVersion?: string } }>;
}

export const sdkRegistryBaselines = (metadata: SdkRegistryMetadata) =>
  Object.entries(metadata.versions).flatMap(([sdk, manifest]) => {
    const api = manifest.pstdio?.extensionApiVersion;
    if (api === undefined) return [];
    if (typeof api !== "string" || !/^\d+\.\d+\.\d+$/.test(api) || !Bun.semver.satisfies(api, "*"))
      throw new Error(`Published SDK ${sdk} has invalid extension API metadata`);
    return [{ sdk, api }];
  });

export const readSdkRegistryMetadata = async (registry = "https://registry.npmjs.org") => {
  const response = await fetch(`${registry}/@pstdio%2fsdk`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Cannot read published SDK metadata: HTTP ${response.status}`);
  return (await response.json()) as SdkRegistryMetadata;
};
