import Header from "./header";
import { RootProvider } from "./root-provider";

export const MarkdownHeader = () => {
  return (
    <RootProvider>
      <Header />
    </RootProvider>
  );
};
