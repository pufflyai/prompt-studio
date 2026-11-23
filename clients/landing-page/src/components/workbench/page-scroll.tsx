import { ScrollArea } from "@pstdio/ui";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";

interface PageScrollProps {
  children: ReactNode;
  pageKey?: string;
  /** The scrolling element, for pages that scroll to their own sections. */
  viewportRef?: RefObject<HTMLDivElement | null>;
}

export const PageScroll = (props: PageScrollProps) => {
  const { children, pageKey } = props;
  const ownRef = useRef<HTMLDivElement>(null);
  const viewportRef = props.viewportRef ?? ownRef;
  useEffect(() => {
    if (pageKey) viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pageKey, viewportRef]);
  return (
    <ScrollArea height="100%" width="100%" viewportRef={viewportRef}>
      {children}
    </ScrollArea>
  );
};
