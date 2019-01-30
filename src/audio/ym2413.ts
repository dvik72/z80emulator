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

const CLOCK_FREQ = 3579545;
const PI = 3.14159265358979323846;

// Size of Sintable ( 8 -- 18 can be used, but 9 recommended.)
const PG_BITS = 9;
const PG_WIDTH = 1 << PG_BITS;

// Phase increment counter
const DP_BITS = 18;
const DP_WIDTH = 1 << DP_BITS;
const DP_BASE_BITS = DP_BITS - PG_BITS;

// Dynamic range (Accuracy of sin table)
const DB_BITS = 8;
const DB_STEP = 48.0 / (1 << DB_BITS);
const DB_MUTE = 1 << DB_BITS;

// Dynamic range of envelope
const EG_STEP = 0.375;
const EG_BITS = 7;
const EG_MUTE = 1 << EG_BITS;

// Dynamic range of total level
const TL_STEP = 0.75;
const TL_BITS = 6;
const TL_MUTE = 1 << TL_BITS;

// Dynamic range of sustine level
const SL_STEP = 3.0;
const SL_BITS = 4;
const SL_MUTE = 1 << SL_BITS;

// Bits for liner value
const DB2LIN_AMP_BITS = 8;
const SLOT_AMP_BITS = DB2LIN_AMP_BITS;

// Bits for envelope phase incremental counter
const EG_DP_BITS = 22;
const EG_DP_WIDTH = 1 << EG_DP_BITS;

// Bits for Pitch and Amp modulator 
const PM_PG_BITS = 8;
const PM_PG_WIDTH = 1 << PM_PG_BITS;
const PM_DP_BITS = 16;
const PM_DP_WIDTH = 1 << PM_DP_BITS;
const AM_PG_BITS = 8;
const AM_PG_WIDTH = 1 << AM_PG_BITS;
const AM_DP_BITS = 16;
const AM_DP_WIDTH = 1 << AM_DP_BITS;

// PM table is calcurated by PM_AMP * pow(2,PM_DEPTH*sin(x)/1200) 
const PM_AMP_BITS = 8;
const PM_AMP = 1 << PM_AMP_BITS;

// PM speed(Hz) and depth(cent) 
const PM_SPEED = 6.4;
const PM_DEPTH = 13.75;

// AM speed(Hz) and depth(dB)
const AM_SPEED = 3.6413;
const AM_DEPTH = 4.875;

const NULL_PATCH_IDX = 19 * 2;

enum EnvMode { READY, ATTACK, DECAY, SUSHOLD, SUSTINE, RELEASE, SETTLE, FINISH };

const pmtable = new Int32Array(PM_PG_WIDTH);
const amtable = new Int32Array(AM_PG_WIDTH);
const tllTable = new Array<Array<Array<Int32Array>>>(16);
const rksTable = new Array<Array<Int32Array>>(2);
const AR_ADJUST_TABLE = new Uint16Array(1 << EG_BITS);
const fullsintable = new Uint16Array(PG_WIDTH);
const halfsintable = new Uint16Array(PG_WIDTH);
const waveform = [fullsintable, halfsintable];
const dB2LinTab = new Int16Array((2 * DB_MUTE) * 2);
const dphaseARTable = new Array<Uint32Array>(16);
const dphaseDRTable = new Array<Uint32Array>(16);
const dphaseTable = new Array<Array<Uint32Array>>(512);
let pmDphase = 0;
let amDphase = 0;

const INST_DATA = [
  new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // user instrument
  new Uint8Array([0x61, 0x61, 0x1e, 0x17, 0xf0, 0x7f, 0x00, 0x17]), // violin
  new Uint8Array([0x13, 0x41, 0x16, 0x0e, 0xfd, 0xf4, 0x23, 0x23]), // guitar
  new Uint8Array([0x03, 0x01, 0x9a, 0x04, 0xf3, 0xf3, 0x13, 0xf3]), // piano
  new Uint8Array([0x11, 0x61, 0x0e, 0x07, 0xfa, 0x64, 0x70, 0x17]), // flute
  new Uint8Array([0x22, 0x21, 0x1e, 0x06, 0xf0, 0x76, 0x00, 0x28]), // clarinet
  new Uint8Array([0x21, 0x22, 0x16, 0x05, 0xf0, 0x71, 0x00, 0x18]), // oboe
  new Uint8Array([0x21, 0x61, 0x1d, 0x07, 0x82, 0x80, 0x17, 0x17]), // trumpet
  new Uint8Array([0x23, 0x21, 0x2d, 0x16, 0x90, 0x90, 0x00, 0x07]), // organ
  new Uint8Array([0x21, 0x21, 0x1b, 0x06, 0x64, 0x65, 0x10, 0x17]), // horn
  new Uint8Array([0x21, 0x21, 0x0b, 0x1a, 0x85, 0xa0, 0x70, 0x07]), // synthesizer
  new Uint8Array([0x23, 0x01, 0x83, 0x10, 0xff, 0xb4, 0x10, 0xf4]), // harpsichord
  new Uint8Array([0x97, 0xc1, 0x20, 0x07, 0xff, 0xf4, 0x22, 0x22]), // vibraphone
  new Uint8Array([0x61, 0x00, 0x0c, 0x05, 0xc2, 0xf6, 0x40, 0x44]), // synthesizer bass
  new Uint8Array([0x01, 0x01, 0x56, 0x03, 0x94, 0xc2, 0x03, 0x12]), // acoustic bass
  new Uint8Array([0x21, 0x01, 0x89, 0x03, 0xf1, 0xe4, 0xf0, 0x23]), // electric guitar
  new Uint8Array([0x07, 0x21, 0x14, 0x00, 0xee, 0xf8, 0xff, 0xf8]),
  new Uint8Array([0x01, 0x31, 0x00, 0x00, 0xf8, 0xf7, 0xf8, 0xf7]),
  new Uint8Array([0x25, 0x11, 0x00, 0x00, 0xf8, 0xfa, 0xf8, 0x55])
];

// Cut the lower b bit off
function HIGHBITS(c: number, b: number): number {
  return c >> b;
}

