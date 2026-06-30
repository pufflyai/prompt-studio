import { Github } from "lucide-react";
import { IntegrationCard } from "@/components/integration-card";
import { MissingResourceBadge, ResourceBadge } from "@/components/resource-badge";
import { WorkspaceBadge } from "@/components/workspace-badge";
import { GalleryCard, GallerySection } from "../gallery-frame";

export const BadgesSection = () => {
  return (
    <GallerySection title="Badges & resources" description="Resource, workspace, and integration affordances.">
      <GalleryCard title="Resource badges" names={["ResourceBadge", "MissingResourceBadge"]}>
        <ResourceBadge fileName="analysis/report.md" size="md" tone="neutral" />
        <MissingResourceBadge referenceId="missing/resource.md" />
      </GalleryCard>

      <GalleryCard title="Workspace badge" names={["WorkspaceBadge"]}>
        <WorkspaceBadge workspaceType="worktree" shorthand="A1" initializing={false} />
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
    </GallerySection>
  );
};
