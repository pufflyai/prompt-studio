import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import { createWebviewQueryClient, defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createRoot } from "react-dom/client";
import { PlannerReadError } from "../../views/planner-read-error";
import { AutoBuildControl } from "./auto-build-control";
import { timelineQueryData } from "./timeline-query";
import { usePlan } from "./use-plan";

function AutoBuildPanel({ host, t }: { host: GuestHost; t: (key: string, fallback?: string) => string }) {
  const { client, plan, error, retry } = usePlan(host);
  return (
    <ChakraProvider value={psTheme}>
      <Box h="lg" minH="0" position="relative" color="fg" bg="bg">
        <PlannerReadError error={error} retry={retry} />
        {plan ? (
          <AutoBuildControl
            host={host}
            client={client}
            t={t}
            data={timelineQueryData(plan, t, (target) => void client.navigation.open(target))}
            onClose={() => void client.placement.close()}
          />
        ) : null}
      </Box>
    </ChakraProvider>
  );
}
export default defineExtensionView({
  render({ mount, host, t }) {
    const root = createRoot(mount);
    root.render(<AutoBuildPanel host={host} t={t} />);
    return () => {
      root.unmount();
      createWebviewQueryClient(host).dispose();
    };
  },
});
