import { Icon, IconButton, Link, Popover, Stack, Text } from "@chakra-ui/react";
import { ArrowUpRight, Info } from "lucide-react";

interface AutoBuildHelpProps {
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildHelp(props: AutoBuildHelpProps) {
  const { t } = props;
  return (
    <Popover.Root positioning={{ placement: "bottom-start", strategy: "fixed", hideWhenDetached: true }}>
      <Popover.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label={t("timeline.autoBuild.about", "About Auto Build")}>
          <Info />
        </IconButton>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content>
          <Popover.Body>
            <Stack gap="sm">
              <Text textStyle="paragraph/S/regular">
                {t(
                  "timeline.autoBuild.description",
                  "A supervisor uses your prompt to assign valid, unassigned tickets as capacity becomes available. It sleeps between checks and resumes when more work can run.",
                )}
              </Text>
              <Link
                variant="underline"
                href="https://prompt.studio/docs/extensions/planner/auto-build/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("timeline.autoBuild.documentation", "Auto Build documentation")}
                <Icon as={ArrowUpRight} boxSize="icon-xs" />
              </Link>
            </Stack>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
}
