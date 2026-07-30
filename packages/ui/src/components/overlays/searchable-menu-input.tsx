import { Input, InputGroup } from "@chakra-ui/react";
import { Search } from "lucide-react";
import type { Ref } from "react";
import { Header } from "@/components/layout/header";

interface SearchableMenuInputProps {
  inputRef?: Ref<HTMLInputElement>;
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
}

const searchInputChromeProps = {
  bg: "transparent",
  border: "0",
  borderColor: "transparent",
  borderRadius: "0",
  boxShadow: "none",
  transition: "none",
  _hover: { bg: "transparent", borderColor: "transparent" },
  _active: { bg: "transparent", borderColor: "transparent" },
  _focus: { borderColor: "transparent", outline: "none", boxShadow: "none" },
  _focusVisible: { borderColor: "transparent", outline: "none", boxShadow: "none" },
} as const;

export const SearchableMenuInput = (props: SearchableMenuInputProps) => {
  const { inputRef, value, placeholder, onValueChange } = props;

  return (
    <Header variant="input" borderBottomWidth="1px" borderColor="border.subtle" flexShrink={0}>
      <InputGroup startElement={<Search size={14} />} width="full">
        <Input
          ref={inputRef}
          mx="xs"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          {...searchInputChromeProps}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </InputGroup>
    </Header>
  );
};
