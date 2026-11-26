import "@pstdio/ui/style.css";
import { Box, ChakraProvider } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView, type PageParams } from "@pstdio/sdk/extensions";
import { psTheme } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { deployedMachinePageRef, monitoringDetailPageRef } from "./lab-navigation";
import type { monitoringCommands } from "./workspace-monitoring-commands";
import { WorkspaceMonitoringDashboard } from "./workspace-monitoring-dashboard";
import { WorkspaceMonitoringDetail } from "./workspace-monitoring-detail";
import { monitoringRange } from "./workspace-monitoring-range";
import { MonitoringError } from "./workspace-monitoring-ui";

export default defineExtensionView({
  render(context) {
    const { host, mount, propsStore, t, page } = context;
    const client = createWebviewClient<typeof monitoringCommands>(host);
    const root = createRoot(mount);

    function Monitoring() {
      const props = useSyncExternalStore(propsStore.subscribe, propsStore.get);
      const { resource, pageParams: params } = props;
      const range = monitoringRange(params?.["monitoring-range"]);
      const locale = context.locale;
      const [error, setError] = useState<string>();
      const showError = (failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure));
      const update = (params: PageParams) => {
        setError(undefined);
        void page.updateParams(params).catch(showError);
      };
      return (
        <Box h="100dvh" display="flex" flexDirection="column" minW="0" bg="bg" color="fg">
          {error && <MonitoringError message={error} t={t} dismiss={() => setError(undefined)} />}
          <Box flex="1" minH="0">
            {resource ? (
              <WorkspaceMonitoringDetail
                key={`${resource.id}:${range}`}
                client={client}
                machineId={resource.id}
                range={range}
                changeRange={(value) => update({ "monitoring-range": value })}
                locale={locale}
                t={t}
                openOutput={(resource) =>
                  void client.navigation.open({ kind: "page", page: deployedMachinePageRef, resource }).catch(showError)
                }
              />
            ) : (
              <WorkspaceMonitoringDashboard
                key={range}
                client={client}
                range={range}
                locale={locale}
                t={t}
                update={update}
                state={typeof params?.["monitoring-state"] === "string" ? params["monitoring-state"] : undefined}
                name={typeof params?.["monitoring-name"] === "string" ? params["monitoring-name"] : undefined}
                open={(resource) =>
                  void client.navigation
                    .open({
                      kind: "page",
                      page: monitoringDetailPageRef,
                      resource,
                      params: { "monitoring-range": range },
                    })
                    .catch(showError)
                }
              />
            )}
          </Box>
        </Box>
      );
    }

    root.render(
      <ChakraProvider value={psTheme}>
        <Monitoring />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
