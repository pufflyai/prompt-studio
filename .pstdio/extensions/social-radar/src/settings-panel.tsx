import { Button, Field, Heading, HStack, Input, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { useRadarCommand } from "./host";
import type { defaults } from "./settings";

interface SettingsFormProps {
  initial: typeof defaults;
}
const SettingsForm = (props: SettingsFormProps) => {
  const { initial } = props;
  const command = useRadarCommand();
  const [values, setValues] = useState(initial);
  const save = useCommandMutation({
    command: (input: typeof defaults) => command("save-settings", { input }),
    invalidate: [["settings"]],
  });
  return (
    <Stack
      as="form"
      gap="md"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          ...values,
          topics: values.topics.map((value) => value.trim()).filter(Boolean),
          competitors: values.competitors.map((value) => value.trim()).filter(Boolean),
          communities: values.communities.map((value) => value.trim()).filter(Boolean),
        });
      }}
    >
      {(["topics", "competitors", "communities"] as const).map((key) => (
        <Field.Root key={key}>
          <Field.Label>{key[0].toUpperCase() + key.slice(1)}</Field.Label>
          <Textarea
            size="sm"
            aria-label={key}
            value={values[key].join("\n")}
            onChange={(event) => setValues({ ...values, [key]: event.target.value.split("\n") })}
          />
          <Field.HelperText>One per line.</Field.HelperText>
        </Field.Root>
      ))}
      <Field.Root>
        <Field.Label>Writing voice</Field.Label>
        <Textarea
          size="sm"
          aria-label="Writing voice"
          value={values.voice}
          onChange={(event) => setValues({ ...values, voice: event.target.value })}
        />
      </Field.Root>
      <Heading as="h3" textStyle="heading/S/bold">
        Daily search budgets
      </Heading>
      <SimpleGrid columns={{ base: 2, md: 3 }} gap="sm">
        {Object.entries(values.budgets).map(([site, count]) => (
          <Field.Root key={site}>
            <Field.Label>{site === "scrollScreens" ? "Screens per search" : site}</Field.Label>
            <Input
              size="sm"
              type="number"
              min={0}
              max={20}
              aria-label={`${site} budget`}
              value={count}
              onChange={(event) =>
                setValues({ ...values, budgets: { ...values.budgets, [site]: Number(event.target.value) } })
              }
            />
          </Field.Root>
        ))}
      </SimpleGrid>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Runs at 07:00 in the host machine’s local time. Log in to X and LinkedIn in your Codex browser. Turn off the
        daily schedule in project automations.
      </Text>
      {save.error && (
        <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
          {save.error.message}
        </Text>
      )}
      {save.isSuccess && (
        <Text role="status" textStyle="label/S/regular">
          Settings saved.
        </Text>
      )}
      <HStack>
        <Button type="submit" size="sm" loading={save.isPending}>
          Save settings
        </Button>
      </HStack>
    </Stack>
  );
};
export const Settings = () => {
  const command = useRadarCommand();
  const query = useCommandQuery({ queryKey: ["settings"], command: () => command<typeof defaults>("get-settings") });
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <Heading as="h2" textStyle="heading/M/bold">
            Social radar settings
          </Heading>
          {query.isPending && (
            <Text role="status" textStyle="paragraph/S/regular">
              Loading settings…
            </Text>
          )}
          {query.error && (
            <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
              {query.error.message}
            </Text>
          )}
          {query.data && <SettingsForm initial={query.data} />}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};
