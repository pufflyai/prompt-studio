import { Box, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { ScrollArea } from "@/components/scroll-area";
import type { ReferenceMenuOption } from "../../ReferenceMenuOption";
import { getSortedMenuOptions } from "../../utils/getSortedMenuOptions";
import { ReferenceMenuItem } from "./ReferenceMenuItem";

interface ReferenceMenuProps {
  options: ReferenceMenuOption[];
  selectedIndex: number | null;
  onSelectItem: (option: ReferenceMenuOption, index: number) => void;
  onMouseEnterItem: (index: number) => void;
}

export const ReferenceMenu = (props: ReferenceMenuProps) => {
  const { options, selectedIndex, onSelectItem, onMouseEnterItem } = props;
  const { table = [], connector = [] } = getSortedMenuOptions(options);

  const hasResults = [...table, ...connector].length;

  /** scroll to the selected item if necessary */
  useEffect(() => {
    document
      .getElementById(`typeahead-item-${selectedIndex}`)
      ?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [selectedIndex]);

  return (
    <ScrollArea
      zIndex="1000"
      position="absolute"
      layerStyle="modal"
      maxHeight={"24rem"}
      showHorizontalScrollbar={false}
      minWidth={{
        base: "100vw",
        md: "264px",
      }}
    >
      {!hasResults && <Text>No results</Text>}
      {!!table.length && (
        <>
          <Text paddingTop="xs" paddingBottom="2xs" paddingX="sm" color="fg.muted" textStyle="label/S/medium">
            Tables
          </Text>
          <Box>
            {table.map((option) => {
              return (
                <ReferenceMenuItem
                  id={`typeahead-item-${option.index}`}
                  isSelected={selectedIndex === option.index}
                  onClick={() => onSelectItem(option, option.index)}
                  onMouseEnter={() => onMouseEnterItem(option.index)}
                  key={option.id}
                  primaryLabel={option.name}
                  secondaryLabel={option.description}
                  setRefElement={option.setRefElement}
                  tabIndex={-1}
                />
              );
            })}
          </Box>
        </>
      )}
      {!!connector.length && (
        <>
          <Text paddingTop="xs" paddingBottom="2xs" paddingX="sm" color="fg.muted" textStyle="label/S/medium">
            Data Sources
          </Text>
          <Box>
            {connector.map((option) => {
              return (
                <ReferenceMenuItem
                  id={`typeahead-item-${option.index}`}
                  isSelected={selectedIndex === option.index}
                  onClick={() => onSelectItem(option, option.index)}
                  onMouseEnter={() => onMouseEnterItem(option.index)}
                  key={option.id}
                  primaryLabel={option.name}
                  secondaryLabel={option.description}
                  setRefElement={option.setRefElement}
                  tabIndex={-1}
                />
              );
            })}
          </Box>
        </>
      )}
    </ScrollArea>
  );
};
