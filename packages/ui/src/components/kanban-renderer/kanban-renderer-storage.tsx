import { createContext, type ReactNode, useContext } from "react";

/** Synchronous snapshot storage supplied by the host before rendering saved views. */
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

/** Hosts can persist views outside the browser origin, such as in a desktop profile. */
export const KanbanRendererStorageProvider = (props: KanbanRendererStorageProviderProps) => {
  const { storage, children } = props;
  return <StorageContext value={storage}>{children}</StorageContext>;
};

export const useKanbanRendererStorage = () => useContext(StorageContext);
