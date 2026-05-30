declare module "prismjs" {
  interface PrismToken {
    alias?: string | string[];
    content: string | PrismToken | Array<string | PrismToken>;
    type: string;
  }

  interface PrismStatic {
    Token: new (
      type: string,
      content: string | PrismToken | Array<string | PrismToken>,
      alias?: string | string[],
    ) => PrismToken;
    languages: Record<string, unknown>;
    tokenize: (text: string, grammar: unknown) => Array<string | PrismToken>;
  }

  const Prism: PrismStatic;
  export default Prism;
}
