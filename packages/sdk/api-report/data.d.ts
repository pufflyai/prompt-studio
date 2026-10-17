interface ArtifactFile {
  path: string;
  size?: number;
  updatedAt?: string;
}
interface ArtifactMount {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, value: string): Promise<void>;
  updateText(path: string, value: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
  list(pattern?: string): Promise<ArtifactFile[]>;
  listDirs(path?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
}
export declare const assertSafePathSegment: (value: string) => void;
export declare const requireRepoFiles: (projectFiles: ArtifactMount | undefined) => ArtifactMount;
export declare const createDraftLayout: (root: string, document: string) => {
  directory: (name: string) => string;
  markdown: (name: string, suffix?: string) => string;
  files: (name: string, suffix?: string) => string;
};
export declare const quoteYamlScalar: (value: string) => string;
export declare const findClosingFrontmatterDelimiter: (content: string) => {
  end: number;
  start: number;
} | null;
export declare const stripFrontmatter: (content: string) => string;
export declare const applyFrontmatter: (frontmatter: string, content: string) => string;
export declare const unquoteYamlScalar: (value: string) => string;
export declare const sameName: (a: string, b: string) => boolean;
export declare const resolveByIdOrName: <TItem extends {
  id: string;
}>(items: TItem[], value: string, nameOf: (item: TItem) => string, label: string) => string;
