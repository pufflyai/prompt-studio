import { createContext, type ReactNode, useContext } from "react";

/** Local interaction-state storage supplied by the host before rendering a board. */
export interface KanbanRendererStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

const StorageContext = createContext<KanbanRendererStorage | undefined>(undefined);

interface KanbanRendererStorageProviderProps {
  storage: KanbanRendererStorage | undefined;
  children: ReactNode;
}

/** Hosts can persist local board state outside the browser origin. Shared view definitions stay on the server. */
export const KanbanRendererStorageProvider = (props: KanbanRendererStorageProviderProps) => {
  const { storage, children } = props;
  return <StorageContext value={storage}>{children}</StorageContext>;
};

export const useKanbanRendererStorage = () => useContext(StorageContext);
