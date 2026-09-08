import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";

/**
 * Every page scrolls in the same container: the design-system ScrollArea, so the
 * scrollbar is the styled one on the right rather than the browser default.
 */
export const PageScroll = (props: { children: ReactNode }) => (
  <ScrollArea height="100%" width="100%">
    {props.children}
  </ScrollArea>
);
