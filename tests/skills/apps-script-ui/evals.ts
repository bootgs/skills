import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "apps-script-ui",
  cases: [
    {
      name: "dialog-reports-success-too-early",
      description: "A dialog can report Done before the edit lands — SpreadsheetApp.flush() before returning.",
      tags: ["recall", "apps-script"],
      prompt: [
        "My sidebar calls a server function that writes a few rows, then shows a 'Done' toast in the success",
        "handler. Users say the toast appears but the rows aren't there yet — they show up a moment later, or",
        "sometimes the user closes the sheet first and loses them. How do I make 'Done' actually mean done?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-ui", arm: "with-only" },
        { name: "names-flush", type: "regex", pattern: "flush\\(\\)" },
        {
          name: "explains-flush",
          type: "llm",
          weight: 3,
          criteria: [
            "The response says to call `SpreadsheetApp.flush()` in the server function before it returns, so the",
            "pending writes are applied before the success handler reports completion. A response that only",
            "suggests a delay, a polling loop, or a different toast fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-marketplace-publish",
      description: "Getting an add-on through review belongs to apps-script-marketplace-publish.",
      tags: ["precision", "apps-script"],
      prompt: [
        "My Workspace add-on got rejected from the Marketplace and the notice was vague. I need to work out",
        "what they actually check so I can fix it before resubmitting. Where do I start?",
      ].join(" "),
      graders: [
        {
          name: "neighbour-fired",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-marketplace-publish",
          arm: "with-only",
        },
        {
          name: "ui-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-ui",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response is about the Marketplace app-review requirements — fetching the current official",
            "checklist rather than reciting one from memory, and the common rejection causes such as OAuth",
            "consent screen status. A response about menus, sidebars, or dialogs has answered a different",
            "question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
