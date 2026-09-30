import { ScrollArea } from "@pstdio/ui";
import { ParamEditor, type ParamValue } from "@pstdio/ui/param-editor";
import { optionGroups } from "./motion-options";
import { useReview } from "./review-context";
export const Parameters = () => {
  const { state, study, update } = useReview();
  const { settings } = state;
  const change = (id: string, value: ParamValue) => {
    if (id === "comparison") {
      void update({ settings: { comparison: value === "compare" } });
      return;
    }
    const [side, ...parts] = id.split(".");
    const field = parts.join(".");
    if (side === "left" || side === "right") {
      if (field === "preset") void update({ settings: { [side]: { preset: value } } });
      else void update({ settings: { [side]: { values: { [field]: value } } } });
      return;
    }
    void update({ settings: { [id]: value } });
  };
  return (
    <ScrollArea h="full" minH="0" viewportProps={{ "aria-label": "Animation parameters" }}>
      <ParamEditor groups={optionGroups(settings, study)} onChange={change} />
    </ScrollArea>
  );
};
