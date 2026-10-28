import { createInstallationView, type ViewProps } from "./create-view";
import { InstallationIndicator } from "./installation-content";
import { useInstallations } from "./use-installations";

const Status = (props: ViewProps) => {
  const { client, projectId, t } = props;
  return <InstallationIndicator {...useInstallations(client, projectId)} t={t} />;
};
export default createInstallationView(Status);
