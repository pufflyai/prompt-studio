import { createContext, type RefObject } from "react";

// Size-sensitive content can wait for its enclosing split to reach its final size.
export const SplitPanelMotionContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
