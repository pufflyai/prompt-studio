import { AspectRatio, Button, Carousel, Heading, HStack, IconButton, Image, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import launchpad from "../assets/launchpad.png";
import projectPulse from "../assets/project-pulse.png";
import releaseChecklist from "../assets/release-checklist.png";
import teamHandoff from "../assets/team-handoff.png";
import { type HomeIdeaId, homeIdeas } from "../home-ideas";
import { HomeIcon } from "./home-icon";

const screenshots = {
  "project-pulse": projectPulse,
  "release-checklist": releaseChecklist,
  "team-handoff": teamHandoff,
  launchpad,
};

interface HomePromptCarouselProps {
  onBuild: (idea: HomeIdeaId) => Promise<void>;
}

export const HomePromptCarousel = ({ onBuild }: HomePromptCarouselProps) => {
  const [pending, setPending] = useState<HomeIdeaId>();
  const [error, setError] = useState<string>();
  const build = async (id: HomeIdeaId) => {
    if (pending) return;
    setPending(id);
    setError(undefined);
    try {
      await onBuild(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(undefined);
    }
  };
  return (
    <Stack gap="md" minW="0" w="full">
      <Heading as="h2" textStyle="label/L/regular">
        Turn this page into something else
      </Heading>
      <Carousel.Root
        aria-label="Home page ideas"
        slideCount={homeIdeas.length}
        slidesPerPage={1}
        loop
        w="full"
        minW="0"
      >
        <Carousel.ItemGroup>
          {homeIdeas.map(({ id, title, description }, index) => (
            <Carousel.Item key={id} index={index} minW="0">
              <SimpleCard as="article" aria-label={title} overflow="hidden">
                <AspectRatio ratio={16 / 10} bg="bg.subtle" borderBottomWidth="1px" borderColor="border">
                  <Image
                    src={new URL(screenshots[id], import.meta.url).href}
                    alt={`${title} example interface`}
                    objectFit="cover"
                    draggable={false}
                  />
                </AspectRatio>
                <SimpleCardBody display="flex" flexDirection="column" gap="md" p="lg">
                  <Stack gap="xs">
                    <Heading as="h3" textStyle="label/L/medium">
                      {title}
                    </Heading>
                    <Text textStyle="paragraph/S/regular" color="fg.muted">
                      {description}
                    </Text>
                  </Stack>
                  <Button
                    variant="solid"
                    alignSelf="flex-start"
                    size="sm"
                    loading={pending === id}
                    disabled={Boolean(pending)}
                    onClick={() => void build(id)}
                  >
                    Build this!
                  </Button>
                </SimpleCardBody>
              </SimpleCard>
            </Carousel.Item>
          ))}
        </Carousel.ItemGroup>
        <Carousel.Control justifyContent="space-between" gap="sm">
          <Carousel.IndicatorGroup>
            {homeIdeas.map(({ id, title }, index) => (
              <Carousel.Indicator key={id} index={index} aria-label={`Show ${title}`} />
            ))}
          </Carousel.IndicatorGroup>
          <HStack gap="xs">
            <Carousel.PrevTrigger asChild>
              <IconButton variant="ghost" size="sm" aria-label="Previous idea">
                <HomeIcon name="chevron-left" />
              </IconButton>
            </Carousel.PrevTrigger>
            <Carousel.NextTrigger asChild>
              <IconButton variant="ghost" size="sm" aria-label="Next idea">
                <HomeIcon name="chevron-right" />
              </IconButton>
            </Carousel.NextTrigger>
          </HStack>
        </Carousel.Control>
      </Carousel.Root>
      {error && (
        <AlertMessage status="error" title="Could not start building" onClose={() => setError(undefined)}>
          {error}
        </AlertMessage>
      )}
    </Stack>
  );
};
