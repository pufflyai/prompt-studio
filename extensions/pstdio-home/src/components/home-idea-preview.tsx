import { Box, Center, Icon, Image } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";
import { type HomeIdea, homeIdeaScreenshotUrl } from "../home-ideas";

const QuestionMark = resolveIconComponent("circle-question-mark");

export const HomeIdeaPreview = ({ idea }: { idea: HomeIdea }) => {
  if (idea.kind === "explore") {
    return (
      <Center role="img" aria-label="Question mark" w="full" h="full">
        <Icon as={QuestionMark} boxSize="24" color="fg.muted" aria-hidden="true" />
      </Center>
    );
  }
  return (
    <Box>
      {(["light", "dark"] as const).map((mode) => (
        <Image
          key={mode}
          src={homeIdeaScreenshotUrl(idea.id, mode)}
          display={mode === "dark" ? { base: "none", _dark: "block" } : { base: "block", _dark: "none" }}
          alt={`${idea.title} example interface`}
          w="full"
          h="full"
          objectFit="cover"
          draggable={false}
          loading="lazy"
        />
      ))}
    </Box>
  );
};
