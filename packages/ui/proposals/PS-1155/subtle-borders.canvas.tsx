import { TokenPreviewScope } from "@/components/internal/style-guide";
import { FoundationColors } from "@/foundations/foundations.canvas";

export default { title: "Proposals/PS-1155 Subtle borders" };

export const PromptLight = {
  defaultTheme: "pstdio-light",
  render: () => (
    <TokenPreviewScope values={{ "colors.border.subtle": "#E5EBE6" }}>
      <FoundationColors />
    </TokenPreviewScope>
  ),
};

export const PromptDark = {
  defaultTheme: "pstdio-dark",
  render: () => (
    <TokenPreviewScope values={{ "colors.border.subtle": "#242933" }}>
      <FoundationColors />
    </TokenPreviewScope>
  ),
};
