import { useStore } from './store';
export function HUD() {
  const { speed, score, driftPoints, multiplier } = useStore();
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', color: '#ff0055', fontFamily: 'monospace' }}>
      <div style={{ position: 'absolute', bottom: 40, left: 40, fontSize: '3rem' }}>{speed} MPH</div>
      <div style={{ position: 'absolute', top: 40, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem' }}>SCORE: {Math.floor(score)}</div>
        {driftPoints > 0 && <div style={{ fontSize: '2rem', color: '#fff' }}>{Math.floor(driftPoints)} x {multiplier.toFixed(1)}</div>}
      </div>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>REC ● 12:00:01 AM</div>
    </div>
  );
}
