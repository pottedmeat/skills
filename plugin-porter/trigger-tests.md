# Trigger Tests — plugin-porter

20 trigger queries to validate the description's activation precision. Run these in fresh sessions with the plugin-porter skill installed and verify activation matches expected.

## Should Trigger (10)

Exact trigger phrase matches:

1. "Port this Claude plugin to Cursor."
2. "Adapt this plugin for OpenCode."
3. "Convert plugin to agent-zero."

Paraphrased variants:

4. "Take this plugin folder and make it work in Codex CLI."
5. "I need to move my Claude plugin over to Cursor — rewrite what needs rewriting."
6. "Help me migrate this skill bundle to a different agent harness."

Edge cases (minimal context, ambiguous phrasing):

7. "Retarget this plugin to OpenCode, please."
8. "Translate the plugin in `./my-plugin/` for agent-zero."

Embedded in longer messages:

9. "I've been using Claude Code for a while but want to try Cursor. I have a plugin at `~/plugins/foo` with a few skills and agents — can you port it over and install it in the right place for Cursor?"
10. "I cloned a Claude plugin from GitHub and I want to install it for my agent-zero setup. Plugin URL is https://github.com/someone/some-plugin. Can you handle the conversion?"

## Should Not Trigger (10)

Adjacent domain queries (should route to create-skill or similar):

11. "Create a new skill that summarizes PDFs." (should route to create-skill)
12. "Build me a Claude plugin for managing todos." (creation, not porting)
13. "Make a skill that ports CSV files to JSON." (the word 'port' but refers to file format, not plugin format)

General programming queries:

14. "Refactor this TypeScript file to use async/await instead of callbacks."
15. "Rename every occurrence of `foo` to `bar` across the repo."
16. "Move this function from one module to another."

Keyword-overlap-wrong-context:

17. "Install the Claude plugin from this marketplace repo into my Claude Code setup." (install verb but target is Claude itself — plugin-porter is Claude→other only)
18. "Translate this README from English to French." (translate verb but not about plugins)

Other known plugin targets in this marketplace:

19. "Optimize this existing skill for better trigger precision." (should route to improve-skill)
20. "Review the PR I just opened for the skill I added." (should route to code review or pr-description)

## Expected Activation Rate

- Should-trigger: ≥9 of 10 fire plugin-porter
- Should-not-trigger: ≤1 of 10 fires plugin-porter

If either bound is violated, revisit the description's trigger phrases or negative cases.
