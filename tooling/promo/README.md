# Promo video

This folder makes a short promotional video from the real app. The video is in Spanish and uses the Amber theme. It comes in three files, one for each aspect ratio:

| File                 | Size        | Use                                                     |
| -------------------- | ----------- | ------------------------------------------------------- |
| `out/promo-9x16.mp4` | 1080 x 1920 | Instagram Reels, TikTok, YouTube Shorts, Facebook Reels |
| `out/promo-4x5.mp4`  | 1080 x 1350 | LinkedIn, Instagram feed, Facebook feed, X              |
| `out/promo-16x9.mp4` | 1920 x 1080 | YouTube, web pages, presentations                       |

Each file is H.264 MP4 at 30 fps with a silent AAC track. The research behind the length, the formats and the safe areas is in `docs/research/2026-11-18-short-promo-video.md`.

## How it works

1. `gen-project.mjs` writes `showcase.json`. This project is a 4-bit adder made only from NAND gates.
2. `capture.mjs` opens the app in a headless browser on three screen sizes. It imports `showcase.json`, does the actions of each scene, and records frames to `out/clips/`.
3. `render.mjs` draws each video frame with `stage.html`. The frame shows the clips on device bodies, with the text from `storyboard.mjs`. Then ffmpeg encodes the frames.

The `out/` folder holds only generated files. Git ignores it.

## Make the video

You need the repository's dependencies (`pnpm install`), the Playwright Chromium browser, and `ffmpeg`.

1. Start the app: `pnpm dev --port 5173`.
2. Record the clips: `node tooling/promo/capture.mjs`.
3. Render the three files: `node tooling/promo/render.mjs`.

Step 2 is necessary only when the app or a scene's actions change. Step 3 is sufficient when you change only `storyboard.mjs` or the stage files.

## Change the video

| To change                                                  | Edit                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| The name, the tagline, the last message, the contact lines | `BRAND` in `storyboard.mjs`                                                              |
| The text of a scene                                        | `kicker` and `title` of the scene in `storyboard.mjs`. `*word*` gives the accent colour. |
| The length or the order of the scenes                      | `start` and `end` of each scene in `storyboard.mjs`                                      |
| The part of a clip that a scene shows, and its speed       | `play` of the device in `storyboard.mjs`                                                 |
| The close view of the Pins panel in a scene                | `inset` of the device in `storyboard.mjs`                                                |
| The position, size and angle of a device                   | The pose for each format in `storyboard.mjs`                                             |
| Colours, fonts, device bodies, text sizes                  | `stage.css`                                                                              |
| The actions that a clip shows                              | The clip's function in `capture.mjs`                                                     |
| The circuit in the simulation shots                        | `gen-project.mjs`, then run it                                                           |

Useful commands:

- Render one format: `node tooling/promo/render.mjs 9x16`.
- Render still frames to examine a layout: `node tooling/promo/render.mjs 9x16 --still 1.5,5,9.5`. The stills go to `out/stills/`.
- Record one clip again: `node tooling/promo/capture.mjs build`. The clips are `sim`, `build`, `test`, `place` and `dive`.
- Use a different app address: set `PROMO_URL`, for example `PROMO_URL=http://127.0.0.1:4319`.

## Notes

- Keep the text of the 9:16 file in the safe area that `FORMATS` gives in `storyboard.mjs`. The platforms put their buttons and captions on the other areas.
- The recorder takes about 19 frames each second. A clip records at a slower pace (`pace` in `capture.mjs`), and the frame times are divided by the pace. Thus a pace of 2 gives about 38 frames for each second of video.
- `capture.mjs` reads the output values while it records the test scenes. It stops with an error if the simulation gives a wrong value (for example, if 5 + 3 is not 8).
- The video has no music. Add a licensed track in the platform's editor, or mix one in with ffmpeg.
