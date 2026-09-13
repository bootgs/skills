/**
 * Generates an OpenAPI 3.0 document from bootgs @RestController classes by
 * walking the TypeScript AST — no runtime reflection, no live Apps Script
 * execution required.
 *
 * Requires `typescript` as a devDependency of the consuming project (already
 * present in any TS-based bootgs project).
 *
 * Known limitations (by design — see the bootgs-openapi SKILL.md gotchas):
 * - Controller/route decorators are matched by identifier text, not by
 *   resolving the import — don't shadow these names.
 * - Only one @RestController path per class is read.
 * - Generic/mapped/conditional types resolve to an open `{}` schema.
 *
 * Exit codes: 0 success, 1 bad usage, 2 tsconfig/program error.
 */

const HELP_TEXT = `Usage: generate-openapi.ts [OPTIONS]

Generates openapi.json from bootgs @RestController classes via static
TypeScript AST analysis.

Options:
  --tsconfig <path>     Path to tsconfig.json (default: tsconfig.json)
  --output <path>       Output file path (default: openapi.json)
  --title <string>      info.title (default: "API")
  --version <string>    info.version (default: "1.0.0")
  --description <string>  info.description
  -h, --help            Show this help and exit

Example:
  npx tsx generate-openapi.ts --tsconfig ./tsconfig.appsscript.json --output ./openapi.json \\
    --title "My API" --version "1.0.0"
`;

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

const CONTROLLER_DECORATORS = new Set(["RestController", "Controller"]);
const ROUTE_DECORATORS: Record<string, string> = {
  Get: "get",
  GetMapping: "get",
  Post: "post",
  PostMapping: "post",
  Put: "put",
  PutMapping: "put",
  Delete: "delete",
  DeleteMapping: "delete",
  Patch: "patch",
  PatchMapping: "patch",
  Head: "head",
  Options: "options",
};
const PATH_PARAM_DECORATORS = new Set(["Param", "PathVariable"]);
const QUERY_PARAM_DECORATORS = new Set(["Query", "RequestParam"]);
const BODY_PARAM_DECORATORS = new Set(["Body", "RequestBody"]);

interface CliOptions {
  tsconfig: string;
  output: string;
  title: string;
  version: string;
  description: string;
}

const KNOWN_FLAGS = new Set(["--tsconfig", "--output", "--title", "--version", "--description"]);

function parseCliArgs(argv: string[]): CliOptions {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  const options: CliOptions = {
    tsconfig: "tsconfig.json",
    output: "openapi.json",
    title: "API",
    version: "1.0.0",
    description: "Auto-generated OpenAPI documentation for bootgs controllers",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!KNOWN_FLAGS.has(flag)) {
      process.stderr.write(`Error: unknown option "${flag}". See --help.\n`);
      process.exit(1);
    }
    const value = argv[i + 1];
    if (value === undefined) {
      process.stderr.write(`Error: "${flag}" requires a value. See --help.\n`);
      process.exit(1);
    }
    i += 1;
    if (flag === "--tsconfig") options.tsconfig = value;
    if (flag === "--output") options.output = value;
    if (flag === "--title") options.title = value;
    if (flag === "--version") options.version = value;
    if (flag === "--description") options.description = value;
  }
  return options;
}

function getDecorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function decoratorName(decorator: ts.Decorator): string | undefined {
  const expr = decorator.expression;
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) return expr.expression.text;
  if (ts.isIdentifier(expr)) return expr.text;
  return undefined;
}

function decoratorFirstStringArg(decorator: ts.Decorator): string | undefined {
  const expr = decorator.expression;
  if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
    const first = expr.arguments[0];
    if (ts.isStringLiteral(first)) return first.text;
  }
  return undefined;
}

function joinPath(...segments: string[]): string {
  const joined = segments
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("/")
    .replace(/\/+/g, "/");
  return `/${joined}`.replace(/\/+/g, "/");
}

type Schema = Record<string, unknown>;

function resolveNamedTypeSchema(
  typeNode: ts.TypeReferenceNode,
  checker: ts.TypeChecker,
  schemas: Map<string, Schema>,
): Schema {
  const name = typeNode.typeName.getText();

  if (name === "Array" && typeNode.typeArguments?.length === 1) {
    return { type: "array", items: typeNodeToSchema(typeNode.typeArguments[0], checker, schemas) };
  }
  if ((name === "Promise" || name === "Readonly") && typeNode.typeArguments?.length === 1) {
    return typeNodeToSchema(typeNode.typeArguments[0], checker, schemas);
  }
  if (name === "Record") return { type: "object" };

  if (schemas.has(name)) return { $ref: `#/components/schemas/${name}` };

  const type = checker.getTypeAtLocation(typeNode);
  const declarations = type.getSymbol()?.getDeclarations() ?? [];
  const decl = declarations.find((d) => ts.isInterfaceDeclaration(d) || ts.isClassDeclaration(d) || ts.isTypeAliasDeclaration(d));

  if (!decl) return {};

  // Reserve the name before recursing, in case of self-reference.
  schemas.set(name, {});

  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  const members: readonly ts.ClassElement[] | readonly ts.TypeElement[] =
    ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type) ? decl.type.members : (decl as ts.InterfaceDeclaration | ts.ClassDeclaration).members ?? [];

  for (const member of members) {
    if (!ts.isPropertySignature(member) && !ts.isPropertyDeclaration(member)) continue;
    if (!member.name || !ts.isIdentifier(member.name)) continue;
    properties[member.name.text] = typeNodeToSchema(member.type, checker, schemas);
    if (!member.questionToken) required.push(member.name.text);
  }

  const schema: Schema = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  schemas.set(name, schema);
  return { $ref: `#/components/schemas/${name}` };
}

