const numericIdentifier = "(?:0|[1-9]\\d*)";
const prereleaseIdentifier = `(?:${numericIdentifier}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const exactVersion = new RegExp(
  `^${numericIdentifier}\\.${numericIdentifier}\\.${numericIdentifier}(?:-${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
);

/** Authors certify each supported API version; a range must never imply support for another alpha. */
export const parseExtensionApiVersions = (declaration: string) => {
  const versions = declaration.split("||").map((version) => version.trim());
  return versions.every((version) => exactVersion.test(version)) ? versions : null;
};

export const supportsExtensionApiVersion = (declaration: string, hostVersion: string) =>
  parseExtensionApiVersions(declaration)?.includes(hostVersion) ?? false;
