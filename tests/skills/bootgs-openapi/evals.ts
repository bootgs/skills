import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "bootgs-openapi",
  cases: [
    {
      name: "why-not-runtime-reflection",
      description: "The generator reads the AST because there is no process to introspect in Apps Script.",
      tags: ["recall", "bootgs"],
      prompt: [
        "I want to generate an OpenAPI spec from my bootgs controllers. Can I just boot the app in Node,",
        "read the decorator metadata off the registered routes at runtime, and dump that? That's how I'd",
        "do it in Nest.",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-openapi", arm: "with-only" },
        {
          name: "argues-for-static-analysis",
          type: "llm",
          weight: 3,
          criteria: [
            "The response explains why this project generates the spec by static TypeScript AST analysis rather",
            "than runtime reflection, and points at the bundled generator script instead of endorsing a",
            "boot-and-introspect approach. Simply agreeing that runtime reflection is the way fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-quickstart",
      description: "Entry-point wiring belongs to bootgs-quickstart.",
      tags: ["precision", "bootgs"],
      prompt: [
        "Starting a bootgs project from scratch. What exactly do my `doGet`, `doPost` and `onOpen` global",
        "functions need to look like so Apps Script actually routes into the framework?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-quickstart", arm: "with-only" },
        {
          name: "openapi-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "bootgs-openapi",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response shows each GAS global constructing an app with `createApp`/`createAsyncApp` and",
            "delegating to it. A response that instead discusses OpenAPI generation or DTO contracts has",
            "answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
