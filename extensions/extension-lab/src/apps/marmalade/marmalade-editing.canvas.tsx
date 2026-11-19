import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { MarmaladeEditingPreview } from "./marmalade-editing-preview";

const meta = {
  title: "Product/Extension Lab/Marmalade/Shared editing",
  component: MarmaladeEditingPreview,
  description:
    "Explore shared property previews, cancellation, retained failures and inline retry without real records. Command controls belong to this synthetic preview; document saving stays silent.",
} satisfies CanvasMeta<typeof MarmaladeEditingPreview>;
export default meta;
export const Editing: CanvasFrame<typeof meta> = {};
