import { Badge, HStack, Stack } from "@chakra-ui/react";
import { MissingResourceBadge, ResourceBadge } from "@/components/primitives/resource-badge";
import { WorkspaceBadge } from "@/components/primitives/workspace-badge";
import { GalleryCard, GallerySection } from "../gallery-frame";

export const BadgesSection = () => {
  return (
    <GallerySection title="Badges & resources" description="Resource and workspace affordances.">
      <GalleryCard title="Badges" names={["Badge"]}>
        <Stack gap="sm">
          <HStack gap="xs" flexWrap="wrap">
            <Badge colorPalette="gray">Default</Badge>
            <Badge colorPalette="blue">Running</Badge>
            <Badge colorPalette="green">Ready</Badge>
            <Badge colorPalette="red">Blocked</Badge>
            <Badge colorPalette="purple">Review</Badge>
          </HStack>
          <HStack gap="xs" flexWrap="wrap">
            <Badge size="xs" variant="subtle" colorPalette="blue">
              xs subtle
            </Badge>
            <Badge size="sm" variant="number" colorPalette="blue">
              12
            </Badge>
            <Badge size="sm" variant="outline" colorPalette="gray">
              sm outline
            </Badge>
            <Badge size="md" variant="solid" colorPalette="green">
              md solid
            </Badge>
          </HStack>
        </Stack>
      </GalleryCard>

      <GalleryCard title="Resource badges" names={["ResourceBadge", "MissingResourceBadge"]}>
        <ResourceBadge fileName="analysis/report.md" size="md" tone="neutral" />
        <MissingResourceBadge referenceId="missing/resource.md" />
      </GalleryCard>

      <GalleryCard title="Workspace badge" names={["WorkspaceBadge"]}>
        <WorkspaceBadge workspaceType="worktree" shorthand="A1" initializing={false} />
      </GalleryCard>
    </GallerySection>
  );
};
