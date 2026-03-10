import { chakra, IconButton, type IconButtonProps } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { MessageCircle } from "lucide-react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

type SessionBubbleButtonStyleProps = "boxShadow" | "transition" | "_hover" | "_active" | "borderColor" | "borderWidth";

export interface SessionBubbleButtonProps extends Omit<IconButtonProps, SessionBubbleButtonStyleProps> {
  isOpen?: boolean;
  right?: string;
}

export const SessionBubbleButton = forwardRef<HTMLButtonElement, SessionBubbleButtonProps>(
  function SessionBubbleButton(props, ref) {
    const { t } = useTranslation("projects");
    const { children, isOpen, right = "6", ...rest } = props;
    const label = t("chatInput.ariaLabel");

    return (
      <chakra.div position="fixed" bottom="6" right={right} zIndex="docked">
        <Tooltip content={label}>
          <IconButton
            ref={ref}
            aria-label={label}
            rounded="full"
            size="lg"
            borderWidth="1px"
            boxShadow={isOpen ? "none" : "mid"}
            transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
            _hover={{
              borderColor: "border.accent",
              boxShadow: "mid",
            }}
            _active={{ boxShadow: isOpen ? "none" : "mid" }}
            {...rest}
          >
            <MessageCircle size={20} strokeWidth={2} />
          </IconButton>
        </Tooltip>
      </chakra.div>
    );
  },
);
