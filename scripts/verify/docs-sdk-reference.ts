/**
 * Checks that the SDK references name every public API group and method, so a new method cannot ship
 * without a reference entry. It compares names, not wording: a method counts as documented when a code span
 * or code block names it in a section or table row that also names its group, or calls `group.method`.
 *
 * Contracts come from public declarations. The extension API uses the checked-in report of
 * `@pstdio/sdk/extensions`. The report does not cover `@pstdio/sdk/client`, so its `PstdioClient`
 * type is read from the entry's source. Deprecated methods are skipped; the reference names their replacement.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { markdownBlocks } from "./docs-markdown";

export interface ContractGroup {
  group: string;
  /** Named type of the group. A reference may document a shared type, such as `ArtifactMount`, once. */
  type?: string;
  methods: string[];
}

interface Contract {
  /** How readers reach the object, such as `client` or `ctx`. */
  prefix: string;
  declarations: string;
  type: string;
  /** Folders whose Markdown files together form the reference for this contract. */
  references: string[];
}

export const SDK_CONTRACTS: Contract[] = [
  {
    prefix: "client",
    declarations: "packages/sdk/src/client/client.ts",
    type: "PstdioClient",
    references: ["documentation/references/sdk"],
  },
  {
    prefix: "ctx",
    declarations: "packages/sdk/api-report/extensions.d.ts",
    type: "ExtensionContextBase",
    references: ["documentation/references/extensions", "documentation/references/sdk"],
  },
  {
    prefix: "view context",
    declarations: "packages/sdk/api-report/extensions.d.ts",
    type: "ExtensionViewRenderContext",
    references: ["documentation/references/extensions", "documentation/references/sdk"],
  },
  {
    prefix: "webview client",
    declarations: "packages/sdk/api-report/extensions.d.ts",
    type: "WebviewClient",
    references: ["documentation/references/extensions", "documentation/references/sdk"],
  },
];

const isDeprecated = (symbol: ts.Symbol, checker: ts.TypeChecker) =>
  symbol.getJsDocTags(checker).some((tag) => tag.name === "deprecated");

/** Groups of a public object type: members whose value is an object with methods, and those methods. */
export const readContractGroups = (file: string, typeName: string) => {
  const program = ts.createProgram([file], {
    noEmit: true,
    skipLibCheck: true,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const checker = program.getTypeChecker();
  const declaration = program
    .getSourceFile(file)
    ?.statements.find(
      (statement): statement is ts.InterfaceDeclaration | ts.TypeAliasDeclaration =>
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        statement.name.text === typeName,
    );
  if (!declaration) throw new Error(`${file} does not declare ${typeName}.`);

  // Platform types, such as the DOM element a view mounts into, are not SDK contracts.
  const isSdkType = (type: ts.Type) =>
    (type.aliasSymbol ?? type.getSymbol())?.declarations?.every((node) => {
      const source = node.getSourceFile();
      return !program.isSourceFileDefaultLibrary(source) && !source.fileName.includes("/node_modules/");
    }) ?? true;
  const valueType = (symbol: ts.Symbol) => checker.getNonNullableType(checker.getTypeOfSymbol(symbol));
  const groups: ContractGroup[] = [];
  for (const member of checker.getTypeAtLocation(declaration.name).getProperties()) {
    const type = valueType(member);
    if (!(type.flags & ts.TypeFlags.Object) || type.getCallSignatures().length > 0 || !isSdkType(type)) continue;
    const methods = type
      .getProperties()
      .filter((method) => valueType(method).getCallSignatures().length > 0 && !isDeprecated(method, checker))
      .map((method) => method.name);
    const typeName = (type.aliasSymbol ?? type.getSymbol())?.name;
    if (methods.length === 0) continue;
    groups.push({ group: member.name, ...(typeName && !typeName.startsWith("__") ? { type: typeName } : {}), methods });
  }
  return groups;
};

// Text inside inline code and code blocks. Prose words such as "list" do not count as API names.
const codeIn = (block: string) =>
  [...block.matchAll(/(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\s*\1|(`+)([^`][\s\S]*?)\3/g)]
    .map((match) => match[2] ?? match[4] ?? "")
    .join("\n");

const names = (code: string, name: string) => new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(code);

/** Missing names, as `prefix.group.method`, or `prefix.group (methods)` when the group is missing. */
export const findReferenceGaps = (prefix: string, groups: ContractGroup[], references: string[]) => {
  const blocks = references.flatMap(markdownBlocks).map(codeIn);
  const allCode = blocks.join("\n");
  const gaps: string[] = [];
  for (const { group, type, methods } of groups) {
    const groupBlocks = blocks.filter((code) => names(code, group) || (type !== undefined && names(code, type)));
    if (groupBlocks.length === 0) {
      gaps.push(`${prefix}.${group} (${methods.join(", ")})`);
      continue;
    }
    for (const method of methods) {
      const documented = names(allCode, `${group}\\.${method}`) || groupBlocks.some((code) => names(code, method));
      if (!documented) gaps.push(`${prefix}.${group}.${method}`);
    }
  }
  return gaps;
};

const readReferences = (root: string, folders: string[]) =>
  folders.flatMap((folder) =>
    readdirSync(join(root, folder))
      .filter((file) => file.endsWith(".md"))
      .map((file) => readFileSync(join(root, folder, file), "utf8")),
  );

export const checkSdkReference = (root: string) =>
  SDK_CONTRACTS.map((contract) => ({
    contract,
    gaps: findReferenceGaps(
      contract.prefix,
      readContractGroups(join(root, contract.declarations), contract.type),
      readReferences(root, contract.references),
    ),
  }));

if (import.meta.main) {
  let failed = false;
  for (const { contract, gaps } of checkSdkReference(join(import.meta.dir, "../.."))) {
    if (gaps.length === 0) continue;
    failed = true;
    console.error(
      `${contract.type} in ${contract.declarations} has names that ${contract.references.join(" and ")} do not document:`,
    );
    for (const gap of gaps) console.error(`  ${gap}`);
  }
  if (failed) {
    console.error("\nAdd each name to its reference with a short description, or mark the API @deprecated.");
    process.exit(1);
  }
  console.log("SDK references name every public group and method.");
}
