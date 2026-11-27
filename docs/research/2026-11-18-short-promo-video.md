# Short promo video for a web app on social platforms

Research date: 2026-11-18. Every source was fetched on this date. Specs change often. Check the live page before you export.

Labels used in this file:
- **Verified**: read on a first-party page on 2026-11-18.
- **Snippet**: seen only in a search-result snippet of a first-party page. The page itself did not load.
- **Unverified**: no first-party page was read. Do not rely on it.
- **Opinion**: our own inference, not a platform rule.

## Summary

1. Make three master files: 9:16, 4:5 and 16:9. They cover all eight platforms.
2. Keep the video 15 to 25 seconds. LinkedIn recommends 15 to 30 seconds. Apple allows 15 to 30 seconds. Google recommends 10 to 30 seconds for vertical action ads.
3. Show the main result in the first 3 seconds. TikTok says: proposition in 3 seconds, hook in 6 seconds.
4. Design for sound off. LinkedIn and Apple say many viewers watch without sound. Burn in short captions.
5. Use H.264 in MP4, 30 fps, AAC audio. All platforms accept it.
6. Meta gives the only numeric safe zone for 9:16: 14% top, 35% bottom, 6% each side. TikTok and YouTube give diagrams or files only.
7. Show real app footage. Apple and Google Play both ask for this. Apple bans fingers on a device. Google Play limits promo content.
8. X specs could not be read on a first-party page. Mark them unverified.

## Spec table per platform

"Ad" means the paid ad spec. "Org" means the organic upload spec. Organic limits are often wider than ad limits.

| Platform | Aspect ratio | Resolution | Duration | Frame rate | Codec / container | Max size | Source status |
|---|---|---|---|---|---|---|---|
| Instagram Reels (ad) | 9:16 | 1440x2560; min width 250 px under 30 s, 500 px from 30 s | up to 15 min | fixed; value not given | H.264, MP4 or MOV, AAC 128 kbps stereo, no edit lists | 4 GB | Verified [M1] |
| Instagram Reels (org, API) | 9:16 recommended; range 0.01:1 to 10:1 | max width 1920 | 3 s to 15 min | 23 to 60 fps | H.264 or HEVC, MP4 or MOV, moov atom first, VBR up to 25 Mbps, AAC | 300 MB | Verified [M5] |
| Instagram Reels (org, app) | 1.91:1 to 9:16 | min 720 px | not confirmed (3 min vs 20 min conflict) | min 30 fps | not given | not given | Snippet [I1]; unverified |
| Instagram feed (ad) | 9:16 | 1080x1920; min width 250 px | 1 s to 60 min | not given | MP4, MOV or GIF; no edit lists | 4 GB | Verified [M2] |
| TikTok (ad, non-Spark) | 9:16 recommended; 16:9; 1:1 | min 540x960; 960x540; 640x640 | up to 10 min | not given | MP4, MOV, MPEG, 3GP, AVI; codec not given; bitrate at least 516 kbps | 500 MB | Verified [T1] |
| TikTok (org, API) | not given | min 360 px, max 4096 px per side | 3 min for all; 5 or 10 min for some | 23 to 60 fps | MP4 (recommended), WebM, MOV; H.264 (recommended), H.265, VP8, VP9 | 4 GB | Verified [T3] |
| YouTube Shorts | vertical (9:16 preferred) | max 1080p | up to 3 min | match source | see YouTube standard | not given | Verified [Y2] |
| YouTube Shorts (ad) | 9:16 best; 1:1 and 16:9 get blurred bars | 1080x1920 | up to 3 min; first 60 s play in the feed; under 60 s recommended; 10 to 30 s for action | not given | not given | not given | Verified [G1], [G3] |
| YouTube standard | 16:9 on computer; vertical and square also play | 1080p bitrate 8 Mbps (30 fps), 12 Mbps (60 fps) | not read | match source (24 to 60) | MP4, H.264 High Profile, closed GOP, 4:2:0, AAC-LC, 48 kHz, moov atom first | not read | Verified [Y1] |
| YouTube ads (in-video) | 16:9, 9:16, 1:1 | 1920x1080, 1080x1920, 1080x1080 | 15 s recommended | not given | many accepted (MP4, MOV, HEVC) | 256 GB | Verified [G2] |
| LinkedIn video ad | 16:9, 1:1, 4:5 (recommended), 9:16 | 4:5 720x900 (min 360x450, max 1080x1350); 9:16 720x1280 (max 1080x1920); 16:9 1920x1080 | 3 s to 30 min; 15 to 30 s recommended; in-stream up to 90 s | "less than 30 fps" | MP4; H.264 or VP8; AAC or MPEG4 | 75 KB to 500 MB | Verified [L1] |
| X (Twitter) | 16:9, 1:1, 4:5, 2:3, 9:16 (expanded ratios) | 16:9 800x450; 1:1 800x800; 4:5 1440x1800; 2:3 1080x1620; 9:16 1080x1920 | not confirmed | not confirmed | not confirmed | not confirmed | Snippet only [X1]; the page returned HTTP 403. Duration, size and codec unverified |
| Facebook Reels (org, API) | 9:16 | 1080x1920 recommended; min 540x960 | 3 to 90 s; 60 s as Page story | 24 to 60 fps, fixed | MP4; H.264 or H.265; 4:2:0; closed GOP 2 to 5 s; AAC-LC 48 kHz 128 kbps or more | not given | Verified [M4] |
| Facebook Reels (ad) | 9:16 | 1440x2560 | see Instagram Reels ad | see Instagram Reels ad | see Instagram Reels ad | see Instagram Reels ad | Not read; the page returned HTTP 404. Unverified |
| Facebook feed (ad) | 4:5 | 1440x1800; min 120x120 | 1 s to 241 min | fixed; value not given | H.264, MP4, MOV or GIF, AAC 128 kbps or more, no edit lists | 4 GB | Verified [M3] |

