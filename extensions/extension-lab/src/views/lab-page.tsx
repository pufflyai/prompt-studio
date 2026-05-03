import { Container, Grid, Heading, Stack, Text } from "@chakra-ui/react";
import { CounterCard } from "../components/counter-card";
import { HostNotificationCard } from "../components/host-notification-card";
import { LabHostBridge } from "../components/lab-host-bridge";
import { NotesCard } from "../components/notes-card";
import { StatsCard } from "../components/stats-card";
import { ThemeCard } from "../components/theme-card";

export const LabPage = () => {
  return (
    <Container className="lab-page" as="main" maxW="5xl" paddingX="lg" paddingY="lg">
      <LabHostBridge />
      <Stack gap="lg">
        <Stack gap="xs">
          <Text textStyle="label/XS/medium" color="fg.accent-primary">
            Extension Lab
          </Text>
          <Heading as="h1" textStyle="heading/L/bold">
            Sandbox webview
          </Heading>
          <Text textStyle="paragraph/M/regular" color="fg.muted" maxW="2xl">
            A self-contained React surface for trying out the extension API. The counter runs through extension commands
            and persists per project with ctx.storage.
          </Text>
        </Stack>

        <StatsCard />

        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="md" alignItems="start">
          <CounterCard />
          <ThemeCard />
          <HostNotificationCard />
          <NotesCard />
        </Grid>
      </Stack>
    </Container>
  );
};
