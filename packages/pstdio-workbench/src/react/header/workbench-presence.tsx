import { DocumentParticipants } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { participantColor } from "../shared/participant-color";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const WorkbenchPresence = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const participants = useWorkbenchStore(workbench.presence.store, (state) => state.participants);
  return (
    <DocumentParticipants
      label="Other editors"
      participants={participants.map((person) => ({ ...person, color: participantColor(person.id) }))}
    />
  );
};
