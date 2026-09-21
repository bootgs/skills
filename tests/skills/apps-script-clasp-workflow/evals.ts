import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "apps-script-clasp-workflow",
  cases: [
    {
      name: "push-is-not-deploy",
      description: "The single most common 'I fixed it but users still see the bug' report.",
      tags: ["recall", "apps-script"],
      prompt: [
        "Our CI runs `clasp push -f` on every merge to main and we treat that as the release. A customer is",
        "still reporting a bug we fixed three weeks ago, and I've verified the fix is in the script editor.",
        "Is our release process wrong?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-clasp-workflow", arm: "with-only" },
        { name: "names-deploy", type: "regex", pattern: "clasp deploy" },
        {
          name: "explains-push-vs-deploy",
          type: "llm",
          weight: 3,
          criteria: [
            "The response explains that `clasp push` updates HEAD only, that installed users run a versioned",
            "deployment, and that CI must also run `clasp deploy` against the existing deployment id for the fix",
            "to reach them. A response that says the process is fine, or blames caching, fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-triggers",
      description: "A trigger that stopped firing is apps-script-triggers' territory.",
      tags: ["precision", "apps-script"],
      prompt: [
        "I have an `onEdit(e)` function in my Sheets project that needs to call UrlFetchApp. It works when I",
        "run it manually from the editor but does nothing when someone actually edits a cell. Why?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-triggers", arm: "with-only" },
        {
          name: "clasp-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-clasp-workflow",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response explains the simple-vs-installable trigger distinction: a simple `onEdit` runs without",
            "authorization and cannot call services that need it, so this needs an installable trigger.",
            "A response about clasp, deployments, or .clasp.json has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
