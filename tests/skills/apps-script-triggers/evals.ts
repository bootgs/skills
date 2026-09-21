import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "apps-script-triggers",
  cases: [
    {
      name: "duplicated-installable-trigger",
      description: "ScriptApp.newTrigger().create() is not idempotent — the handler fires twice per event.",
      tags: ["recall", "apps-script"],
      prompt: [
        "My Apps Script add-on has a setup function that installs an onFormSubmit trigger. Users keep",
        "reporting that their notification email arrives twice, sometimes three times, for one submission.",
        "The handler itself only sends once. What's happening?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-triggers", arm: "with-only" },
        { name: "names-the-api", type: "regex", pattern: "getProjectTriggers|newTrigger" },
        {
          name: "explains-idempotency",
          type: "llm",
          weight: 3,
          criteria: [
            "The response identifies that creating the trigger is not idempotent — running the setup code again",
            "adds a second trigger for the same handler — and shows checking existing triggers by handler",
            "function name before creating, or deleting first. A response that blames the handler logic fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-clasp-workflow",
      description: "A 'my fix isn't live for users' question is the push-vs-deploy distinction.",
      tags: ["precision", "apps-script"],
      prompt: [
        "I fixed a bug in my Apps Script add-on and pushed it. I can see the new code in the editor, but",
        "the users who installed it still hit the old behaviour. What step am I missing?",
      ].join(" "),
      graders: [
        {
          name: "neighbour-fired",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-clasp-workflow",
          arm: "with-only",
        },
        {
          name: "triggers-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-triggers",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response explains that `clasp push` only updates HEAD and that installed users run a versioned",
            "deployment, so the fix needs a `clasp deploy`. A response about triggers, authorization, or event",
            "objects has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