function typeNodeToSchema(typeNode: ts.TypeNode | undefined, checker: ts.TypeChecker, schemas: Map<string, Schema>): Schema {
  if (!typeNode) return {};

  if (ts.isParenthesizedTypeNode(typeNode)) return typeNodeToSchema(typeNode.type, checker, schemas);

  switch (typeNode.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { type: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { type: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { type: "boolean" };
    case ts.SyntaxKind.VoidKeyword:
    case ts.SyntaxKind.UndefinedKeyword:
    case ts.SyntaxKind.NullKeyword:
      return {};
    default:
      break;
  }

  if (ts.isArrayTypeNode(typeNode)) {
    return { type: "array", items: typeNodeToSchema(typeNode.elementType, checker, schemas) };
  }

  if (ts.isUnionTypeNode(typeNode)) {
    const literals = typeNode.types.filter(ts.isLiteralTypeNode);
    if (literals.length === typeNode.types.length) {
      const values = literals.map((l) => (ts.isStringLiteral(l.literal) ? l.literal.text : l.literal.getText()));
      return { type: "string", enum: values };
    }
    // Mixed/complex unions: not worth a precise schema — see SKILL.md gotchas.
    return {};
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    return resolveNamedTypeSchema(typeNode, checker, schemas);
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    const properties: Record<string, Schema> = {};
    for (const member of typeNode.members) {
      if (!ts.isPropertySignature(member) || !member.name || !ts.isIdentifier(member.name)) continue;
      properties[member.name.text] = typeNodeToSchema(member.type, checker, schemas);
    }
    return { type: "object", properties };
  }

  // Generics, mapped types, conditional types, etc. — open schema on purpose.
  return {};
}

interface OperationParam {
  name: string;
  in: "path" | "query";
  schema: Schema;
}

function main() {
  const options = parseCliArgs(process.argv.slice(2));

  const configPath = ts.findConfigFile(path.dirname(options.tsconfig), ts.sys.fileExists, path.basename(options.tsconfig)) ?? options.tsconfig;
  if (!ts.sys.fileExists(configPath)) {
    process.stderr.write(`Error: tsconfig not found at "${configPath}". Pass --tsconfig <path>.\n`);
    process.exit(2);
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    process.stderr.write(`Error: failed to read "${configPath}": ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}\n`);
    process.exit(2);
  }
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

  const program = ts.createProgram({ rootNames: parsedConfig.fileNames, options: parsedConfig.options });
  const checker = program.getTypeChecker();

  const paths: Record<string, Record<string, unknown>> = {};
  const schemas = new Map<string, Schema>();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes("node_modules")) continue;

    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isClassDeclaration(node)) return;

      const controllerDecorator = getDecorators(node).find((d) => {
        const name = decoratorName(d);
        return name !== undefined && CONTROLLER_DECORATORS.has(name);
      });
      if (!controllerDecorator) return;

      const basePath = decoratorFirstStringArg(controllerDecorator) ?? "";

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) continue;

        const routeDecorator = getDecorators(member).find((d) => {
          const name = decoratorName(d);
          return name !== undefined && name in ROUTE_DECORATORS;
        });
        if (!routeDecorator) continue;

        const httpMethod = ROUTE_DECORATORS[decoratorName(routeDecorator) as string];
        const methodPath = decoratorFirstStringArg(routeDecorator) ?? "";
        const fullPath = joinPath(basePath, methodPath);

        const jsDoc = ts.getJSDocCommentsAndTags(member).map((tag) => tag.comment).filter(Boolean).join(" ");

        const parameters: OperationParam[] = [];
        let requestBody: Schema | undefined;

        for (const param of member.parameters) {
          const paramDecorator = getDecorators(param)[0];
          if (!paramDecorator) continue;
          const name = decoratorName(paramDecorator);
          const argName = decoratorFirstStringArg(paramDecorator) ?? (ts.isIdentifier(param.name) ? param.name.text : "value");
          const schema = typeNodeToSchema(param.type, checker, schemas);

          if (name !== undefined && PATH_PARAM_DECORATORS.has(name)) {
            parameters.push({ name: argName, in: "path", schema });
          } else if (name !== undefined && QUERY_PARAM_DECORATORS.has(name)) {
            parameters.push({ name: argName, in: "query", schema });
          } else if (name !== undefined && BODY_PARAM_DECORATORS.has(name)) {
            requestBody = schema;
          }
        }

        const returnSchema = typeNodeToSchema(member.type, checker, schemas);

        paths[fullPath] = paths[fullPath] ?? {};
        paths[fullPath][httpMethod] = {
          summary: member.name.text,
          ...(jsDoc ? { description: jsDoc } : {}),
          parameters: parameters.map((p) => ({ name: p.name, in: p.in, required: p.in === "path", schema: p.schema })),
          ...(requestBody ? { requestBody: { content: { "application/json": { schema: requestBody } } } } : {}),
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: returnSchema } } },
          },
        };
      }
    });
  }

  const document = {
    openapi: "3.0.0",
    info: { title: options.title, version: options.version, description: options.description },
    paths,
    components: { schemas: Object.fromEntries(schemas) },
  };

  fs.writeFileSync(options.output, JSON.stringify(document, null, 2));
  process.stderr.write(`Wrote ${Object.keys(paths).length} route(s) to ${options.output}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
