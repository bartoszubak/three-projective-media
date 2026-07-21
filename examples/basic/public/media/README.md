# Demo media

The sandbox contains three original screen recordings captured from Zafiro
Isle Lab and one procedurally generated color field.

Zafiro Isle Lab is an original browser-based 3D environment project developed
by Bartek Bąk:

<https://playzafiro.com/isle-lab/>

The three Terrain Study files are screen recordings captured from the
author-developed Zafiro Isle Lab project. Abstract Color Field was generated
procedurally with FFmpeg.

## Terrain Study I–III

The Terrain Study videos are original screen recordings captured and produced
by Bartek Bąk from his author-developed Zafiro Isle Lab project.

Copyright © 2026 Bartek Bąk.

They are included as demonstration media for Projector Space. Source and
encoding provenance is documented below.

All three outputs use H.264 High profile, `yuv420p`, 640 × 360, 30 fps,
fast-start MP4, and no audio. They were encoded on `2026-07-21` UTC with
FFmpeg 8.0. Source and output metadata follow.

### Terrain Study I

- Public filename: `terrain-study-1.mp4`
- Source filename: `terrain_1.mp4`
- Source SHA-256: `b04afdca53166f6b4e937a9cdf117b0554bb2fa1ea22fb6d3de2210725f9c921`
- Source segment: `-ss 0 -t 12`
- Output SHA-256: `be01f0e808d0bedb2732f5b705380d468ac0d0196ed9969da5befaa2014f2497`
- Codec/pixel format: H.264 High / `yuv420p`
- Resolution/frame rate: 640 × 360 / 30 fps
- Duration: 12.000 seconds
- Audio: none
- File size: 1,288,415 bytes

```bash
ffmpeg -hide_banner -y -ss 0 -i terrain_1.mp4 -t 12 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart -an terrain-study-1.mp4
```

### Terrain Study II

- Public filename: `terrain-study-2.mp4`
- Source filename: `terrain_2.mp4`
- Source SHA-256: `c83116e019b5d0fedc43ff834fe2dd12300f6c48019badda83f36d921d2b124d`
- Source segment: `-ss 60 -t 12`
- Output SHA-256: `bbda7bc9796cc5132431795cfa93ca26dd54cd4a41f8048595d459f39c815e4c`
- Codec/pixel format: H.264 High / `yuv420p`
- Resolution/frame rate: 640 × 360 / 30 fps
- Duration: 12.000 seconds
- Audio: none
- File size: 296,661 bytes

```bash
ffmpeg -hide_banner -y -ss 60 -i terrain_2.mp4 -t 12 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart -an terrain-study-2.mp4
```

### Terrain Study III

- Public filename: `terrain-study-3.mp4`
- Source filename: `terrain_3.mp4`
- Source SHA-256: `be8a0f20f327007150dc2049004beb4999fa8e97f680419fe1abde52d6c21a0b`
- Source segment: `-ss 0 -t 12`
- Output SHA-256: `54b2195f502b0739977c6bf1b4b61dc87e2c7918953c63d48eae5f6e9f57d398`
- Codec/pixel format: H.264 High / `yuv420p`
- Resolution/frame rate: 640 × 360 / 30 fps
- Duration: 12.000 seconds
- Audio: none
- File size: 525,575 bytes

```bash
ffmpeg -hide_banner -y -ss 0 -i terrain_3.mp4 -t 12 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart -an terrain-study-3.mp4
```

The commands show the exact encoding arguments and filenames. They are run from
a private source-media working directory, with each output written to this
public media directory; private absolute paths are intentionally not recorded.

## Abstract Color Field

`projector-space-demo.mp4` is an original, procedurally generated color field.
It was created entirely from FFmpeg's built-in `nullsrc` source and `geq`
filter.

- Generated (UTC): `2026-07-21T10:53:02Z`
- FFmpeg: `8.0`
- Video codec: H.264 High profile
- Pixel format: `yuv420p`
- Resolution: 640 × 360
- Frame rate: 30 fps
- Duration: 8.000 seconds
- Audio: none
- File size: 266,699 bytes
- SHA-256: `97020e28651bcd3fe67aafd40541b5fdba8d04f05a4ea933ef7efd50e231b60e`

Exact command, run from the repository root:

```bash
ffmpeg -hide_banner -loglevel error -f lavfi -i "nullsrc=size=640x360:rate=30:duration=8,geq=r='24+78*(sin(2*PI*(X/W+T/8))+1)/2+52*(cos(2*PI*(Y/H-T/8))+1)/2':g='22+75*(sin(2*PI*(Y/H+T/8))+1)/2+48*(sin(2*PI*((X+Y)/(W+H)-T/8))+1)/2':b='38+98*(cos(2*PI*(X/W-Y/H+T/8))+1)/2+44*(sin(2*PI*(X/W+Y/H+T/8))+1)/2',format=yuv420p" -an -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart -y examples/basic/public/media/projector-space-demo.mp4
```

The periodic time terms make the eight-second motion loop-friendly.
