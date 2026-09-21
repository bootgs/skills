import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "bootgs-quickstart",
  cases: [
    {
      name: "silent-di-failure",
      description: "Injected services are undefined at runtime with no compile error — the useDefineForClassFields trap.",
      tags: ["recall", "bootgs"],
      prompt: [
        "I'm setting up a new Google Apps Script project on bootgs. My controller compiles fine,",
        "but every service I inject through the constructor is `undefined` the moment a request",
        "actually runs. No error, no stack trace, just undefined. My tsconfig is whatever `tsc --init`",
        "gave me. What's wrong?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-quickstart", arm: "with-only" },
        { name: "names-the-option", type: "regex", pattern: "useDefineForClassFields" },
        {
          name: "diagnosis",
          type: "llm",
          weight: 3,
          criteria: [
            "The response identifies `useDefineForClassFields` left at its modern default of `true` as the cause,",
            "and says it must be set to `false`. It explains the mechanism at least in outline: class fields are",
            "defined after the constructor body runs and overwrite what decorator-based DI already injected.",
            "A response that only suggests generic debugging, blames the DI registration, or recommends",
            "`experimentalDecorators`/`emitDecoratorMetadata` alone without naming `useDefineForClassFields` fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-architecture",
      description: "A layering question belongs to bootgs-architecture; quickstart should hand off rather than answer it.",
      tags: ["precision", "bootgs"],
      prompt: [
        "My bootgs project has grown to about fifteen controllers and services and the layering has",
        "stopped holding — repositories import from controllers now. I want this enforced mechanically",
        "in CI, not by code review. How do I set that up?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-architecture", arm: "with-only" },
        {
          name: "quickstart-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "bootgs-quickstart",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response is about enforcing layer boundaries mechanically — it names eslint-plugin-boundaries",
            "or an equivalent lint-based enforcement of Controller → Service → Repository → Domain.",
            "A response that instead walks through project bootstrap, tsconfig options, or doGet/doPost",
            "entry-point wiring has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
