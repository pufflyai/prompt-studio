import { parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { parseExtensionSourceRef } from "../../services/extension-source-ref";
import { type ExtensionCatalog, packagedExtensionCatalog, selectExtensionCatalogEntry } from "./extension-catalog";

export const isManagedCatalogSource = (
  source: { install_name: string; extension_id: string; source_kind: string; source_ref: string | null },
  catalog: ExtensionCatalog,
  registryUrl?: string,
) => {
  const trusted = selectExtensionCatalogEntry(packagedExtensionCatalog, source.install_name);
  const selected = selectExtensionCatalogEntry(catalog, source.install_name);
  if (
    !trusted ||
    !selected ||
    trusted.origin.url !== "https://github.com/pufflyai/prompt-studio" ||
    trusted.origin.ref !== "{hostRelease}" ||
    selected.origin.url !== trusted.origin.url ||
    selected.origin.path !== trusted.origin.path ||
    selected.origin.ref !== trusted.origin.ref ||
    source.extension_id !== (trusted.extensionId ?? `pstdio.${trusted.installName}`)
  )
    return false;
  const registry = parseRegistrySourceRef(source.source_ref);
  // 0.48 recorded some catalog tools in project folders as local_path with their official Git ref.
  const git = parseExtensionSourceRef(source.source_ref);
  if (
    !(git?.url === trusted.origin.url && git.path === trusted.origin.path) &&
    !(source.source_kind === "registry" && registry?.id === source.extension_id && registry.registry === registryUrl)
  )
    return false;
  return true;
};