// Expand x which is s bits to d bits
function EXPAND_BITS(x: number, s: number, d: number) {
  return x << (d - s);
}

// Adjust envelope speed which depends on sampling rate
function rate_adjust(x: number, rate: number) {
  return x * CLOCK_FREQ / 72 / rate + 0.5 | 0;
}

function BIT(s: number, b: number): number {
  return (s >> b) & 1;
}

function TL2EG(d: number): number {
  return d * (TL_STEP / EG_STEP | 0);
}

function DB_POS(x: number): number {
  if (x < 0) console.log("!!1");
  return x / DB_STEP | 0;
}

function DB_NEG(x: number): number {
  if (x < 0) console.log("!!2");
  return 2 * DB_MUTE + x / DB_STEP | 0;
}

class Patch {
  constructor(n?: number, data?: Uint8Array) {
    if (n && data) {
      if (n == 0) {
        this.AM = (data[0] >> 7) & 1;
        this.PM = (data[0] >> 6) & 1;
        this.EG = (data[0] >> 5) & 1;
        this.KR = (data[0] >> 4) & 1;
        this.ML = (data[0] >> 0) & 15;
        this.KL = (data[2] >> 6) & 3;
        this.TL = (data[2] >> 0) & 63;
        this.FB = (data[3] >> 0) & 7;
        this.WF = (data[3] >> 3) & 1;
        this.AR = (data[4] >> 4) & 15;
        this.DR = (data[4] >> 0) & 15;
        this.SL = (data[6] >> 4) & 15;
        this.RR = (data[6] >> 0) & 15;
      } else {
        this.AM = (data[1] >> 7) & 1;
        this.PM = (data[1] >> 6) & 1;
        this.EG = (data[1] >> 5) & 1;
        this.KR = (data[1] >> 4) & 1;
        this.ML = (data[1] >> 0) & 15;
        this.KL = (data[3] >> 6) & 3;
        this.TL = 0;
        this.FB = 0;
        this.WF = (data[3] >> 4) & 1;
        this.AR = (data[5] >> 4) & 15;
        this.DR = (data[5] >> 0) & 15;
        this.SL = (data[7] >> 4) & 15;
        this.RR = (data[7] >> 0) & 15;
      }
    }
  }
  
  public getState(): any {
    let state: any = {};

    state.AM = this.AM;
    state.PM = this.PM;
    state.EG = this.EG;

    state.KR = this.KR;
    state.ML = this.ML;
    state.KL = this.KL;
    state.TL = this.TL;
    state.FB = this.FB;
    state.WF = this.WF;
    state.AR = this.AR;
    state.DR = this.DR;
    state.SL = this.SL;
    state.RR = this.RR;

    return state;
  }

  public setState(state: any): void {
    this.AM = this.AM;
    this.PM = this.PM;
    this.EG = this.EG;

    this.KR = state.KR;
    this.ML = state.ML;
    this.KL = state.KL;
    this.TL = state.TL;
    this.FB = state.FB;
    this.WF = state.WF;
    this.AR = state.AR;
    this.DR = state.DR;
    this.SL = state.SL;
    this.RR = state.RR;
  }

  public AM = 0;
  public PM = 0;
  public EG = 0;
  
  public KR = 0;
  public ML = 0;
  public KL = 0;
  public TL = 0;
  public FB = 0;
  public WF = 0;
  public AR = 0;
  public DR = 0;
  public SL = 0;
  public RR = 0;
}

class Slot {
  constructor(type: boolean) {
    this.reset(this.type);
  }

  public reset(slotType: boolean): void {
    this.type = slotType;
    this.sintblIdx = 0;
    this.sintbl = waveform[this.sintblIdx];
    this.phase = 0;
    this.dphase = 0;
    this.output[0] = 0;
    this.output[1] = 0;
    this.feedback = 0;
    this.egMode = EnvMode.FINISH;
    this.egPhase = EG_DP_WIDTH;
    this.egDphase = 0;
    this.rks = 0;
    this.tll = 0;
    this.sustine = false;
    this.fnum = 0;
    this.block = 0;
    this.volume = 0;
    this.pgout = 0;
    this.egout = 0;
    this.slotOnFlag = false;

    this.setPatch(NULL_PATCH_IDX);
  }

  public updatePG(): void {
    this.dphase = dphaseTable[this.fnum][this.block][this.patches[this.patchIdx].ML];
  }

  public updateTLL(): void {
    this.tll = this.type ? tllTable[this.fnum >> 5][this.block][this.volume][this.patches[this.patchIdx].KL] :
      tllTable[this.fnum >> 5][this.block][this.patches[this.patchIdx].TL][this.patches[this.patchIdx].KL];
  }

  public updateRKS(): void {
    this.rks = rksTable[this.fnum >> 8][this.block][this.patches[this.patchIdx].KR];
  }

  public updateWF(): void {
    this.sintblIdx = this.patches[this.patchIdx].WF;
    this.sintbl = waveform[this.sintblIdx];
  }

  public updateEG(): void {
    switch (this.egMode) {
      case EnvMode.ATTACK:
        this.egDphase = dphaseARTable[this.patches[this.patchIdx].AR][this.rks];
        break;
      case EnvMode.DECAY:
        this.egDphase = dphaseDRTable[this.patches[this.patchIdx].DR][this.rks];
        break;
      case EnvMode.SUSTINE:
        this.egDphase = dphaseDRTable[this.patches[this.patchIdx].RR][this.rks];
        break;
      case EnvMode.RELEASE:
        if (this.sustine) {
          this.egDphase = dphaseDRTable[5][this.rks];
        } else if (this.patches[this.patchIdx].EG) {
          this.egDphase = dphaseDRTable[this.patches[this.patchIdx].RR][this.rks];
        } else {
          this.egDphase = dphaseDRTable[7][this.rks];
        }
        break;
      case EnvMode.SETTLE:
        this.egDphase = dphaseDRTable[15][0];
        break;
      case EnvMode.SUSHOLD:
      case EnvMode.FINISH:
      default:
        this.egDphase = 0;
        break;
    }
  }

