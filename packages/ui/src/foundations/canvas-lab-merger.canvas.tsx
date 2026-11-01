import { Box, Button, Field, Flex, Grid, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SegmentedControl, Slider, Switch } from "@/components/primitives";

export default {
  title: "Canvas/Lab merger proposal",
  description: "Proposed frame controls. Values and saved versions are local fixtures and reset on reload.",
};

const defaults = { density: 6, opacity: 60 };

const StudyFrame = (props: { motion?: boolean }) => {
  const { motion = false } = props;
  const [values, setValues] = useState(defaults);
  const [saved, setSaved] = useState(defaults);
  const [name, setName] = useState("Soft dots");
  const [version, setVersion] = useState("Default");
  const [selected, setSelected] = useState(true);
  const [time, setTime] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [rate, setRate] = useState("1");
  const dirty = values.density !== saved.density || values.opacity !== saved.opacity;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setTime((current) => {
        const next = current + Number(rate) / 10;
        return loop ? next % 6 : Math.min(next, 6);
      });
    }, 100);
    return () => clearInterval(timer);
  }, [playing, loop, rate]);

  useEffect(() => {
    if (!loop && time === 6) setPlaying(false);
  }, [loop, time]);

  return (
    <Stack p="md" gap="md" bg="bg" h="full">
      <Flex gap="sm" align="center" justify="space-between">
        <Text textStyle="label/M/medium">{motion ? "Chat turn" : `Dots · ${version}`}</Text>
        <Button size="xs" variant="outline" onClick={() => setSelected(!selected)}>
          {selected ? "Clear selection" : "Select frame"}
        </Button>
      </Flex>
      <Flex flex="1" minH="0" gap="md">
        <Box flex="1" minW="0" onClick={() => setSelected(true)}>
          <Box flex="1" minH="40" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" p="lg">
            {motion ? (
              <Stack gap="md" opacity={values.opacity / 100}>
                <Text textStyle="paragraph/S/regular">Build a tool for reviewing UI motion.</Text>
                <Box borderWidth="1px" borderColor="border.subtle" p="md" opacity={Math.min(1, time / 2)}>
                  <Text textStyle="label/S/medium">{time < 3 ? "Working" : "Ready for review"}</Text>
                </Box>
                {time >= 3 && <Text textStyle="paragraph/S/regular">The preview is ready.</Text>}
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
        <Stack
          as="aside"
          aria-label="Frame editor"
          w="xs"
          flexShrink="0"
          p="md"
          borderStartWidth="1px"
          borderColor="border.subtle"
        >
          <Text textStyle="label/M/medium">Frame editor</Text>
          {selected ? (
            <>
              <Text textStyle="label/S/medium">{motion ? "Chat turn" : "Dots"}</Text>
              <Stack gap="md">
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
                {motion && (
                  <>
                    <Switch checked={loop} onCheckedChange={({ checked }) => setLoop(checked)}>
                      Loop
                    </Switch>
                    <SegmentedControl
                      aria-label="Playback speed"
                      options={[
                        { value: "0.5", label: "0.5×" },
                        { value: "1", label: "1×" },
                        { value: "2", label: "2×" },
                      ]}
                      value={rate}
                      onValueChange={setRate}
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
                <Text role="status" textStyle="paragraph/S/regular" color="fg.muted">
                  {dirty ? "Temporary changes" : `Saved version: ${version}`}
                </Text>
              </Stack>{" "}
              {motion && (
                <Stack gap="sm">
                  <Flex gap="sm" align="center">
                    <Button
                      size="xs"
                      onClick={() => {
                        if (time === 6) setTime(0);
                        setPlaying(!playing);
                      }}
                    >
                      {playing ? "Pause" : "Play"}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setTime(0)}>
                      Restart
                    </Button>
                    <Text textStyle="mono/XS">{time.toFixed(1)} / 6.0 s</Text>
                  </Flex>
                  <Slider
                    aria-label={["Time"]}
                    min={0}
                    max={6}
                    step={0.1}
                    value={[time]}
                    onValueChange={({ value }) => {
                      setPlaying(false);
                      setTime(value[0]);
                    }}
                  />
                </Stack>
              )}
            </>
          ) : (
            <Text color="fg.muted">Select a frame</Text>
          )}
        </Stack>
      </Flex>
    </Stack>
  );
};

export const ShaderParameters = () => <StudyFrame />;
export const MotionParameters = () => <StudyFrame motion />;
