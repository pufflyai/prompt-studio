import { Box } from "@chakra-ui/react";
import { Github } from "lucide-react";
import { IntegrationCard } from "@/components/primitives/integration-card";
import type { TagEditorValue } from "@/components/tag-editor";
import { TagEditor } from "@/components/tag-editor";
import { GalleryCard } from "../gallery-frame";

const tagValues = [
  { id: "blocked", name: "blocked", color: "red", icon: "flame", sortOrder: 10 },
  { id: "ready", name: "ready", color: "green", icon: "status-done", sortOrder: 20, isDefault: true },
  { id: "review", name: "review", color: "purple", icon: "eye", sortOrder: 30 },
] satisfies TagEditorValue[];

export const SettingsCompositeCards = () => {
  return (
    <>
      <GalleryCard title="Tags" names={["TagEditor"]} gridColumn={{ base: "auto", xl: "span 2" }}>
        <Box overflowX="auto" minW="0">
          <TagEditor
            title="Ticket tags"
            description="Manage tag values used across boards and filters."
            values={tagValues}
            onValuesChange={() => undefined}
            showDefault
          />
        </Box>
      </GalleryCard>

      <GalleryCard title="Integration card" names={["IntegrationCard"]}>
        <IntegrationCard
          id="github"
          icon={<Github />}
          name="GitHub"
          description="Link repositories and track code changes."
          version="1.2.0"
          active={false}
        />
      </GalleryCard>
    </>
  );
};
