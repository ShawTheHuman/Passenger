/**
 * Procedural Audio Service using Web Audio API
 * Generates engine drone, road noise, and SFX without external files.
 */
class AudioService {
    private ctx: AudioContext | null = null;
    private engineOsc1: OscillatorNode | null = null;
    private engineOsc2: OscillatorNode | null = null;
    private engineGain: GainNode | null = null;
    private roadNoiseNode: AudioBufferSourceNode | null = null;
    private roadGain: GainNode | null = null;
    private masterGain: GainNode | null = null;
  
    constructor() {}
  
    init() {
      if (this.ctx) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {
        console.error("Web Audio API not supported", e);
      }
    }
  
    async startAmbience() {
      if (!this.ctx) this.init();
      if (!this.ctx || !this.masterGain) return;

      try {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    
        // Stop existing before starting new to prevent overlap/leak
        this.stopAll();
  
        this.startEngine();
        this.startRoadNoise();
      } catch (e) {
          console.error("Failed to start ambience", e);
      }
    }
  
    private startEngine() {
      if (!this.ctx || !this.masterGain) return;
      
      try {
        // Dual oscillator for a "phasing" engine hum
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
    
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc2.type = 'triangle';
    
        // Base frequency (Low idle)
        this.engineOsc1.frequency.value = 60;
        this.engineOsc2.frequency.value = 62; // Slight detune for texture
    
        // Filter to muffle the harsh sawtooth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
    
        this.engineOsc1.connect(filter);
        this.engineOsc2.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);
    
        // Use setTargetAtTime for safer, smoother transitions than ramp
        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.engineGain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.5);
    
        this.engineOsc1.start();
        this.engineOsc2.start();
      } catch (e) {
        console.warn("Failed to start engine audio", e);
      }
    }
  
    private startRoadNoise() {
      if (!this.ctx || !this.masterGain) return;
  
      try {
        // Create white noise buffer
        const bufferSize = 2 * this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
    
        this.roadNoiseNode = this.ctx.createBufferSource();
        this.roadNoiseNode.buffer = buffer;
        this.roadNoiseNode.loop = true;
    
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600; // Muffled road sound
        
        this.roadGain = this.ctx.createGain();
        this.roadGain.gain.value = 0.05;
    
        this.roadNoiseNode.connect(filter);
        filter.connect(this.roadGain);
        this.roadGain.connect(this.masterGain);
    
        this.roadNoiseNode.start();
      } catch (e) {
        console.warn("Failed to start road noise", e);
      }
    }
  
    /**
     * Modulate engine pitch based on suspicion/speed/tension
     */
    updateEngine(tension: number) {
      if (!this.ctx || !this.engineOsc1 || !this.engineOsc2) return;
      
      // Safety check: ensure tension is a finite number
      if (!Number.isFinite(tension)) return;

      try {
        // 0 to 1 tension
        const baseFreq = 60 + (Math.max(0, tension) * 40); // 60Hz to 100Hz
        
        // Safety check: Frequency must be positive
        if (baseFreq <= 0 || !Number.isFinite(baseFreq)) return;

        const time = this.ctx.currentTime;
        // Use linearRampToValueAtTime instead of exponential to avoid crash if value hits 0 or negative somehow
        this.engineOsc1.frequency.linearRampToValueAtTime(baseFreq, time + 0.5);
        this.engineOsc2.frequency.linearRampToValueAtTime(baseFreq + 2, time + 0.5);
      } catch (e) {
        console.warn("Audio engine update failed", e);
      }
    }
  
    stopAll() {
      try {
        if (this.engineOsc1) {
             try { this.engineOsc1.stop(); } catch(e) {}
             this.engineOsc1.disconnect();
             this.engineOsc1 = null;
        }
        if (this.engineOsc2) {
             try { this.engineOsc2.stop(); } catch(e) {}
             this.engineOsc2.disconnect();
             this.engineOsc2 = null;
        }
        if (this.roadNoiseNode) {
             try { this.roadNoiseNode.stop(); } catch(e) {}
             this.roadNoiseNode.disconnect();
             this.roadNoiseNode = null;
        }
      } catch (e) {
        console.warn("Error stopping audio", e);
      }
    }
  
    playCue(cueName: string) {
      if (!this.ctx || !this.masterGain) return;
  
      const t = this.ctx.currentTime;
      
      try {
        switch (cueName) {
            case 'heartbeat':
            // Low thump
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(50, t);
            osc.frequency.linearRampToValueAtTime(1, t + 0.1); // Changed to linear
            gain.gain.setValueAtTime(1, t);
            gain.gain.setTargetAtTime(0, t, 0.05); // Use setTarget for decay
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.2);
            
            // Second thump
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.frequency.setValueAtTime(50, t + 0.2);
            osc2.frequency.linearRampToValueAtTime(1, t + 0.3); // Changed to linear
            gain2.gain.setValueAtTime(1, t + 0.2);
            gain2.gain.setTargetAtTime(0, t + 0.2, 0.05);
            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(t + 0.2);
            osc2.stop(t + 0.4);
            break;
    
            case 'engine_rev':
            if (this.engineOsc1 && this.engineOsc2) {
                this.engineOsc1.frequency.linearRampToValueAtTime(150, t + 0.5);
                this.engineOsc2.frequency.linearRampToValueAtTime(155, t + 0.5);
                this.engineOsc1.frequency.linearRampToValueAtTime(60, t + 2.0);
                this.engineOsc2.frequency.linearRampToValueAtTime(62, t + 2.0);
            }
            break;
    
            case 'radio_static':
            const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const noise = this.ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.2, t);
            noiseGain.gain.setTargetAtTime(0, t, 0.1);
            noise.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noise.start(t);
            break;
            
            case 'siren':
            const sirenOsc = this.ctx.createOscillator();
            const sirenGain = this.ctx.createGain();
            sirenOsc.type = 'triangle';
            sirenOsc.frequency.setValueAtTime(600, t);
            sirenOsc.frequency.linearRampToValueAtTime(1200, t + 1);
            sirenOsc.frequency.linearRampToValueAtTime(600, t + 2);
            sirenGain.gain.value = 0.1;
            sirenGain.gain.linearRampToValueAtTime(0, t + 3);
            sirenOsc.connect(sirenGain);
            sirenGain.connect(this.masterGain);
            sirenOsc.start(t);
            sirenOsc.stop(t+3);
            break;
        }
      } catch (e) {
          console.warn("Error playing cue", cueName, e);
      }
    }
  }
  
  export const audioService = new AudioService();