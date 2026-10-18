import type { WebviewHostProps } from "pstdio-api-contracts/extension-kernel";

export const createWebviewHostProps = (props: Partial<WebviewHostProps> & Record<string, unknown> = {}) => {
  const locale = props.locale ?? "en";
  return {
    ...props,
    projectId: props.projectId,
    themePreference: props.themePreference ?? "system",
    locale,
    resource: props.resource,
    pageLocation: props.pageLocation,
    pageParams: props.pageParams ?? {},
    translations: props.translations ?? { locale, defaultLocale: locale, bundle: {}, defaultBundle: {} },
  } satisfies WebviewHostProps;
};
