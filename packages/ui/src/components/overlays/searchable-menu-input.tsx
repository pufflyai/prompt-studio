import { Input, InputGroup } from "@chakra-ui/react";
import { Search } from "lucide-react";
import type { KeyboardEventHandler, Ref } from "react";
import { Header } from "@/components/layout/header";

interface SearchableMenuInputProps {
  inputRef?: Ref<HTMLInputElement>;
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

export const SearchableMenuInput = (props: SearchableMenuInputProps) => {
  const { inputRef, value, placeholder, onValueChange, onKeyDown } = props;

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
          onKeyDown={(event) => {
            onKeyDown?.(event);
            // Let the owning menu navigate/select its highlighted choice. Keep
            // text editing (including IME composition) inside the search field.
            const navigate = !event.nativeEvent.isComposing && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key);
            if (!navigate && (!onKeyDown || event.key !== "Escape")) event.stopPropagation();
          }}
        />
      </InputGroup>
    </Header>
  );
};