Notes:
- LinkedIn lists the frame rate as "less than 30 fps". Apple App Store previews allow a maximum of 30 fps [A1]. Export LinkedIn files at 29.97 fps to be safe. This is **opinion**.
- Meta feed ads with the Awareness objective hide the headline, description and call-to-action button in the mobile feed [M3]. Put the call to action inside the video.
- The LinkedIn page lists audio size as "less than 64KHz". This is probably an error on the page. Do not use it.

### Safe zones

| Platform | Safe zone | Status |
|---|---|---|
| Instagram Reels and Facebook Reels ads (9:16) | Keep text and logos out of 14% at the top, 35% at the bottom and 6% on each side. At 1080x1920 this is about 269 px, 672 px and 65 px. The profile icon, caption and call-to-action button cover these areas. | Verified [M1], [M6]. Pixel values are our arithmetic. |
| TikTok in-feed ads | The safe zone depends on video shape, caption length and extra formats. TikTok gives it only as downloadable overlay files. No numbers in the text. | Verified that no numbers are published in text [T2]. Numbers unverified. |
| YouTube Shorts ads | Google shows a diagram for 1080x1920. The text gives no margins. | Verified that no numbers are in the text [G4]. Numbers unverified. |
| LinkedIn, X, YouTube standard, Facebook feed | No safe zone is published in the pages read. Facebook feed hides the caption footer for Awareness ads [M3]. | Unverified |

## Creative guidance from the platforms

| Topic | Guidance | Source |
|---|---|---|
| Hook timing | TikTok: put the content proposition in the first 3 seconds to improve recall. Put the hook in the first 6 seconds. | [T4] |
| Hook timing | LinkedIn: show the key message in the first 10 seconds. For a 30-second video, make the point in the first 5 seconds. | [L2] |
| Hook timing | Google (YouTube): open with a bold, attention-grabbing visual. The page gives no second count. The older ABCD guide says two or more shots in the first 5 seconds. That older figure came from a search snippet only. | [G5]; snippet |
| Hook timing | Google Play: show the real app early, within the first 10 seconds. | [P1] |
| Pacing | TikTok: use transitions, stickers and graphics to keep viewers engaged. Show text at about 5 to 10 words per second. | [T4] |
| Pacing | Apple: use simple transitions such as dissolves and fades. Google Play: use smooth pacing and clean transitions. | [A2], [P1] |
| Sound off | LinkedIn: many members watch with sound off. Carry the message with visuals and on-screen text. Burn in subtitles. | [L2] |
| Sound off | Apple: previews play muted by default. Use copy for context. Keep text on screen long enough to read. | [A2] |
| Sound on | YouTube: almost entirely a sound-on place. Use sound to help the brand. TikTok and Meta: use good audio. Meta says Reels play with sound by default. | [G5], [T4], [M7] |
| Captions | Meta: subtitles and sound are optional but recommended. LinkedIn: SRT captions are supported. | [M1], [L1] |
| Branding | Google: work the brand into the story with product shots, graphics and voice-over. Google Play: limit title screens and logos. | [G5], [P1] |
| Call to action | TikTok: end with a clear call to action. LinkedIn: show a clear call to action. Google: give clear, simple next steps. Google Play: do not use "Download now" in the video. | [T4], [L2], [G5], [P1] |
| Format | Meta: 9:16 video with audio and key messages in the safe zone gave 34.5% lower cost per result than image ads. This is a Meta test result, not independent. | [M7] |
| Length for ads | LinkedIn: 15 to 30 s recommended. LinkedIn data (2025): 7 to 15 s videos had up to 300% higher completion. Google Shorts ads: under 60 s; 10 to 30 s for action ads. | [L1], [L2], [G1] |