  public updateAll(): void {
    this.updatePG();
    this.updateTLL();
    this.updateRKS();
    this.updateWF();
    this.updateEG();
  }

  public slotOn(): void {
    this.egMode = EnvMode.ATTACK;
    this.egPhase = 0;
    this.phase = 0;
    this.updateEG();
  }

  public slotOn2(): void {
    this.egMode = EnvMode.ATTACK;
    this.egPhase = 0;
    this.updateEG();
  }

  public slotOff(): void {
    if (this.egMode == EnvMode.ATTACK) {
      this.egPhase = EXPAND_BITS(AR_ADJUST_TABLE[HIGHBITS(this.egPhase, EG_DP_BITS - EG_BITS)], EG_BITS, EG_DP_BITS);
    }
    this.egMode = EnvMode.RELEASE;
    this.updateEG();
  }

  public setPatch(idx: number): void {
    this.patchIdx = idx;
  }

  public setVolume(newVolume: number): void {
    this.volume = newVolume;
  }

  public EG2DB(d: number): number {
    return d * (EG_STEP / DB_STEP | 0);
  }

  public SL2EG(d: number): number {
    return d * (SL_STEP / EG_STEP | 0);
  }

  public wave2_4pi(e: number): number {
    const shift = SLOT_AMP_BITS - PG_BITS - 1;
    if (shift > 0) {
      return e >> shift;
    } else {
      return e << -shift;
    }
  }

  public wave2_8pi(e: number): number {
    const shift = SLOT_AMP_BITS - PG_BITS - 2;
    if (shift > 0) {
      return e >> shift;
    } else {
      return e << -shift;
    }
  }

  public calcPhase(lfoPm: number): void {
    if (this.patches[this.patchIdx].PM) {
      this.phase += (this.dphase * lfoPm) >> PM_AMP_BITS;
    } else {
      this.phase += this.dphase;
    }
    this.phase &= (DP_WIDTH - 1);
    this.pgout = HIGHBITS(this.phase, DP_BASE_BITS);
  }

  private S2E(x: number): number {
    return this.SL2EG(x / SL_STEP | 0) << (EG_DP_BITS - EG_BITS);
  }

  public calcEnvelope(lfoAm: number): void {
    let out = 0;
    switch (this.egMode) {
      case EnvMode.ATTACK:
        out = AR_ADJUST_TABLE[HIGHBITS(this.egPhase, EG_DP_BITS - EG_BITS)];
        this.egPhase += this.egDphase;
        if ((EG_DP_WIDTH & this.egPhase) || (this.patches[this.patchIdx].AR == 15)) {
          out = 0;
          this.egPhase = 0;
          this.egMode = EnvMode.DECAY;
          this.updateEG();
        }
        break;
      case EnvMode.DECAY:
        out = HIGHBITS(this.egPhase, EG_DP_BITS - EG_BITS);
        this.egPhase += this.egDphase;
        if (this.egPhase >= this.SL[this.patches[this.patchIdx].SL]) {
          this.egPhase = this.SL[this.patches[this.patchIdx].SL];
          if (this.patches[this.patchIdx].EG) {
            this.egMode = EnvMode.SUSHOLD;
          } else {
            this.egMode = EnvMode.SUSTINE;
          }
          this.updateEG();
        }
        break;
      case EnvMode.SUSHOLD:
        out = HIGHBITS(this.egPhase, EG_DP_BITS - EG_BITS);
        if (this.patches[this.patchIdx].EG == 0) {
          this.egMode = EnvMode.SUSTINE;
          this.updateEG();
        }
        break;
      case EnvMode.SUSTINE:
      case EnvMode.RELEASE:
        out = HIGHBITS(this.egPhase, EG_DP_BITS - EG_BITS);
        this.egPhase += this.egDphase;
        if (out >= (1 << EG_BITS)) {
          this.egMode = EnvMode.FINISH;
          out = (1 << EG_BITS) - 1;
        }
        break;
      case EnvMode.SETTLE:
        out = HIGHBITS(this.egPhase, EG_DP_BITS - EG_BITS);
        this.egPhase += this.egDphase;
        if (out >= (1 << EG_BITS)) {
          this.egMode = EnvMode.ATTACK;
          out = (1 << EG_BITS) - 1;
          this.updateEG();
        }
        break;
      case EnvMode.FINISH:
      default:
        out = (1 << EG_BITS) - 1;
        break;
    }
    if (this.patches[this.patchIdx].AM) {
      out = this.EG2DB(out + this.tll) + lfoAm;
    } else {
      out = this.EG2DB(out + this.tll);
    }
    if (out >= DB_MUTE) {
      out = DB_MUTE - 1;
    }

    this.egout = out | 3;
  }

  public calcSlotCar(fm: number): number {
    if (this.egout >= (DB_MUTE - 1)) {
      this.output[0] = 0;
    }
    else {
      this.output[0] = dB2LinTab[this.sintbl[(this.pgout + this.wave2_8pi(fm)) & (PG_WIDTH - 1)] + this.egout];
    }
    this.output[1] = (this.output[1] + this.output[0]) >> 1;

    return this.output[1];
  }
  
  public calcSlotMod(): number {
    this.output[1] = this.output[0];

    if (this.egout >= (DB_MUTE - 1)) {
      this.output[0] = 0;
    }
    else if (this.patches[this.patchIdx].FB != 0) {
      const fm = this.wave2_4pi(this.feedback) >> (7 - this.patches[this.patchIdx].FB);
      this.output[0] = dB2LinTab[this.sintbl[(this.pgout + fm) & (PG_WIDTH - 1)] + this.egout];
    }
    else {
      this.output[0] = dB2LinTab[this.sintbl[this.pgout] + this.egout];
    }
    this.feedback = (this.output[1] + this.output[0]) >> 1;

    return this.feedback;
  }

  public calcSlotTom() {
    return (this.egout >= (DB_MUTE - 1)) ? 0 : dB2LinTab[this.sintbl[this.pgout] + this.egout];
  }

