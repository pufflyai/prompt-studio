import { Button, Carousel, Heading, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { HomeIcon } from "./home-icon";

const ideas = [
  {
    title: "Project pulse",
    prompt:
      "Customize this Home page with a project dashboard. Summarize recent activity, work in progress, and the next three things I should look at. Link each item to its source.",
  },
  {
    title: "Release checklist",
    prompt:
      "Turn this Home page into a release checklist. Show the current release, open blockers, and status of the checks I need before shipping. Link to the relevant tickets and pull requests.",
  },
  {
    title: "Team handoff",
    prompt:
      "Build a handoff view for this Home page. Show what changed since the last handoff, decisions still open, and the people or tickets to follow up with.",
  },
  {
    title: "Launchpad",
    prompt:
      "Make this Home page a launchpad for the work I repeat. Inspect this project, identify useful commands and views, and add shortcuts to run or open them.",
  },
];

const HomePromptIdea = (props: { title: string; prompt: string }) => {
  const { title, prompt } = props;
  const text = useRef<HTMLParagraphElement>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "selected">();
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("copied");
      return;
    } catch {
      // The text remains copyable in webviews where the browser denies the clipboard API.
    }
    const element = text.current;
    const selection = element?.ownerDocument.getSelection();
    if (!element || !selection) return;
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    setCopyStatus("selected");
  };
  return (
    <Stack gap="xs">
      <HStack justify="space-between">
        <Heading as="h3" textStyle="label/M/medium">
          {title}
        </Heading>
        <Button variant="ghost" size="xs" onClick={() => void copyPrompt()}>
          Copy prompt
        </Button>
      </HStack>
      <Text ref={text} textStyle="paragraph/S/regular" color="fg.muted" userSelect="text">
        {prompt}
      </Text>
      {copyStatus && (
        <Text role="status" textStyle="label/S/regular" color="fg.muted">
          {copyStatus === "copied" ? "Prompt copied." : "Prompt selected. Press Cmd+C or Ctrl+C to copy it."}
        </Text>
      )}
    </Stack>
  );
};

export const HomePromptCarousel = () => (
  <Carousel.Root aria-label="Ideas for your Home page" slideCount={ideas.length} loop>
    <Stack gap="sm" minW="0">
      <HStack justify="space-between">
        <Heading as="h2" textStyle="label/L/regular">
          Ideas for your Home page
        </Heading>
        <Carousel.Control gap="xs" flexShrink={0}>
          <Carousel.PrevTrigger asChild>
            <IconButton variant="ghost" size="sm" aria-label="Previous idea">
              <HomeIcon name="chevron-left" size={16} />
            </IconButton>
          </Carousel.PrevTrigger>
          <Carousel.NextTrigger asChild>
            <IconButton variant="ghost" size="sm" aria-label="Next idea">
              <HomeIcon name="chevron-right" size={16} />
            </IconButton>
          </Carousel.NextTrigger>
        </Carousel.Control>
      </HStack>
      <Carousel.ItemGroup rounded="sm" borderWidth="1px" borderColor="border.subtle" bg="bg.subtle">
        {ideas.map(({ title, prompt }, index) => (
          <Carousel.Item key={title} index={index} p="md">
            <HomePromptIdea title={title} prompt={prompt} />
          </Carousel.Item>
        ))}
      </Carousel.ItemGroup>
    </Stack>
  </Carousel.Root>
);
