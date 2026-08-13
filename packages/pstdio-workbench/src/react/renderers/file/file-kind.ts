// Generic file-type dispatch for the file renderer. Markdown is the default so
// `.md` / `.txt` / extension-less files open in the prose editor; recognised code
// extensions open in Monaco; images render read-only. This is deliberately
// domain-agnostic — it knows about file types, not about tickets.

export type FileKind = "markdown" | "code" | "image";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const PROSE_EXTENSIONS = new Set(["md", "markdown", "txt"]);

// Extension → Monaco language id. Markdown/plain text intentionally absent so
// they fall through to the prose editor.
const CODE_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  sql: "sql",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  dockerfile: "dockerfile",
  graphql: "graphql",
  gql: "graphql",
  md: "markdown",
  markdown: "markdown",
  txt: "plaintext",
};

const extensionOf = (fileName: string | undefined) => {
  if (!fileName) return "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
};

const isImage = (fileName: string | undefined, mimeType: string | undefined) => {
  if (mimeType?.startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.has(extensionOf(fileName));
};

export const pickFileKind = (fileName: string | undefined, mimeType: string | undefined): FileKind => {
  if (isImage(fileName, mimeType)) return "image";
  const extension = extensionOf(fileName);
  if (!PROSE_EXTENSIONS.has(extension) && extension in CODE_LANGUAGE_BY_EXTENSION) return "code";
  return "markdown";
};

// Monaco language for a code file; falls back to plaintext for unknown extensions.
export const codeLanguageFor = (fileName: string | undefined) =>
  CODE_LANGUAGE_BY_EXTENSION[extensionOf(fileName)] ?? "plaintext";
