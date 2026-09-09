import { RootProvider } from "./root-provider";
import { WorkbenchLanding } from "./workbench/workbench-landing";

interface IndexPageProps {
  initialPath: string;
}

export const IndexPage = (props: IndexPageProps) => {
  const { initialPath } = props;

  return (
    <RootProvider>
      <WorkbenchLanding initialPath={initialPath} />
    </RootProvider>
  );
};
