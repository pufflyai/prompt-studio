import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { landingChaptersSlotRecipe } from "../../theme/recipes/landing-chapters";
import { DownloadPicker } from "../downloads/download-picker";
import { ShapesScene, TogetherScene, WhyScene, YoursScene } from "../iso/iso-scenes";
import { PageScroll } from "../workbench/page-scroll";

const CHAPTERS: { id: string; title: string; body: string[]; Scene: () => ReactNode }[] = [
  {
    id: "why",
    title: "Your agents build great tools. Then you lose them.",
    body: [
      "A script in a folder. A page in Downloads. A dashboard on a localhost port you no longer remember. Each one worked once, and none of them are around when you need them next week.",
      "Prompt Studio gives every tool your agents build a place to live, so it's still there the next time you need it.",
    ],
    Scene: WhyScene,
  },
  {
    id: "any-shape",
    title: "The app takes the shape of the work.",
    body: [
      "Today it's a ticket board. Tomorrow you need an image editor, a 3D viewer, or a dashboard. Describe it and your agent reshapes the workbench around it.",
    ],
    Scene: ShapesScene,
  },
  {
    id: "together",
    title: "Your tools share what they make.",
    body: [
      "Move a ticket on your board and your dashboard updates with it, because both read the same tickets. Put a schedule on the dashboard and a weekly report fills itself in.",
    ],
    Scene: TogetherScene,
  },
  {
    id: "yours",
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
        {/* Set like a dictionary entry: headword, pronunciation and part of speech, numbered sense, example. */}
        <Box as="dl" css={styles.intro}>
          <Text as="dt">
            <Text as="h1" css={styles.headword}>
              agentic workbench
            </Text>
            <Text as="span" css={styles.pronunciation}>
              /əˈdʒen.tɪk ˈwɜːk.bentʃ/ <em>noun</em>
            </Text>
          </Text>
          <Text as="dd" css={styles.sense}>
            <Text as="span" css={styles.senseNumber}>
              1.
            </Text>
            One app where the tools your agents build live, run, and work together.
          </Text>
          <Text as="dd" css={styles.example}>
            “Prompt Studio is the agentic workbench where our release dashboard lives.”
          </Text>
        </Box>
        {CHAPTERS.map(({ id, title, body, Scene }) => (
          <Box as="section" key={id} id={id} css={styles.chapter} aria-labelledby={`${id}-title`}>
            <Box css={styles.copy} data-part="copy">
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
