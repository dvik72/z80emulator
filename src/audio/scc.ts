//////////////////////////////////////////////////////////////////////////////
//
// This program is free software; you can redistribute it and / or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
//
//////////////////////////////////////////////////////////////////////////////

import { AudioDevice } from '../core/audiomanager';
import { Board } from '../core/board';
import { SaveState } from '../core/savestate';

const ROTATE_OFF = 32;
const ROTATE_ON = 28;

export enum SccMode { NONE, REAL, COMPATIBLE, PLUS };

export class Scc extends AudioDevice {
  constructor(
    private board: Board,
    private mode: SccMode
  ) {
    super('SCC', false);

    this.board.getAudioManager().registerAudioDevice(this);
    this.basePhaseStep = (1 << 28) * 3579545 / 32 / (this.sampleRate * 4) | 0;

    this.reset();
  }

  public setMode(mode: SccMode): void {
    this.mode = mode;
  }

  public reset(): void {
    if (this.mode != SccMode.REAL) {
      this.setMode(SccMode.COMPATIBLE);
    }

    for (let channel = 0; channel < 5; channel++) {
      this.curWave[channel] = 0;
      this.period[channel] = 0;
      this.phase[channel] = 0;
      this.phaseStep[channel] = 0;
      this.volume[channel] = 0;
      this.nextVolume[channel] = 0;
      this.rotate[channel] = ROTATE_OFF;
      this.readOnly[channel] = false;
      this.oldSample[channel] = 0;
      this.deformSample[channel] = 0;
      for (let i = 0; i < 32; i++) {
        this.wave[channel][i] = 0;
      }
    }

    for (let i = 0; i < 95; i++) {
      this.in[i] = 0;
    }

    this.deformReg = 0;
    this.enable = 0xff;
  }

  public read(address: number): number {
    switch (this.mode) {

      case SccMode.REAL:
        if (address < 0x80) {
          return this.getWave(address >> 5, address);
        }

        if (address < 0xa0) {
          return this.getFreqAndVol(address);
        }

        if (address < 0xe0) {
          return 0xff;
        }

        this.updateDeformation(0xff);

        return 0xff;

      case SccMode.COMPATIBLE:
        if (address < 0x80) {
          return this.getWave(address >> 5, address);
        }

        if (address < 0xa0) {
          return this.getFreqAndVol(address);
        }

        if (address < 0xc0) {
          return this.getWave(4, address);
        }

        if (address < 0xe0) {
          this.updateDeformation(0xff);
          return 0xff;
        }

        return 0xff;

      case SccMode.PLUS:
        if (address < 0xa0) {
          return this.getWave(address >> 5, address);
        }

        if (address < 0xc0) {
          return this.getFreqAndVol(address);
        }

        if (address < 0xe0) {
          this.updateDeformation(0xff);
          return 0xff;
        }

        return 0xff;
    }

    return 0xff;
  }

  public write(address: number, value: number): void {
    this.board.syncAudio();

    switch (this.mode) {
      case SccMode.REAL:
        if (address < 0x80) {
          this.updateWave(address >> 5, address, value);
          return;
        }

        if (address < 0xa0) {
          this.updateFreqAndVol(address, value);
          return;
        }

        if (address < 0xe0) {
          return;
        }

        this.updateDeformation(value);
        return;

      case SccMode.COMPATIBLE:
        if (address < 0x80) {
          this.updateWave(address >> 5, address, value);
          return;
        }

        if (address < 0xa0) {
          this.updateFreqAndVol(address, value);
          return;
        }

        if (address < 0xc0) {
          return;
        }

        if (address < 0xe0) {
          this.updateDeformation(value);
          return;
        }

        return;

      case SccMode.PLUS:
        if (address < 0xa0) {
          this.updateWave(address >> 5, address, value);
          return;
        }

        if (address < 0xc0) {
          this.updateFreqAndVol(address, value);
          return;
        }

        if (address < 0xe0) {
          this.updateDeformation(value);
          return;
        }

        return;
    }
  }

