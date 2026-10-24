import { ScrollArea } from "@pstdio/ui";
import { boomboxStore, Queue } from "../apps/boombox";
import { createExampleView, viewBackgrounds } from "../create-view";
import type { ExampleViewInput } from "../view-context";

const View = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  return (
    <ScrollArea h="full">
      <Queue host={input.host} />
    </ScrollArea>
  );
};
export default createExampleView(View, boomboxStore, viewBackgrounds.panel);
