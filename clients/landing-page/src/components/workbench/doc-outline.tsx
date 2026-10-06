import { Box, chakra } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { LandingDocument } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";

interface DocOutlineProps {
  headings: LandingDocument["headings"];
}

/** Shared by documentation and blog articles. Marks the section being read on wide screens. */
export const DocOutline = (props: DocOutlineProps) => {
  const { headings } = props;
  const styles = useDocStyles();
  const sections = headings.filter((heading) => heading.depth === 2);
  const [current, setCurrent] = useState(sections[0]?.slug);
  const slugs = sections.map((heading) => heading.slug).join(" ");

  useEffect(() => {
    // The current section is the last heading above the top third of the screen,
    // so scrolling up marks the section being read, not the next one.
    const markCurrent = () => {
      const elements = slugs.split(" ").flatMap((slug) => document.getElementById(slug) ?? []);
      const band = window.innerHeight / 3;
      const passed = elements.filter((element) => element.getBoundingClientRect().top <= band);
      setCurrent((passed.at(-1) ?? elements[0])?.id);
    };
    markCurrent();
    // Capture scrolls from the reading pane, including anchor jumps past a heading.
    document.addEventListener("scroll", markCurrent, true);
    window.addEventListener("resize", markCurrent);
    return () => {
      document.removeEventListener("scroll", markCurrent, true);
      window.removeEventListener("resize", markCurrent);
    };
  }, [slugs]);

  if (sections.length < 2) return null;

  return (
    <Box as="nav" aria-label="On this page" css={styles.outline}>
      <Box css={styles.outlineTitle}>On this page</Box>
      {sections.map((heading) => (
        <chakra.a
          key={heading.slug}
          href={`#${heading.slug}`}
          css={styles.outlineLink}
          aria-current={heading.slug === current ? "location" : undefined}
        >
          {heading.text}
        </chakra.a>
      ))}
    </Box>
  );
};
