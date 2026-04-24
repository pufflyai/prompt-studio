export type ArtifactFile = {
  path: string;
  sizeBytes: number;
};

export type ArtifactMountApi = {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, value: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
  list(pattern?: string): Promise<ArtifactFile[]>;
  listDirs(path?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
};