  public sync(count: number): void {
    const audioBuffer = this.getAudioBufferMono();

    for (let index = 0; index < count; index++) {
      let masterVolume = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        for (let channel = 0; channel < 5; channel++) {
          this.phase[channel] = this.phase[channel] + this.phaseStep[channel] & 0xfffffff;
          const sample = this.phase[channel] >> 23;

          if (sample != this.oldSample[channel]) {
            this.volume[channel] = this.nextVolume[channel];
            let v = this.wave[channel][sample];
            if (v > 127) v -= 256;
            this.curWave[channel] = v
            this.oldSample[channel] = sample;
          }

          const refVolume = ((this.enable >> channel) & 1) * this.volume[channel];
          masterVolume[i] += this.curWave[channel] * refVolume;
        }
      }
      audioBuffer[index] = this.filter4(masterVolume[0], masterVolume[1], masterVolume[2], masterVolume[3]) / 8000;
    }
  }

  private getWave(channel: number, address: number): number {
    if (this.rotate[channel] == ROTATE_OFF) {
      const value = this.wave[channel][address & 0x1f];
      return value;
    }
    else {
      let periodCh = channel;

      this.board.syncAudio();

      if ((this.deformReg & 0xc0) == 0x80) {
        if (channel == 4) {
          periodCh = 3;
        }
      }
      else if (channel == 3 && this.mode != SccMode.PLUS) {
        periodCh = 4;
      }

      const shift = this.oldSample[periodCh] - this.deformSample[periodCh];
      const value = this.wave[channel][(address + shift) & 0x1f];
      return value;
    }
  }

  private getFreqAndVol(address: number): number {
    address &= 0x0f;

    if (address < 0x0a) {
      // get period
      const channel = address >> 1;
      if (address & 1) {
        return (this.period[channel] >> 8) & 0xff;
      } else {
        return this.period[channel] & 0xff;
      }
    } else if (address < 0x0f) {
      // get volume
      return this.nextVolume[address - 0x0a];
    } else {
      // get enable-bits
      return this.enable;
    }
  }

  private updateWave(channel: number, address: number, value: number) {
    if (!this.readOnly[channel]) {
      const pos = address & 0x1f;

      this.wave[channel][pos] = value;
      if ((this.mode != SccMode.PLUS) && (channel == 3)) {
        this.wave[4][pos] = this.wave[3][pos];
      }
    }
  }

  private updateFreqAndVol(address: number, value: number): void {
    address &= 0x0f;
    if (address < 0x0a) {
      const channel = address >> 1;

      this.board.syncAudio();

      if (address & 1) {
        this.period[channel] = ((value & 0xf) << 8) | (this.period[channel] & 0xff);
      }
      else {
        this.period[channel] = (this.period[channel] & 0xf00) | (value & 0xff);
      }
      if (this.deformReg & 0x20) {
        this.phase[channel] = 0;
      }
      let period = this.period[channel];

      if (this.deformReg & 2) {
        period &= 0xff;
      }
      else if (this.deformReg & 1) {
        period >>= 8;
      }

      this.phaseStep[channel] = period > 0 ? this.basePhaseStep / (1 + period) | 0 : 0;

      this.volume[channel] = this.nextVolume[channel];
      this.phase[channel] &= 0x1f << 23;
      this.oldSample[channel] = 0xff;
    }
    else if (address < 0x0f) {
      this.nextVolume[address - 0x0a] = value & 0x0f;
    }
    else {
      this.enable = value;
    }
  }

  private updateDeformation(value: number) {
    if (value == this.deformReg) {
      return;
    }

    this.board.syncAudio();

    this.deformReg = value;

    for (let channel = 0; channel < 5; channel++) {
      this.deformSample[channel] = this.oldSample[channel];
    }

    if (this.mode != SccMode.REAL) {
      value &= ~0x80;
    }

    switch (value & 0xc0) {
      case 0x00:
        for (let channel = 0; channel < 5; channel++) {
          this.rotate[channel]   = ROTATE_OFF;
          this.readOnly[channel] = false;
        }
        break;
      case 0x40:
        for (let channel = 0; channel < 5; channel++) {
          this.rotate[channel]   = ROTATE_ON;
          this.readOnly[channel] = true;
        }
        break;
      case 0x80:
        for (let channel = 0; channel < 3; channel++) {
          this.rotate[channel]   = ROTATE_OFF;
          this.readOnly[channel] = false;
        }
        for (let channel = 3; channel < 5; channel++) {
          this.rotate[channel]   = ROTATE_ON;
          this.readOnly[channel] = true;
        }
        break;
      case 0xC0:
        for (let channel = 0; channel < 3; channel++) {
          this.rotate[channel]   = ROTATE_ON;
          this.readOnly[channel] = true;
        }
        for (let channel = 3; channel < 5; channel++) {
          this.rotate[channel]   = ROTATE_OFF;
          this.readOnly[channel] = true;
        }
        break;
    }
  }

  // Filter type: Low pass
  // Passband: 0.0 - 750.0 Hz
  // Order: 94
  // Transition band: 250.0 Hz
  // Stopband attenuation: 50.0 dB
  private filter4(in1: number, in2: number, in3: number, in4: number): number {
    for (let i = 0; i < 91; ++i) {
      this.in [i] = this.in [i + 4];
    }
    this.in [91] = in1;
    this.in [92] = in2;
    this.in [93] = in3;
    this.in [94] = in4;

    const res = 2.8536195E-4 * (this.in [0] + this.in [94]) +
      9.052306E-5 * (this.in [1] + this.in [93]) +
      -2.6902245E-4 * (this.in [2] + this.in [92]) +
      -6.375284E-4 * (this.in [3] + this.in [91]) +
      -7.87536E-4 * (this.in [4] + this.in [90]) +
      -5.3910224E-4 * (this.in [5] + this.in [89]) +
      1.1107049E-4 * (this.in [6] + this.in [88]) +
      9.2801993E-4 * (this.in [7] + this.in [87]) +
      0.0015018889 * (this.in [8] + this.in [86]) +
      0.0014338732 * (this.in [9] + this.in [85]) +
      5.688559E-4 * (this.in [10] + this.in [84]) +
      -8.479743E-4 * (this.in [11] + this.in [83]) +
      -0.0021999443 * (this.in [12] + this.in [82]) +
      -0.0027432537 * (this.in [13] + this.in [81]) +
      -0.0019824558 * (this.in [14] + this.in [80]) +
      2.018935E-9 * (this.in [15] + this.in [79]) +
      0.0024515253 * (this.in [16] + this.in [78]) +
      0.00419754 * (this.in [17] + this.in [77]) +
      0.0041703423 * (this.in [18] + this.in [76]) +
      0.0019952168 * (this.in [19] + this.in [75]) +
      -0.0016656333 * (this.in [20] + this.in [74]) +
      -0.005242034 * (this.in [21] + this.in [73]) +
      -0.0068841926 * (this.in [22] + this.in [72]) +
      -0.005360789 * (this.in [23] + this.in [71]) +
      -8.1365916E-4 * (this.in [24] + this.in [70]) +
      0.0050464263 * (this.in [25] + this.in [69]) +
      0.00950725 * (this.in [26] + this.in [68]) +
      0.010038091 * (this.in [27] + this.in [67]) +
      0.005602208 * (this.in [28] + this.in [66]) +
      -0.00253724 * (this.in [29] + this.in [65]) +
      -0.011011368 * (this.in [30] + this.in [64]) +
      -0.015622435 * (this.in [31] + this.in [63]) +
      -0.013267951 * (this.in [32] + this.in [62]) +
      -0.0036876823 * (this.in [33] + this.in [61]) +
      0.009843254 * (this.in [34] + this.in [60]) +
      0.021394625 * (this.in [35] + this.in [59]) +
      0.02469893 * (this.in [36] + this.in [58]) +
      0.01608393 * (this.in [37] + this.in [57]) +
      -0.0032088074 * (this.in [38] + this.in [56]) +
      -0.026453404 * (this.in [39] + this.in [55]) +
      -0.043139543 * (this.in [40] + this.in [54]) +
      -0.042553578 * (this.in [41] + this.in [53]) +
      -0.018007802 * (this.in [42] + this.in [52]) +
      0.029919287 * (this.in [43] + this.in [51]) +
      0.09252273 * (this.in [44] + this.in [50]) +
      0.15504532 * (this.in [45] + this.in [49]) +
      0.20112106 * (this.in [46] + this.in [48]) +
      0.2180678 * this.in [47];

    return res;
  }
  
  public getState(): any {
    let state: any = {};

    state.deformReg = this.deformReg;
    state.enable = this.enable;

    state.curWave = SaveState.getArrayState(this.curWave);
    state.period = SaveState.getArrayState(this.period);
    state.phase = SaveState.getArrayState(this.phase);
    state.phaseStep = SaveState.getArrayState(this.phaseStep);
    state.volume = SaveState.getArrayState(this.volume);
    state.nextVolume = SaveState.getArrayState(this.nextVolume);
    state.readOnly = SaveState.getArrayState(this.readOnly);
    state.oldSample = SaveState.getArrayState(this.oldSample);
    state.deformSample = SaveState.getArrayState(this.deformSample);
    state.wave = SaveState.getArrayOfArrayState(this.wave);

    return state;
  }

  public setState(state: any): void {
    this.deformReg = state.deformReg;
    this.enable = state.enable;

    SaveState.setArrayState(this.curWave, state.curWave);
    SaveState.setArrayState(this.period, state.period);
    SaveState.setArrayState(this.phase, state.phase);
    SaveState.setArrayState(this.phaseStep, state.phaseStep);
    SaveState.setArrayState(this.volume, state.volume);
    SaveState.setArrayState(this.nextVolume, state.nextVolume);
    SaveState.setArrayState(this.readOnly, state.readOnly);
    SaveState.setArrayState(this.oldSample, state.oldSample);
    SaveState.setArrayState(this.deformSample, state.deformSample);
    SaveState.setArrayOfArrayState(this.wave, state.wave);
  }

  private basePhaseStep = 0;
  private deformReg = 0;
  private enable = 0xff;
  private curWave = new Array<number>(5);
  private period = new Array<number>(5);
  private phase = new Array<number>(5);
  private phaseStep = new Array<number>(5);
  private volume = new Array<number>(5);
  private nextVolume = new Array<number>(5);
  private rotate = new Array<number>(5);
  private readOnly = new Array<boolean>(5);
  private oldSample = new Array<number>(5);
  private deformSample = new Array<number>(5);
  private wave = [
    new Array<number>(32),
    new Array<number>(32),
    new Array<number>(32),
    new Array<number>(32),
    new Array<number>(32)
  ];

  private in = new Array<number>(95);
}
