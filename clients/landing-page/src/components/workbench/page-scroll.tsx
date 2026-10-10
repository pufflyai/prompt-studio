import { ScrollArea } from "@pstdio/ui";
import { type ReactNode, useEffect, useRef } from "react";

interface PageScrollProps {
  children: ReactNode;
  pageKey?: string;
}

export const PageScroll = (props: PageScrollProps) => {
  const { children, pageKey } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pageKey) viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pageKey]);
  return (
    <ScrollArea height="100%" width="100%" viewportRef={viewportRef}>
      {children}
    </ScrollArea>
  );
};
