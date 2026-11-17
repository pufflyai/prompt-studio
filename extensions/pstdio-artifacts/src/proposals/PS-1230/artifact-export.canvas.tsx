import { Box } from "@chakra-ui/react";
import { exampleArtifact } from "../../components/artifact-story-fixture";
import { ArtifactTranslationStory } from "../../components/artifact-translation-story";
import { ArtifactReader } from "./artifact-reader";
export default { title: "Proposals/PS-1230 Artifact export" };
export const ExportArtifact = () => (
  <ArtifactTranslationStory>
    <Box height="100dvh">
      <ArtifactReader
        content={{ ...exampleArtifact, html: "<h1>Release overview</h1>" }}
        revisions={[exampleArtifact]}
        onSelect={() => {}}
        onExport={() => {}}
      />
    </Box>
  </ArtifactTranslationStory>
);
