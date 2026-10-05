import { Link, Text, type TextProps } from "@chakra-ui/react";
import { useOpenLink } from "../webview/client";

// The last character excludes sentence punctuation, so "see https://x.com." links to x.com.
const urlPattern = /(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/g;

interface LinkedTextProps extends TextProps {
  children: string;
}
/** Scraped text with its web addresses as links that open outside the webview. */
export const LinkedText = (props: LinkedTextProps) => {
  const { children, ...textProps } = props;
  const open = useOpenLink();
  // split with a capture group puts each address at an odd index.
  const parts = children.split(urlPattern);
  return (
    <Text {...textProps}>
      {parts.map((part, index) =>
        index % 2 ? (
          <Link
            // Text parts never reorder, so their position is a stable key.
            key={index}
            href={part}
            variant="underline"
            wordBreak="break-all"
            onClick={(event) => {
              event.preventDefault();
              void open(part);
            }}
          >
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </Text>
  );
};
