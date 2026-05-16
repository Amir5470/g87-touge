import * as THREE from 'three';

function makeCanvas(size = 1024) {
  const c = globalThis.document ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = size;
  c.height = size;
  return c;
}

export function createCarPaintTexture(color = '#0b62ff', size = 1024, flakes = 8000) {
  const canvas = makeCanvas(size);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  // base glossy gradient
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#111111');
  g.addColorStop(0.08, color);
  g.addColorStop(0.5, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // subtle metallic flakes
  for (let i = 0; i < flakes; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.25;
    const alpha = Math.random() * 0.45 + 0.05;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // slight glossy highlight band
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(size * 0.25, size * 0.15, size * 0.5, size * 0.35);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  return tex;
}

export function createAsphaltTexture(size = 1024) {
  const canvas = makeCanvas(size);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  // base gray
  ctx.fillStyle = '#111114';
  ctx.fillRect(0, 0, size, size);

  // noise grain
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 60 + (Math.random() * 60 | 0);
    img.data[i] = v; // r
    img.data[i + 1] = v; // g
    img.data[i + 2] = v; // b
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // darker patches
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.03 + Math.random() * 0.05;
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.02 + Math.random() * 0.08);
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 24);
  tex.anisotropy = 4;
  tex.encoding = THREE.LinearEncoding;
  return tex;
}
