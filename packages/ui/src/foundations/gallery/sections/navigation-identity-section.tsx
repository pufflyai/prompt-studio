import { Avatar, Badge, Box, HStack, Icon, Stack, Tabs, Text } from "@chakra-ui/react";
import { Clock, MessageSquare, Settings, UserRound, Users, X } from "lucide-react";
import { GalleryCard, GallerySection } from "../gallery-frame";

interface GalleryAvatarProps {
  name: string;
  label: string;
  colorPalette: string;
  size: "2xs" | "xs" | "sm";
  status?: "online" | "away" | "offline";
}

const statusColor = {
  away: "yellow.500",
  offline: "fg.subtle",
  online: "green.500",
};

const GalleryAvatar = (props: GalleryAvatarProps) => {
  const { name, label, colorPalette, size, status } = props;

  return (
    <HStack gap="xs" minW="0">
      <Box position="relative" flexShrink={0}>
        <Avatar.Root size={size} colorPalette={colorPalette}>
          <Avatar.Fallback name={name} />
        </Avatar.Root>
        {status ? (
          <Box
            position="absolute"
            right="-1px"
            bottom="-1px"
            boxSize="0.45rem"
            borderRadius="full"
            borderWidth="1px"
            borderColor="bg.subtle"
            background={statusColor[status]}
          />
        ) : null}
      </Box>
      <Stack gap="0" minW="0">
        <Text textStyle="label/S/medium" truncate>
          {name}
        </Text>
        <Text textStyle="label/XS" color="fg.muted" truncate>
          {label}
        </Text>
      </Stack>
    </HStack>
  );
};

export const NavigationIdentitySection = () => {
  return (
    <GallerySection title="Tabs & identity" description="Dense tab navigation and user or agent identity treatments.">
      <GalleryCard title="Subtle tabs" names={["Tabs"]}>
        <Tabs.Root defaultValue="activity" variant="subtle">
          <Tabs.List>
            <Tabs.Trigger value="activity">
              <Icon as={Clock} />
              Activity
              <Icon as={X} color="fg.subtle" />
            </Tabs.Trigger>
            <Tabs.Trigger value="comments">
              <Icon as={MessageSquare} />
              Comments
              <Icon as={X} color="fg.subtle" />
            </Tabs.Trigger>
            <Tabs.Trigger value="people" disabled>
              <Icon as={Users} />
              People
              <Icon as={X} color="fg.subtle" />
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="activity" paddingTop="sm">
            <Stack gap="xs">
              <Text textStyle="label/S/medium">Build queue</Text>
              <Text textStyle="label/S/regular" color="fg.muted">
                Three runs are waiting for review.
              </Text>
            </Stack>
          </Tabs.Content>
          <Tabs.Content value="comments" paddingTop="sm">
            <Text textStyle="label/S/regular" color="fg.muted">
              Latest handoff notes and replies.
            </Text>
          </Tabs.Content>
        </Tabs.Root>
      </GalleryCard>

      <GalleryCard title="Tab sizes" names={["Tabs"]}>
        <Stack gap="sm">
          <Tabs.Root defaultValue="details" variant="subtle" size="xs">
            <Tabs.List>
              <Tabs.Trigger value="details">
                <Icon as={UserRound} />
                Details
                <Icon as={X} color="fg.subtle" />
              </Tabs.Trigger>
              <Tabs.Trigger value="settings">
                <Icon as={Settings} />
                Settings
                <Icon as={X} color="fg.subtle" />
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
          <Tabs.Root defaultValue="details" variant="subtle" size="sm">
            <Tabs.List>
              <Tabs.Trigger value="details">
                <Icon as={UserRound} />
                Details
                <Icon as={X} color="fg.subtle" />
              </Tabs.Trigger>
              <Tabs.Trigger value="settings">
                <Icon as={Settings} />
                Settings
                <Icon as={X} color="fg.subtle" />
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
          <Tabs.Root defaultValue="details" variant="subtle" size="md">
            <Tabs.List>
              <Tabs.Trigger value="details">
                <Icon as={UserRound} />
                Details
                <Icon as={X} color="fg.subtle" />
              </Tabs.Trigger>
              <Tabs.Trigger value="settings">
                <Icon as={Settings} />
                Settings
                <Icon as={X} color="fg.subtle" />
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </Stack>
      </GalleryCard>

      <GalleryCard title="Avatars" names={["Avatar"]}>
        <Stack gap="sm">
          <GalleryAvatar name="Jordan Lee" label="Reviewer" colorPalette="blue" size="sm" status="online" />
          <GalleryAvatar name="System Agent" label="Automation" colorPalette="purple" size="xs" status="away" />
          <GalleryAvatar name="Mira Patel" label="Offline" colorPalette="gray" size="2xs" status="offline" />
        </Stack>
        <HStack gap="0" paddingTop="xs">
          {["AL", "MK", "SC", "PT"].map((name, index) => (
            <Avatar.Root
              key={name}
              size="xs"
              colorPalette={index % 2 === 0 ? "blue" : "green"}
              marginLeft={index === 0 ? "0" : "-0.35rem"}
              borderWidth="1px"
              borderColor="bg.subtle"
            >
              <Avatar.Fallback name={name} />
            </Avatar.Root>
          ))}
          <Badge marginLeft="xs" variant="number" colorPalette="gray">
            +4
          </Badge>
        </HStack>
      </GalleryCard>
    </GallerySection>
  );
};
