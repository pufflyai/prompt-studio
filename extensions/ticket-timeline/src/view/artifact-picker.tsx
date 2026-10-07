// Select a published project artifact without copying its HTML into the timeline store.
import { chakra, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { artifactsChanged } from "../artifacts";
import { useLiveValue } from "./use-live-value";
import type { PlanClient } from "./use-plan";

const readLibrary = (client: PlanClient) => client.commands["artifact.list"]();
const libraryEvents = [artifactsChanged];

export function ArtifactPicker({
  client,
  value,
  onChange,
  disabled,
}: {
  client: PlanClient;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const { value: items, error } = useLiveValue(client, readLibrary, libraryEvents);
  return (
    <Stack gap="xs">
      <chakra.label htmlFor="timeline-artifact">Published artifact</chakra.label>
      <NativeSelect.Root disabled={disabled || !items?.length}>
        <NativeSelect.Field id="timeline-artifact" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose an artifact</option>
          {value && !items?.some(({ url }) => url === value) ? (
            <option value={value}>Linked artifact unavailable</option>
          ) : null}
          {items?.map(({ url, title }) => (
            <option key={url} value={url}>
              {title}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      {error ? (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      ) : null}
      {items?.length === 0 ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          Publish a prototype in the project’s artifact library to add it here.
        </Text>
      ) : null}
    </Stack>
  );
}
