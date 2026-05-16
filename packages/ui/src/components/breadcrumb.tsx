import { Breadcrumb as ChakraBreadcrumb, type SystemStyleObject } from "@chakra-ui/react";
import * as React from "react";

export interface BreadcrumbItem {
  title: React.ReactNode;
  url?: string;
  onClick?: () => void;
}

export interface BreadcrumbLinkProps {
  to: string;
  children: React.ReactNode;
}

export interface BreadcrumbProps extends ChakraBreadcrumb.RootProps {
  separator?: React.ReactNode;
  separatorGap?: SystemStyleObject["gap"];
  items: BreadcrumbItem[];
  linkComponent?: React.ComponentType<BreadcrumbLinkProps>;
}

const linkProps = {
  alignItems: "center",
  display: "inline-flex",
  gap: "2xs",
  minW: "0",
  maxW: "100%",
  overflow: "hidden",
  outline: "none",
  boxShadow: "none",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  _active: { outline: "none", boxShadow: "none" },
  _focus: { outline: "none", boxShadow: "none" },
  _focusVisible: { outline: "none", boxShadow: "none" },
} as const;

export const Breadcrumb = React.forwardRef<HTMLDivElement, BreadcrumbProps>(function BreadcrumbRoot(props, ref) {
  const { separator, separatorGap, items, linkComponent: LinkComponent, ...rest } = props;

  return (
    <ChakraBreadcrumb.Root ref={ref} {...rest}>
      <ChakraBreadcrumb.List gap={separatorGap} flexWrap="nowrap" minW="0" maxW="100%" overflow="hidden">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const isInteractive = Boolean(item.url || item.onClick);
          let itemContent: React.ReactNode;

          if (last && !isInteractive) {
            itemContent = <ChakraBreadcrumb.CurrentLink {...linkProps}>{item.title}</ChakraBreadcrumb.CurrentLink>;
          } else if (item.url) {
            itemContent = LinkComponent ? (
              <ChakraBreadcrumb.Link asChild {...linkProps}>
                <LinkComponent to={item.url}>{item.title}</LinkComponent>
              </ChakraBreadcrumb.Link>
            ) : (
              <ChakraBreadcrumb.Link href={item.url} {...linkProps}>
                {item.title}
              </ChakraBreadcrumb.Link>
            );
          } else if (item.onClick) {
            itemContent = (
              <ChakraBreadcrumb.Link as="button" type="button" onClick={item.onClick} {...linkProps}>
                {item.title}
              </ChakraBreadcrumb.Link>
            );
          } else {
            itemContent = <ChakraBreadcrumb.Link {...linkProps}>{item.title}</ChakraBreadcrumb.Link>;
          }

          return (
            <ChakraBreadcrumb.Item key={index} minW="0" flexShrink={last ? 1 : 0} overflow="hidden">
              {itemContent}
              {last ? null : (
                <ChakraBreadcrumb.Separator as="span" aria-hidden flexShrink={0}>
                  {separator}
                </ChakraBreadcrumb.Separator>
              )}
            </ChakraBreadcrumb.Item>
          );
        })}
      </ChakraBreadcrumb.List>
    </ChakraBreadcrumb.Root>
  );
});
