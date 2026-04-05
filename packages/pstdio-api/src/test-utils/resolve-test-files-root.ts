import { resolve } from "node:path";

export const resolveTestFilesRoot = () => resolve(import.meta.dirname, "../../../pstdio/files");
