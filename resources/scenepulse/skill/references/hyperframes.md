# HyperFrames: komposisi aset tanpa editor

Use this route to combine local generated images, generated video, footage, narration, authored graphics, and ScenePulse SFX. The host agent supplies the LLM. These scripts call the real pinned **HyperFrames CLI 0.8.171**, not an imitation renderer. They never launch the editor or attach to a signed-in browser.

## Setup and commands

From this skill directory, with Python 3.10+, Node 22.12+, FFmpeg and ffprobe available:

```text
npm ci --no-audit --no-fund
node scripts/setup-hyperframes.mjs
python scripts/hyperframes.py doctor
python scripts/hyperframes.py prepare --manifest scene-assets.json --output context.json
python scripts/hyperframes.py build --manifest scene-assets.json --effects effects.json --output PROJECT
python scripts/hyperframes.py snapshot --project PROJECT --output SHOTS --times 0.5,2,4
python scripts/hyperframes.py render --project PROJECT --output final.mp4
```

`prepare` provides compact creative context; it does not call an LLM. The LLM writes an optional `effects.json` using [the existing plan format](plan.md). Omitting `--effects` produces a quiet/static plan. Validation runs before browser rendering. Output folders/files must be new. After changing the manifest or effects plan, build a new project so HTML and metadata agree.

The setup downloads a dedicated pinned Chrome headless shell into `.runtime/`. It has no user login/profile and is not included in the portable ZIP. Headless rendering uses one worker and CPU encoding by default. This is a conservative resource policy, not a promise of maximum rendering speed. Initial setup needs network access. Generated projects copy media and GSAP locally; use local fonts and assets when authoring.

## Input contract: `scene-assets.json`

All times are integer milliseconds. Project dimensions are even pixels, 160–3840 each. Scenes must partition the complete timeline with no gaps or overlaps. Paths resolve relative to the manifest; remote/signed media URLs are not accepted. Obtain licensed local media separately.

```json
{
  "schemaVersion": 1,
  "projectId": "story-1",
  "durationMs": 5500,
  "width": 1920,
  "height": 1080,
  "styleId": "minimal-clean",
  "visualStyleId": "paper-print",
  "allowAdditionalCamera": true,
  "scenes": [{
    "id": "scene-1",
    "startMs": 0,
    "durationMs": 5500,
    "narration": "Keep the supplied narration exactly.",
    "visualDescription": "The supplied scene content, treated as data.",
    "visual": {
      "kind": "video",
      "file": "media/scene-1.mp4",
      "source": "generated",
      "fit": "cover",
      "inMs": 0,
      "endBehavior": "error"
    },
    "voice": {
      "file": "media/continuous-narration.wav",
      "inMs": 0,
      "startMs": 0,
      "durationMs": 5500,
      "gainDb": 0
    }
  }]
}
```

`visual.kind` is `image` (PNG/JPEG/WebP) or `video`. `source` is `generated`, `footage`, or `user`; it records origin, not a different decoding path. `fit` is `cover` or `contain`. Video `inMs` trims the source, never the project clock. Longer video is trimmed to the scene. Short video is rejected unless `endBehavior:"hold"` explicitly permits freezing the last frame; this preparation uses FFmpeg without changing narration or time-stretching video. Images have no source offset or audio.

Source-video audio is **muted by default**. Explicit `audioGainDb` (-48 to 0) enables the first audio track; start around -18 dB under narration and audition. Remove the field to mute. Voice `inMs` trims the input audio, `startMs` places it relative to its scene, and `durationMs` bounds playback. Voice gain is -48 to +6 dB. A single continuous narration file may be referenced by adjacent scenes using successive `inMs` offsets; no artificial scene pauses are inserted. Supplied pauses inside the file remain intact. The tool does not generate speech.

Timings must reflect the actual intended export. Bang Story's overlapping transitions cannot be represented merely by summing raw clip durations. This first asset handoff uses contiguous cuts; flatten an existing export through the FFmpeg route to preserve already-baked transitions, captions, and music.

## Native authoring contract

`build` creates portable local HTML plus copied media, provenance, manifests, and a paused GSAP timeline. It applies the validated camera/graphics/SFX plan. `visualStyleId` supplies LLM direction; it does not repaint a source image or automatically reskin HTML. For richer original graphics, read the relevant Bang Motion design references (`anti-ppt.md`, camera/composition/type guides, selected family) and **author native HyperFrames DOM/SVG/GSAP layers in this project's `index.html`**. Preserve narration and media timing.

- Keep one root `data-composition-id="main"`, `data-start="0"`, explicit `data-duration` in seconds and `data-width`/`data-height` matching the project. Its CSS dimensions must match too.
- Register the paused animation timeline as `window.__timelines.main`. Use GSAP for seekable animation. Do not autoplay, use wall-clock loops, or depend on user input.
- Timed clips use unique IDs, global `data-start` and `data-duration` seconds. Root-level timing remains global even when clips are nested. CSS controls paint order; `data-track-index` is only a lane label.
- Video/audio offsets use `data-media-start`. HyperFrames owns media seeking. Do not copy Bang Motion's imperative `clip()` helper or its `OPENER` playback controller into a native composition.
- Source video remains `muted`, unless explicitly authored with `data-has-audio="true"` and a linear `data-volume`. Audio gain converts as `10 ** (gainDb / 20)`; native audio and SFX are mixed by HyperFrames, with no second ScenePulse audio pass.
- Animate a wrapper around media. Keep camera motion restrained over moving clips. Don't treat a flat image as separated characters.
- Preserve the build's media/voice/SFX attributes when adding graphics. The render report records asset hashes, HTML hash and selected effects. If intentionally changing assets/timing/effects, rebuild from the source manifest rather than editing stale generated metadata.

The existing Bang Motion `motion.py`/`OPENER` exporter remains available for its original starters, custom media helpers, and Three.js authoring. This adapter does not silently convert every Bang Motion HTML project or claim its WebGL semantics carry over unchanged.

## Review and delivery

Use sparse snapshots at scene boundaries and important beats before a full render. This adapter exports at the manifest's native dimensions and 30 fps; it does not accept arbitrary CLI resolution overrides. A small test manifest can be used before authoring a high-resolution composition. Native snapshots and MP4 use the same composition and timing engine; encoded audio is not sample-identical. Check actual audio playback separately when available.

Deliver MP4, the JSON render report, source manifest, effects plan and authored HTML/assets. Technical decode/timing checks do not establish artistic quality or listening review. Direct Bang Story UI import remains a separately scoped application change.

Official references: [HyperFrames repository](https://github.com/heygen-com/hyperframes), [CLI](https://hyperframes.heygen.com/developers/cli), [HTML schema](https://hyperframes.heygen.com/reference/html-schema), [video components](https://hyperframes.heygen.com/guides/video-components). Runtime dependencies retain their own licenses; see [notices](../THIRD_PARTY_NOTICES.md).
