import { AsyncLocalStorage } from "node:async_hooks";
import type { DocumentHistory } from "pstdio-sync";

export const dataMigrationContext = new AsyncLocalStorage<{ key: string; histories: Map<string, DocumentHistory> }>();
