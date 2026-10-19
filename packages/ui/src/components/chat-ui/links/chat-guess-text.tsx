import { TEXT_TYPE_TO_FORMAT, type TextFormatType } from "lexical";
import type { ReactNode } from "react";
import theme from "@/components/rich-text/theme/rich-text-theme";

export const CHAT_TEXT_FORMAT_TAGS = [
  ["code", "code"],
  ["bold", "strong"],
  ["italic", "em"],
  ["strikethrough", "s"],
  ["underline", "u"],
] as const satisfies readonly (readonly [TextFormatType, string])[];

export const hasChatTextFormat = (format: number, type: TextFormatType) => (format & TEXT_TYPE_TO_FORMAT[type]) !== 0;

// A guess that stays unlinked keeps the bold, italic and code formatting it had in the message.
export const ChatGuessText = (props: { text: string; format: number }) => {
  const { text, format } = props;
  return CHAT_TEXT_FORMAT_TAGS.reduceRight<ReactNode>((content, [type, Tag]) => {
    if (!hasChatTextFormat(format, type)) return content;
    return (
      <Tag key={type} className={theme.text?.[type]}>
        {content}
      </Tag>
    );
  }, text);
};
