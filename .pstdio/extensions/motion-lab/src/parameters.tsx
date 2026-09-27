import { Text, Textarea } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { ParamEditor, type ParamValue } from "@pstdio/ui/param-editor";
import { useState } from "react";
import { optionGroups } from "./motion-options";
import { useReview } from "./review-context";

export const Parameters = () => {
  const { state, update } = useReview();
  const { settings } = state;
  const [copyStatus, setCopyStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
      setCopyStatus("Configuration copied.");
    } catch {
      setCopyStatus("Select and copy the configuration below.");
    }
  };
  const change = (id: string, value: ParamValue) => {
    if (id === "export") {
      void copy();
      return;
    }
    if (id === "comparison") {
      void update({ settings: { comparison: value === "compare" } });
      return;
    }
    const [side, field] = id.split(".");
    if (side === "left" || side === "right") {
      void update({ settings: { [side]: { ...settings[side], [field]: value } } });
      return;
    }
    void update({ settings: { [id]: value } });
  };
  return (
    <ScrollArea h="full" minH="0" viewportProps={{ "aria-label": "Animation parameters" }}>
      <ParamEditor groups={optionGroups(settings)} onChange={change} />
      {copyStatus && (
        <Text role="status" textStyle="label/S/regular" p="sm">
          {copyStatus}
        </Text>
      )}
      {copyStatus.startsWith("Select") && (
        <Textarea
          aria-label="Configuration to copy"
          readOnly
          value={JSON.stringify(settings, null, 2)}
          onFocus={(event) => event.target.select()}
        />
      )}
    </ScrollArea>
  );
};
