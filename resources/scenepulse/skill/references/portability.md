# Portable skill package

The same folder contains the instructions, local scripts, six style presets, and eight source-labelled CC0 sounds. No absolute developer paths, credentials, paid audio services, or additional LLM SDKs belong in the package. The host agent supplies its existing LLM and permissioned execution tools.

The v0.3 bundle includes a pinned headless HyperFrames scene-asset composer, attributed Bang Motion guides/starters, and ten visual directions. Install the optional Node runtime after extraction; node_modules and browser binaries are not shipped. For the preferred composition route run `npm ci` and `node scripts/setup-hyperframes.mjs`, then `python scripts/hyperframes.py doctor`; see [the native workflow](hyperframes.md). The original Bang Motion renderer has its own [runtime instructions](bang-motion.md). The existing FFmpeg route does not require Node or a browser. Importing a skill in a sandbox without compatible execution tools still cannot render videos.

## Claude

Use the packaged ZIP with Claude's custom skill import where supported, or put the `scenepulse` folder in a Claude Code skill directory such as `.claude/skills/`. Execution requires a host with Python and FFmpeg/ffprobe plus access to the input video. A successful upload does not establish that those binaries or input files are accessible. Verify with the `doctor` command.

Official source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

## OpenClaw

Use the local skill installation command documented for the installed OpenClaw version, e.g. `openclaw skills install ./scenepulse --as scenepulse`. Alternatively follow its workspace skill-folder setup. Run `doctor` through the agent's execution tools. Runtime permissions and available binaries determine whether rendering can execute.

Official sources: https://docs.openclaw.ai/tools/creating-skills and https://docs.openclaw.ai/cli/skills

## Codex

Install the `scenepulse` folder into an appropriate skill directory for your Codex setup and reload discovery as needed. `agents/openai.yaml` is optional Codex UI metadata; it does not change the core workflow for other agents.

Official source: https://developers.openai.com/plugins/concepts/skills

This package is structurally portable. Platform-specific import/runtime execution must be verified in each actual host; no Claude/OpenClaw session has been exercised by the local rendering checks.

## Extend without losing intention

Edit `assets/styles.json` to tune editorial energy and limits. Keep accepted/rejected project examples with a short user reason. Add a new sound only after provenance, decode, listening, and catalog checks. Add new rendering capabilities in scripts and validate their observable output before listing them in instructions. A future API-driven Bang Story planner should load the same directions/catalog and submit returned JSON to the same validator; it does not need to imitate an entire desktop agent.
