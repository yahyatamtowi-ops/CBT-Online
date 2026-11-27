/**
 * Plays a short two-tone warning chime via Web Audio API when an exam violation occurs.
 * Safe no-op in environments without AudioContext or before user gesture.
 */
export function playViolationAlarm(severity: 'warning' | 'critical' = 'warning'): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, gainPeak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = severity === 'critical' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (severity === 'critical') {
      playTone(880, 0, 0.18, 0.22);
      playTone(620, 0.2, 0.22, 0.22);
      playTone(880, 0.44, 0.26, 0.24);
    } else {
      playTone(760, 0, 0.14, 0.18);
      playTone(540, 0.16, 0.18, 0.16);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Gracefully ignore audio restrictions
  }
}
