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

export const SearchableMenuInput = (props: SearchableMenuInputProps) => {
  const { inputRef, value, placeholder, onValueChange } = props;

  return (
    <Header variant="input" borderBottomWidth="1px" borderColor="border.subtle" flexShrink={0}>
      <InputGroup startElement={<Search size={14} />} width="full">
        <Input
          ref={inputRef}
          mx="xs"
          variant="borderless"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </InputGroup>
    </Header>
  );
};
