import { Button, Flex, Stack } from "@chakra-ui/react";
import { useCollectionViewStore } from "@pstdio/ui/collection-view";
import { useState } from "react";
import { TimelineDisplayMenu } from "../../timeline/view/timeline-display-menu";
import { timelineInitialState } from "../../timeline/view/timeline-query";
import { TimelineDisplayMenu as ProposedDisplayMenu } from "./timeline-display-menu";

export default { title: "Proposals/PS-292 Save Timeline views" };
export const SaveDisplay = () => {
  const { settings } = useCollectionViewStore("timeline-display-close", timelineInitialState, (state) => state);
  const [saved, setSaved] = useState("");
  const [proposed, setProposed] = useState(false);
  const Menu = proposed ? ProposedDisplayMenu : TimelineDisplayMenu;
  return (
    <Stack h="600px" p="md">
      <Button onClick={() => setProposed(!proposed)}>{proposed ? "Use current behavior" : "Use proposed fix"}</Button>
      <Flex justify="end">
        <Menu
          storageKey="timeline-display-close"
          attributes={[{ id: "id", label: "ID", type: { kind: "string" }, displayable: true }]}
        />
      </Flex>
      <Flex justify="end">
        <Button onClick={() => setSaved(JSON.stringify(settings.displayProperties))}>Save view</Button>
      </Flex>
      <output aria-label="Saved display properties">{saved}</output>
    </Stack>
  );
};
