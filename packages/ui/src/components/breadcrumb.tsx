import { Breadcrumb as ChakraBreadcrumb, type SystemStyleObject } from "@chakra-ui/react";
import * as React from "react";
import { type ResourceContextAction, ResourceContextMenu } from "./resource-context-menu";

export interface BreadcrumbItem {
  title: React.ReactNode;
  url?: string;
  onClick?: () => void;
  contextMenuActions?: ResourceContextAction[];
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
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  _active: { outline: "none" },
  _focus: { outline: "none" },
  _focusVisible: { outline: "none" },
} as const;

const staticProps = {
  ...linkProps,
  color: "fg",
  cursor: "default",
  textDecoration: "none",
  _hover: { textDecoration: "none" },
} as const;

interface BreadcrumbItemContentProps {
  item: BreadcrumbItem;
  isCurrent: boolean;
  linkComponent?: React.ComponentType<BreadcrumbLinkProps>;
}

interface BreadcrumbSeparatorProps {
  separator?: React.ReactNode;
}

const isInteractiveItem = (item: BreadcrumbItem) => Boolean(item.url || item.onClick);

const BreadcrumbItemLink = (props: BreadcrumbItemContentProps) => {
  const { item, isCurrent, linkComponent: LinkComponent } = props;

  if (isCurrent && !isInteractiveItem(item)) {
    return <ChakraBreadcrumb.CurrentLink {...staticProps}>{item.title}</ChakraBreadcrumb.CurrentLink>;
  }

  if (item.url && LinkComponent) {
    return (
      <ChakraBreadcrumb.Link asChild {...linkProps}>
        <LinkComponent to={item.url}>{item.title}</LinkComponent>
      </ChakraBreadcrumb.Link>
    );
  }

  if (item.url) {
    return (
      <ChakraBreadcrumb.Link href={item.url} {...linkProps}>
        {item.title}
      </ChakraBreadcrumb.Link>
    );
  }

  if (item.onClick) {
    return (
      <ChakraBreadcrumb.Link as="button" type="button" onClick={item.onClick} {...linkProps}>
        {item.title}
      </ChakraBreadcrumb.Link>
    );
  }

  return (
    <ChakraBreadcrumb.Link as="span" {...staticProps}>
      {item.title}
    </ChakraBreadcrumb.Link>
  );
};

const BreadcrumbItemContent = (props: BreadcrumbItemContentProps) => {
  const { item } = props;
  const content = <BreadcrumbItemLink {...props} />;

  if (!item.contextMenuActions?.length) return content;

  return (
    <ResourceContextMenu actions={item.contextMenuActions} positioning={{ placement: "bottom-start" }}>
      {content}
    </ResourceContextMenu>
  );
};

const BreadcrumbSeparator = (props: BreadcrumbSeparatorProps) => {
  const { separator } = props;

  if (separator === undefined) {
    return <ChakraBreadcrumb.Separator flexShrink={0} />;
  }

  return <ChakraBreadcrumb.Separator flexShrink={0}>{separator}</ChakraBreadcrumb.Separator>;
};

export const Breadcrumb = React.forwardRef<HTMLDivElement, BreadcrumbProps>(function BreadcrumbRoot(props, ref) {
  const { separator, separatorGap, items, linkComponent: LinkComponent, ...rest } = props;

  return (
    <ChakraBreadcrumb.Root ref={ref} {...rest}>
      <ChakraBreadcrumb.List gap={separatorGap} flexWrap="nowrap" minW="0" maxW="100%" overflow="hidden">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <React.Fragment key={index}>
              <ChakraBreadcrumb.Item minW="0" flexShrink={isCurrent ? 1 : 0} overflow="hidden">
                <BreadcrumbItemContent item={item} isCurrent={isCurrent} linkComponent={LinkComponent} />
              </ChakraBreadcrumb.Item>
              {isCurrent ? null : <BreadcrumbSeparator separator={separator} />}
            </React.Fragment>
          );
        })}
      </ChakraBreadcrumb.List>
    </ChakraBreadcrumb.Root>
  );
});
