import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { WORKBENCH_SERVICES } from "../../content/workbench-services";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { DemoWorkbench } from "../examples/demo-workbench";
import { ExtensionsDemo } from "../service-demos/extensions-demo";
import { NavigationDemo } from "../service-demos/navigation-demo";
import { NotificationsDemo } from "../service-demos/notifications-demo";
import { SearchDemo } from "../service-demos/search-demo";
import { ThemesDemo } from "../service-demos/themes-demo";

const SERVICE_DEMOS = {
  search: SearchDemo,
  notifications: NotificationsDemo,
  navigation: NavigationDemo,
  extensions: ExtensionsDemo,
  themes: ThemesDemo,
};

export const WorkbenchServices = () => {
  const styles = useStoryStyles();
  return (
    <>
      <Stack gap="sm">
        <Text as="h1" textStyle={{ base: "heading/M", md: "heading/L" }}>
          Easy to extend from a solid foundation.
        </Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Prompt Studio ships with builtin features that every tool can use.
        </Text>
      </Stack>
      {WORKBENCH_SERVICES.map((service) => {
        const Demo = SERVICE_DEMOS[service.id];
        return (
          <Box key={service.id} as="section" css={styles.section} aria-labelledby={`service-${service.id}`}>
            <HStack gap="md" align="start">
              <Icon as={service.icon} boxSize="6" color="fg.muted" />
              <Stack gap="sm">
                <Text id={`service-${service.id}`} as="h2" textStyle="heading/S">
                  {service.name}
                </Text>
                <Text textStyle="paragraph/M/regular" color="fg.muted">
                  {service.description}
                </Text>
              </Stack>
            </HStack>
            <DemoWorkbench>
              <Demo />
            </DemoWorkbench>
          </Box>
        );
      })}
    </>
  );
};
