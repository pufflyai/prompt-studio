import { createContext, useContext } from "react";

export const CollectionItemLabelContext = createContext("Item");
export const useCollectionItemLabel = () => useContext(CollectionItemLabelContext);
