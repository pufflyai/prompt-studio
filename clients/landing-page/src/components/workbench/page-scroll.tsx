import { ScrollArea } from "@pstdio/ui";
import { createContext, type ReactNode, useContext } from "react";
import { useLandingStyles } from "../../hooks/use-landing-styles";

type ScrollScope = "page" | "panels";
const PageScrollContext = createContext<ScrollScope | undefined>(undefined);

export const PageScroll = (props: { children: ReactNode; scope?: ScrollScope }) => {
  const { children, scope = "page" } = props;
  const parent = useContext(PageScrollContext);
  const styles = useLandingStyles();
  if (parent === "page") return children;
  let css = parent === "panels" ? styles.panelScroll : undefined;
  if (scope === "panels") css = styles.panelsScroll;
  return (
    <PageScrollContext value={scope}>
      <ScrollArea css={css} height="100%" width="100%">
        {children}
      </ScrollArea>
    </PageScrollContext>
  );
};
