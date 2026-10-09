import { createContext, type ReactNode, useContext } from "react";
import type { ToolShapeKind } from "../content/tool-shapes";

export const DemoComposition = createContext<{ parts: ToolShapeKind[]; complete: boolean } | null>(null);
export const useDemoComposition = () => useContext(DemoComposition);

export const DemoContribution = (props: { kind: ToolShapeKind; children: ReactNode }) => {
  const { kind, children } = props;
  const composition = useDemoComposition();
  if (composition && !composition.parts.includes(kind)) return null;
  return children;
};
