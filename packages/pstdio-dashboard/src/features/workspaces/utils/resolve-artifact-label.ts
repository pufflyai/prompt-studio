export const resolveArtifactLabel = (relativePath: string) => {
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) ?? relativePath;
  const directory = segments.length > 1 ? `${segments.slice(0, -1).join("/")}/` : "";

  const extensionStart = fileName.startsWith(".") ? fileName.indexOf(".", 1) : fileName.lastIndexOf(".");
  const baseName = extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;

  return `${directory}${baseName}`;
};
