# Bang Story handoff

Version 1 accepts an already exported local video. Existing narration, music, captions, camera moves, transitions, and visual choices are baked into it. ScenePulse applies additional effects without changing Bang Story's source project or databases. This is a working file-based handoff, not a live in-app button or project migration.

Create a UTF-8 JSON brief:

```json
{
  "schemaVersion": 1,
  "projectId": "my-project",
  "video": "video.mp4",
  "durationMs": 12000,
  "styleId": "minimal-clean",
  "allowAdditionalCamera": false,
  "scenes": [
    {"id":"scene-1","startMs":0,"durationMs":6000,"narration":"Existing narration, unchanged.","visualDescription":"Existing scene."},
    {"id":"scene-2","startMs":6000,"durationMs":6000,"narration":"Next narration.","visualDescription":"A major section transition."}
  ]
}
```

`video` resolves relative to the brief file, not the agent's current directory. Use actual export-relative scene ranges, including transition overlaps resolved by the exporter; ranges here must form a continuous partition. Do not guess from raw project clip durations. If actual ranges are unavailable, run `init --video VIDEO --output BRIEF.json --style minimal-clean`. It measures the video and creates one scene covering the export. A single scene is honest but does not enable automatic cut-aware placement.

The existing Bang Story `ProjectBundle` contains clips and assets, while the exporter owns the final timing/crossfades. A future Bang Story adapter should export final scene ranges and optional visual event times into this brief, then import the validated plan into its own preview/export. Do not modify that code or claim that adapter is installed during a skill-only task.

The LLM can read provided scene descriptions and inspect frames through its host tools. These Python scripts do not perform visual recognition, speech transcription, scene detection, or network calls.