  public calcSlotSnare(noise: number): number {
    if (this.egout >= (DB_MUTE - 1)) {
      return 0;
    }
    if (BIT(this.pgout, 7)) {
      return dB2LinTab[(noise ? DB_POS(0.0) : DB_POS(15.0)) + this.egout];
    } else {
      return dB2LinTab[(noise ? DB_NEG(0.0) : DB_NEG(15.0)) + this.egout];
    }
  }

  // TOP-CYM
  public calcSlotCym(pgoutHh: number): number {
    if (this.egout >= (DB_MUTE - 1)) {
      return 0;
    }
    const dbout
      = (((BIT(pgoutHh, PG_BITS - 8) ^ BIT(pgoutHh, PG_BITS - 1)) |
        BIT(pgoutHh, PG_BITS - 7)) ^
        (BIT(this.pgout, PG_BITS - 7) & ~BIT(this.pgout, PG_BITS - 5)))
        ? DB_NEG(3.0)
        : DB_POS(3.0);
    return dB2LinTab[dbout + this.egout];
  }

  public calcSlotHat(pgoutCym: number, noise: number): number {
    if (this.egout >= (DB_MUTE - 1)) {
      return 0;
    }
    let dbout = 0;
    if (((BIT(this.pgout, PG_BITS - 8) ^ BIT(this.pgout, PG_BITS - 1)) |
      BIT(this.pgout, PG_BITS - 7)) ^
      (BIT(pgoutCym, PG_BITS - 7) & ~BIT(pgoutCym, PG_BITS - 5))) {
      dbout = noise ? DB_NEG(12.0) : DB_NEG(24.0);
    } else {
      dbout = noise ? DB_POS(12.0) : DB_POS(24.0);
    }
    return dB2LinTab[dbout + this.egout];
  }


  private SL = [
    this.S2E(0.0), this.S2E(3.0), this.S2E(6.0), this.S2E(9.0),
    this.S2E(12.0), this.S2E(15.0), this.S2E(18.0), this.S2E(21.0),
    this.S2E(24.0), this.S2E(27.0), this.S2E(30.0), this.S2E(33.0),
    this.S2E(36.0), this.S2E(39.0), this.S2E(42.0), this.S2E(48.0)
  ];
  
  public getState(): any {
    let state: any = {};

    state.type = this.type;
    state.patchIdx = this.patchIdx;
    state.slotOnFlag = this.slotOnFlag;

    state.feedback = this.feedback;
    state.output = SaveState.getArrayState(this.output);
    state.sintblIdx = this.sintblIdx;
    state.phase = this.phase;
    state.dphase = this.dphase;
    state.pgout = this.pgout;

    state.fnum = this.fnum;
    state.block = this.block;
    state.volume = this.volume;
    state.sustine = this.sustine;
    state.tll = this.tll;
    state.rks = this.rks;
    state.egMode = this.egMode;
    state.egPhase = this.egPhase;
    state.egDphase = this.egDphase;
    state.egout = this.egout;

    return state;
  }

  public setState(state: any): void {
    this.type = state.type;
    this.patchIdx = state.patchIdx;
    this.slotOnFlag = state.slotOnFlag;

    this.feedback = state.feedback;
    SaveState.setArrayState(this.output, state.output);
    this.sintblIdx = state.sintblIdx;
    this.phase = state.phase;
    this.dphase = state.dphase;
    this.pgout = state.pgout;

    this.fnum = state.fnum;
    this.block = state.block;
    this.volume = state.volume;
    this.sustine = state.sustine;
    this.tll = state.tll;
    this.rks = state.rks;
    this.egMode = state.egMode;
    this.egPhase = state.egPhase;
    this.egDphase = state.egDphase;
    this.egout = state.egout;

    this.sintbl = waveform[this.sintblIdx];
  }

  public type = false;
  public patches = new Array<Patch>(0);
  public patchIdx = 0;
  public slotOnFlag = false;

  public feedback = 0;
  public output = [0, 0, 0, 0, 0];
  public sintbl = new Int16Array(0);
  public sintblIdx = 0;
  public phase = 0;
  public dphase = 0;
  public pgout = 0;

  public fnum = 0;
  public block = 0;
  public volume = 0;
  public sustine = false;
  public tll = 0;
  public rks = 0;
  public egMode = EnvMode.ATTACK;
  public egPhase = 0;
  public egDphase = 0;
  public egout = 0;
}

class Channel {
  constructor() { }

  public reset(): void {
    this.mod.reset(false);
    this.car.reset(true);
    this.setPatch(0);
  }

  public setPatch(num: number): void {
    this.patchNumber = num;
    this.mod.setPatch(2 * num + 0);
    this.car.setPatch(2 * num + 1);
  }

  public setSustine(sustine: boolean): void {
    this.car.sustine = sustine;
    if (this.mod.type) {
      this.mod.sustine = sustine;
    }
  }

  public setVol(volume: number): void {
    this.car.volume = volume;
  }

  public setFnumber(fnum: number): void {
    this.car.fnum = fnum;
    this.mod.fnum = fnum;
  }

  public setBlock(block: number) {
    this.car.block = block;
    this.mod.block = block;
  }

  public keyOn(): void {
    if (!this.mod.slotOnFlag) this.mod.slotOn();
    if (!this.car.slotOnFlag) this.car.slotOn();
  }

  public keyOff(): void {
    if (this.car.slotOnFlag) this.car.slotOff();
  }
  
  public getState(): any {
    let state: any = {};

    state.patchNumber = this.patchNumber;

    state.mod = this.mod.getState();
    state.car = this.car.getState();

    return state;
  }

  public setState(state: any): void {
    this.patchNumber = state.patchNumber;

    this.mod.setState(state.mod);
    this.car.setState(state.car);
  }

  public patches = new Array<Patch>(1);
  public patchNumber = 0;
  public mod = new Slot(false);
  public car = new Slot(true);
}

