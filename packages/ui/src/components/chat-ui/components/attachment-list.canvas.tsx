import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { AttachmentList } from "./attachment-list";

const meta: CanvasMeta<typeof AttachmentList> = {
  title: "Patterns/Chat/Attachment List",
  component: AttachmentList,
};
export default meta;
type Story = CanvasFrame<typeof AttachmentList>;
const sampleAttachments = ["workspace/analysis/report.md", "workspace/data/users.csv"];
export const Default: Story = {
  id: "patterns-chat-attachment-list--default",
  args: {
    attachments: sampleAttachments,
    onSelect: (resourceId) => console.log("Selected:", resourceId),
    onRemove: (resourceId) => console.log("Remove:", resourceId),
  },
};
