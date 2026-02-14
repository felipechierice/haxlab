interface SynthNote {
  frequency: number;
  startTime: number;
  duration: number;
  volume?: number;
}

interface SynthConfig {
  type: OscillatorType;
  notes?: SynthNote[];
  frequency?: number;
  frequencyEnd?: number;
  duration: number;
  volume: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

const defaultSounds: Record<string, SynthConfig> = {
  kick: {
    type: 'sine',
    frequency: 150,
    frequencyEnd: 40,
    duration: 0.15,
    volume: 0.4,
    attack: 0.001,
    release: 0.1
  },
  goal: {
    type: 'square',
    notes: [
      { frequency: 523, startTime: 0, duration: 0.15, volume: 0.3 },    // C5
      { frequency: 659, startTime: 0.08, duration: 0.15, volume: 0.3 }, // E5
      { frequency: 784, startTime: 0.16, duration: 0.25, volume: 0.35 } // G5
    ],
    duration: 0.5,
    volume: 0.3,
    attack: 0.01,
    release: 0.15
  },
  success: {
    type: 'triangle',
    notes: [
      { frequency: 523, startTime: 0, duration: 0.1, volume: 0.25 },   // C5
      { frequency: 659, startTime: 0.06, duration: 0.1, volume: 0.25 }, // E5
      { frequency: 784, startTime: 0.12, duration: 0.15, volume: 0.3 }  // G5
    ],
    duration: 0.3,
    volume: 0.25,
    attack: 0.01,
    release: 0.08
  },
  fail: {
    type: 'sawtooth',
    frequency: 220,
    frequencyEnd: 110,
    duration: 0.25,
    volume: 0.25,
    attack: 0.01,
    release: 0.15
  }
};

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, SynthConfig> = new Map();
  private enabled: boolean = true;
  private masterVolume: number = 0.7;

  constructor() {
    this.loadSounds(defaultSounds);
  }

  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  loadSounds(soundConfigs: Record<string, SynthConfig>): void {
    Object.entries(soundConfigs).forEach(([name, config]) => {
      this.sounds.set(name, config);
    });
  }

  private synthesize(config: SynthConfig): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const attack = config.attack || 0.01;
    const release = config.release || 0.1;
    const volume = config.volume * this.masterVolume;

    if (config.notes && config.notes.length > 0) {
      // Som com múltiplas notas
      config.notes.forEach(note => {
        const osc = this.audioContext!.createOscillator();
        const gain = this.audioContext!.createGain();
        
        osc.type = config.type;
        osc.frequency.setValueAtTime(note.frequency, now + note.startTime);
        
        osc.connect(gain);
        gain.connect(this.audioContext!.destination);
        
        const noteVolume = (note.volume || 1) * volume;
        gain.gain.setValueAtTime(0, now + note.startTime);
        gain.gain.linearRampToValueAtTime(noteVolume, now + note.startTime + attack);
        gain.gain.setValueAtTime(noteVolume, now + note.startTime + note.duration - release);
        gain.gain.linearRampToValueAtTime(0.001, now + note.startTime + note.duration);
        
        osc.start(now + note.startTime);
        osc.stop(now + note.startTime + note.duration);
      });
    } else {
      // Som simples com sweep de frequência
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = config.type;
      osc.frequency.setValueAtTime(config.frequency!, now);
      
      if (config.frequencyEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, config.frequencyEnd),
          now + config.duration
        );
      }
      
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.setValueAtTime(volume, now + config.duration - release);
      gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
      
      osc.start(now);
      osc.stop(now + config.duration);
    }
  }

  play(soundName: string): void {
    if (!this.enabled) return;
    
    this.initAudioContext();
    
    const config = this.sounds.get(soundName);
    if (config && this.audioContext) {
      // Resume audio context se necessário (browser policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      this.synthesize(config);
    }
  }

  /**
   * Pré-inicializa o AudioContext para evitar stutter no primeiro som.
   * Deve ser chamado durante uma interação do usuário (click/keypress).
   */
  warmUp(): void {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  toggleMute(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Permite customizar sons em runtime
  updateSound(name: string, config: SynthConfig): void {
    this.sounds.set(name, config);
  }

  // Carrega configurações de sons de um JSON
  loadSoundsFromJSON(json: string): void {
    try {
      const configs = JSON.parse(json);
      this.loadSounds(configs);
    } catch (e) {
      console.error('Failed to parse sound config JSON:', e);
    }
  }
}

// Instância singleton
export const audioManager = new AudioManager();
