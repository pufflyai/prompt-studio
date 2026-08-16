import { createContext, type ReactNode, useContext } from "react";
import type { MarkdownUrlResolver } from "./markdown-url";

const MarkdownUrlContext = createContext<MarkdownUrlResolver | undefined>(undefined);

interface MarkdownUrlProviderProps {
  children: ReactNode;
  resolver?: MarkdownUrlResolver;
}

export const MarkdownUrlProvider = (props: MarkdownUrlProviderProps) => {
  const { children, resolver } = props;
  return <MarkdownUrlContext.Provider value={resolver}>{children}</MarkdownUrlContext.Provider>;
};

export const useMarkdownUrlResolver = () => useContext(MarkdownUrlContext);
