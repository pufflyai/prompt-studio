import type { LandingDocument, LandingPage } from "../content/landing-pages";
import { RootProvider } from "./root-provider";
import { WorkbenchLanding } from "./workbench/workbench-landing";

interface IndexPageProps {
  initialPath: string;
  pages: LandingPage[];
  initialDocument: LandingDocument | undefined;
}

export const IndexPage = (props: IndexPageProps) => {
  const { initialPath, pages, initialDocument } = props;

  return (
    <RootProvider>
      <WorkbenchLanding initialPath={initialPath} pages={pages} initialDocument={initialDocument} />
    </RootProvider>
  );
};
