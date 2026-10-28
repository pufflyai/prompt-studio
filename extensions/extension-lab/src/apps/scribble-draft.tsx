import { Button } from "@chakra-ui/react";
import { useState } from "react";
import type { ExampleViewInput } from "../view-context";
import { ScribbleEditor } from "./scribble-editor";
import { scribbleStore } from "./scribble-store";
import { useScribbleDraft } from "./use-scribble-draft";

export const ScribbleDraftCanvas = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  const id = input.resource!.id;
  const draft = useScribbleDraft(input.host, id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const resource = await draft.save();
      await scribbleStore.refresh();
      await input.host.navigate({ kind: "viewer", operation: "replace", from: input.resource, resource });
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ScribbleEditor
      id={id}
      {...draft.value}
      disabled={!draft.ready || saving}
      error={error ?? draft.error}
      onTitleChange={(title) => draft.update({ title })}
      onIconChange={(icon) => draft.update({ icon })}
      onContentChange={(content) => draft.update({ content })}
      action={
        <Button size="sm" loading={saving} disabled={!draft.ready} onClick={() => void save()}>
          Save page
        </Button>
      }
    />
  );
};
