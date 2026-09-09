import { ScrollArea } from "@pstdio/ui";
import { createContext, type ReactNode, useContext } from "react";

const PageScrollContext = createContext(false);

export const PageScroll = (props: { children: ReactNode }) => {
  const { children } = props;
  const hasScrollParent = useContext(PageScrollContext);
  // Stacked mobile panels share the outer scrollbar.
  if (hasScrollParent) return children;
  return (
    <PageScrollContext value={true}>
      <ScrollArea height="100%" width="100%">
        {children}
      </ScrollArea>
    </PageScrollContext>
  );
};
