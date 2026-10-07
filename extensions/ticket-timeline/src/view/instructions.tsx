// Render readable action Markdown and safe links without loading the full rich-text editor.
import { Box, chakra } from "@chakra-ui/react";
import { useContext } from "react";
import Markdown from "react-markdown";
import { InstructionNavigation } from "./instruction-navigation";

export function Instructions({ text }: { text: string }) {
  const resolve = useContext(InstructionNavigation);
  return (
    <Box
      textStyle="label/S/regular"
      css={{
        "& p, & ul, & ol": { marginBottom: "0.5rem" },
        "& ul, & ol": { paddingLeft: "1.25rem" },
        "& h1, & h2, & h3": { fontWeight: "600", marginBottom: "0.5rem" },
      }}
    >
      <Markdown
        components={{
          a: ({ href, children }) => {
            const open = href && resolve?.(href);
            if (open) {
              return (
                <chakra.button
                  type="button"
                  onClick={open}
                  color="blue.fg"
                  textDecoration="underline"
                  title="Open ticket with attachment"
                >
                  {children}
                </chakra.button>
              );
            }
            if (href && !/^[a-z]+:|^\/\//i.test(href)) {
              return <chakra.span>{children}</chakra.span>;
            }
            return (
              <chakra.a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                color="blue.fg"
                textDecoration="underline"
              >
                {children}
              </chakra.a>
            );
          },
        }}
      >
        {text}
      </Markdown>
    </Box>
  );
}
