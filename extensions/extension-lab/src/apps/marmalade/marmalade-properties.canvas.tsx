import type { CanvasMeta } from "@pstdio/canvas";
import { MarmaladeInspectorPreview } from "./marmalade-inspector-preview";
import { MarmaladePropertyPreview } from "./marmalade-property-preview";

export default {
  title: "Product/Extension Lab/Marmalade/Properties",
  description:
    "Explore inspector sizing and shared numeric preview, commit and cancellation. Synthetic data only; durable saves and keyboard routing are qualified in the host.",
} satisfies CanvasMeta;

export const InspectorGroups = () => <MarmaladeInspectorPreview />;
export const PropertyEditing = () => <MarmaladePropertyPreview />;
