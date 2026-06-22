export const imagePreviewMimeTypes = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
} as const;

export const imagePreviewExtensions = Object.keys(imagePreviewMimeTypes);

export const getFileExtension = (filePath: string) => {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  const extension = fileName.split(".").pop();
  return extension ? extension.toLowerCase() : "";
};

export const getImagePreviewMimeType = (filePath: string) => {
  const extension = getFileExtension(filePath);
  return imagePreviewMimeTypes[extension as keyof typeof imagePreviewMimeTypes] ?? null;
};

export const isImagePreviewPath = (filePath: string) => getImagePreviewMimeType(filePath) !== null;