export class Ym2413 extends AudioDevice {
  constructor(private board: Board) {
    super('YM-2413', false);

    this.board.getAudioManager().registerAudioDevice(this);
    
    for (let i = 0; i < 16 + 3; i++) {
      this.patches[2 * i + 0] = new Patch(0, INST_DATA[i]);
      this.patches[2 * i + 1] = new Patch(1, INST_DATA[i]);
    }

    for (let i = 0; i < 0x40; i++) {
      this.reg[i] = 0;
    }

    for (let i = 0; i < 9; i++) {
      this.ch[i] = new Channel();
      this.ch[i].patches = this.patches;
      this.ch[i].mod.patches = this.patches;
      this.ch[i].car.patches = this.patches;
    }

    this.makePmTable();
    this.makeAmTable();
    this.makeDB2LinTable();
    this.makeAdjustTable();
    this.makeTllTable();
    this.makeRksTable();
    this.makeSinTable();

    this.updateSampleRate(this.sampleRate);
    this.setInternalVolume(5000);

    this.reset();
  }

  public reset(): void {
    this.pmPhase = 0;
    this.amPhase = 0;
    this.noiseSeed = 0xFFFF;

    for (let i = 0; i < 9; i++) {
      this.ch[i].reset();
    }
    for (let i = 0; i < 0x40; i++) {
      this.writeReg(i, 0);
    }
    this.setInternalMute(true);
  }

  public sync(count: number): void {
    const audioBuffer = this.getAudioBufferMono();

    for (let index = 0; index < count; index++) {
      audioBuffer[index] = this.calcSample() / 32768 * 0.9;
    }
    this.checkMute();
  }

  private updateSampleRate(sampleRate: number) {
    this.makeDphaseTable(sampleRate);
    this.makeDphaseARTable(sampleRate);
    this.makeDphaseDRTable(sampleRate);
    pmDphase = rate_adjust(PM_SPEED * PM_DP_WIDTH / (CLOCK_FREQ / 72), sampleRate);
    amDphase = rate_adjust(AM_SPEED * AM_DP_WIDTH / (CLOCK_FREQ / 72), sampleRate);
  }

  public keyOn_BD(): void { this.ch[6].keyOn(); }
  public keyOn_HH(): void { if (!this.ch[7].mod.slotOnFlag) this.ch[7].mod.slotOn2(); }
  public keyOn_SD(): void { if (!this.ch[7].car.slotOnFlag) this.ch[7].car.slotOn(); }
  public keyOn_TOM(): void { if (!this.ch[8].mod.slotOnFlag) this.ch[8].mod.slotOn(); }
  public keyOn_CYM(): void { if (!this.ch[8].car.slotOnFlag) this.ch[8].car.slotOn2(); }

  public keyOff_BD(): void { this.ch[6].keyOff(); }
  public keyOff_HH(): void { if (this.ch[7].mod.slotOnFlag) this.ch[7].mod.slotOff(); }
  public keyOff_SD(): void { if (this.ch[7].car.slotOnFlag) this.ch[7].car.slotOff(); }
  public keyOff_TOM(): void { if (this.ch[8].mod.slotOnFlag) this.ch[8].mod.slotOff(); }
  public keyOff_CYM(): void { if (this.ch[8].car.slotOnFlag) this.ch[8].car.slotOff(); }

  public updateRhythmMode(): void {
    if (this.ch[6].patchNumber & 0x10) {
      if (!(this.ch[6].car.slotOnFlag ||
        (this.reg[0x0e] & 0x20))) {
        this.ch[6].mod.egMode = EnvMode.FINISH;
        this.ch[6].car.egMode = EnvMode.FINISH;
        this.ch[6].setPatch(this.reg[0x36] >> 4);
      }
    } else if (this.reg[0x0e] & 0x20) {
      this.ch[6].mod.egMode = EnvMode.FINISH;
      this.ch[6].car.egMode = EnvMode.FINISH;
      this.ch[6].setPatch(16);
    }

    if (this.ch[7].patchNumber & 0x10) {
      if (!((this.ch[7].mod.slotOnFlag && this.ch[7].car.slotOnFlag) ||
        (this.reg[0x0e] & 0x20))) {
        this.ch[7].mod.type = false;
        this.ch[7].mod.egMode = EnvMode.FINISH;
        this.ch[7].car.egMode = EnvMode.FINISH;
        this.ch[7].setPatch(this.reg[0x37] >> 4);
      }
    } else if (this.reg[0x0e] & 0x20) {
      this.ch[7].mod.type = true;
      this.ch[7].mod.egMode = EnvMode.FINISH;
      this.ch[7].car.egMode = EnvMode.FINISH;
      this.ch[7].setPatch(17);
    }

    if (this.ch[8].patchNumber & 0x10) {
      if (!((this.ch[8].mod.slotOnFlag && this.ch[8].car.slotOnFlag) ||
        (this.reg[0x0e] & 0x20))) {
        this.ch[8].mod.type = false;
        this.ch[8].mod.egMode = EnvMode.FINISH;
        this.ch[8].car.egMode = EnvMode.FINISH;
        this.ch[8].setPatch(this.reg[0x38] >> 4);
      }
    } else if (this.reg[0x0e] & 0x20) {
      this.ch[8].mod.type = true;
      this.ch[8].mod.egMode = EnvMode.FINISH;
      this.ch[8].car.egMode = EnvMode.FINISH;
      this.ch[8].setPatch(18);
    }
  }

  public updateKeyStatus(): void {
    for (let i = 0; i < 9; i++) {
      this.ch[i].mod.slotOnFlag = this.ch[i].car.slotOnFlag = (this.reg[0x20 + i] & 0x10) != 0;
    }
    if (this.reg[0x0e] & 0x20) {
      this.ch[6].mod.slotOnFlag = this.ch[6].mod.slotOnFlag || 0 != (this.reg[0x0e] & 0x10); // BD1
      this.ch[6].car.slotOnFlag = this.ch[6].car.slotOnFlag || 0 != (this.reg[0x0e] & 0x10); // BD2
      this.ch[7].mod.slotOnFlag = this.ch[7].mod.slotOnFlag || 0 != (this.reg[0x0e] & 0x01); // HH
      this.ch[7].car.slotOnFlag = this.ch[7].car.slotOnFlag || 0 != (this.reg[0x0e] & 0x08); // SD
      this.ch[8].mod.slotOnFlag = this.ch[8].mod.slotOnFlag || 0 != (this.reg[0x0e] & 0x04); // TOM
      this.ch[8].car.slotOnFlag = this.ch[8].car.slotOnFlag || 0 != (this.reg[0x0e] & 0x02); // SYM
    }
  }

