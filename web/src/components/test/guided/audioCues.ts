import { useCallback, useEffect, useRef } from 'react';

export function useAudioCuePlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => () => {
    void audioContextRef.current?.close();
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = new window.AudioContext();
      audioContextRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const playCue = useCallback(
    async (tones: Array<{ delayMs: number; durationMs: number; frequency: number; gain?: number; type?: OscillatorType }>) => {
      const ctx = await ensureAudioContext();
      if (!ctx) return;
      const base = ctx.currentTime + 0.01;

      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const startAt = base + tone.delayMs / 1000;
        const stopAt = startAt + tone.durationMs / 1000;
        const peakGain = tone.gain ?? 0.05;

        osc.type = tone.type ?? 'sine';
        osc.frequency.setValueAtTime(tone.frequency, startAt);
        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(stopAt + 0.02);
      }
    },
    [ensureAudioContext],
  );

  const playCountdownBeep = useCallback(() => {
    void playCue([{ delayMs: 0, durationMs: 90, frequency: 920, gain: 0.035, type: 'square' }]);
  }, [playCue]);

  const playGoCue = useCallback(() => {
    void playCue([
      { delayMs: 0, durationMs: 100, frequency: 1040, gain: 0.04, type: 'square' },
      { delayMs: 140, durationMs: 170, frequency: 1320, gain: 0.045, type: 'square' },
    ]);
  }, [playCue]);

  const playStopCue = useCallback(() => {
    void playCue([{ delayMs: 0, durationMs: 180, frequency: 440, gain: 0.045, type: 'triangle' }]);
  }, [playCue]);

  return {
    ensureAudioContext,
    playCountdownBeep,
    playGoCue,
    playStopCue,
  };
}
