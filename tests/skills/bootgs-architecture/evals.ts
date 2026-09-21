import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "bootgs-architecture",
  cases: [
    {
      name: "repository-reaching-upward",
      description: "A PR that has a repository importing a service — the one-directional rule.",
      tags: ["recall", "bootgs"],
      prompt: [
        "Reviewing a bootgs PR. It adds `WidgetRepositoryImpl` and that file imports `WidgetServiceImpl`",
        "to reuse a formatting helper. It compiles and the tests pass. Is this fine? If not, what should",
        "the author do instead?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-architecture", arm: "with-only" },
        {
          name: "rejects-the-upward-import",
          type: "llm",
          weight: 3,
          criteria: [
            "The response says this is a layering violation: dependencies run one way only",
            "(Controller → Service → Repository → Domain) and a repository must not import a service.",
            "It proposes a concrete fix — move the shared helper down into domain/ or a utility, or invert",
            "the dependency — rather than approving the PR because it compiles.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-validation",
      description: "Input validation on a controller method belongs to bootgs-validation.",
      tags: ["precision", "bootgs"],
      prompt: [
        "In my bootgs controller, a handler takes a `limit` query parameter. Right now a caller can pass",
        "`limit=-5` or `limit=abc` and it reaches my service untouched. What's the idiomatic bootgs way",
        "to reject that at the boundary?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-validation", arm: "with-only" },
        {
          name: "architecture-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "bootgs-architecture",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response is about bootgs' parameter validation: it names validation decorators such as",
            "@Min/@Positive or a Parse pipe for coercion. A response that instead discusses layer boundaries,",
            "the Interface+Impl convention, or eslint-plugin-boundaries has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
