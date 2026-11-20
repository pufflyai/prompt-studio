import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { RECORDING_LAYOUT, RECORDING_SIZE } from "../../content/recording-content";
import { TOOL_EXAMPLES, type ToolExampleId } from "../../content/tool-examples-content";
import { CANCELLED, Director } from "../../services/recording/director";
import { RECORDINGS } from "../../services/recording/recordings";
import { landingRecordingSlotRecipe } from "../../theme/recipes/landing-recording";
import { RECORDING_PANES } from "./recording-panes";

interface ToolRecordingProps {
  start: ToolExampleId;
  onSelect: (id: ToolExampleId) => void;
}

const ORDER = TOOL_EXAMPLES.map((example) => example.id);
const REGIONS = ["left", "main", "right", "bottom"] as const;

/**
 * A scripted recording of the workbench switching between tools. The window keeps its frame
 * while panels resize and content crossfades, the way a mode change looks in the app.
 */
export const ToolRecording = (props: ToolRecordingProps) => {
  const { start, onSelect } = props;
  const styles = useSlotRecipe({ recipe: landingRecordingSlotRecipe })({});
  const fitRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const directorRef = useRef<Director | null>(null);
  const modeRef = useRef(start);
  const [mode, setMode] = useState(start);
  const [cycle, setCycle] = useState(0);

  const show = (id: ToolExampleId) => {
    modeRef.current = id;
    setMode(id);
    setCycle((value) => value + 1);
  };

  const play = async (director: Director, from: ToolExampleId, jump: boolean) => {
    const run = director.next();
    let index = ORDER.indexOf(from);
    try {
      if (jump) {
        RECORDINGS[from].reset(director);
        show(from);
        await director.step(run, 800);
      }
      for (;;) {
        const id = ORDER[index];
        if (modeRef.current !== id) {
          await director.moveTo(run, director.find(`[data-mode-button=${id}]`));
          await director.click(run);
          RECORDINGS[id].reset(director);
          show(id);
          await director.step(run, 900);
        }
        await RECORDINGS[id].play(director, run);
        index = (index + 1) % ORDER.length;
      }
    } catch (error) {
      if (error !== CANCELLED) throw error;
    }
  };

  const select = (id: ToolExampleId) => {
    onSelect(id);
    if (directorRef.current) void play(directorRef.current, id, true);
  };

  // The recording starts once per mount; later restarts come from the tab buttons.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `play` only reads refs and state setters.
  useEffect(() => {
    const fit = fitRef.current!;
    const frame = windowRef.current!;
    const director = new Director(frame, cursorRef.current!);
    directorRef.current = director;
    const resize = new ResizeObserver(() => {
      const scale = Math.min(1, fit.clientWidth / RECORDING_SIZE.width);
      director.scale = scale;
      frame.style.transform = `scale(${scale})`;
      fit.style.height = `${RECORDING_SIZE.height * scale}px`;
    });
    resize.observe(fit);
    // Reduced motion keeps the first frame of each tool; the tabs still switch tools.
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new IntersectionObserver((entries) => {
      director.visible = entries[entries.length - 1].isIntersecting && !still;
      fit.parentElement!.style.setProperty("--rec-play", director.visible ? "running" : "paused");
    });
    seen.observe(fit);
    for (const id of ORDER) RECORDINGS[id].reset(director);
    void play(director, modeRef.current, true);
    return () => {
      director.stop();
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  const layout = RECORDING_LAYOUT[mode];
  return (
    <Box css={styles.root}>
      <Box css={styles.tabs} role="group" aria-label="Example tools">
        {TOOL_EXAMPLES.map((example) => (
          <chakra.button
            key={example.id}
            css={styles.tab}
            aria-pressed={example.id === mode}
            data-active={example.id === mode}
            onClick={() => select(example.id)}
          >
            <Box css={styles.bar}>
              <Box
                key={`${example.id}-${cycle}`}
                css={styles.fill}
                data-active={example.id === mode}
                style={{ animationDuration: `${RECORDING_LAYOUT[example.id].duration + 900}ms` }}
              />
            </Box>
            {example.name}
          </chakra.button>
        ))}
      </Box>
      <Box
        ref={fitRef}
        css={styles.fit}
        role="img"
        aria-label={TOOL_EXAMPLES.find((example) => example.id === mode)!.description}
      >
        <Box
          ref={windowRef}
          css={styles.window}
          style={{ width: RECORDING_SIZE.width, height: RECORDING_SIZE.height }}
          aria-hidden="true"
        >
          <Box
            css={styles.body}
            style={{
              gridTemplateColumns: `44px ${layout.left}px minmax(0, 1fr) ${layout.right}px`,
              gridTemplateRows: `minmax(0, 1fr) ${layout.bottom}px`,
            }}
          >
            {/* The rail is the mode switcher: the recorded cursor clicks it to change tools. */}
            <Box css={styles.rail}>
              {ORDER.map((id) => (
                <Box key={id} css={styles.railItem} data-mode-button={id} data-active={id === mode} />
              ))}
            </Box>
            {REGIONS.map((region) => (
              <Box key={region} css={styles.region} data-region={region}>
                {ORDER.map((id) => (
                  <Box key={id} css={styles.pane} data-active={id === mode}>
                    {RECORDING_PANES[id][region]}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
          <Box css={styles.status}>
            <span>{layout.status}</span>
            <span>main · synced</span>
          </Box>
          <Box ref={cursorRef} css={styles.cursor}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 1l13 7.5-6 1.2L6.3 16z" fill="white" stroke="black" strokeWidth="1" />
            </svg>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
