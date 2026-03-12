import { Button, Icon, Menu } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Ticket } from "@/features/ticket-list/types";

interface ComplexitySelectorProps {
  value: Ticket["complexity"];
  onChange?: (complexity: Ticket["complexity"]) => void;
}

const COMPLEXITY_OPTIONS = [null, "low", "medium", "high"] as const;

export const ComplexitySelector = (props: ComplexitySelectorProps) => {
  const { value, onChange } = props;
  const { t } = useTranslation("projects");

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          size="sm"
          variant="subtle"
          width="160px"
          justifyContent="space-between"
          _hover={{ bg: "background.tertiary" }}
        >
          {value
            ? t(`ticketPanel.fields.complexity.options.${value}`)
            : t("ticketPanel.fields.complexity.options.unspecified")}
          <Icon as={ChevronDown} color="foreground.tertiary" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="160px" bg="bg">
          {COMPLEXITY_OPTIONS.map((complexityOption) => (
            <MenuItem
              key={complexityOption ?? "unspecified"}
              primaryLabel={
                complexityOption
                  ? t(`ticketPanel.fields.complexity.options.${complexityOption}`)
                  : t("ticketPanel.fields.complexity.options.unspecified")
              }
              isSelected={value === complexityOption}
              onClick={() => onChange?.(complexityOption)}
            />
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
