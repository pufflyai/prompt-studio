import { WorkbenchLanding } from "./landing/workbench-landing";
import { RootProvider } from "./root-provider";

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
