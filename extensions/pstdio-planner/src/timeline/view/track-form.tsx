// Create a product feature track directly from the timeline.
import { Button, chakra, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { PlanClient } from "./use-plan";

export function TrackForm(props: { client: PlanClient; onDone: () => void }) {
  const { client, onDone } = props;
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await client.commands["timeline.track.create"]({ name });
      onDone();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <chakra.form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Stack gap="sm">
        <chakra.label htmlFor="track-name">Feature track name</chakra.label>
        <Input
          autoFocus
          id="track-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Catalogue auditing"
        />
        {error ? (
          <Text role="alert" color="fg.error">
            {error}
          </Text>
        ) : null}
        <Button type="submit" disabled={!name.trim() || saving} loading={saving}>
          Create track
        </Button>
      </Stack>
    </chakra.form>
  );
}
