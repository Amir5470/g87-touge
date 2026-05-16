import { useEffect, useRef } from 'react';
import { useStore } from './store';

export function HUD() {
  const speedRef = useRef(null);
  const scoreRef = useRef(null);
  const chainRef = useRef(null);

  useEffect(() => {
    // initialize
    if (speedRef.current) speedRef.current.textContent = '0 MPH';
    if (scoreRef.current) scoreRef.current.textContent = 'SCORE: 0';

    const unsubSpeed = useStore.subscribe((s) => s.speed, (speed) => {
      if (speedRef.current) speedRef.current.textContent = `${speed} MPH`;
    });

    const unsubScore = useStore.subscribe((s) => s.score, (score) => {
      if (scoreRef.current) scoreRef.current.textContent = `SCORE: ${Math.floor(score)}`;
    });

    const unsubDrift = useStore.subscribe((s) => s.driftPoints, (dp) => {
      const multi = useStore.getState().multiplier;
      if (chainRef.current) {
        if (dp > 0) {
          chainRef.current.style.display = 'block';
          chainRef.current.textContent = `${Math.floor(dp)} x ${multi.toFixed(1)}`;
        } else {
          chainRef.current.style.display = 'none';
        }
      }
    });

    const unsubMulti = useStore.subscribe((s) => s.multiplier, (m) => {
      if (chainRef.current && useStore.getState().driftPoints > 0) {
        chainRef.current.textContent = `${Math.floor(useStore.getState().driftPoints)} x ${m.toFixed(1)}`;
      }
    });

    return () => {
      unsubSpeed();
      unsubScore();
      unsubDrift();
      unsubMulti();
    };
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', color: '#ff0055', fontFamily: 'monospace' }}>
      <div ref={speedRef} style={{ position: 'absolute', bottom: 40, left: 40, fontSize: '3rem' }}>0 MPH</div>
      <div style={{ position: 'absolute', top: 40, width: '100%', textAlign: 'center' }}>
        <div ref={scoreRef} style={{ fontSize: '1.5rem' }}>SCORE: 0</div>
        <div ref={chainRef} style={{ fontSize: '2rem', color: '#fff', display: 'none' }} />
      </div>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>REC ● 12:00:01 AM</div>
    </div>
  );
}
