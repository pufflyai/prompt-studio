import { Box, Flex } from "@chakra-ui/react";
import { Activity, EmptyState, ScrollArea } from "@pstdio/ui";
import type { ShellCore } from "../core";
import { ShellIcon } from "./shell-icons";

interface ShellActivityFeedProps {
  shell: ShellCore;
  title?: string;
  resourceUri?: string;
  kind?: string;
}

const activityIconName = (input?: string) => {
  if (input === "error") return "XCircle";
  if (input === "warning") return "AlertTriangle";
  if (input === "success") return "CheckCircle2";
  if (input === "info") return "Info";
  return "Activity";
};

export const ShellActivityFeed = (props: ShellActivityFeedProps) => {
  const { shell, title = "Activity", resourceUri, kind } = props;
  const items = shell.activity.listItems({ resourceUri, kind });

  return (
    <Flex as="section" direction="column" h="full" minH="0" minW="0" aria-label={title}>
      <ScrollArea height="100%">
        <Box py="sm">
          <Activity.Root>
            {items.length > 0 ? (
              <Activity.Feed>
                <Activity.Timeline>
                  {items.map((item) => (
                    <Activity.Event
                      key={item.id}
                      actor={{ name: item.source }}
                      timestamp={item.createdAt}
                      icon={<ShellIcon name={activityIconName(item.severity ?? item.kind)} size={12} />}
                    >
                      <span>{item.title}</span>
                      {item.message ? <span>{item.message}</span> : null}
                    </Activity.Event>
                  ))}
                </Activity.Timeline>
              </Activity.Feed>
            ) : (
              <EmptyState minH="12rem" title="No activity" />
            )}
          </Activity.Root>
        </Box>
      </ScrollArea>
    </Flex>
  );
};