## Product-demo conventions

Primary sources are thin. Most points below come from app-store rules, which apply to app previews and not to social ads. Label them as such.

| Convention | Evidence | Status |
|---|---|---|
| Show real UI from the product. Apple: "demonstrate the features, functionality, and user interface of your app using footage captured on device." | [A2] | First-party, for app previews |
| Tell one cohesive story. If you make several videos, each must show something new. | [A2] | First-party, for app previews |
| Capture at native UI resolution. Do not zoom in on the view. | [A2] | First-party, for app previews |
| Add graphic hints such as touch hotspots to show interaction. This supports cursor and tap emphasis. | [A2] | First-party, for app previews |
| Do not film people touching a device. Show only content inside the app. | [A2], [P1] | First-party |
| Make at least 80% of the video real user experience. Limit title screens and logos. No black bars on portrait video. | [P1] | First-party, for Google Play |
| Avoid dates, "new for spring" and prices. They age the video. | [A2] | First-party |
| Pick a strong poster frame. It shows when autoplay is off. | [A2] | First-party |
| Device mockups: Apple gives no frame rule. Google Play says device imagery in graphics ages fast. Apple accepts one device size per preview and wants native screens. | [A2], [P1] | Weak. No platform requires or bans mockups for social ads. |
| Zoom and pan on UI, feature-per-beat structure, text overlay length beyond TikTok's 5 to 10 words per second | No first-party source found | **Opinion**. See blueprint. |

## Recommended blueprint

### Master files

| Master | Size | Covers | Safe margins | Basis |
|---|---|---|---|---|
| 9:16 | 1080x1920 (render 1440x2560 if cheap, then downscale) | Instagram Reels, TikTok, YouTube Shorts, Facebook Reels, Instagram feed ad, LinkedIn and X vertical | Top 269 px (14%), bottom 672 px (35%), sides 65 px (6%). Live area is 950x979 px. | Meta numbers [M1]. Used for all vertical platforms because TikTok and YouTube publish no numbers. |
| 4:5 | 1080x1350 (or 1440x1800 for Meta) | Facebook feed, LinkedIn feed (recommended ratio), X feed, Instagram feed | 5% on every side (54 px sides, 68 px top and bottom). Put the call to action inside the video. | **Opinion**. No platform publishes margins. Facebook feed hides the footer for Awareness [M3]. |
| 16:9 | 1920x1080 | YouTube standard, LinkedIn, X, website | 5% on every side (96 px sides, 54 px top and bottom). Keep the lower third clear for YouTube UI. | **Opinion**. |

A 1:1 file is not needed. LinkedIn, Meta feed and X all accept 4:5.

### Export settings (all masters)

1. Container: MP4, with the moov atom at the front and no edit lists.
2. Video: H.264 High Profile, progressive, 4:2:0, closed GOP.
3. Frame rate: 30 fps constant. Use 29.97 fps for LinkedIn.
4. Bitrate: 8 to 12 Mbps at 1080p. YouTube recommends 8 Mbps at 1080p30 [Y1]. Apple targets 10 to 12 Mbps [A1].
5. Audio: AAC-LC stereo, 48 kHz, 128 kbps or more, even if the video has no voice. Add a quiet music bed or UI sounds.
6. Captions: burn them in. Also upload SRT on LinkedIn.
7. File size: stay under 300 MB. This also meets the smallest limit found for organic Instagram [M5].

### Storyboard: 20 seconds, 9:16

Use the same beats for 4:5 and 16:9. Re-compose each frame. Do not only crop.

| Time (s) | Beat | On screen | Text (max 6 words) |
|---|---|---|---|
| 0.0 to 2.5 | Hook | The best result of the app, full frame, one device, one fast move. No logo screen. | One clear promise |
| 2.5 to 7.0 | Feature 1 | Desktop. Zoom to the key control. Cursor ring or click pulse. | Feature name |
| 7.0 to 11.5 | Feature 2 | Tablet. Camera angle shifts. Show the same project. | Feature name |
| 11.5 to 16.0 | Feature 3 | Phone. Show the touch gesture with a hotspot. | Feature name |
| 16.0 to 18.5 | Proof | The three devices side by side with the same project. | Works on every screen |
| 18.5 to 20.0 | Call to action | Logo, one action, short URL. Hold 1.5 s. | One action |

Rules for the beats:
1. Each beat shows one feature. Each beat runs 4 to 5 seconds. Cut or move the camera at each beat.
2. Keep text inside the safe zone. Keep each text block on screen for at least 1.5 seconds. Use TikTok's rate of 5 to 10 words per second as the upper limit [T4].
3. Use only real app footage. Do not film hands on devices [A2].
4. Do not name a price or a date [A2].
5. Make the first frame a good poster frame [A2].
6. For a 15 second cut, drop Feature 3 and shorten the proof beat. For a 25 second cut, add 5 seconds to Feature 1 and Feature 2.

