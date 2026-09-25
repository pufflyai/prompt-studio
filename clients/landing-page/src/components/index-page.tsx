import type { LegalDocuments } from "../content/landing-content";
import { RootProvider } from "./root-provider";
import { WorkbenchLanding } from "./workbench/workbench-landing";

interface IndexPageProps {
  initialPath: string;
  legalDocuments: LegalDocuments;
}

export const IndexPage = (props: IndexPageProps) => {
  const { initialPath, legalDocuments } = props;

  return (
    <RootProvider>
      <WorkbenchLanding initialPath={initialPath} legalDocuments={legalDocuments} />
    </RootProvider>
  );
};
