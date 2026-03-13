import { Check, Copy } from "lucide-react";

interface CopyCommandIconProps {
  isCopied: boolean;
}

export const CopyCommandIcon = (props: CopyCommandIconProps) => {
  const { isCopied } = props;

  if (isCopied) {
    return <Check size={16} color="var(--chakra-colors-green-500)" />;
  }

  return <Copy size={16} />;
};
