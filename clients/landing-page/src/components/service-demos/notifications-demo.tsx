import { Badge, Box, Button, HStack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { Bell, Check } from "lucide-react";
import { useState } from "react";
import { DEMO_NOTIFICATIONS } from "../../content/service-demo-content";
import { useStoryStyles } from "../../hooks/use-landing-styles";

export const NotificationsDemo = () => {
  const [readIds, setReadIds] = useState<string[]>([]);
  const styles = useStoryStyles();
  const unread = DEMO_NOTIFICATIONS.length - readIds.length;
  return (
    <Box css={styles.panel}>
      <HStack css={styles.panelHeader} flexWrap="wrap">
        <Bell size={16} />
        <Text flex="1">Notifications</Text>
        <Badge>{unread} unread</Badge>
        <Button
          size="xs"
          variant="ghost"
          disabled={unread === 0}
          onClick={() => setReadIds(DEMO_NOTIFICATIONS.map((item) => item.id))}
        >
          Mark all read
        </Button>
      </HStack>
      <Box css={styles.panelBody} role="group" aria-label="Example notifications">
        {DEMO_NOTIFICATIONS.map((item) => (
          <ListRow
            key={item.id}
            label={item.title}
            description={item.description}
            icon={<item.icon size={16} />}
            onActivate={() => setReadIds((current) => (current.includes(item.id) ? current : [...current, item.id]))}
            endContent={
              readIds.includes(item.id) ? <Check size={16} aria-label="Read" /> : <Badge colorPalette="blue">New</Badge>
            }
          />
        ))}
      </Box>
    </Box>
  );
};
