import { Box, Tabs, useSlotRecipe } from "@chakra-ui/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { useChapterPlayback } from "../../hooks/use-chapter-playback";
import { landingCarouselSlotRecipe } from "../../theme/recipes/landing-carousel";
import { PageScroll } from "../workbench/page-scroll";

interface Chapter {
  id: string;
  label: string;
  href?: string;
  content: ReactNode;
}

interface ChapterCarouselProps {
  label: string;
  chapters: Chapter[];
  value: string;
  onChange: (value: string, automatic?: boolean) => void;
}

export const ChapterCarousel = (props: ChapterCarouselProps) => {
  const { label, chapters, value, onChange } = props;
  const styles = useSlotRecipe({ recipe: landingCarouselSlotRecipe })({});
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const index = chapters.findIndex((chapter) => chapter.id === value);
  const chapter = chapters[index];
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const select = (next: string, automatic = false) => {
    if (next !== value) onChange(next, automatic);
  };
  const playback = useChapterPlayback(rootRef, value, () => select(chapters[(index + 1) % chapters.length].id, true));

  useEffect(() => {
    const root = rootRef.current;
    root?.querySelectorAll('[role="tab"]')[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index]);

  return (
    <Box
      ref={rootRef}
      css={styles.root}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      data-playing={playback.playing}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") playback.setHovered(true);
      }}
      onPointerLeave={() => playback.setHovered(false)}
      onFocusCapture={() => playback.setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) playback.setFocused(false);
      }}
    >
      <Tabs.Root
        css={styles.tabs}
        size="sm"
        value={value}
        onValueChange={({ value }) => select(value)}
        // onChange owns routing. Controlled updates must not synthesize another link click.
        navigate={() => undefined}
        ids={{ trigger: (value) => `${id}-${value}-tab`, content: (value) => `${id}-${value}-panel` }}
      >
        <Box css={styles.header}>
          <Tabs.List css={styles.list} aria-label={`${label} chapters`}>
            {chapters.map((chapter) => (
              <Tabs.Trigger key={chapter.id} value={chapter.id} css={styles.trigger} asChild={Boolean(chapter.href)}>
                {chapter.href ? (
                  <a
                    href={chapter.href}
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                        return;
                      event.preventDefault();
                      select(chapter.id);
                    }}
                  >
                    {chapter.label}
                  </a>
                ) : (
                  chapter.label
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Box>
        <Box
          key={chapter.id}
          role="tabpanel"
          tabIndex={0}
          id={`${id}-${chapter.id}-panel`}
          aria-labelledby={`${id}-${chapter.id}-tab`}
          css={styles.slide}
          aria-roledescription="slide"
          onTouchStart={(event) => {
            touchStart.current = null;
            const target = event.target as HTMLElement;
            if (event.touches.length !== 1 || target.closest('button, a, input, textarea, select, [role="slider"]'))
              return;
            touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
          }}
          onTouchCancel={() => {
            touchStart.current = null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start) return;
            const dx = event.changedTouches[0].clientX - start.x;
            const dy = event.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            const next = Math.max(0, Math.min(chapters.length - 1, index + (dx < 0 ? 1 : -1)));
            if (next !== index) select(chapters[next].id);
          }}
        >
          <PageScroll>{chapter.content}</PageScroll>
        </Box>
      </Tabs.Root>
    </Box>
  );
};
