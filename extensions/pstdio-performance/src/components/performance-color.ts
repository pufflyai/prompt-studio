export const performanceColor = (token: string | undefined) =>
  token ? `var(--chakra-colors-${token.replaceAll(".", "-")})` : undefined;
