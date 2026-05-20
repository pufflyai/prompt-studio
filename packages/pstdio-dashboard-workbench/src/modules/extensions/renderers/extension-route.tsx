import { Badge, Code, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { EmptyState, SurfaceListRow, SurfacePanel } from "@/services/components/surface";
import { useExtensionInstances } from "../hooks/use-extensions";

export const ExtensionRoute = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const routePath = input.placement.resource?.id ?? "";
  const extensions = useExtensionInstances();

  return (
    <SurfacePanel title="Extension route" subtitle={routePath || undefined}>
      <Stack gap="lg" maxW="640px">
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Extension routes resolve through workbench resources. The route <Code>{routePath || "—"}</Code> would host the
          contributed webview here.
        </Text>
        {extensions.length === 0 ? (
          <EmptyState title="No extensions installed" />
        ) : (
          <Stack gap="xs">
            <Text textStyle="label/S/semibold" color="fg.muted" textTransform="uppercase">
              Installed extensions
            </Text>
            {extensions.map((extension) => (
              <SurfaceListRow
                key={extension.id}
                icon="Blocks"
                title={extension.displayName}
                description={extension.namespace}
                trailing={
                  <Badge colorPalette={extension.enabled ? "green" : "gray"}>
                    {extension.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                }
              />
            ))}
          </Stack>
        )}
      </Stack>
    </SurfacePanel>
  );
};
