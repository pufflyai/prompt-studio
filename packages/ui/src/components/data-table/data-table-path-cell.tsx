import { chakra } from "@chakra-ui/react";
import { Tooltip } from "@/components/primitives/tooltip";

// Long paths keep their start and final characters, so the folder name stays readable (design/DESIGN.md).
const visibleEndLength = 5;

export const DataTablePathCell = (props: { value: string }) => {
  const { value } = props;
  const start = value.slice(0, -visibleEndLength);
  const end = value.slice(-visibleEndLength);

  return (
    <Tooltip content={value} openDelay={300}>
      <chakra.span
        display="inline-flex"
        minW="0"
        maxW="full"
        tabIndex={0}
        textStyle="paragraph/S/regular"
        whiteSpace="nowrap"
      >
        <chakra.span overflow="hidden" textOverflow="ellipsis">
          {start}
        </chakra.span>
        <chakra.span flexShrink={0}>{end}</chakra.span>
      </chakra.span>
    </Tooltip>
  );
};
