# Third-party notices

## Bang Motion

ScenePulse includes portions of [bangtutorial/bang-motion](https://github.com/bangtutorial/bang-motion), by **Bang Tutorial**, under the MIT License. Reviewed revision: `c1aa65e921c970d858705fcb4a53a8294d1a4131`, declared version 1.19.0.

The original license is preserved at `vendor/bang-motion/LICENSE`. Per-file provenance and integration notes are recorded in `vendor/bang-motion/UPSTREAM.json`. The upstream SKILL.md is bundled as GUIDE.md to avoid a second discovered skill. Copied source files otherwise remain byte-identical; ScenePulse's integration wrappers are separate files.

## Optional rendering runtime

HyperFrames by HeyGen ([source](https://github.com/heygen-com/hyperframes), npm `hyperframes` 0.8.171) is installed separately under Apache-2.0. ScenePulse invokes its CLI; the upstream source and renderer binaries are not bundled in this skill ZIP. The lockfile pins the dependency tree. The dedicated Chrome headless shell is a separate runtime download with its own notices.

Puppeteer, @puppeteer/browsers, GSAP, and Three.js are installed separately through pinned npm dependencies. Their own licenses apply; their source/runtime binaries are not included in the skill ZIP. GSAP 3.12.5 has its own license terms and is not relicensed under ScenePulse's MIT license. Generated HyperFrames projects retain GSAP's embedded copyright/license header and copy its package license declaration and README alongside the runtime. Generated projects using copied third-party resources must retain the applicable notices.

## Sound assets

The eight bundled audio files are source-labelled CC0 1.0. Authors, source URLs, hashes, and original license notices are in `assets/sfx.json` and `assets/licenses/`. The code's MIT license does not replace those asset records.
