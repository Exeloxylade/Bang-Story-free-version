# Plan format v1

All times are integer milliseconds, local to the named scene. Never use narration-file timestamps directly. Exact scene identity and duration come from the brief. Every scene appears once; no-effect scenes have empty arrays and static motion.

```json
{
  "schemaVersion": 1,
  "projectId": "my-project",
  "durationMs": 12000,
  "timebase": "milliseconds",
  "styleId": "minimal-clean",
  "sceneEffects": [
    {
      "sceneId":"scene-1",
      "audio":[],
      "motion":{"presetId":"static","amount":0},
      "graphics":[]
    },
    {
      "sceneId":"scene-2",
      "audio":[{"effectId":"transition","startMs":0,"gainDb":-24}],
      "motion":{"presetId":"static","amount":0},
      "graphics":[{"presetId":"highlight-box","startMs":1000,"endMs":3000,"x":0.2,"y":0.2,"width":0.3,"height":0.3}]
    }
  ]
}
```

The box coordinates above are illustrative; never put a box there without visual evidence. Use `audio: []` for none, not a sound with ID `none`.

Sound roles: `transition`, `pop`, `click`, `tick`, `pluck`, `bong`. The catalog deterministically maps each role to an exact default sound. `soundId` may optionally select one of that role's listed variants. Gains are attenuation relative to the original file, bounded to -48 dB through the style's maximum. These are not loudness measurements or guarantees of perceived balance. Each cue must fit wholly in the scene. No more than 32 SFX or 16 graphic cues per video in v1; style-specific spacing and density limits also apply.

Motion: `static`, `push-in`, `pull-out`, `pan-left`, `pan-right`. `amount` is extra zoom fraction (0–0.08 or a stricter style ceiling). Static requires 0; other presets require positive amount and `allowAdditionalCamera: true` in the brief. This renderer adds motion over the baked export; it cannot move independent characters or preserve offscreen content after cropping. Smoothstep easing spans the scene. Keep cuts clean by using motion only on deliberately selected scenes.

Graphics: `highlight-box`, `underline`, `frame-outline`. Each uses normalized `x`, `y`, `width`, `height`, stays inside the frame, and ends before 80% of frame height to protect captions. For `frame-outline`, this means a border around the chosen content area rather than the outer frame. `startMs < endMs <= scene duration`. The graphic fades in/out with alpha; color comes from the style. At most the style's graphic count per scene.

Unknown fields/IDs, nonfinite numbers, conflicting project/style/duration, duplicate scenes, invalid intervals, too-close sounds, and unsupported transforms are rejected rather than silently changed. Plans are validated before rendering. Render reports record resolved asset IDs, hashes, command arguments, measured output duration, and review status.
