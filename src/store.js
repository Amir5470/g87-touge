import { create } from 'zustand';
export const useStore = create((set) => ({
  speed: 0, score: 0, driftPoints: 0, multiplier: 1,
  setStats: (speed, isDrifting) => set((state) => {
    let newDriftPoints = state.driftPoints;
    let newMultiplier = state.multiplier;
    if (isDrifting && speed > 5) {
      newDriftPoints += speed * 0.1;
      newMultiplier = Math.min(5, state.multiplier + 0.001);
    } else if (state.driftPoints > 0) {
      setTimeout(() => {
        set(s => ({ score: s.score + (s.driftPoints * s.multiplier), driftPoints: 0, multiplier: 1 }));
      }, 1000);
    }
    return { speed: Math.round(speed * 2.237), driftPoints: newDriftPoints, multiplier: newMultiplier };
  }),
}));
