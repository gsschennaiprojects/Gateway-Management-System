'use client';

import { useCallback, useRef } from 'react';

/**
 * Generates a professional notification chime using the Web Audio API.
 * No external audio file dependency — produces a clean, two-tone bell sound.
 */
export function useNotificationSound() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Create a two-tone bell chime (C6 → E6)
      const frequencies = [1047, 1319]; // C6 and E6

      frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);

        // ADSR envelope for each tone
        const startTime = now + i * 0.12;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02); // Attack
        gainNode.gain.exponentialRampToValueAtTime(0.08, startTime + 0.08); // Decay
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4); // Release

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.45);
      });
    } catch {
      // Silently fail if Web Audio API is not available
    }
  }, [getAudioContext]);

  const playSuccessSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Ascending three-tone (C5 → E5 → G5)
      const frequencies = [523, 659, 784];

      frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);

        const startTime = now + i * 0.1;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.4);
      });
    } catch {
      // Silently fail
    }
  }, [getAudioContext]);

  const playErrorSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Descending two-tone (E5 → C5)
      const frequencies = [659, 523];

      frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, now);

        const startTime = now + i * 0.15;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.35);
      });
    } catch {
      // Silently fail
    }
  }, [getAudioContext]);

  return {
    playNotificationSound,
    playSuccessSound,
    playErrorSound,
  };
}
