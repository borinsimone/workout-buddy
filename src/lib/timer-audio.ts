let context: AudioContext | undefined;
type Cue = "alarm" | "start";
const players: Partial<Record<Cue, HTMLAudioElement>> = {};
const priming: Partial<Record<Cue, Promise<void>>> = {};
function primeMedia(cue: Cue) {
  if (typeof Audio === "undefined" || priming[cue]) return;
  try {
    const player = players[cue] ??= new Audio(`./sounds/timer-${cue}.wav`);
    player.preload = "auto";
    player.volume = 0.0001;
    priming[cue] = player.play().then(() => {
      player.pause();
      player.currentTime = 0;
    }).catch(() => { delete priming[cue]; });
  } catch { /* The synthesizer remains available as a fallback. */ }
}
export async function unlockTimerAudio() {
  primeMedia("alarm");
  primeMedia("start");
  try {
    if (!context || context.state === "closed") context = new AudioContext();
    if (context.state !== "running") await context.resume();
  } catch {
    /* Audio may be unavailable on this browser. */
  }
}
async function playCue(volume: number, cue: Cue) {
  const level = Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) / 100 : 0.8;
  if (level === 0) return false;
  const player = players[cue];
  if (player) {
    try {
      await priming[cue];
      for (const other of Object.values(players)) other.pause();
      player.currentTime = 0;
      player.volume = level;
      await player.play();
      return true;
    } catch { /* Fall back to Web Audio when media playback is blocked. */ }
  }
  if (!context) return false;
  if (context.state !== "running") await unlockTimerAudio();
  if (context.state !== "running") return false;
  const start = context.currentTime;
  Array.from({ length: cue === "start" ? 1 : 9 }, (_, index) => cue === "start" ? 1320 : [880, 1100, 1320][index % 3]).forEach((frequency, index) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    const at = start + Math.floor(index / 3) * 1.65 + (index % 3) * 0.4;
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.8 * level, at + 0.015);
    gain.gain.setValueAtTime(0.8 * level, at + 0.24);
    gain.gain.linearRampToValueAtTime(0, at + 0.3);
    oscillator.connect(gain);
    gain.connect(context!.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.32);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });
  return true;
}
export const playTimerAlarm = (volume = 80) => playCue(volume, "alarm");
export const playPreparationBeep = (volume = 80) => playCue(volume, "start");
