import { Flex, Input, InputGroup } from "@chakra-ui/react";
import { WorkbenchIcon } from "../../shared/icon";

interface TreeViewSearchProps {
  visible: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export const TreeViewSearch = (props: TreeViewSearchProps) => {
  const { visible, placeholder = "Search files", value, onChange } = props;
  if (!visible) return null;

  return (
    <Flex flexShrink={0} px="xs" py="xs" borderBottomWidth="1px" borderColor="border.subtle" bg="bg">
      <InputGroup startElement={<WorkbenchIcon name="search" size={14} />} width="full">
        <Input
          size="sm"
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputGroup>
    </Flex>
  );
};
