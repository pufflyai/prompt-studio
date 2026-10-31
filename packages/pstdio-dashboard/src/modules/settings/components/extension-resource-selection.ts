export const findExtensionByResource = <T extends { installName: string; extensionId: string }>(
  extensions: T[],
  resource: string | null,
) =>
  extensions.find((extension) => extension.installName === resource) ??
  extensions.find((extension) => extension.extensionId === resource);
