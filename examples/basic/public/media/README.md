# Procedural demo media

`projector-space-demo.mp4` is an original, procedurally generated color field.
It was created entirely from FFmpeg's built-in `nullsrc` source and `geq`
filter. It uses no third-party footage, images, music, logos, or trademarks.

## Generation

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

The periodic time terms make the eight-second motion loop-friendly. The asset
is part of this repository and is provided under the same MIT License as the
project.