  public writeReg(regis: number, data: number): void {
    this.reg[regis] = data;

    switch (regis) {
      case 0x00:
        this.patches[0].AM = (data >> 7) & 1;
        this.patches[0].PM = (data >> 6) & 1;
        this.patches[0].EG = (data >> 5) & 1;
        this.patches[0].KR = (data >> 4) & 1;
        this.patches[0].ML = (data >> 0) & 15;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].mod.updatePG();
            this.ch[i].mod.updateRKS();
            this.ch[i].mod.updateEG();
          }
        }
        break;
      case 0x01:
        this.patches[1].AM = (data >> 7) & 1;
        this.patches[1].PM = (data >> 6) & 1;
        this.patches[1].EG = (data >> 5) & 1;
        this.patches[1].KR = (data >> 4) & 1;
        this.patches[1].ML = (data >> 0) & 15;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].car.updatePG();
            this.ch[i].car.updateRKS();
            this.ch[i].car.updateEG();
          }
        }
        break;
      case 0x02:
        this.patches[0].KL = (data >> 6) & 3;
        this.patches[0].TL = (data >> 0) & 63;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].mod.updateTLL();
          }
        }
        break;
      case 0x03:
        this.patches[1].KL = (data >> 6) & 3;
        this.patches[1].WF = (data >> 4) & 1;
        this.patches[0].WF = (data >> 3) & 1;
        this.patches[0].FB = (data >> 0) & 7;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].mod.updateWF();
            this.ch[i].car.updateWF();
          }
        }
        break;
      case 0x04:
        this.patches[0].AR = (data >> 4) & 15;
        this.patches[0].DR = (data >> 0) & 15;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].mod.updateEG();
          }
        }
        break;
      case 0x05:
        this.patches[1].AR = (data >> 4) & 15;
        this.patches[1].DR = (data >> 0) & 15;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].car.updateEG();
          }
        }
        break;
      case 0x06:
        this.patches[0].SL = (data >> 4) & 15;
        this.patches[0].RR = (data >> 0) & 15;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].mod.updateEG();
          }
        }
        break;
      case 0x07:
        this.patches[1].SL = (data >> 4) & 15;
        this.patches[1].RR = (data >> 0) & 15;
        for (let i = 0; i < 9; i++) {
          if (this.ch[i].patchNumber == 0) {
            this.ch[i].car.updateEG();
          }
        }
        break;
      case 0x0e:
        this.updateRhythmMode();
        if (data & 0x20) {
          if (data & 0x10) this.keyOn_BD(); else this.keyOff_BD();
          if (data & 0x08) this.keyOn_SD(); else this.keyOff_SD();
          if (data & 0x04) this.keyOn_TOM(); else this.keyOff_TOM();
          if (data & 0x02) this.keyOn_CYM(); else this.keyOff_CYM();
          if (data & 0x01) this.keyOn_HH(); else this.keyOff_HH();
        }
        this.updateKeyStatus();

        this.ch[6].mod.updateAll();
        this.ch[6].car.updateAll();
        this.ch[7].mod.updateAll();
        this.ch[7].car.updateAll();
        this.ch[8].mod.updateAll();
        this.ch[8].car.updateAll();
        break;

      case 0x10: case 0x11: case 0x12: case 0x13:
      case 0x14: case 0x15: case 0x16: case 0x17:
      case 0x18:
        {
          const cha = regis & 0x0F;
          this.ch[cha].setFnumber(data + ((this.reg[0x20 + cha] & 1) << 8));
          this.ch[cha].mod.updateAll();
          this.ch[cha].car.updateAll();
          break;
        }
      case 0x20: case 0x21: case 0x22: case 0x23:
      case 0x24: case 0x25: case 0x26: case 0x27:
      case 0x28:
        {
          const cha = regis & 0x0F;
          const fNum = ((data & 1) << 8) + this.reg[0x10 + cha];
          const block = (data >> 1) & 7;
          this.ch[cha].setFnumber(fNum);
          this.ch[cha].setBlock(block);
          this.ch[cha].setSustine(((data >> 5) & 1) != 0);
          if (data & 0x10) {
            this.ch[cha].keyOn();
          } else {
            this.ch[cha].keyOff();
          }
          this.ch[cha].mod.updateAll();
          this.ch[cha].car.updateAll();
          this.updateKeyStatus();
          this.updateRhythmMode();
          break;
        }
      case 0x30: case 0x31: case 0x32: case 0x33: case 0x34:
      case 0x35: case 0x36: case 0x37: case 0x38:
        {
          const cha = regis & 0x0F;
          const j = (data >> 4) & 15;
          const v = data & 15;
          if ((this.reg[0x0e] & 0x20) && (regis >= 0x36)) {
            switch (regis) {
              case 0x37:
                this.ch[7].mod.setVolume(j << 2);
                break;
              case 0x38:
                this.ch[8].mod.setVolume(j << 2);
                break;
            }
          } else {
            this.ch[cha].setPatch(j);
          }
          this.ch[cha].setVol(v << 2);
          this.ch[cha].mod.updateAll();
          this.ch[cha].car.updateAll();
          break;
        }
      default:
        break;
    }
    this.checkMute();
  }
  
  private checkMute(): void {
    this.setInternalMute(this.checkMuteHelper());
  }

  private checkMuteHelper(): boolean {
    for (let i = 0; i < 6; i++) {
      if (this.ch[i].car.egMode != EnvMode.FINISH) return false;
    }
    if (!(this.reg[0x0e] & 0x20)) {
      for (let i = 6; i < 9; i++) {
        if (this.ch[i].car.egMode != EnvMode.FINISH) return false;
      }
    } else {
      if (this.ch[6].car.egMode != EnvMode.FINISH) return false;
      if (this.ch[7].mod.egMode != EnvMode.FINISH) return false;
      if (this.ch[7].car.egMode != EnvMode.FINISH) return false;
      if (this.ch[8].mod.egMode != EnvMode.FINISH) return false;
      if (this.ch[8].car.egMode != EnvMode.FINISH) return false;
    }
    return true;
  }

  private updateNoise(): void {
    if (this.noiseSeed & 1) this.noiseSeed ^= 0x8003020;
    this.noiseSeed >>= 1;
  }

  private updateAmpm(): void {
    this.pmPhase = (this.pmPhase + pmDphase) & (PM_DP_WIDTH - 1);
    this.amPhase = (this.amPhase + amDphase) & (AM_DP_WIDTH - 1);
    this.lfoAm = amtable[HIGHBITS(this.amPhase, AM_DP_BITS - AM_PG_BITS)];
    this.lfoPm = pmtable[HIGHBITS(this.pmPhase, PM_DP_BITS - PM_PG_BITS)];
  }

  private calcSample(): number {
    this.updateAmpm();
    this.updateNoise();

    for (let i = 0; i < 9; i++) {
      this.ch[i].mod.calcPhase(this.lfoPm);
      this.ch[i].mod.calcEnvelope(this.lfoAm);
      this.ch[i].car.calcPhase(this.lfoPm);
      this.ch[i].car.calcEnvelope(this.lfoAm);
    }

    let channelMask = 0;
    for (let i = 0; i < 9; i++) {
      if (this.ch[i].car.egMode != EnvMode.FINISH) {
        channelMask |= (1 << i);
      }
    }

    let mix = 0;
    if (this.ch[6].patchNumber & 0x10) {
      if (channelMask & (1 << 6)) {
        mix += this.ch[6].car.calcSlotCar(this.ch[6].mod.calcSlotMod());
        channelMask &= ~(1 << 6);
      }
    }
    if (this.ch[7].patchNumber & 0x10) {
      if (this.ch[7].mod.egMode != EnvMode.FINISH) {
        mix += this.ch[7].mod.calcSlotHat(this.ch[8].car.pgout, this.noiseSeed & 1);
      }
      if (channelMask & (1 << 7)) {
        mix -= this.ch[7].car.calcSlotSnare(this.noiseSeed & 1);
        channelMask &= ~(1 << 7);
      }
    }
    if (this.ch[8].patchNumber & 0x10) {
      if (this.ch[8].mod.egMode != EnvMode.FINISH) {
        mix += this.ch[8].mod.calcSlotTom();
      }
      if (channelMask & (1 << 8)) {
        mix -= this.ch[8].car.calcSlotCym(this.ch[7].mod.pgout);
        channelMask &= ~(1 << 8);
      }
    }
    mix *= 2;
    
    for (const i in this.ch) {
      if (channelMask & 1) {
        mix += this.ch[i].car.calcSlotCar(this.ch[i].mod.calcSlotMod());
      }
      channelMask >>= 1;
    }

    return this.filter((this.maxVolume * mix) >> (DB2LIN_AMP_BITS - 1));
  }

  private filter(input: number): number {
    this.in[4] = this.in[3];
    this.in[3] = this.in[2];
    this.in[2] = this.in[1];
    this.in[1] = this.in[0];
    this.in[0] = input;

    return (0 * (this.in[0] + this.in[4]) + 1 * (this.in[3] + this.in[1]) + 2 * this.in[2]) / 4;
  }
  
  public setInternalVolume(newVolume: number) {
    this.maxVolume = newVolume;
  }
  
  public setInternalMute(muted: boolean): void {
    this.internalMuted = muted;
  }

  public isInternalMuted(): boolean {
    return this.internalMuted;
  }

  private makeAdjustTable(): void {
    AR_ADJUST_TABLE[0] = (1 << EG_BITS) - 1;
    for (let i = 1; i < (1 << EG_BITS); i++) {
      AR_ADJUST_TABLE[i] = (1 << EG_BITS) - 1 - ((1 << EG_BITS) - 1) * Math.log(i) / Math.log(127.0);
    }
  }

  private makeDB2LinTable(): void {
    for (let i = 0; i < 2 * DB_MUTE; i++) {
      dB2LinTab[i] = (i < DB_MUTE) ? ((1 << DB2LIN_AMP_BITS) - 1) * Math.pow(10.0, -i * DB_STEP / 20) : 0;
      dB2LinTab[i + 2 * DB_MUTE] = -dB2LinTab[i];
    }
  }

  private lin2db(d: number): number {
    return d ? Math.min(-(20.0 * Math.log(d) / Math.log(10) / DB_STEP), DB_MUTE - 1) : DB_MUTE - 1;
  }

  private makeSinTable(): void {
    for (let i = 0; i < PG_WIDTH / 4; i++) {
      fullsintable[i] = this.lin2db(Math.sin(2.0 * PI * i / PG_WIDTH));
    }
    for (let i = 0; i < PG_WIDTH / 4; i++) {
      fullsintable[PG_WIDTH / 2 - 1 - i] = fullsintable[i];
    }
    for (let i = 0; i < PG_WIDTH / 2; i++) {
      fullsintable[PG_WIDTH / 2 + i] = 2 * DB_MUTE + fullsintable[i];
    }

    for (let i = 0; i < PG_WIDTH / 2; i++) {
      halfsintable[i] = fullsintable[i];
    }
    for (let i = PG_WIDTH / 2; i < PG_WIDTH; i++) {
      halfsintable[i] = fullsintable[0];
    }
  }

  private saw(phase: number): number {
    if (phase <= (PI / 2)) {
      return phase * 2 / PI;
    }
    else if (phase <= (PI * 3 / 2)) {
      return 2.0 - (phase * 2 / PI);
    }
    else {
      return -4.0 + phase * 2 / PI;
    }
  }

  private makePmTable(): void {
    for (let i = 0; i < PM_PG_WIDTH; i++) {
      pmtable[i] = PM_AMP * Math.pow(2.0, PM_DEPTH * this.saw(2.0 * PI * i / PM_PG_WIDTH) / 1200);
    }
  }

  private makeAmTable(): void {
    for (let i = 0; i < AM_PG_WIDTH; i++) {
      amtable[i] = AM_DEPTH / 2 / DB_STEP * (1.0 + this.saw(2.0 * PI * i / PM_PG_WIDTH));
    }
  }

  private makeDphaseTable(sampleRate: number): void {
    const mltable = [
      1, 1* 2, 2* 2, 3* 2, 4* 2, 5* 2, 6* 2, 7* 2,
      8 * 2, 9 * 2, 10 * 2, 10 * 2, 12 * 2, 12 * 2, 15 * 2, 15 * 2
    ];

    for (let fnum = 0; fnum < 512; fnum++) {
      dphaseTable[fnum] = new Array<Uint32Array>(8);
      for (let block = 0; block < 8; block++) {
        dphaseTable[fnum][block] = new Uint32Array(16);
        for (let ML = 0; ML < 16; ML++) {
          dphaseTable[fnum][block][ML] =
            rate_adjust(((fnum * mltable[ML]) << block) >> (20 - DP_BITS), sampleRate);
        }
      }
    }
  }

  private makeTllTable(): void {
    const kltable = [
      (0.000 * 2), (9.000 * 2), (12.000 * 2), (13.875 * 2),
      (15.000 * 2), (16.125 * 2), (16.875 * 2), (17.625 * 2),
      (18.000 * 2), (18.750 * 2), (19.125 * 2), (19.500 * 2),
      (19.875 * 2), (20.250 * 2), (20.625 * 2), (21.000 * 2)
    ];

    for (let fnum = 0; fnum < 16; fnum++) {
      tllTable[fnum] = new Array<Array<Uint32Array>>(8);
      for (let block = 0; block < 8; block++) {
        tllTable[fnum][block] = new Array<Uint32Array>(64);
        for (let TL = 0; TL < 64; TL++) {
          tllTable[fnum][block][TL] = new Uint32Array(4);
          for (let KL = 0; KL < 4; KL++) {
            if (KL == 0) {
              tllTable[fnum][block][TL][KL] = TL2EG(TL);
            } else {
              const tmp = kltable[fnum] - (3.000 * 2) * (7 - block);
              tllTable[fnum][block][TL][KL] = tmp <= 0 ? TL2EG(TL) : ((tmp >> (3 - KL)) / EG_STEP) + TL2EG(TL);
            }
          }
        }
      }
    }
  }

  private makeDphaseARTable(sampleRate: number): void {
    for (let AR = 0; AR < 16; AR++) {
      dphaseARTable[AR] = new Uint16Array(16);
      for (let Rks = 0; Rks < 16; Rks++) {
        let RM = AR + (Rks >> 2);
        const RL = Rks & 3;
        if (RM > 15) RM = 15;
        switch (AR) {
          case 0:
            dphaseARTable[AR][Rks] = 0;
            break;
          case 15:
            dphaseARTable[AR][Rks] = 0;
            break;
          default:
            dphaseARTable[AR][Rks] = rate_adjust(3 * (RL + 4) << (RM + 1), sampleRate);
            break;
        }
      }
    }
  }

  private makeDphaseDRTable(sampleRate: number): void {
    for (let DR = 0; DR < 16; DR++) {
      dphaseDRTable[DR] = new Uint16Array(16);
      for (let Rks = 0; Rks < 16; Rks++) {
        let RM = DR + (Rks >> 2);
        const RL = Rks & 3;
        if (RM > 15) RM = 15;
        switch (DR) {
          case 0:
            dphaseDRTable[DR][Rks] = 0;
            break;
          default:
            dphaseDRTable[DR][Rks] = rate_adjust((RL + 4) << (RM - 1), sampleRate);
            break;
        }
      }
    }
  }

  private makeRksTable(): void {
    for (let fnum8 = 0; fnum8 < 2; fnum8++) {
      rksTable[fnum8] = new Array<Int32Array>(8);
      for (let block = 0; block < 8; block++) {
        rksTable[fnum8][block] = new Int32Array(2);
        for (let KR = 0; KR < 2; KR++) {
          rksTable[fnum8][block][KR] = KR  ? (block << 1) + fnum8 : block >> 1;
        }
      }
    }
  }
  
  public getState(): any {
    let state: any = {};

    state.maxVolume = this.maxVolume;
    state.internalMuted = this.internalMuted;
    state.reg = SaveState.getArrayState(this.reg);

    state.pmPhase = this.pmPhase;
    state.lfoPm = this.lfoPm;
    state.amPhase = this.amPhase;
    state.lfoAm = this.lfoAm;
    state.noiseSeed = this.noiseSeed;

    state.in = SaveState.getArrayState(this.in);

    state.ch = []
    for (let i = 0; i < this.ch.length; i++) {
      state.ch[i] = this.ch[i].getState();
    }
    state.patches = []
    for (let i = 0; i < this.patches.length; i++) {
      state.patches[i] = this.patches[i].getState();
    }

    return state;
  }

  public setState(state: any): void {
    this.maxVolume = this.maxVolume;
    this.internalMuted = this.internalMuted;
    this.reg = SaveState.getArrayState(this.reg);

    this.pmPhase = state.pmPhase;
    this.lfoPm = state.lfoPm;
    this.amPhase = state.amPhase;
    this.lfoAm = state.lfoAm;
    this.noiseSeed = state.noiseSeed;

    SaveState.setArrayState(this.in, state.in);

    for (let i = 0; i < this.ch.length; i++) {
      this.ch[i].setState(state.ch[i]);
    }
    for (let i = 0; i < this.patches.length; i++) {
      this.patches[i].setState(state.patches[i]);
    }
  }

  private maxVolume = 0;
  private internalMuted = false;
  private reg = new Uint8Array(0x40);

  private pmPhase = 0;
  private lfoPm = 0;

  private amPhase = 0;
  private lfoAm = 0;

  private noiseSeed = 0;

  private in = [0, 0, 0, 0, 0];

  private ch = new Array<Channel>(9);

  private patches = new Array<Patch>(19 * 2 + 1);
};