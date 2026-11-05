import { defineExtensionView } from "@pstdio/sdk/extensions";
import { PlannerCollectionEditor } from "./planner-collection-editor";
import { renderTicketRoot } from "./view-root";
export default defineExtensionView({
  render({ mount, host }) {
    return renderTicketRoot(mount, <PlannerCollectionEditor host={host} kind="status" />);
  },
});
