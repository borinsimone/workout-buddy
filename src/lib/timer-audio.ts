let context: AudioContext | undefined;
export async function unlockTimerAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
  } catch {
    /* Audio may be unavailable on this browser. */
  }
}
export function playTimerAlarm(volume = 80) {
  if (!context || context.state !== "running") return;
  const level = Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) / 100 : 0.8;
  if (level === 0) return;
  const start = context.currentTime;
  [660, 880, 1100].forEach((frequency, index) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    const at = start + index * 0.24;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.8 * level, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    oscillator.connect(gain);
    gain.connect(context!.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.2);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });
}
