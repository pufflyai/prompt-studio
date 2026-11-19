import { ScrollArea } from "../primitives/scroll-area";
import { TreeList } from "./tree-list";

export default { title: "Design system/Components/Data display/Tree list/Fixed resource groups" };
export const ResourceGroups = () => (
  <ScrollArea h="md">
    <TreeList
      sections={[
        {
          id: "resources",
          nodes: [
            {
              id: "pull-requests",
              label: "Pull requests",
              collapsible: false,
              children: [
                { id: "pr-1", label: "Fix release checks" },
                { id: "pr-2", label: "Update fixtures" },
              ],
            },
            { id: "notes", label: "Notes", collapsible: false, children: [{ id: "note", label: "Release checklist" }] },
          ],
        },
      ]}
    />
  </ScrollArea>
);
