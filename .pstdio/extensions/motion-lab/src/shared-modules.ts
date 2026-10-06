// The preview already loads these libraries. Scenes import them from the preview
// instead of from installed packages, so they share React and Remotion state.
export const sharedSpecifiers = [
  "react",
  "react/jsx-runtime",
  "remotion",
  "@chakra-ui/react",
  "@pstdio/ui",
  "@pstdio/ui/chat-ui",
  "lucide-react",
  "motion-lab/kit",
] as const;
export type SharedSpecifier = (typeof sharedSpecifiers)[number];
export const sharedImportPrefix = "motion-lab-shared:";
