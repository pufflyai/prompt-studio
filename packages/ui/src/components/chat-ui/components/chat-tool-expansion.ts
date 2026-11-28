import { createContext } from "react";

// Keep manually expanded tool output when a virtual row leaves and reenters the viewport.
export const ChatToolExpansionContext = createContext<Map<string, Set<string>> | null>(null);
