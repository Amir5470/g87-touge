import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // HUD / scoring
  speed: 0,
  score: 0,
  driftPoints: 0,
  multiplier: 1,
  continuousDriftTime: 0,

  // car pose + velocity for camera
  carPose: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
  // visual quaternion from the model (when the visual mesh applies extra yaw)
  carVisualQuaternion: [0, 0, 0, 1],
  lastVel: [0, 0, 0],

  // recovery
  lastSafePoint: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], time: Date.now() },
  staticOverlay: false,

  // called from the Vehicle each frame
  setStats: (speed, isDrifting, delta = 0) => set((state) => {
    let newDriftPoints = state.driftPoints;
    let newMultiplier = state.multiplier;
    let continuous = state.continuousDriftTime || 0;

    if (isDrifting && speed > 5) {
      continuous += delta;
      newDriftPoints += speed * delta * 10; // scaled for visible scoring
      if (continuous >= 2.0) {
        newMultiplier = Math.min(5.0, newMultiplier + 0.5);
        continuous = 0;
      }
    } else {
      if (state.driftPoints > 0) {
        setTimeout(() => {
          set(s => ({ score: s.score + (s.driftPoints * s.multiplier), driftPoints: 0, multiplier: 1 }));
        }, 3000);
      }
      continuous = 0;
    }

    return {
      speed: Math.round(speed * 2.237),
      driftPoints: newDriftPoints,
      multiplier: newMultiplier,
      continuousDriftTime: continuous,
    };
  }),

  // camera helpers
  setCarPose: (position, quaternion) => set({ carPose: { position, quaternion } }),
  setCarVisualQuaternion: (quaternion) => set({ carVisualQuaternion: quaternion }),
  setLastVelocity: (vel) => set({ lastVel: vel }),

  // recovery helpers
  saveSafePoint: (position, quaternion) => set({ lastSafePoint: { position, quaternion, time: Date.now() } }),
  triggerStatic: (on) => set({ staticOverlay: !!on }),
}));
