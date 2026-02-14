"use client";

let uiAudioContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;
  if (!uiAudioContext) uiAudioContext = new AudioContextClass();

  return uiAudioContext;
}

export function playGoogleButtonClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  void (async () => {
    try {
      if (ctx.state !== "running") {
        await ctx.resume();
      }

      const now = ctx.currentTime + 0.01;
      const totalDuration = 6.0;
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.15, now + 0.5);
      masterGain.gain.exponentialRampToValueAtTime(0.1, now + 2.8);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

      // Layer 1: airy cinematic whoosh sweep (no bass)
      if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 6.2), ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * 0.2;
        }
      }
      const whoosh = ctx.createBufferSource();
      whoosh.buffer = noiseBuffer;
      const whooshFilter = ctx.createBiquadFilter();
      whooshFilter.type = "bandpass";
      whooshFilter.Q.value = 0.9;
      whooshFilter.frequency.setValueAtTime(1300, now);
      whooshFilter.frequency.exponentialRampToValueAtTime(4200, now + 2.8);
      whooshFilter.frequency.exponentialRampToValueAtTime(2000, now + 6.0);
      const whooshHighPass = ctx.createBiquadFilter();
      whooshHighPass.type = "highpass";
      whooshHighPass.frequency.setValueAtTime(520, now);
      const whooshGain = ctx.createGain();
      whooshGain.gain.setValueAtTime(0.0001, now);
      whooshGain.gain.exponentialRampToValueAtTime(0.075, now + 0.8);
      whooshGain.gain.exponentialRampToValueAtTime(0.04, now + 3.5);
      whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.0);
      whoosh.connect(whooshFilter);
      whooshFilter.connect(whooshHighPass);
      whooshHighPass.connect(whooshGain);
      whooshGain.connect(masterGain);
      whoosh.start(now);
      whoosh.stop(now + 6.0);

      // Layer 2: glass pad (D + A), high and smooth
      const padNotes = [587.33, 880.0]; // D5 + A5
      padNotes.forEach((frequency) => {
        const pad = ctx.createOscillator();
        const padGain = ctx.createGain();
        padGain.connect(masterGain);
        padGain.gain.setValueAtTime(0.0001, now);
        padGain.gain.exponentialRampToValueAtTime(0.1, now + 1.1);
        padGain.gain.exponentialRampToValueAtTime(0.065, now + 3.6);
        padGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.0);
        pad.type = "sine";
        pad.frequency.setValueAtTime(frequency, now);
        pad.frequency.linearRampToValueAtTime(frequency * 1.015, now + 6.0);
        pad.connect(padGain);
        pad.start(now);
        pad.stop(now + 6.0);
      });

      // Layer 3: D-M-S-L orchestral phrase (D-F#-A-B)
      const noteEvents = [
        { t: 0.55, f: 587.33 }, // D5
        { t: 1.05, f: 739.99 }, // F#5
        { t: 1.55, f: 880.0 }, // A5
        { t: 2.05, f: 987.77 }, // B5 (La)
      ];
      noteEvents.forEach(({ t, f }) => {
        const noteStart = now + t;
        const noteStop = noteStart + 1.75;

        const sectionFilter = ctx.createBiquadFilter();
        sectionFilter.type = "lowpass";
        sectionFilter.frequency.setValueAtTime(2400, noteStart);
        sectionFilter.Q.value = 0.6;
        sectionFilter.connect(masterGain);

        const sectionGain = ctx.createGain();
        sectionGain.gain.setValueAtTime(0.0001, noteStart);
        sectionGain.gain.exponentialRampToValueAtTime(0.1, noteStart + 0.2);
        sectionGain.gain.exponentialRampToValueAtTime(0.0001, noteStop);
        sectionGain.connect(sectionFilter);

        // Strings body
        const strings = ctx.createOscillator();
        strings.type = "triangle";
        strings.frequency.setValueAtTime(f, noteStart);
        strings.frequency.linearRampToValueAtTime(f * 1.004, noteStop);
        strings.connect(sectionGain);
        strings.start(noteStart);
        strings.stop(noteStop + 0.01);

        // Brass sheen (one octave up)
        const brass = ctx.createOscillator();
        const brassGain = ctx.createGain();
        brassGain.gain.setValueAtTime(0.38, noteStart);
        brassGain.connect(sectionGain);
        brass.type = "sawtooth";
        brass.frequency.setValueAtTime(f * 2, noteStart);
        brass.frequency.linearRampToValueAtTime(f * 2.01, noteStop);
        brass.connect(brassGain);
        brass.start(noteStart + 0.01);
        brass.stop(noteStop);

        // Slight detune layer for orchestral width
        const width = ctx.createOscillator();
        const widthGain = ctx.createGain();
        widthGain.gain.setValueAtTime(0.28, noteStart);
        widthGain.connect(sectionGain);
        width.type = "triangle";
        width.detune.setValueAtTime(8, noteStart);
        width.frequency.setValueAtTime(f, noteStart);
        width.connect(widthGain);
        width.start(noteStart + 0.015);
        width.stop(noteStop);
      });
    } catch {
      // Non-blocking: skip audio if browser/audio context fails.
    }
  })();
}
