import { ScrollArea } from "@pstdio/ui";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";
import { useLandingStyles } from "../../hooks/use-landing-styles";

type ScrollScope = "page" | "panels";
const PageScrollContext = createContext<ScrollScope | undefined>(undefined);

interface PageScrollProps {
  children: ReactNode;
  scope?: ScrollScope;
  pageKey?: string;
}

export const PageScroll = (props: PageScrollProps) => {
  const { children, scope = "page", pageKey } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const parent = useContext(PageScrollContext);
  const styles = useLandingStyles();
  useEffect(() => {
    if (pageKey) viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pageKey]);
  if (parent === "page") return children;
  let css = parent === "panels" ? styles.panelScroll : undefined;
  if (scope === "panels") css = styles.panelsScroll;
  return (
    <PageScrollContext value={scope}>
      <ScrollArea css={css} height="100%" width="100%" viewportRef={viewportRef}>
        {children}
      </ScrollArea>
    </PageScrollContext>
  );
};
