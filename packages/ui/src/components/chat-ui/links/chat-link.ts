export interface ChatLinkCandidate {
  source: string;
  origin: "markdown" | "inline-code" | "reference" | "tool";
}

export interface ChatLinkHandler {
  resolveHref(candidate: ChatLinkCandidate): string | null;
  resolveImageSource?(source: string): Promise<string | null>;
  describe?(candidate: ChatLinkCandidate): string;
  open(candidate: ChatLinkCandidate): void | Promise<void>;
}

export interface ChatLinkProps {
  linkHandler?: ChatLinkHandler;
}

export interface ChatSourcePosition {
  line: number;
  column?: number;
  endLine?: number;
}

export type ParsedChatLink =
  | { kind: "file"; path: string; position?: ChatSourcePosition }
  | { kind: "page"; href: string }
  | { kind: "external"; href: string }
  | { kind: "invalid"; reason: string };

const invalid = (reason: string) => ({ kind: "invalid" as const, reason });
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;

const localSource = (source: string) => {
  if (/^file:/i.test(source)) {
    try {
      const url = new URL(source);
      if (url.hostname) return invalid("Network file links are unavailable.");
      source = url.pathname.replace(/^\/([a-z]:\/)/i, "$1") + url.hash;
      if (url.search) return invalid("File links cannot contain a query.");
    } catch {
      return invalid("This file link is malformed.");
    }
  } else if (
    /^[a-z][a-z\d+.-]*:/i.test(source) &&
    !/^[a-z]:[/\\]/i.test(source) &&
    !/^[^:]+:\d+(?::\d+)?$/.test(source)
  ) {
    return invalid("This link scheme is unsupported.");
  }

  return source.replace(/^#?\$PROJECT\//i, "");
};

const filePosition = (source: string) => {
  let position: ChatSourcePosition | undefined;
  const hash = source.indexOf("#");
  if (hash >= 0) {
    const match = /^#L(\d+)(?:-L(\d+))?$/.exec(source.slice(hash));
    if (!match) return invalid("This file location is unsupported.");
    position = { line: Number(match[1]), ...(match[2] ? { endLine: Number(match[2]) } : {}) };
    source = source.slice(0, hash);
  } else {
    const match = /:(\d+)(?::(\d+))?$/.exec(source);
    if (match) {
      position = { line: Number(match[1]), ...(match[2] ? { column: Number(match[2]) } : {}) };
      source = source.slice(0, match.index);
    }
  }
  if (
    position &&
    (!positive(position.line) ||
      (position.column !== undefined && !positive(position.column)) ||
      (position.endLine !== undefined && (!positive(position.endLine) || position.endLine < position.line)))
  )
    return invalid("Source locations must use positive line and column numbers.");

  return { kind: "file" as const, path: source, position };
};

const isInlinePath = (source: string, original: string) => {
  const explicit = /^(\.\.?\/|\/|[a-z]:\/)/i.test(source) || original.startsWith("$PROJECT/");
  const shaped =
    !/^(@|v\d)/.test(source) &&
    !/[\s()]/.test(source) &&
    (source.includes("/") || /^[\w-]+\.[a-z][\w-]*$/i.test(source));

  return explicit || shaped;
};

export const parseChatLink = (candidate: ChatLinkCandidate, dashboardOrigin?: string): ParsedChatLink | undefined => {
  const source = candidate.source.trim();
  if (!source) return undefined;
  if (/^https?:/i.test(source)) {
    try {
      const url = new URL(source);
      if (url.origin === dashboardOrigin && url.pathname.startsWith("/projects/"))
        return { kind: "page", href: source };
      return { kind: "external", href: source };
    } catch {
      return invalid("This URL is malformed.");
    }
  }
  if (/^(mailto:|sms:|tel:)/i.test(source)) return { kind: "external", href: source };
  if (/^\/projects\//.test(source)) return { kind: "page", href: source };
  if (/^(~\/|\\\\|\/\/)/.test(source)) return invalid("This path has no supported workspace root.");
  if (/^(javascript|data|vscode|pstdio):/i.test(source)) return invalid("This link scheme is unsupported.");
  const local = localSource(source);
  if (typeof local !== "string") return local;
  const file = filePosition(local);
  if (file.kind === "invalid") return file;
  if (file.path.includes("?")) return invalid("Encode question marks in file names.");
  let path: string;
  try {
    path = decodeURIComponent(file.path).replaceAll("\\", "/");
  } catch {
    return invalid("This path has invalid URL encoding.");
  }
  if (path.includes("\0")) return invalid("This path is malformed.");
  if (candidate.origin === "inline-code" && !isInlinePath(path, candidate.source)) return undefined;
  return { ...file, path };
};
