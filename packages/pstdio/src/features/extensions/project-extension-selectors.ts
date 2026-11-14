import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { canonicalExtensionId, extensionIdentityRenames } from "pstdio-api-contracts/extension-host";

// Explicit install names retain their meaning, including third-party custom installs.
export const selectProjectExtensions = (extensions: ProjectExtensionInstance[], selector: string) => {
  const installed = extensions.filter((extension) => extension.installName === selector);
  if (installed.length) return installed;
  const qualified = extensions.filter((extension) => extension.extensionId === selector);
  if (qualified.length) return qualified;
  const rename = extensionIdentityRenames.find(({ from, to }) =>
    [from.name, `${from.publisher}.${from.name}`, to.name, `${to.publisher}.${to.name}`].includes(selector),
  );
  if (!rename) return [];
  const owner = `${rename.to.publisher}.${rename.to.name}`;
  return extensions.filter((extension) => canonicalExtensionId(extension.extensionId) === owner);
};

export const deprecatedProjectExtensionSelector = (extension: ProjectExtensionInstance, selector: string) => {
  const rename = extensionIdentityRenames.find(
    ({ to }) => `${to.publisher}.${to.name}` === canonicalExtensionId(extension.extensionId),
  );
  return rename && [rename.from.name, `${rename.from.publisher}.${rename.from.name}`].includes(selector)
    ? `Deprecated: extension ${selector} is replaced by ${rename.to.publisher}.${rename.to.name}.`
    : undefined;
};

// Publication record IDs select immutable histories. Return their actual key, never rename it here.
export const findExtensionPublication = <T extends { recordId: string }>(records: T[], owner: string) => {
  const matches = records.filter((record) => canonicalExtensionId(record.recordId) === canonicalExtensionId(owner));
  if (matches.length > 1) throw new Error("Conflicting extension publication histories require resolution.");
  return matches[0];
};
