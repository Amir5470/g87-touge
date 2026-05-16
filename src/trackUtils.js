import * as THREE from 'three';

let curve = null;
let samples = [];
let cumulativeLengths = [];
let totalLength = 0;

export function setCurve(curveIn, sampleCount = 512) {
  curve = curveIn;
  samples = curve.getPoints(sampleCount);
  cumulativeLengths = [0];
  for (let i = 1; i < samples.length; i++) {
    cumulativeLengths[i] = cumulativeLengths[i - 1] + samples[i].distanceTo(samples[i - 1]);
  }
  totalLength = cumulativeLengths[cumulativeLengths.length - 1] || 1;
}

export function getProgressAtPosition(pos) {
  if (!curve || samples.length === 0) return 0;
  const p = pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(pos[0], pos[1], pos[2]);
  let minDist = Infinity;
  let minIndex = 0;
  for (let i = 0; i < samples.length; i++) {
    const d = samples[i].distanceTo(p);
    if (d < minDist) {
      minDist = d;
      minIndex = i;
    }
  }
  const progress = cumulativeLengths[minIndex] / totalLength;
  return Math.max(0, Math.min(1, progress));
}

export function getPointAt(progress) {
  if (!curve) return new THREE.Vector3(0, 0, 0);
  return curve.getPointAt(Math.max(0, Math.min(1, progress)));
}

export function getTangentAt(progress) {
  if (!curve) return new THREE.Vector3(0, 0, 1);
  return curve.getTangentAt(Math.max(0, Math.min(1, progress)));
}

export function getCurve() {
  return curve;
}
