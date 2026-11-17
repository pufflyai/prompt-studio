import { Button, Stack } from "@chakra-ui/react";
import { SettingsActions } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useState } from "react";

/** Exercise the existing settings action pattern with synthetic, local values. */
export const PreferenceSavePreview = () => {
  const [accepted, setAccepted] = useState(0);
  const [draft, setDraft] = useState<number>();
  const [fail, setFail] = useState(true);
  return (
    <Stack gap="md">
      <Button variant="outline" onClick={() => setFail((value) => !value)}>
        {fail ? "Next save fails" : "Next save succeeds"}
      </Button>
      <Button variant="outline" onClick={() => setAccepted((value) => value + 1)}>
        Change accepted value elsewhere
      </Button>
      <ParamEditor
        params={[{ id: "size", name: "Size", type: "number", defaultValue: accepted }]}
        defaultValues={draft === undefined ? {} : { size: draft }}
        onChange={(_name, value) => setDraft(Number(value))}
      />
      <SettingsActions
        dirty={draft !== undefined}
        onReset={() => setDraft(undefined)}
        onSave={async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 800));
          if (fail) throw new Error("Could not save this preference. Try again.");
          setAccepted(draft ?? accepted);
          setDraft(undefined);
        }}
      />
    </Stack>
  );
};
