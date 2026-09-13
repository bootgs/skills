/**
 * eslint-plugin-boundaries config enforcing the bootgs-architecture layering:
 * Controller → Service → Repository → Domain, one direction only.
 *
 * npm install --save-dev eslint-plugin-boundaries
 *
 * Adjust `files` to your source root, and rename "SettingsRepositoryImpl"
 * below to whatever your own storage-primitive repository is called (or
 * remove that exception entirely if you don't have one).
 */
import typescriptParser from "@typescript-eslint/parser";
import boundaries from "eslint-plugin-boundaries";

/**
 * OPTIONAL: only keep these if the project funnels each layer's public
 * surface through an index.ts barrel file. If it doesn't — importing a
 * layer's files directly is just how the project works — delete this
 * array and its spread below instead of trying to disable it per rule.
 */
const OPTIONAL_BARREL_EXPORT_RULES = [
  {
    to: { type: "domain", captured: { segment: ["entity", "dto", "enums", "types"] } },
    disallow: { to: { internalPath: "!index.ts" } },
    message: "Access to domain {{to.captured.segment}} is only allowed through index.ts",
  },
  {
    to: { type: "domain", captured: { segment: "constants" } },
    disallow: { to: { internalPath: "!(index.ts|constants.ts)" } },
    message: "Access to domain constants is only allowed through index.ts or constants.ts",
  },
  {
    to: [{ type: "controller" }, { type: "service" }],
    disallow: { to: { internalPath: "!index.ts" } },
    message: "Access to {{to.type}} is only allowed through index.ts",
  },
  {
    // "SettingsRepositoryImpl" is the one storage-primitive exception — see the skill's Gotchas.
    to: { type: "repository" },
    disallow: { to: { internalPath: "!(index.ts|SettingsRepositoryImpl.ts)" } },
    message: "Access to repository is only allowed through index.ts or SettingsRepositoryImpl.ts",
  },
];

export default {
  files: ["src/**/*.ts"],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: { sourceType: "module" },
  },
  plugins: { boundaries },
  settings: {
    "boundaries/include": ["src/"],
    "boundaries/elements": [
      { type: "root", pattern: "main.ts", mode: "full" },
      { type: "shared", pattern: "shared/*", capture: ["segment"] },
      { type: "shared", pattern: "shared/*/**", capture: ["segment"] },
      { type: "controller", pattern: "controller/*.ts", capture: ["controller"], mode: "file" },
      { type: "service", pattern: "service/*.ts", capture: ["service"], mode: "file" },
      { type: "repository", pattern: "repository/*.ts", capture: ["repository"], mode: "file" },
      { type: "domain", pattern: ["domain/*/*.ts", "domain/*.ts"], capture: ["segment"] },
      { type: "exceptions", pattern: "exceptions/*.ts", capture: ["exception"], mode: "file" },
    ],
  },
  rules: {
    ...boundaries.configs.recommended.rules,
    "boundaries/dependencies": [
      2,
      {
        default: "allow",
        rules: [
          // ---------------------------------------------------------------
          // OPTIONAL: barrel-export enforcement.
          //
          // Whether a layer funnels its public surface through index.ts is
          // a project choice, not a requirement of the layering itself —
          // see the skill's Gotchas. Delete this whole block if the
          // project imports layer files directly instead of through
          // barrels; the layer-direction rules below are unaffected.
          ...OPTIONAL_BARREL_EXPORT_RULES,
          // ---------------------------------------------------------------
          {
            from: { type: "controller" },
            disallow: { to: { type: "controller", captured: { controller: "!{{from.captured.controller}}" } } },
            message: "Controller must not import another controller",
          },
          {
            from: { type: "service" },
            disallow: { to: { type: "controller" } },
            message: "Service must not import upper layers ({{to.type}})",
          },
          {
            from: { type: "repository" },
            disallow: { to: [{ type: "controller" }, { type: "service" }] },
            message: "Repository must not import upper layers ({{to.type}})",
          },
          {
            from: { type: "repository" },
            disallow: {
              to: {
                type: "repository",
                captured: { repository: "!({{from.captured.repository}}|SettingsRepositoryImpl)" },
              },
            },
            message: "Repository must not import another repository",
          },
          {
            from: { type: "domain" },
            disallow: { to: [{ type: "controller" }, { type: "service" }, { type: "repository" }, { type: "exceptions" }] },
            message: "Domain must not import upper layers ({{to.type}})",
          },
          {
            from: { type: "exceptions" },
            disallow: { to: [{ type: "controller" }, { type: "service" }, { type: "repository" }] },
            message: "Exceptions must not import upper layers ({{to.type}})",
          },
          {
            from: { type: "shared" },
            disallow: { to: [{ type: "controller" }, { type: "service" }, { type: "repository" }, { type: "domain" }, { type: "exceptions" }] },
            message: "Shared must not import upper layers ({{to.type}})",
          },
        ],
      },
    ],
  },
};
