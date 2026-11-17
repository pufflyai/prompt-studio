import type { CanvasMeta } from "@pstdio/canvas";
import { MarmaladeEditingPreview } from "../../apps/marmalade/marmalade-editing-preview";
import { PropertyControls } from "./marmalade-property-controls";
import { InspectorLayout, NativeActions } from "./marmalade-workflows";

export default {
  title: "Proposals/GitHub 12xx Marmalade workflows",
  description:
    "Synthetic design exploration for #1268, #1269 and #1274. SharedEditing reuses the delivered #1944 preview for #1271 and #1275. These frames do not prove host isolation, persistence or keyboard routing.",
} satisfies CanvasMeta;

export const ActionsAndExport = () => <NativeActions />;
export const InspectorGroups = () => <InspectorLayout />;
export const SharedEditing = () => <MarmaladeEditingPreview />;
export const PropertyEditing = () => <PropertyControls />;
