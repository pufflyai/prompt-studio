import { createContext, useContext } from "react";
import type { ToolShapeKind } from "../content/tool-shapes";

export const DemoComposition = createContext<{ parts: ToolShapeKind[]; complete: boolean } | null>(null);
export const useDemoComposition = () => useContext(DemoComposition);
