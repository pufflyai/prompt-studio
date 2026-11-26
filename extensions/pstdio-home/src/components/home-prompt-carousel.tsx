import { AspectRatio, Button, Carousel, Heading, HStack, IconButton, Stack, Text, useCarousel } from "@chakra-ui/react";
import { AlertMessage, ScopedPopover as Popover, Portal, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { type HomeIdeaId, homeIdeas } from "../home-ideas";
import { HomeIcon } from "./home-icon";
import { HomeIdeaPreview } from "./home-idea-preview";

interface HomePromptCarouselProps {
  onBuild: (idea: HomeIdeaId) => Promise<void>;
}

export const HomePromptCarousel = ({ onBuild }: HomePromptCarouselProps) => {
  const [pending, setPending] = useState<HomeIdeaId>();
  const [error, setError] = useState<{ idea: HomeIdeaId; message: string }>();
  const carousel = useCarousel({
    slideCount: homeIdeas.length,
    slidesPerPage: 1,
    loop: true,
    onPageChange: ({ page }) => {
      if (error && homeIdeas[page]?.id !== error.idea) setError(undefined);
    },
  });
  const build = async (id: HomeIdeaId) => {
    if (pending) return;
    setPending(id);
    setError(undefined);
    try {
      await onBuild(id);
    } catch (error) {
      carousel.scrollTo(
        homeIdeas.findIndex((idea) => idea.id === id),
        true,
      );
      setError({ idea: id, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setPending(undefined);
    }
  };
  return (
    <Stack gap="md" minW="0" w="full">
      <Heading as="h2" textStyle="label/L/regular">
        Turn this page into something better
      </Heading>
      <Carousel.RootProvider value={carousel} aria-label="Home page ideas" w="full" minW="0">
        <Carousel.ItemGroup>
          {homeIdeas.map((idea, index) => {
            const { id, title, description, kind } = idea;
            const errorTitle = kind === "explore" ? "Could not explore ideas" : "Could not start building";
            return (
              <Carousel.Item key={id} index={index} minW="0">
                <SimpleCard as="article" aria-label={title} overflow="hidden">
                  <AspectRatio ratio={16 / 10} bg="bg.subtle" borderBottomWidth="1px" borderColor="border">
                    <HomeIdeaPreview idea={idea} />
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
                    <Popover.Root
                      open={error?.idea === id}
                      onOpenChange={({ open }) => {
                        if (!open) setError(undefined);
                      }}
                      positioning={{ placement: "bottom-start" }}
                    >
                      <Popover.Trigger asChild>
                        <Button
                          variant="solid"
                          alignSelf="flex-start"
                          size="sm"
                          loading={pending === id}
                          disabled={Boolean(pending)}
                          onClick={() => void build(id)}
                        >
                          {kind === "explore" ? "Get ideas" : "Build this!"}
                        </Button>
                      </Popover.Trigger>
                      {error?.idea === id && (
                        <Portal>
                          <Popover.Positioner>
                            <Popover.Content aria-label={errorTitle} p="0" w="popover-panel" maxW="90vw">
                              <AlertMessage
                                role="alert"
                                status="error"
                                title={errorTitle}
                                onClose={() => setError(undefined)}
                              >
                                {error?.idea === id ? error.message : undefined}
                              </AlertMessage>
                            </Popover.Content>
                          </Popover.Positioner>
                        </Portal>
                      )}
                    </Popover.Root>
                  </SimpleCardBody>
                </SimpleCard>
              </Carousel.Item>
            );
          })}
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
      </Carousel.RootProvider>
    </Stack>
  );
};
