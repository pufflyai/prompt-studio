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

export const Breadcrumb = React.forwardRef<HTMLDivElement, BreadcrumbProps>(function BreadcrumbRoot(props, ref) {
  const { separator, separatorGap, items, linkComponent: LinkComponent, ...rest } = props;

  return (
    <ChakraBreadcrumb.Root ref={ref} {...rest}>
      <ChakraBreadcrumb.List gap={separatorGap} flexWrap="nowrap" minW="0" overflow="hidden">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const isInteractive = Boolean(item.url || item.onClick);
          let itemContent: React.ReactNode;

          if (last && !isInteractive) {
            itemContent = <ChakraBreadcrumb.CurrentLink whiteSpace="nowrap">{item.title}</ChakraBreadcrumb.CurrentLink>;
          } else if (item.url) {
            itemContent = LinkComponent ? (
              <ChakraBreadcrumb.Link asChild whiteSpace="nowrap">
                <LinkComponent to={item.url}>{item.title}</LinkComponent>
              </ChakraBreadcrumb.Link>
            ) : (
              <ChakraBreadcrumb.Link href={item.url} whiteSpace="nowrap">
                {item.title}
              </ChakraBreadcrumb.Link>
            );
          } else if (item.onClick) {
            itemContent = (
              <ChakraBreadcrumb.Link as="button" type="button" whiteSpace="nowrap" onClick={item.onClick}>
                {item.title}
              </ChakraBreadcrumb.Link>
            );
          } else {
            itemContent = <ChakraBreadcrumb.Link whiteSpace="nowrap">{item.title}</ChakraBreadcrumb.Link>;
          }

          return (
            <ChakraBreadcrumb.Item key={index}>
              {itemContent}
              {last ? null : (
                <ChakraBreadcrumb.Separator as="span" aria-hidden ml="xs">
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
