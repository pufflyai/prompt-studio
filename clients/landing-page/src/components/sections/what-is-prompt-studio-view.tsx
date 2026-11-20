import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { landingChaptersSlotRecipe } from "../../theme/recipes/landing-chapters";
import { DownloadPicker } from "../downloads/download-picker";
import { ShapesScene, TogetherScene, WhyScene, YoursScene } from "../iso/iso-scenes";
import { PageScroll } from "../workbench/page-scroll";

const CHAPTERS: { id: string; eyebrow: string; title: string; body: string[]; Scene: () => ReactNode }[] = [
  {
    id: "why",
    eyebrow: "Why",
    title: "Your agents build great tools. Then you lose them.",
    body: [
      "A script in a folder. A page in Downloads. A dashboard on a localhost port you no longer remember. Each one worked once, and none of them are around when you need them next week.",
      "Prompt Studio gives every tool your agents build a place to live, so it's still there the next time you need it.",
    ],
    Scene: WhyScene,
  },
  {
    id: "any-shape",
    eyebrow: "One app, any shape",
    title: "The app takes the shape of the work.",
    body: [
      "Today it's a ticket board. Tomorrow you need an image editor, a 3D viewer, or a dashboard. Describe it and your agent reshapes the workbench around it.",
    ],
    Scene: ShapesScene,
  },
  {
    id: "together",
    eyebrow: "Tools that work together",
    title: "Your tools share what they make.",
    body: [
      "Drag a chart out of a dashboard and into your notes. It stays live, because both tools read the same data. Add a schedule and the note turns into a report that updates itself every Monday.",
    ],
    Scene: TogetherScene,
  },
  {
    id: "yours",
    eyebrow: "Yours",
    title: "It all stays yours.",
    body: [
      "Your tools run on your computer and your files stay in your folders. Prompt Studio is open source and works with the harness of your choice.",
    ],
    Scene: YoursScene,
  },
];

export const WhatIsPromptStudioView = () => {
  const styles = useSlotRecipe({ recipe: landingChaptersSlotRecipe })({});
  return (
    <PageScroll>
      <Box css={styles.page}>
        <Box css={styles.intro}>
          <Text textStyle="label/S/medium" color="fg.muted">
            What is Prompt Studio
          </Text>
          <Text as="h1" textStyle={{ base: "heading/L", md: "heading/XL" }}>
            An agentic workbench.
          </Text>
          <Text textStyle="paragraph/L/regular" color="fg.muted">
            One app where the tools your agents build live, run, and work together.
          </Text>
        </Box>
        {CHAPTERS.map(({ id, eyebrow, title, body, Scene }) => (
          <Box as="section" key={id} id={id} css={styles.chapter} aria-labelledby={`${id}-title`}>
            <Box css={styles.copy} data-part="copy">
              <Text textStyle="label/S/medium" color="fg.muted">
                {eyebrow}
              </Text>
              <Text as="h2" id={`${id}-title`} textStyle={{ base: "heading/M", md: "heading/L" }}>
                {title}
              </Text>
              {body.map((paragraph) => (
                <Text key={paragraph} textStyle="paragraph/M/regular" color="fg.muted">
                  {paragraph}
                </Text>
              ))}
            </Box>
            <Box css={styles.scene}>
              <Scene />
            </Box>
          </Box>
        ))}
        <Box css={styles.cta}>
          <Text as="h2" textStyle={{ base: "heading/M", md: "heading/L" }}>
            Try the agentic workbench.
          </Text>
          <DownloadPicker />
        </Box>
      </Box>
    </PageScroll>
  );
};
