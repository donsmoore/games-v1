export class SoundManagerClass {
    constructor() {
        this.ctx = null;
        this.masterGain = null;

        // Engine
        this.engineOsc = null;
        this.engineGain = null;
        this.engineLFO = null; // For texture

        // Wind
        this.windNode = null;
        this.windGain = null;

        this.initialized = false;
        this.muted = false;

        // Settings
        this.baseFreq = 100; // Hz
        this.maxFreq = 400;
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            if (this.masterGain) this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            if (this.ctx) this.ctx.suspend();
        } else {
            if (this.ctx) this.ctx.resume();
            if (this.masterGain) this.masterGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.1);
        }
        return this.muted;
    }

    init() {
        if (this.initialized) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5; // Master volume
            this.masterGain.connect(this.ctx.destination);

            this.setupEngineSound();
            this.setupWindSound();

            this.initialized = true;
            console.log("Audio System Initialized");
        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                console.log("Audio Context Resumed");
            });
        }
    }

    setupEngineSound() {
        // Engine sound removed per user request (toremove "woooing" undertone)
        // We keep the structure in case we want a rumble later, but for now it's silent.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sine';
        this.engineOsc.frequency.value = this.baseFreq;

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0; // Silent

        this.engineOsc.start();
    }

    setupWindSound() {
        // White noise buffer
        const bufferSize = 2 * this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.windNode = this.ctx.createBufferSource();
        this.windNode.buffer = buffer;
        this.windNode.loop = true;

        // Dynamic Filter for Wind (Lowpass opens up with speed)
        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = 200; // Start muffled

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        this.windNode.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);

        this.windNode.start();
    }

    update(speed, maxSpeed) {
        if (!this.initialized || this.muted) return;

        const ratio = Math.min(1, Math.max(0, speed / maxSpeed));

        // Engine: Silent (removed "woooing")
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);

        // Wind is the main sensation of speed now

        // Wind Filter: 200Hz (muffled) -> 3000Hz (rushing air)
        const targetCutoff = 200 + (2800 * (ratio * ratio)); // Quadratic curve for drama
        this.windFilter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.1);

        // Wind Volume: 0 -> 0.4 (reduced by 50% from 0.8)
        const windVol = ratio > 0.1 ? (ratio * 0.4) : 0;
        this.windGain.gain.setTargetAtTime(windVol, this.ctx.currentTime, 0.1);
    }

    playLaser() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playExplosion(size = 1.0) {
        if (!this.initialized || this.muted) return;

        // White Noise Burst
        const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds max
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        // Pitch down the filter for larger explosions
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 1.0);

        const gain = this.ctx.createGain();
        // Louder for larger size
        const vol = Math.min(1.0, 0.5 * size);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
        noise.stop(this.ctx.currentTime + 1.2);
    }

    playBombDrop() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 2.0); // Doppler-ish drop

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.0);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 2.0);
    }
}

export const SoundManager = new SoundManagerClass();
