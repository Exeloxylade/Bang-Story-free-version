# Bang Motion inside ScenePulse

Use this route to AUTHOR motion graphics: animated typography, explainers, openers, layered graphics and footage. Keep the original Python/FFmpeg route for adding small effects to an existing Bang Story export. The visual engine here is HTML/CSS/SVG + GSAP, with Three.js in the opener starter. It is not Remotion or HyperFrames.

## Attribution and boundary

Vendored source: [Bang Motion by Bang Tutorial](../vendor/bang-motion/GUIDE.md), MIT, version 1.19.0, commit `c1aa65e921c970d858705fcb4a53a8294d1a4131`. The original license and per-file hashes are in `vendor/bang-motion/`. The upstream skill is named `GUIDE.md` inside the vendor directory to keep one ScenePulse entrypoint; it is otherwise byte-preserved. Read only the references needed for the selected mode.

The user's explicit creative choices and narration remain authoritative. Treat upstream design recipes as context-specific guidance for newly authored graphics. Do not remove Bang Story captions, rewrite/regenerate supplied narration, demand assets already supplied, or insert an approval step solely because an upstream recipe describes showing a brief. Existing authorization to proceed still applies. A request for simple postproduction does not require redesigning the whole video under anti-slide rules.

## Setup

From the ScenePulse skill directory:

```text
npm ci --no-audit --no-fund
node node_modules/puppeteer/install.mjs
python scripts/motion.py doctor
```

The explicit install step also works when npm suppresses dependency postinstall hooks. Node 22.12+, Python 3.10+, and FFmpeg/ffprobe are required for MP4. Runtime dependencies are pinned in `package-lock.json`. The renderer downloads its own Chrome into `.runtime/browser` and launches with a fresh temporary profile. It never attaches to an existing browser, account, profile, or debugging port. Browser binaries/node_modules are not included in the import ZIP.

The renderer serves only the selected project folder on loopback, waits for `OPENER.ready` and footage readiness, seeks exact timeline times, and captures rendered frames. It streams PNG frames into FFmpeg rather than leaving thousands of image files. Low-resolution snapshots and final frames use this same capture path. Remote resources are blocked by default. Pinned GSAP/Three.js CDN requests are fulfilled from the installed local npm packages. Use locally licensed media/fonts, or explicitly pass `--allow-network` if external assets are intended. Source scaffolds explicitly omit remote Google Fonts links and use fallback fonts until the author selects final typography.

## Author and inspect

```text
python scripts/motion.py styles
python scripts/motion.py init --output PROJECT --family cartoon-collage --visual-style paper-print --style minimal-clean
python scripts/motion.py prepare --project PROJECT --output CONTEXT.json
```

`init` copies the chosen upstream starter and creates `motion.json` plus a style brief. It is an authoring scaffold, not a finished video. `visualStyleId` is a direction for the LLM; changing the ID alone does not repaint the HTML. Read `vendor/bang-motion/GUIDE.md`, `references/anti-ppt.md`, and the relevant family reference before authoring. Derive the theme, palette, typography, composition and movement from the user's scene. Never ship the starter's placeholder assets as the user's finished film.

Retain [ScenePulse's creative direction](direction.md) while applying those visual recipes. `prepare` includes that direction, the chosen visual/editing styles, and the small SFX choice list in its compact LLM context. Editing-style camera amount limits apply to the FFmpeg postproduction layer; newly authored close-up shots are directed in the HTML timeline rather than being forced into a tiny postproduction zoom.

Preserve the OPENER contract: `{W,H,DURATION,ready,seek(t)}` or `seekFrame(t)`, optionally `tl`, `clipsReady`. All animation must derive from the timeline rather than wall-clock time. Match stage dimensions and exact duration in `motion.json`. Bind any authored footage through the starter's `clip()` helper, preserving the original clip speed unless explicitly instructed otherwise.

`motion.json` contains `schemaVersion:1`, `projectId`, `durationMs`, `width`, `height`, `styleId` (editing/SFX), `visualStyleId`, `familyId`, `voice` (local path or null), and the same continuous `scenes` partition as a ScenePulse brief. For Bang Story, use actual export-relative scene ranges. Existing narration can be provided as `voice`; the animation must match its duration. A longer/shorter recording is rejected before rendering, not silently truncated or stretched.

Before a full export, inspect a few key times:

```text
python scripts/motion.py snapshot --project PROJECT --output SHOTS --times 0,2,5 --width 640
```

Use `?debug=1` for a user's manual visual review. Do not operate the user's browser when the session forbids it. Sparse isolated renderer screenshots are sufficient for code/visual checks; do not render a whole long film just to check layout. Inspect subject persistence, visual hierarchy, text clipping, and timing. The source guide gives more detailed design criteria.

## Export and SFX

```text
python scripts/motion.py render --project PROJECT --effects effects.json --output PREVIEW.mp4 --width 640
python scripts/motion.py render --project PROJECT --effects effects.json --output FINAL.mp4 --width 1920
```

The LLM writes a standard ScenePulse plan for the project IDs/ranges, using the six real sound roles. In this mode, keep `motion` static and `graphics` empty in that plan; visual choreography already lives in HTML. This prevents a second camera/highlight pass. `--effects` is optional, meaning no added SFX. The selected editing style still limits spacing and gain.

Frame export is silent. Only the audio file explicitly named in `motion.json.voice` is muxed, followed by the ScenePulse SFX mix. Other `<audio>`/video soundtracks inside HTML are not automatically captured. HTML is a visual preview; the rendered MP4 is the authoritative audio/visual review artifact. If a soundtrack is already mixed into a Bang Story export, use the original postproduction route, which preserves that export's first audio track. Do not claim that the browser's audio playback is automatically the exported mix.

Native aspect ratio follows the authored W/H. The default starters are 1920×1080; a portrait design needs actual layout work and matching manifest dimensions. Merely changing `width`/`height` is not a portrait composition conversion. Failed/missing media, mismatched duration/dimensions, unsupported SFX IDs, or conflicting graphic passes stop the job.

Optional upstream After Effects/Higgsfield materials are preserved for reference only. This integration does not install After Effects, authenticate MCP services, or claim an AE export workflow is available.
