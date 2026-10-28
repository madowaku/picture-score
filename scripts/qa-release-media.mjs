// Inspect actual encoded streams, never infer codecs from filename or Blob.type.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir, writeFile } from 'node:fs/promises';
const out = 'output/playwright/release';
const names = (await readdir(out)).filter(name => /^(square|portrait|offline)\.(mp4|webm)$/.test(name));
names.push('../sketchbook-fallback.webm');
const reports = [];
for (const name of names) {
  const file = `${out}/${name}`;
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }));
  const video = probe.streams.find(s => s.codec_type === 'video'), audio = probe.streams.find(s => s.codec_type === 'audio');
  assert.ok(video && audio, `${name}: missing video or audio`);
  assert.equal(video.width, 720);
  assert.equal(video.height, name.startsWith('portrait') ? 1280 : 720);
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-f', 'f32le', '-ac', '1', '-ar', '24000', '-'], { maxBuffer: 32 * 1024 * 1024 });
  let peak = 0, sum = 0;
  for (let i = 0; i < pcm.length; i += 4) { const sample = pcm.readFloatLE(i); peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
  const rms = Math.sqrt(sum / (pcm.length / 4)), duration = pcm.length / 4 / 24000;
  assert.ok(peak > .001 && peak < 1 && rms > .0001 && duration > 5 && duration < 30, `${name}: silent/clipped/truncated audio`);
  // Decode ALL frames so a valid header alone cannot make this pass.
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const media = { name, container: probe.format.format_name, video: video.codec_name, audio: audio.codec_name,
    width: video.width, height: video.height, audioSeconds: duration, containerSeconds: probe.format.duration ?? null,
    videoSeconds: video.duration ?? null, audioStart: audio.start_time ?? null, videoStart: video.start_time ?? null,
    peak, rms, h264aac: video.codec_name === 'h264' && audio.codec_name === 'aac' };
  if (video.duration) assert.ok(Math.abs(Number(video.duration) - duration) < 1, `${name}: A/V duration mismatch`);
  if (audio.start_time && video.start_time) assert.ok(Math.abs(Number(audio.start_time) - Number(video.start_time)) < .5, `${name}: A/V start mismatch`);
  if (name.startsWith('square') || name.startsWith('portrait')) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '2', '-i', file, '-frames:v', '1', `${out}/${name}-frame.png`]);
  }
  reports.push(media);
  console.log(JSON.stringify(media));
}
assert.equal(names.filter(name => name.startsWith('square')).length, 1);
assert.equal(names.filter(name => name.startsWith('portrait')).length, 1);
assert.equal(names.filter(name => name.startsWith('offline')).length, 1);
await writeFile(`${out}/media.json`, JSON.stringify({ ffprobe: execFileSync('ffprobe', ['-version'], { encoding: 'utf8' }).split('\n')[0], files: reports }, null, 2));
