import React, { useEffect, useState } from 'react';
import { useStore } from './store';

export function DebugOverlay() {
  const lastVel = useStore((s) => s.lastVel);
  const carPose = useStore((s) => s.carPose);
  const [keys, setKeys] = useState(window.__g87_keys || {});
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    let frames = 0;
    const loop = (t) => {
      frames++;
      if (t - last >= 1000) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      setKeys(window.__g87_keys || {});
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const speedMph = lastVel ? (Math.hypot(lastVel[0] || 0, lastVel[1] || 0, lastVel[2] || 0) * 2.237).toFixed(1) : '0.0';
  const posText = carPose && carPose.position ? carPose.position.map((v) => v.toFixed(1)).join(',') : 'n/a';
  const angVel = (typeof window !== 'undefined' && window.__g87_angvel) ? window.__g87_angvel.toFixed(2) : '0.00';

  return (
    <div style={{ position: 'absolute', left: 8, top: 8, color: '#ff66b2', fontFamily: 'monospace', fontSize: 12, zIndex: 9999, pointerEvents: 'none', background: 'rgba(0,0,0,0.25)', padding: 8, borderRadius: 6 }}>
      <div>FPS: {fps}</div>
      <div>Keys: W:{keys.forward ? 1 : 0} S:{keys.backward ? 1 : 0} A:{keys.left ? 1 : 0} D:{keys.right ? 1 : 0}</div>
      <div>Speed: {speedMph} MPH</div>
      <div>Pos: {posText}</div>
      <div>AngVel Y: {angVel}</div>
    </div>
  );
}
