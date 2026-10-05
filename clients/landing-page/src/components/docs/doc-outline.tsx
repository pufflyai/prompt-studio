import { Box, chakra } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { LandingDocument } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";

interface DocOutlineProps {
  headings: LandingDocument["headings"];
}

/** Lists the page's `##` headings on wide screens and marks the one in view. */
export const DocOutline = (props: DocOutlineProps) => {
  const { headings } = props;
  const styles = useDocStyles();
  const sections = headings.filter((heading) => heading.depth === 2);
  const [current, setCurrent] = useState(sections[0]?.slug);
  const slugs = sections.map((heading) => heading.slug).join(" ");

  useEffect(() => {
    const elements = slugs.split(" ").flatMap((slug) => document.getElementById(slug) ?? []);
    // The current section is the last heading above the top third of the screen,
    // so scrolling up marks the section being read, not the next one.
    const markCurrent = () => {
      const band = window.innerHeight / 3;
      const passed = elements.filter((element) => element.getBoundingClientRect().top <= band);
      setCurrent((passed.at(-1) ?? elements[0])?.id);
    };
    const observer = new IntersectionObserver(markCurrent, { rootMargin: "0px 0px -66% 0px" });
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
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
