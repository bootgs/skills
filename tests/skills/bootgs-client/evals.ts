import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "bootgs-client",
  cases: [
    {
      name: "google-script-run-is-not-a-promise",
      description: "Awaiting the bare google.script.run proxy resolves immediately with the proxy, not the result.",
      tags: ["recall", "bootgs"],
      prompt: [
        "I'm calling my bootgs backend from an HtmlService sidebar. I wrote",
        "`const result = await google.script.run.doGet(event);` and `result` is some object that isn't my",
        "response at all — it has none of my fields. The server side definitely runs. What's going on?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-client", arm: "with-only" },
        { name: "names-the-handlers", type: "regex", pattern: "withSuccessHandler" },
        {
          name: "explains-the-proxy",
          type: "llm",
          weight: 3,
          criteria: [
            "The response explains that `google.script.run` is not promise-based: awaiting it resolves with the",
            "proxy object rather than the server's return value, and the result only arrives through",
            "`withSuccessHandler`/`withFailureHandler`. It shows or describes wrapping the call in a Promise.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-openapi",
      description: "Keeping a spec in sync with controllers belongs to bootgs-openapi.",
      tags: ["precision", "bootgs"],
      prompt: [
        "I want an openapi.json that stays in sync with my bootgs @RestController classes, so I can generate",
        "a typed client from it instead of hand-writing one. How should I produce the spec?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-openapi", arm: "with-only" },
        {
          name: "client-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "bootgs-client",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response is about generating an OpenAPI spec from the controllers by static TypeScript AST",
            "analysis. A response that instead explains the Virtual Transport Layer event shape or how to call",
            "the backend from a sidebar has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