## Sources

All fetched 2026-11-18.

| ID | URL | Note |
|---|---|---|
| M1 | https://www.facebook.com/business/ads-guide/update/video/instagram-reels | Meta Ads Guide, Instagram Reels video ad specs and safe zone |
| M2 | https://www.facebook.com/business/ads-guide/update/video/instagram-feed | Meta Ads Guide, Instagram feed video (Spanish page) |
| M3 | https://www.facebook.com/business/ads-guide/video/facebook-feed and https://www.facebook.com/business/ads-guide/update/video/facebook-feed | Meta Ads Guide, Facebook feed video |
| M4 | https://developers.facebook.com/documentation/video-api/guides/reels-publishing | Meta developer docs, Facebook Reels |
| M5 | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media | Meta developer docs, Instagram Reels specs |
| M6 | https://www.facebook.com/business/ads-guide/update/image/instagram-reels | Meta Ads Guide, Reels image ads, same safe zone |
| M7 | https://www.facebook.com/business/ads/facebook-instagram-reels-ads | Meta Reels ads page (Spanish) |
| I1 | https://help.instagram.com/1038071743007909 | Instagram Help Center. The page did not render. Used snippet only. |
| T1, T2 | https://ads.tiktok.com/help/article/video-ads-specifications and https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads | TikTok Ads Help, in-feed specs and safe zone |
| T3 | https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide | TikTok developer docs |
| T4 | https://ads.tiktok.com/help/article/creative-best-practices | TikTok Ads Help, creative best practices |
| Y1 | https://support.google.com/youtube/answer/1722171 | YouTube recommended upload encoding |
| Y2 | https://support.google.com/youtube/answer/10059070 | YouTube Shorts help |
| G1 | https://support.google.com/google-ads/answer/16041697 | Google Ads Help, YouTube Shorts ads |
| G2 | https://support.google.com/google-ads/answer/17091270 | Google Ads Help, video ad specs |
| G3 | https://support.google.com/google-ads/answer/9128498 | Google Ads Help, square and vertical video |
| G4 | same as G3 | Safe zone section, text has no margins |
| G5 | https://business.google.com/en-all/think/future-of-marketing/youtube-video-ad-creative/ | Think with Google, ABCDs |
| L1 | https://www.linkedin.com/help/lms/answer/85306 | LinkedIn Help, video ad specs |
| L2 | https://business.linkedin.com/advertise/ads/sponsored-content/video-ads/tips | LinkedIn Marketing Solutions, video tips |
| X1 | https://business.x.com/en/help/campaign-setup/creative-ad-specifications | X Business. Returned HTTP 403. Used search snippet only. |
| A1 | https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications | Apple app preview specs |
| A2 | https://developer.apple.com/app-store/app-previews/ | Apple app preview guidance |
| P1 | https://support.google.com/googleplay/android-developer/answer/9866151 | Google Play preview video guidelines |

## Open questions and unverified items

1. **X specs**: maximum duration, file size, codec and frame rate are not confirmed. The X pages returned HTTP 403. The aspect ratio and resolution list is from a search snippet.
2. **TikTok safe zone numbers**: only in downloadable files in Ads Manager. Download them and check the 9:16 master against them.
3. **YouTube Shorts safe zone numbers**: only in a diagram. Read the diagram on the Google Ads Help page.
4. **Instagram Reels organic limits**: the Help Center page did not render. The 3-minute against 20-minute length conflict is open. The 720 px and 30 fps minimums are from a snippet.
5. **Facebook Reels ad spec page**: returned HTTP 404. The Facebook Reels ad safe zone is assumed to match Instagram Reels. A third-party source says Meta merged the 9:16 safe zones in 2026. This is secondary and unverified.
6. **TikTok organic upload page** (resolution, length in app): not read. Only the developer API limits are verified.
7. **YouTube standard**: maximum length and file size were not read from the encoding page.
8. **Frame rate for LinkedIn**: "less than 30 fps" is ambiguous. We choose 29.97 fps. This is opinion.
9. **4:5 and 16:9 safe margins (5%)**: our own choice. No platform publishes them.
10. **Device mockups, zoom, pan and cursor emphasis**: no first-party advice for social ads. Apple and Google Play rules apply to store previews only.
11. **Hook rule "two shots in the first 5 seconds"** (older YouTube ABCD guide): seen in a search snippet only. The current Think with Google page gave no second count.
12. **Meta and LinkedIn performance figures** (34.5% lower cost per result, 300% completion lift): first-party claims. They are not independent.
