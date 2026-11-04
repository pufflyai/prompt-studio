import { Box, Button, Field, Flex, Grid, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { Film, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { KeyframeTimeline, moveLoopBoundary } from "@/components/keyframe-timeline";
import { ResizableSplitLayout } from "@/components/layout/resizable-split-layout";
import { ParamEditor } from "@/components/param-editor";
import { Slider } from "@/components/primitives";

export default {
  title: "Canvas/Lab merger proposal",
  description:
    "Selection-scoped panels resize to close. The timeline exposes a repeat toggle beside transport; pinch or Ctrl-scroll over its ruler to zoom. Animation ranges and speed settings belong to the timeline.",
};
const defaults = { density: 6, opacity: 60 };
const StudyFrame = (props: { motion?: boolean }) => {
  const { motion = false } = props;
  const [values, setValues] = useState(defaults);
  const [saved, setSaved] = useState(defaults);
  const [name, setName] = useState("Soft dots");
  const [version, setVersion] = useState("Default");
  const [selected, setSelected] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [time, setTime] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [rate, setRate] = useState(1);
  const [range, setRange] = useState({ start: 0, end: 6 });
  const dirty = values.density !== saved.density || values.opacity !== saved.opacity;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setTime((current) => {
        const next = current + rate / 10;
        if (next < range.end) return next;
        if (loop) return range.start;
        setPlaying(false);
        return range.end;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [playing, loop, rate, range]);
  return (
    <Stack p="md" gap="sm" bg="bg" h="full">
      <Flex justify="space-between">
        <Text textStyle="label/M/medium">{motion ? "Chat turn" : `Dots · ${version}`}</Text>
        <Button size="xs" variant="outline" onClick={() => setSelected(!selected)}>
          {selected ? "Clear selection" : "Select frame"}
        </Button>
      </Flex>
      <ResizableSplitLayout
        resizableSide="bottom"
        separator="line"
        defaultSizePx={184}
        minSizePx={64}
        collapsed={!selected || !motion || !timelineOpen}
        onCollapsedChange={(collapsed) => setTimelineOpen(!collapsed)}
        resizeLabel="Resize animation timeline"
        resizablePanel={
          selected && motion && timelineOpen ? (
            <KeyframeTimeline
              label="Animations · Chat turn"
              tracks={[{ id: "animation", label: "Animation", keyframes: [] }]}
              duration={6}
              currentTime={time}
              onTimeChange={(next) => {
                setPlaying(false);
                setTime(next);
              }}
              loop={loop}
              onLoopChange={setLoop}
              playing={playing}
              onPlayingChange={setPlaying}
              onRestart={() => setTime(range.start)}
              loopRange={range}
              onLoopRangeChange={setRange}
              settings={
                <ParamEditor
                  params={[
                    {
                      id: "rate",
                      type: "selection",
                      name: "Speed",
                      defaultValue: String(rate),
                      options: [0.5, 1, 2].map((value) => ({ id: String(value), name: `${value}×` })),
                    },
                    {
                      id: "start",
                      type: "number",
                      name: "Loop start",
                      min: 0,
                      max: moveLoopBoundary(range, "start", 6, 6, 60).start,
                      step: 1 / 60,
                      defaultValue: range.start,
                    },
                    {
                      id: "end",
                      type: "number",
                      name: "Loop end",
                      min: moveLoopBoundary(range, "end", 0, 6, 60).end,
                      max: 6,
                      step: 1 / 60,
                      defaultValue: range.end,
                    },
                  ]}
                  onChange={(id, value) => {
                    if (id === "rate") setRate(Number(value));
                    if (id === "start") setRange({ ...range, start: Number(value) });
                    if (id === "end") setRange({ ...range, end: Number(value) });
                  }}
                />
              }
              markers={[{ id: "ready", time: 3, label: "Ready" }]}
            />
          ) : null
        }
        contentPanel={
          <ResizableSplitLayout
            resizableSide="right"
            separator="line"
            defaultSizePx={280}
            minSizePx={160}
            collapsed={!selected || !editorOpen}
            onCollapsedChange={(collapsed) => setEditorOpen(!collapsed)}
            resizeLabel="Resize frame editor"
            resizablePanel={
              <Stack as="aside" aria-label="Frame editor" p="md" gap="md">
                {selected && editorOpen && (
                  <>
                    <Text textStyle="label/S/medium">Opacity · {values.opacity}%</Text>
                    <Slider
                      aria-label={["Opacity"]}
                      min={0}
                      max={100}
                      value={[values.opacity]}
                      onValueChange={({ value }) => setValues({ ...values, opacity: value[0] })}
                    />
                    {!motion && (
                      <>
                        <Text textStyle="label/S/medium">Density · {values.density}</Text>
                        <Slider
                          aria-label={["Density"]}
                          min={2}
                          max={12}
                          step={1}
                          value={[values.density]}
                          onValueChange={({ value }) => setValues({ ...values, density: value[0] })}
                        />
                      </>
                    )}
                    <Button variant="ghost" onClick={() => setValues(saved)}>
                      Reset parameters
                    </Button>
                    {!motion && (
                      <>
                        <Field.Root>
                          <Field.Label>Version name</Field.Label>
                          <Input size="sm" value={name} onChange={(event) => setName(event.target.value)} />
                        </Field.Root>
                        <Button
                          variant="primary"
                          disabled={!dirty || !name.trim()}
                          onClick={() => {
                            setSaved(values);
                            setVersion(name.trim());
                          }}
                        >
                          Save as new version
                        </Button>
                      </>
                    )}
                  </>
                )}
              </Stack>
            }
            contentPanel={
              <Box flex="1" minW="0" position="relative">
                {selected && (
                  <Flex position="absolute" top="sm" right="sm" gap="xs">
                    {motion && !timelineOpen && (
                      <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label="Open animation timeline"
                        onClick={() => setTimelineOpen(true)}
                      >
                        <Film />
                      </IconButton>
                    )}
                    {!editorOpen && (
                      <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label="Open frame parameters"
                        onClick={() => setEditorOpen(true)}
                      >
                        <SlidersHorizontal />
                      </IconButton>
                    )}
                  </Flex>
                )}
                <Box
                  onClick={() => setSelected(true)}
                  p="lg"
                  minH="40"
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border.subtle"
                >
                  {motion ? (
                    <Stack opacity={values.opacity / 100}>
                      <Text>Build a tool for reviewing UI motion.</Text>
                      <Text>{time < 3 ? "Working" : "Ready for review"}</Text>
                    </Stack>
                  ) : (
                    <Grid templateColumns={`repeat(${values.density}, 1fr)`} gap="md" opacity={values.opacity / 100}>
                      {Array.from({ length: values.density * 4 }, (_, index) => (
                        <Box key={index} boxSize="2" borderRadius="full" bg="fg.muted" />
                      ))}
                    </Grid>
                  )}
                </Box>
              </Box>
            }
          />
        }
      />
    </Stack>
  );
};
export const ShaderParameters = () => <StudyFrame />;
export const MotionParameters = () => <StudyFrame motion />;
