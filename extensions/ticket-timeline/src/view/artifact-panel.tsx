// Attach a library prototype to a ticket or open the node's current published artifact.
import { Button, Stack, Text } from "@chakra-ui/react";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { useState } from "react";
import type { PlanRow } from "../contracts";
import { ArtifactPicker } from "./artifact-picker";
import { ArtifactPreview } from "./artifact-preview";
import type { PlanClient } from "./use-plan";

export function ArtifactPanel({
  row,
  client,
  onOpen,
}: {
  row: PlanRow;
  client: PlanClient;
  onOpen: (target: NavigationTarget) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(row.artifact?.url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async (link: string) => {
    setSaving(true);
    setError(undefined);
    try {
      await client.commands["artifact.attach"]({ ticket: row.id, url: link });
      setEditing(false);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };
  const open = () => {
    if (row.artifact?.target) {
      onOpen(row.artifact.target);
    }
  };
  return (
    <Stack gap="xs">
      {row.artifact ? (
        <>
          <Text textStyle="label/S/medium" color="fg.accent">
            ARTIFACT · {row.artifact.title}
          </Text>
          <ArtifactPreview key={row.artifact.revisionId ?? row.artifact.url} row={row} client={client} onOpen={open} />
        </>
      ) : null}
      {editing ? (
        <>
          <ArtifactPicker client={client} value={url} onChange={setUrl} disabled={saving} />
          <Button size="sm" disabled={!url || saving} loading={saving} onClick={() => void save(url)}>
            Link artifact
          </Button>
          {row.artifact ? (
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save("none")}>
              Remove artifact link
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {row.artifact ? "Change artifact" : "Link artifact"}
        </Button>
      )}
      {error ? (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
