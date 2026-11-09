# Locally generated wallpaper test media

Two seconds, 160 × 90, 12 fps, silent. `wallpaper.mp4` is H.264 baseline / YUV420P with fast-start metadata; `wallpaper.webm` is VP8. These synthetic FFmpeg `testsrc2` patterns contain no third-party photographs, personal data, network resources or audio. The hue changes across the frame so capture/seek tests can distinguish decoded **painted** video from a static background.

Generation (FFmpeg with libx264/libvpx; not a shipped application dependency):

```sh
ffmpeg -f lavfi -i 'testsrc2=size=160x90:rate=12' -vf 'hue=H=2*PI*t' -t 2 -an -c:v libvpx -b:v 70k wallpaper.webm
ffmpeg -f lavfi -i 'testsrc2=size=160x90:rate=12' -vf 'hue=H=2*PI*t' -t 2 -an -c:v libx264 -profile:v baseline -pix_fmt yuv420p -movflags +faststart wallpaper.mp4
```

Tests also truncate the MP4 in a temporary profile to induce a genuine Chromium decoder/container error. That failure must be diagnosed, not described as successful playback. No broken video is shipped as an application wallpaper.
