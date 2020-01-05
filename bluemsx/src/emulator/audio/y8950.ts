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
import { Board, InterruptVector } from '../core/board';
import { Timer } from '../core/timeoutmanager';
import { SaveState } from '../util/savestate';

// Note to reader:
// This file is inappropriate to use for educational purposes with
// the only exception to learn how *not* to write code.


const ym_deltat_decode_tableB1 = [
  1, 3, 5, 7, 9, 11, 13, 15,
  -1, -3, -5, -7, -9, -11, -13, -15,
];
const ym_deltat_decode_tableB2 = [
  57, 57, 57, 57, 77, 102, 128, 153,
  57, 57, 57, 57, 77, 102, 128, 153
];

const YM_DELTAT_SHIFT = 16;
const YM_DELTAT_DELTA_MAX = 24576;
const YM_DELTAT_DELTA_MIN = 127;
const YM_DELTAT_DELTA_DEF = 127;

const YM_DELTAT_DECODE_RANGE = 32768;
const YM_DELTAT_DECODE_MIN = -YM_DELTAT_DECODE_RANGE;
const YM_DELTAT_DECODE_MAX = YM_DELTAT_DECODE_RANGE - 1;

class YM_DELTAT {
  constructor(
    private connectors: Int32Array
    //,
    //private statusSet: (flag: number) => void,
    //private statusReset: (flag: number) => void
  ) {
 
  }

  public initSampleRam(size: number): void {
    this.memory = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      this.memory[i] = 0xff;
    }
  }

  public write(r: number, v: number): void {
    if (r >= 0x10) return;
    this.reg[r] = v;
    this.memread = 0;
    switch (r) {
      case 0x00:
      case 0x60:
      case 0x20:
        if (v & 0x80) {
          this.portstate = v & 0x90;
          this.volume_w_step = this.volume * this.step / (1 << YM_DELTAT_SHIFT) | 0;
          this.now_addr = (this.start) << 1;
          this.now_step = (1 << YM_DELTAT_SHIFT) - this.step;
          this.adpcmx = 0;
          this.adpcml = 0;
          this.adpcmd = YM_DELTAT_DELTA_DEF;
          this.next_leveling = 0;
          this.flag = 1;
          this.eos = 0;

          if (!this.step) {
            this.flag = 0;
            this.eos = 1;
            this.portstate = 0x00;
          }

          if (this.memory.length == 0) {
            this.flag = 0;
            this.eos = 1;
            //DELTAT->portstate = 0x00;
          } else {
            if (this.end >= this.memory.length) {
              this.end = this.memory.length - 1;
            }
            if (this.start >= this.memory.length) {
              this.flag = 0;
              this.eos = 1;
              this.portstate = 0x00;
            }
          }
        } else if (v & 0x01) {
          this.flag = 0;
          this.eos = 1;
          //DELTAT->start         = 0;
          //DELTAT->end           = 0;
          //DELTAT->read_pointer  = 0;
          //DELTAT->write_pointer = 0;
          this.portstate = 0x00;
        }
        break;
      case 0x01:
        this.pan = (v >> 6) & 0x03;
        break;
      case 0x02:
      case 0x03:
        this.start = (this.reg[0x3] * 0x0100 | this.reg[0x2]) << this.portshift;
        this.write_pointer = 0;
        this.read_pointer = 0;
        break;
      case 0x04:
      case 0x05:
        this.end = (this.reg[0x5] * 0x0100 | this.reg[0x4]) << this.portshift;
        this.end += (1 << this.portshift) - 1;
        break;
      case 0x06:
      case 0x07:
        break;
      case 0x08:
        if ((this.start + this.write_pointer) < this.memory.length &&
          (this.start + this.write_pointer) <= this.end) {
          this.memory[this.start + this.write_pointer] = v;
          this.write_pointer++;
          this.eos = 0;
        }
        else {
          this.write_pointer = 0;
          this.start = 0;
          this.eos = 1;
        }
        break;
      case 0x09:
      case 0x0a:
        this.delta = (this.reg[0xa] * 0x0100 | this.reg[0x9]);
        this.step = this.delta * (1 << (YM_DELTAT_SHIFT - 16)) * this.freqbase | 0;
        this.volume_w_step = this.volume * this.step / (1 << YM_DELTAT_SHIFT) | 0;
        break;
      case 0x0b:
        {
          const oldvol = this.volume;
          this.volume = (v & 0xff) * (this.output_range / 256) / YM_DELTAT_DECODE_RANGE;
          if (oldvol != 0) {
            this.adpcml = this.adpcml / oldvol * this.volume | 0;
            this.sample_step = this.sample_step / oldvol * this.volume | 0;
          }
          this.volume_w_step = this.volume * this.step / (1 << YM_DELTAT_SHIFT) | 0;
        }
        break;
    }
  }

  public read(): number {
    let v = 0;

    if (this.memread < 2) {
      this.eos=0;
      this.memread++;
      return 0;
    }
    if ((this.start + this.read_pointer) < this.memory.length &&
      (this.start + this.read_pointer) <= this.end) {
      v = this.memory[this.start + this.read_pointer];
      this.read_pointer++;
      this.eos=0;
    }
    else {
      this.read_pointer=0;
      this.start=0;
      this.eos=1;
    }

    return v;
  }

  public read2(): number {
    return this.adpcmx / 256 | 0;
  }

  public reset(pan: number): void {
    this.now_addr  = 0;
    this.now_step  = 0;
    this.step      = 0;
    this.start     = 0;
    this.end       = 0;
    this.eos       = 0;
    this.volume    = 0;
    this.pan       = pan;
    this.arrivedFlag = 0;
    this.flag      = 0;
    this.adpcmx    = 0;
    this.adpcmd    = 127;
    this.adpcml    = 0;
    this.volume_w_step = 0;
    this.next_leveling = 0;
    this.portstate = 0;
    this.memread = 0;
  }

  public calc(): void {
    let step = 0;
    let data = 0;
    let old_m = 0;
    let now_leveling = 0;
    let delta_next = 0;

    this.now_step += this.step;
    if (this.now_step >= (1 << YM_DELTAT_SHIFT)) {
      step = this.now_step >> YM_DELTAT_SHIFT;
      this.now_step &= (1 << YM_DELTAT_SHIFT) - 1;
      do {
        if (this.now_addr > (this.end << 1)) {
          if (this.portstate & 0x10) {
            this.now_addr = this.start << 1;
            this.adpcmx = 0;
            this.adpcmd = YM_DELTAT_DELTA_DEF;
            this.next_leveling = 0;
            this.flag = 1;
            this.eos = 0;

          } else {
            this.arrivedFlag |= this.flagMask;
            this.flag = 0;
            this.eos = 1;
            this.adpcml = 0;
            now_leveling = 0;
            return;
          }
        }
        if (this.now_addr & 1) data = this.now_data & 0x0f;
        else {
          this.now_data = this.memory[this.now_addr >> 1];
          data = this.now_data >> 4;
        }
        this.now_addr++;
        old_m = this.adpcmx
        this.adpcmx += (ym_deltat_decode_tableB1[data] * this.adpcmd >> 3);
        if (this.adpcmx > YM_DELTAT_DECODE_MAX) this.adpcmx = YM_DELTAT_DECODE_MAX;
        if (this.adpcmx < YM_DELTAT_DECODE_MIN) this.adpcmx = YM_DELTAT_DECODE_MIN;
        this.adpcmd = (this.adpcmd * ym_deltat_decode_tableB2[data]) >> 6;
        if (this.adpcmd > YM_DELTAT_DELTA_MAX) this.adpcmd = YM_DELTAT_DELTA_MAX;
        if (this.adpcmd < YM_DELTAT_DELTA_MIN) this.adpcmd = YM_DELTAT_DELTA_MIN;
        delta_next = this.adpcmx - old_m;
        now_leveling = this.next_leveling;
        this.next_leveling = old_m + (delta_next >> 1);
      } while (--step);
      this.sample_step = (this.next_leveling - now_leveling) * this.volume_w_step;
      this.adpcml = now_leveling * this.volume;
      this.adpcml += this.sample_step * (this.now_step / this.step | 0);
    }
    this.adpcml += this.sample_step;
    this.connectors[this.pan] += this.adpcml;
  }

  public getState(): any {
    let state: any = {};
    
    state.memory = SaveState.getArrayState(this.memory);
    state.reg = SaveState.getArrayState(this.reg);

    state.portstate = this.portstate;
    state.portshift = this.portshift;
    state.memread = this.memread;

    state.flag = this.flag;
    state.eos = this.eos;
    state.flagMask = this.flagMask;
    state.now_data = this.now_data;
    state.now_addr = this.now_addr;
    state.now_step = this.now_step;
    state.step = this.step;
    state.start = this.start;
    state.end = this.end;
    state.read_pointer = this.read_pointer;
    state.write_pointer = this.write_pointer;
    state.delta = this.delta;
    state.volume = this.volume;
    state.pan = this.pan;
    state.adpcmx = this.adpcmx;
    state.adpcmd = this.adpcmd;
    state.adpcml = this.adpcml;

    state.volume_w_step = this.volume_w_step;
    state.next_leveling = this.next_leveling;
    state.sample_step = this.sample_step;

    state.arrivedFlag = this.arrivedFlag;

    return state;
  }

  public setState(state: any): void {
    SaveState.setArrayState(this.memory, state.memory);
    SaveState.setArrayState(this.reg, state.reg);

    this.portstate = state.portstate;
    this.portshift = state.portshift;
    this.memread = state.memread;

    this.flag = state.flag;
    this.eos = state.eos;
    this.flagMask = state.flagMask;
    this.now_data = state.now_data;
    this.now_addr = state.now_addr;
    this.now_step = state.now_step;
    this.step = state.step;
    this.start = state.start;
    this.end = state.end;
    this.read_pointer = state.read_pointer;
    this.write_pointer = state.write_pointer;
    this.delta = state.delta;
    this.volume = state.volume;
    this.pan = state.pan;
    this.adpcmx = state.adpcmx;
    this.adpcmd = state.adpcmd;
    this.adpcml = state.adpcml;

    this.volume_w_step = state.volume_w_step;
    this.next_leveling = state.next_leveling;
    this.sample_step = state.sample_step;

    this.arrivedFlag = state.arrivedFlag;
  }

  private memory = new Uint8Array(0);
  public freqbase = 0;
  public output_range = 0;

  private reg = new Uint8Array(16);
  private portstate = 0;
  public portshift = 0;
  private memread = 0;

  public flag = 0;
  public eos = 0;
  private flagMask = 0;
  private now_data = 0;
  private now_addr = 0;
  private now_step = 0;
  private step = 0;
  private start = 0;
  private end = 0;
  private read_pointer = 0;
  private write_pointer = 0;
  private delta = 0;
  private volume = 0;
  private pan = 0;
  private adpcmx = 0;
  private adpcmd = 0;
  private adpcml = 0;

  private volume_w_step = 0;
  private next_leveling = 0;
  private sample_step = 0;

  private arrivedFlag = 0;
};



const PI = 3.14159265358979323846;

const OPL_ARRATE = 141280;
const OPL_DRRATE = 1956000;

const DELTAT_MIXING_LEVEL = 1;

const FREQ_BITS = 24;

const FREQ_RATE = 1 << (FREQ_BITS - 20);
const TL_BITS = FREQ_BITS + 2;

const OPL_OUTSB = TL_BITS + 3 - 16;
const OPL_MAXOUT = 0x7fff << OPL_OUTSB;
const OPL_MINOUT = -0x8000 << OPL_OUTSB;

const SIN_ENT = 2048;
const ENV_BITS = 16;
const EG_ENT = 4096;
const EG_OFF = (2 * EG_ENT) << ENV_BITS;
const EG_DED = EG_OFF;
const EG_DST = EG_ENT << ENV_BITS;
const EG_AED = EG_DST;
const EG_AST = 0;
const EG_STEP = 96.0 / EG_ENT;
const VIB_ENT = 512;
const VIB_SHIFT = 32 - 13;
const VIB_MASK = (1 << 28) - 1; 
const AMS_ENT	= 512;
const AMS_SHIFT = 32 - 13;
const AMS_MASK = (1 << 28) - 1;
const VIB_RATE = 256;

const SLOT1 = 0;
const SLOT2 = 1;

const ENV_MOD_RR = 0x00;
const ENV_MOD_DR = 0x01;
const ENV_MOD_AR = 0x02;

const OPL_TYPE_WAVESEL = 0x01;
const OPL_TYPE_ADPCM = 0x02;
const OPL_TYPE_KEYBOARD = 0x04; 
const OPL_TYPE_IO = 0x08;

const slot_array = [
  0, 2, 4, 1, 3, 5, - 1, -1,
  6, 8, 10, 7, 9, 11, -1, -1,
  12, 14, 16, 13, 15, 17, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1
];

const DV = EG_STEP / 2;
const KSL_TABLE = [
  /* OCT 0 */
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0,
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0,
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0,
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0,
  /* OCT 1 */
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0,
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0,
  0.000 / DV | 0, 0.750 / DV | 0, 1.125 / DV | 0, 1.500 / DV | 0,
  1.875 / DV | 0, 2.250 / DV | 0, 2.625 / DV | 0, 3.000 / DV | 0,
  /* OCT 2 */
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0,
  0.000 / DV | 0, 1.125 / DV | 0, 1.875 / DV | 0, 2.625 / DV | 0,
  3.000 / DV | 0, 3.750 / DV | 0, 4.125 / DV | 0, 4.500 / DV | 0,
  4.875 / DV | 0, 5.250 / DV | 0, 5.625 / DV | 0, 6.000 / DV | 0,
  /* OCT 3 */
  0.000 / DV | 0, 0.000 / DV | 0, 0.000 / DV | 0, 1.875 / DV | 0,
  3.000 / DV | 0, 4.125 / DV | 0, 4.875 / DV | 0, 5.625 / DV | 0,
  6.000 / DV | 0, 6.750 / DV | 0, 7.125 / DV | 0, 7.500 / DV | 0,
  7.875 / DV | 0, 8.250 / DV | 0, 8.625 / DV | 0, 9.000 / DV | 0,
  /* OCT 4 */
  0.000 / DV | 0, 0.000 / DV | 0, 3.000 / DV | 0, 4.875 / DV | 0,
  6.000 / DV | 0, 7.125 / DV | 0, 7.875 / DV | 0, 8.625 / DV | 0,
  9.000 / DV | 0, 9.750 / DV | 0, 10.125 / DV | 0, 10.500 / DV | 0,
  10.875 / DV | 0, 11.250 / DV | 0, 11.625 / DV | 0, 12.000 / DV | 0,
  /* OCT 5 */
  0.000 / DV | 0, 3.000 / DV | 0, 6.000 / DV | 0, 7.875 / DV | 0,
  9.000 / DV | 0, 10.125 / DV | 0, 10.875 / DV | 0, 11.625 / DV | 0,
  12.000 / DV | 0, 12.750 / DV | 0, 13.125 / DV | 0, 13.500 / DV | 0,
  13.875 / DV | 0, 14.250 / DV | 0, 14.625 / DV | 0, 15.000 / DV | 0,
  /* OCT 6 */
  0.000 / DV | 0, 6.000 / DV | 0, 9.000 / DV | 0, 10.875 / DV | 0,
  12.000 / DV | 0, 13.125 / DV | 0, 13.875 / DV | 0, 14.625 / DV | 0,
  15.000 / DV | 0, 15.750 / DV | 0, 16.125 / DV | 0, 16.500 / DV | 0,
  16.875 / DV | 0, 17.250 / DV | 0, 17.625 / DV | 0, 18.000 / DV | 0,
  /* OCT 7 */
  0.000 / DV | 0, 9.000 / DV | 0, 12.000 / DV | 0, 13.875 / DV | 0,
  15.000 / DV | 0, 16.125 / DV | 0, 16.875 / DV | 0, 17.625 / DV | 0,
  18.000 / DV | 0, 18.750 / DV | 0, 19.125 / DV | 0, 19.500 / DV | 0,
  19.875 / DV | 0, 20.250 / DV | 0, 20.625 / DV | 0, 21.000 / DV | 0
];

function SC(db: number): number {
  return (db * ((3 / EG_STEP) * (1 << ENV_BITS))) + EG_DST | 0;
}

const SL_TABLE = [
  SC(0), SC(1), SC(2), SC(3), SC(4), SC(5), SC(6), SC(7),
  SC(8), SC(9), SC(10), SC(11), SC(12), SC(13), SC(14), SC(31)
];

const TL_MAX = EG_ENT * 2;

let TL_TABLE: Int32Array;
let SIN_TABLE: Int32Array;
let AMS_TABLE: Int32Array;
let VIB_TABLE: Int32Array;
let ENV_CURVE = new Int32Array(2 * EG_ENT + 1);

const ML = 2;

const MUL_TABLE = [
  0.50 * ML | 0, 1.00 * ML | 0, 2.00 * ML | 0, 3.00 * ML | 0,
  4.00 * ML | 0, 5.00 * ML | 0, 6.00 * ML | 0, 7.00 * ML | 0,
  8.00 * ML | 0, 9.00 * ML | 0, 10.00 * ML | 0, 10.00 * ML | 0,
  12.00 * ML | 0, 12.00 * ML | 0, 15.00 * ML | 0, 15.00 * ML | 0
];

const WHITE_NOISE_db = 6.0;

enum Connector { OUTD = 0, AMS = 1, VIB = 2, FEEDBACK2 = 3 };

function OPLOpenTable(): void {
  TL_TABLE = new Int32Array(TL_MAX * 2);
  SIN_TABLE = new Int32Array(SIN_ENT * 4);
  AMS_TABLE = new Int32Array(AMS_ENT * 2);
  VIB_TABLE = new Int32Array(VIB_ENT * 2);

  for (let t = 0; t < EG_ENT - 1; t++) {
    const rate = ((1 << TL_BITS) - 1) / Math.pow(10, EG_STEP * t / 20);
    TL_TABLE[t] = rate | 0;
    TL_TABLE[TL_MAX + t] = -TL_TABLE[t];
  }

  for (let t = EG_ENT - 1; t < TL_MAX; t++) {
    TL_TABLE[t] = TL_TABLE[TL_MAX + t] = 0;
  }

  const log10 = Math.log(10);
  SIN_TABLE[0] = SIN_TABLE[SIN_ENT >> 1] = EG_ENT - 1;
  for (let s = 1; s <= (SIN_ENT >> 2); s++) {
    let pom = Math.sin(2 * Math.PI * s / SIN_ENT);
    pom = 20 * Math.log(1 / pom) / log10;
    const j = pom / EG_STEP | 0;

    SIN_TABLE[s] = SIN_TABLE[(SIN_ENT >> 1) - s] = j;
    SIN_TABLE[(SIN_ENT >> 1) + s] = SIN_TABLE[SIN_ENT - s] = TL_MAX + j;
  }
  for (let s = 0; s < SIN_ENT; s++) {
    SIN_TABLE[SIN_ENT * 1 + s] = s < (SIN_ENT >> 1) ? SIN_TABLE[s] : EG_ENT;
    SIN_TABLE[SIN_ENT * 2 + s] = SIN_TABLE[s % (SIN_ENT >> 1)];
    SIN_TABLE[SIN_ENT * 3 + s] = (s / (SIN_ENT >> 2)) & 1 ? EG_ENT : SIN_TABLE[SIN_ENT * 2 + s];
  }

  for (let i = 0; i < EG_ENT; i++) {
    const pom = Math.pow(((EG_ENT - 1 - i) / EG_ENT), 8) * EG_ENT;
    ENV_CURVE[i] = pom | 0;
    ENV_CURVE[(EG_DST >> ENV_BITS) + i] = i;
  }
  ENV_CURVE[EG_OFF >> ENV_BITS] = EG_ENT - 1;
  for (let i = 0; i < AMS_ENT; i++) {
    const pom = (1.0 + Math.sin(2 * Math.PI * i / AMS_ENT)) / 2;
    AMS_TABLE[i] = (1.0 / EG_STEP) * pom | 0;
    AMS_TABLE[AMS_ENT + i] = (4.8 / EG_STEP) * pom | 0;
  }

  for (let i = 0; i < VIB_ENT; i++) {
    const pom = VIB_RATE * 0.06 * Math.sin(2 * Math.PI * i / VIB_ENT);
    VIB_TABLE[i] = VIB_RATE + (pom * 0.07) | 0;
    VIB_TABLE[VIB_ENT + i] = VIB_RATE + (pom * 0.14) | 0;
  }
}

function Limit(val: number, max: number, min: number): number {
  if (val > max)
    val = max;
  else if (val < min)
    val = min;

  return val;
}

class OPL_SLOT {
  constructor(
    private connectors: Int32Array
  ) { }

  public OP_OUT(env: number, con: number) {
    if (this.Cnt + con > 0xffffffff) {
      this.Cnt -= 0x100000000;
    }
    const sinIndex = this.wavetableidx + (((this.Cnt + con) / (0x1000000 / SIN_ENT | 0)) & (SIN_ENT - 1)) | 0;

    return TL_TABLE[SIN_TABLE[sinIndex] + env];
  }

  public OPL_KEYON(): void {
    this.Cnt = 0;
    this.evm = ENV_MOD_AR;
    this.evs = this.evsa;
    this.evc = EG_AST;
    this.eve = EG_AED;
  }

  public OPL_KEYOFF() {
    if (this.evm > ENV_MOD_RR) {
      this.evm = ENV_MOD_RR;
      if (!(this.evc & EG_DST))
        this.evc = EG_DST;
      this.eve = EG_DED;
      this.evs = this.evsr;
    }
  }

  public OPL_CALC_SLOT(): number {
    if ((this.evc+= this.evs) >= this.eve	)
    {
      switch (this.evm) {
        case ENV_MOD_AR:
          this.evm =	ENV_MOD_DR;
          this.evc =	EG_DST;
          this.eve =	this.SL;
          this.evs =	this.evsd;
          break;
        case ENV_MOD_DR:
          this.evc =	this.SL;
          this.eve =	EG_DED;
          if (this.eg_typ) {
            this.evs =	0;
          }
          else {
            this.evm =	ENV_MOD_RR;
            this.evs =	this.evsr;
          }
          break;
        case ENV_MOD_RR:
          this.evc =	EG_OFF;
          this.eve =	EG_OFF + 1;
          this.evs =	0;
          break;
      }
    }

    return this.TLL + ENV_CURVE[this.evc >> ENV_BITS] + (this.ams ? this.connectors[Connector.AMS] : 0);
  }

  public getState(): any {
    let state: any = {};

    state.TL = this.TL;
    state.TLL = this.TLL;
    state.KSR = this.KSR;
    state.AR = this.AR;
    state.DR = this.DR;
    state.SL = this.SL;
    state.RR = this.RR;
    state.ksl = this.ksl;
    state.ksr = this.ksr;
    state.mul = this.mul;
    state.Cnt = this.Cnt;
    state.Incr = this.Incr;
    state.eg_typ = this.eg_typ;
    state.evm = this.evm;
    state.evc = this.evc;
    state.eve = this.eve;
    state.evs = this.evs;
    state.evsa = this.evsa;
    state.evsd = this.evsd;
    state.evsr = this.evsr;
    state.ams = this.ams;
    state.vib = this.vib;
    state.wavetableidx = this.wavetableidx;

    return state;
  }

  public setState(state: any): void {
    this.TL = state.TL;
    this.TLL = state.TLL;
    this.KSR = state.KSR;
    this.AR = state.AR;
    this.DR = state.DR;
    this.SL = state.SL;
    this.RR = state.RR;
    this.ksl = state.ksl;
    this.ksr = state.ksr;
    this.mul = state.mul;
    this.Cnt = state.Cnt;
    this.Incr = state.Incr;
    this.eg_typ = state.eg_typ;
    this.evm = state.evm;
    this.evc = state.evc;
    this.eve = state.eve;
    this.evs = state.evs;
    this.evsa = state.evsa;
    this.evsd = state.evsd;
    this.evsr = state.evsr;
    this.ams = state.ams;
    this.vib = state.vib;
    this.wavetableidx = state.wavetableidx;
  }

  public TL = 0;		/* total level     :TL << 8            */
  public TLL = 0;		/* adjusted now TL                     */
  public KSR = 0;		/* key scale rate  :(shift down bit)   */
  public AR = 0;		/* attack rate     :&AR_TABLE[AR<<2]   */
  public DR = 0;		/* decay rate      :&DR_TALBE[DR<<2]   */
  public SL = 0;		/* sustin level    :SL_TALBE[SL]       */
  public RR = 0;		/* release rate    :&DR_TABLE[RR<<2]   */
  public ksl = 0;		/* keyscale level  :(shift down bits)  */
  public ksr = 0;		/* key scale rate  :kcode>>KSR         */
  public mul = 0;		/* multiple        :ML_TABLE[ML]       */
  public Cnt = 0;		/* frequency count :                   */
  public Incr = 0;	/* frequency step  :                   */
  /* envelope generator state */
  public eg_typ = 0;	/* envelope type flag                  */
  public evm = 0;		/* envelope phase                      */
  public evc = 0;		/* envelope counter                    */
  public eve = 0;		/* envelope counter end point          */
  public evs = 0;		/* envelope counter step               */
  public evsa = 0;	/* envelope step for AR :AR[ksr]       */
  public evsd = 0;	/* envelope step for DR :DR[ksr]       */
  public evsr = 0;	/* envelope step for RR :RR[ksr]       */
  /* LFO */
  public ams = 0;		/* ams flag                            */
  public vib = 0;		/* vibrate flag                        */
  /* wave selector */
  public wavetableidx = 0;
};

class OPL_CH {
  constructor(
    private connectors: Int32Array
  ) {
  }

  public OPL_CALC_CH(): void {
    let env_out = 0;
    this.connectors[Connector.FEEDBACK2] = 0;
    /* SLOT	1 */
    let SLOT = this.SLOT[SLOT1];
    env_out = SLOT.OPL_CALC_SLOT();
    if (env_out < EG_ENT - 1) {
      /* PG */
      if (SLOT.vib) SLOT.Cnt += (SLOT.Incr * this.connectors[Connector.VIB] / VIB_RATE | 0);
      else SLOT.Cnt += SLOT.Incr;
      /* connectoion */
      if (this.FB) {
        const feedback1 = (this.op1_out[0] + this.op1_out[1]) >> this.FB;
        this.op1_out[1] = this.op1_out[0];
        this.connectors[this.CON ? Connector.OUTD : Connector.FEEDBACK2] += this.op1_out[0] = SLOT.OP_OUT(env_out, feedback1);
      }
      else {
        this.connectors[this.CON ? Connector.OUTD : Connector.FEEDBACK2] += SLOT.OP_OUT(env_out, 0);
      }
    } else {
      this.op1_out[1] = this.op1_out[0];
      this.op1_out[0] = 0;
    }
    /* SLOT	2 */
    SLOT = this.SLOT[SLOT2];
    env_out = SLOT.OPL_CALC_SLOT();
    if (env_out < EG_ENT - 1) {
      /* PG */
      if (SLOT.vib) SLOT.Cnt += (SLOT.Incr * this.connectors[Connector.VIB] / VIB_RATE | 0);
      else SLOT.Cnt += SLOT.Incr;
      /* connectoion */
      this.connectors[Connector.OUTD] += SLOT.OP_OUT(env_out, this.connectors[Connector.FEEDBACK2]);
    }
  }

  public CSMKeyControll(): void {
    const slot1 = this.SLOT[SLOT1];
    const slot2 = this.SLOT[SLOT2];

    slot1.OPL_KEYOFF();
    slot2.OPL_KEYOFF();

    slot1.TLL = slot1.TL + (this.ksl_base >> slot1.ksl);
    slot2.TLL = slot2.TL + (this.ksl_base >> slot2.ksl);

    this.op1_out[0] = this.op1_out[1] = 0;
    slot1.OPL_KEYON();
    slot2.OPL_KEYON();
  }

  public getState(): any {
    let state: any = {};

    state.SLOT = []
    for (let i = 0; i < this.SLOT.length; i++) {
      state.SLOT[i] = this.SLOT[i].getState();
    }

    state.CON = this.CON;
    state.FB = this.FB;
    state.op1_out = SaveState.getArrayState(this.op1_out);
    state.block_fnum = this.block_fnum;
    state.kcode = this.kcode;
    state.fc = this.fc;
    state.ksl_base = this.ksl_base;
    state.keyon = this.keyon;

    return state;
  }

  public setState(state: any): void {
    for (let i = 0; i < this.SLOT.length; i++) {
      this.SLOT[i].setState(state.SLOT[i]);
    }

    this.CON = state.CON;
    this.FB = state.FB;
    SaveState.setArrayState(this.op1_out, state.op1_out);
    this.block_fnum = state.block_fnum;
    this.kcode = state.kcode;
    this.fc = state.fc;
    this.ksl_base = state.ksl_base;
    this.keyon = state.keyon;
  }

  public SLOT = [new OPL_SLOT(this.connectors), new OPL_SLOT(this.connectors)];
  public CON = 0;			/* connection type                     */
  public FB = 0;			/* feed back       :(shift down bit)   */
  public op1_out = [0, 0];	/* slot1 output for selfeedback        */
  /* phase generator state */
  public block_fnum = 0;	/* block+fnum      :                   */
  public kcode = 0;		/* key code        : KeyScaleCode      */
  public fc = 0;			/* Freq. Increment base                */
  public ksl_base = 0;	/* KeyScaleLevel Base step             */
  public keyon = 0;		/* key on/off flag                     */

};

class FM_OPL {
  constructor(
    private board: Board,
    clock: number,
    rate: number,
    sampleram: number,
    private setTimer: (timer: number, count: number) => void,
    private startTimer: (timer: number, start: boolean) => void,
    private getNoteOn: (kbdLatch: number) => number,
    private getAudioSwitch: () => boolean
  ) {
    OPLOpenTable();

    for (let i = 0; i < this.P_CH.length; i++) {
      this.P_CH[i] = new OPL_CH(this.connectors);
    }

    this.deltat.initSampleRam(1024 * sampleram);
    this.clock = clock;
    this.rate = rate;
    this.baseRate = rate;

    this.initialize();
    this.reset();
  }

  public write(a: number, v: number): number {
    if (!(a & 1)) {	
      this.address = v & 0xff;
    }
    else {	/* data	port */
      this.writeReg(this.address, v);
    }
    return this.status >> 7;
  }

  public read(a: number): number {
    if (!(a & 1)) {
      this.OPL_STATUS_SET(0x08);

      if (this.deltat.eos) {
        this.OPL_STATUS_SET(0x10);
      }
      else {
        this.OPL_STATUS_RESET(0x10);
      }
      return (this.status & (0x80 | this.statusmask)) | 6;
    }

    switch (this.address) {
      case 0x05:
        return this.getNoteOn(this.reg6);
      case 0x14:
        return this.deltat.read2();
      case 0x0f:
        return this.deltat.read();
      case 0x13:
      case 0x1a:
        return 0;
      case 0x19: /* I/O DATA	  */
        return ~(this.getAudioSwitch() ? 0 : 0x04);
    }
    return 0xff;
  }

  public timerOver(c: number): number {
    if (c) {
      this.OPL_STATUS_SET(0x20);
    }
    else {
      this.OPL_STATUS_SET(0x40);
      if (this.mode & 0x80) {
        for (let ch = 0; ch < 9; ch++)
          this.P_CH[ch].CSMKeyControll();
      }
    }

    return this.status >> 7;
  }

  private initialize(): void {
    if (this.baseRate == (this.clock / 72 | 0)) {
      this.freqbase = this.baseRate / this.rate;
      this.TimerBase = 1.0 / this.baseRate;
    }
    else {
      this.freqbase = (this.rate) ? (this.clock / this.rate) / 72 : 0;
      this.TimerBase = 1.0 / (this.clock / 72.0);
    }

    this.init_timetables(OPL_ARRATE, OPL_DRRATE);
    for (let fn = 0; fn < 1024; fn++) {
      this.FN_TABLE[fn] = this.freqbase * fn * FREQ_RATE * (1 << 7) / 2 | 0;
    }
    this.amsIncr = (this.rate ? AMS_ENT * (1 << AMS_SHIFT) / this.rate * 3.7 * (this.clock / 3600000) : 0) | 0;
    this.vibIncr = (this.rate ? VIB_ENT * (1 << VIB_SHIFT) / this.rate * 6.4 * (this.clock / 3600000) : 0) | 0;
  }

  private writeReg(r: number, v: number): void {
    this.regs[r & 0xff] = v;

    switch (r & 0xe0) {
      case 0x00:
        switch (r & 0x1f) {
          case 0x01:
            if (this.type & OPL_TYPE_WAVESEL) {
              this.wavesel = v & 0x20;
              if (!this.wavesel) {
                for (let c = 0; c < this.P_CH.length; c++) {
                  this.P_CH[c].SLOT[SLOT1].wavetableidx = 0;
                  this.P_CH[c].SLOT[SLOT2].wavetableidx = 0;
                }
              }
            }
            return;
          case 0x02:
            this.setTimer(0, 1 * (256 - v));
            break;
          case 0x03:
            this.setTimer(1, 4 * (256 - v));
            return;
          case 0x04:
            if (v & 0x80) {	/* IRQ flag	clear */
              this.OPL_STATUS_RESET(0x7f);
            }
            else {
              this.OPL_STATUS_RESET(v & 0x78);
              this.OPL_STATUSMASK_SET(((~v) & 0x78) | 0x01);

              this.startTimer(0, (v & 1) != 0);
              this.startTimer(1, (v & 2) != 0);
            }
            return;
          case 0x06:
            if (this.type & OPL_TYPE_KEYBOARD) {
              this.reg6 = v;
            }
            return;
          case 0x07:
            if (this.type & OPL_TYPE_ADPCM)
              this.deltat.write(r - 0x07, v);
            return;
          case 0x08:
            this.mode = v;
            v &= 0x1f;
          case 0x09:
          case 0x0a:
          case 0x0b:
          case 0x0c:
          case 0x0d:
          case 0x0e:
          case 0x0f:
          case 0x10:
          case 0x11:
          case 0x12:
            if (this.type & OPL_TYPE_ADPCM)
              this.deltat.write(r - 0x07, v);
            return;
          case 0x15:
            this.reg15 = v;
            if (this.mode & 0x04) {
              const damp = [256, 279, 304, 332, 362, 395, 431, 470];
              let sample = (256 * this.reg15 + this.reg16) * 128 / damp[this.reg17] | 0;
              if (sample > 0x7fff) sample -= 0x10000;
              this.dacSampleVolume = sample;
            }
          case 0x16:
            this.reg16 = v & 0xc0;
            return;
          case 0x17:
            this.reg17 = v & 0x07;
            return;
          case 0x18:
            if (this.type & OPL_TYPE_IO)
              this.portDirection = v & 0x0f;
            return;
          case 0x19:
            if (this.type & OPL_TYPE_IO) {
              this.portLatch = v;
            }
            return;
          case 0x1a:
            return;
        }
        break;
      case 0x20:
        {
          const slot = slot_array[r & 0x1f];
          if (slot == -1) return;
          this.set_mul(slot, v);
        }
        return;
      case 0x40:
        {
          const slot = slot_array[r & 0x1f];
          if (slot == -1) return;
          this.set_ksl_tl(slot, v);
        }
        return;
      case 0x60:
        {
          const slot = slot_array[r & 0x1f];
          if (slot == -1) return;
          this.set_ar_dr(slot, v);
        }
        return;
      case 0x80:
        {
          const slot = slot_array[r & 0x1f];
          if (slot == -1) return;
          this.set_sl_rr(slot, v);
        }
        return;
      case 0xa0:
        switch (r) {
          case 0xbd:
            {
              const rkey = this.rythm ^ v;
              this.ams_table_idx = v & 0x80 ? AMS_ENT : 0;
              this.vib_table_idx = v & 0x40 ? VIB_ENT : 0;
              this.rythm = v & 0x3f;
              if (this.rythm & 0x20) {
                if (rkey & 0x10) {
                  if (v & 0x10) {
                    this.P_CH[6].op1_out[0] = this.P_CH[6].op1_out[1] = 0;
                    this.P_CH[6].SLOT[SLOT1].OPL_KEYON();
                    this.P_CH[6].SLOT[SLOT2].OPL_KEYON();
                  }
                  else {
                    this.P_CH[6].SLOT[SLOT1].OPL_KEYOFF();
                    this.P_CH[6].SLOT[SLOT2].OPL_KEYOFF();
                  }
                }
                /* SD key on/off */
                if (rkey & 0x08) {
                  if (v & 0x08) this.P_CH[7].SLOT[SLOT2].OPL_KEYON();
                  else this.P_CH[7].SLOT[SLOT2].OPL_KEYOFF();
                }/*	TAM	key	on/off */
                if (rkey & 0x04) {
                  if (v & 0x04) this.P_CH[8].SLOT[SLOT1].OPL_KEYON();
                  else this.P_CH[8].SLOT[SLOT1].OPL_KEYOFF();
                }
                /* TOP-CY key on/off */
                if (rkey & 0x02) {
                  if (v & 0x02) this.P_CH[8].SLOT[SLOT2].OPL_KEYON();
                  else this.P_CH[8].SLOT[SLOT2].OPL_KEYOFF();
                }
                /* HH key on/off */
                if (rkey & 0x01) {
                  if (v & 0x01) this.P_CH[7].SLOT[SLOT1].OPL_KEYON();
                  else this.P_CH[7].SLOT[SLOT1].OPL_KEYOFF();
                }
              }
            }
            return;
        }

        if ((r & 0x0f) > 8) return;
        let CH_NUM = r & 0x0f;
        let CH = this.P_CH[CH_NUM];
        let block_fnum = 0;
        if (!(r & 0x10)) {
          block_fnum = (CH.block_fnum & 0x1f00) | v;
        }
        else {
          const keyon = (v >> 5) & 1;
          block_fnum = ((v & 0x1f) << 8) | (CH.block_fnum & 0xff);
          if (CH.keyon != keyon) {
            if ((CH.keyon = keyon)) {
              CH.op1_out[0] = CH.op1_out[1] = 0;
              CH.SLOT[SLOT1].OPL_KEYON();
              CH.SLOT[SLOT2].OPL_KEYON();
            }
            else {
              CH.SLOT[SLOT1].OPL_KEYOFF();
              CH.SLOT[SLOT2].OPL_KEYOFF();
            }
          }
        }

        if (CH.block_fnum != block_fnum) {
          const blockRv = 7 - (block_fnum >> 10);
          const fnum = block_fnum & 0x3ff;
          CH.block_fnum = block_fnum;

          CH.ksl_base = KSL_TABLE[block_fnum >> 6];
          CH.fc = this.FN_TABLE[fnum] >> blockRv;
          CH.kcode = CH.block_fnum >> 9;
          if ((this.mode & 0x40) && CH.block_fnum & 0x100) CH.kcode |= 1;
          this.CALC_FCSLOT(CH_NUM, SLOT1);
          this.CALC_FCSLOT(CH_NUM, SLOT2);
        }
        return;
      case 0xc0:
        {
          if ((r & 0x0f) > 8) return;
          let CH = this.P_CH[r & 0x0f];
          {
            const feedback = (v >> 1) & 7;
            CH.FB = feedback ? (8 + 1) - feedback : 0;
            CH.CON = v & 1;
          }
        }
        return;
      case 0xe0:
        {
          const slot = slot_array[r & 0x1f];
          if (slot == -1) return;
          let CH = this.P_CH[slot >> 1];
          if (this.wavesel) {
            CH.SLOT[slot & 1].wavetableidx = (v & 0x03) * SIN_ENT;
          }
        }
        return;
    }
  }

  public updateOne() {
    let data = 0;
    let amsCnt = this.amsCnt;
    let vibCnt = this.vibCnt;
    let rythm = this.rythm & 0x20;

    /* rythm slot */
    this.SLOT7_1 = this.P_CH[7].SLOT[SLOT1];
    this.SLOT7_2 = this.P_CH[7].SLOT[SLOT2];
    this.SLOT8_1 = this.P_CH[8].SLOT[SLOT1];
    this.SLOT8_2 = this.P_CH[8].SLOT[SLOT2];
    /* LFO state */
    let amsIncr = this.amsIncr;
    let vibIncr = this.vibIncr;

    let R_CH = rythm ? 6 : 9;
    this.connectors[Connector.AMS] = AMS_TABLE[this.ams_table_idx + ((amsCnt = amsCnt + amsIncr & AMS_MASK) >> AMS_SHIFT)];
    this.connectors[Connector.VIB] = VIB_TABLE[this.vib_table_idx + ((vibCnt = vibCnt + vibIncr & VIB_MASK) >> VIB_SHIFT)];

    this.connectors[Connector.OUTD] = 0;
    let count = this.rate / this.baseRate | 0;
    while (count--) {
      for (let i = 0; i < R_CH; i++)
        this.P_CH[i].OPL_CALC_CH();

      if (rythm)
        this.OPL_CALC_RH();
    }

    this.connectors[Connector.OUTD] = this.connectors[Connector.OUTD] / (this.rate / this.baseRate) | 0;
    this.connectors[Connector.OUTD] += this.dacSampleVolume << 14;

    if (this.deltat.flag)
      this.deltat.calc();
    data = this.connectors[Connector.OUTD];//Limit( outd ,	OPL_MAXOUT,	OPL_MINOUT );
    this.amsCnt = amsCnt;
    this.vibCnt = vibCnt;

    if (!this.deltat.flag)
      this.status &= 0xfe;
    
    return data / (1 << OPL_OUTSB) * 0.5  | 0;
  }

  public reset(): void {
    this.mode = 0;
    this.OPL_STATUS_RESET(0x7f);
    for (let i = 0; i < this.regs.length; i++) {
      this.regs[i] = 0;
    }
    this.writeReg(0x01, 0);
    this.writeReg(0x02, 0);
    this.writeReg(0x03, 0);
    this.writeReg(0x04, 0);
    for (let i = 0xff; i >= 0x20; i--) {
      this.writeReg(i, 0);
    }

    for (let c = 0; c < this.P_CH.length; c++) {
      let CH = this.P_CH[c];
      for (let s = 0; s < 2; s++) {
        CH.SLOT[s].wavetableidx = 0;
        CH.SLOT[s].evc = EG_OFF;
        CH.SLOT[s].eve = EG_OFF + 1;
        CH.SLOT[s].evs = 0;
      }
    }
    this.statusmask = 0;
    if (this.type & OPL_TYPE_ADPCM) {
      this.deltat.freqbase = this.freqbase;
      this.deltat.portshift = 2;
      this.deltat.output_range = DELTAT_MIXING_LEVEL << TL_BITS;
      this.deltat.reset(0);
    }

    this.dacSampleVolume = 0;

    this.reg6 = 0;
    this.reg15 = 0;
    this.reg16 = 0;
    this.reg17 = 0;
  }

  private CALC_FCSLOT(OPL_CH_: number, SLOT_: number): void {
    let CH = this.P_CH[OPL_CH_];
    let SLOT = CH.SLOT[SLOT_];

    SLOT.Incr = CH.fc * SLOT.mul;
    const ksr = CH.kcode >> SLOT.KSR;

    if (SLOT.ksr != ksr) {
      SLOT.ksr = ksr;
      SLOT.evsa = SLOT.AR ? this.AR_TABLE[(SLOT.AR << 2) + ksr] : 0;
      SLOT.evsd = SLOT.DR ? this.DR_TABLE[(SLOT.DR << 2) + ksr] : 0;
      SLOT.evsr = this.DR_TABLE[SLOT.RR + ksr];
    }
    SLOT.TLL = SLOT.TL + (CH.ksl_base >> SLOT.ksl);
  }

  private set_mul(slot: number, v: number): void {
    let ch = slot >> 1;
    slot &= 1;
    let CH = this.P_CH[ch];
    let SLOT = CH.SLOT[slot];

    SLOT.mul = MUL_TABLE[v & 0x0f];
    SLOT.KSR = (v & 0x10) ? 0 : 2;
    SLOT.eg_typ = (v & 0x20) >> 5;
    SLOT.vib = (v & 0x40);
    SLOT.ams = (v & 0x80);
    this.CALC_FCSLOT(ch, slot);
  }

  private set_ksl_tl(slot: number, v: number): void {
    let ch = slot >> 1;
    slot &= 1;
    let CH = this.P_CH[ch];
    let SLOT = CH.SLOT[slot];

    const ksl = v >> 6;	

    SLOT.ksl = ksl ? 3 - ksl : 31;
    SLOT.TL = (v & 0x3f) * (0.75 / EG_STEP) | 0;

    if (!(this.mode & 0x80)) {
      SLOT.TLL = SLOT.TL + (CH.ksl_base >> SLOT.ksl);
    }
  }

  private set_ar_dr(slot: number, v: number): void {
    let ch = slot >> 1;
    slot &= 1;
    let CH = this.P_CH[ch];
    let SLOT = CH.SLOT[slot];

    const ar = v >> 4;
    const dr = v & 0x0f;

    SLOT.AR = ar;
    SLOT.evsa = SLOT.AR ? this.AR_TABLE[(SLOT.AR << 2) + SLOT.ksr] : 0;
    if (SLOT.evm == ENV_MOD_AR) SLOT.evs = SLOT.evsa;

    SLOT.DR = dr;
    SLOT.evsd = SLOT.DR ? this.DR_TABLE[(SLOT.DR << 2) + SLOT.ksr] : 0;
    if (SLOT.evm == ENV_MOD_DR) SLOT.evs = SLOT.evsd;
  }

  private set_sl_rr(slot: number, v: number): void {
    let ch = slot >> 1;
    slot &= 1;
    let CH = this.P_CH[ch];
    let SLOT = CH.SLOT[slot];

    const sl = v >> 4;
    const rr = v & 0x0f;

    SLOT.SL = SL_TABLE[sl];
    if (SLOT.evm == ENV_MOD_DR) SLOT.eve = SLOT.SL;
    SLOT.RR = rr << 2;
    SLOT.evsr = this.DR_TABLE[SLOT.RR + SLOT.ksr];
    if (SLOT.evm == ENV_MOD_RR) SLOT.evs = SLOT.evsr;
  }

  private OPL_STATUS_SET(flag: number): void {
    this.status |= flag;

    if (!(this.status & 0x80)) {
      if (this.status & this.statusmask) {
        this.status |= 0x80;
        this.board.setInt(InterruptVector.MSX_AUDIO);
      }
    }
  }

  private OPL_STATUS_RESET(flag: number): void {
    this.status &= ~flag;
    if ((this.status & 0x80)) {
      if (!(this.status & this.statusmask)) {
        this.status &= 0x7f;
        this.board.clearInt(InterruptVector.MSX_AUDIO);
      }
    }
  }

  private OPL_STATUSMASK_SET(flag: number): void {
    this.statusmask = flag;
    this.OPL_STATUS_SET(0);
    this.OPL_STATUS_RESET(0);
  }
  
  public OPL_CALC_RH(): void {
    const whitenoise = ((Math.random() * 0xfffffff & 1) * (WHITE_NOISE_db / EG_STEP | 0)) | 0;

    this.connectors[Connector.FEEDBACK2] = 0;
    let CH = this.P_CH;
    let SLOT = CH[6].SLOT[SLOT1];
    let env_out = SLOT.OPL_CALC_SLOT();
    if (env_out < EG_ENT - 1) {
      if (SLOT.vib) SLOT.Cnt += (SLOT.Incr * this.connectors[Connector.VIB] / VIB_RATE | 0);
      else SLOT.Cnt += SLOT.Incr;
      if (CH[6].FB) {
        let feedback1 = (CH[6].op1_out[0] + CH[6].op1_out[1]) >> CH[6].FB;
        CH[6].op1_out[1] = CH[6].op1_out[0];
        this.connectors[Connector.FEEDBACK2] = CH[6].op1_out[0] = SLOT.OP_OUT(env_out, feedback1);
      }
      else {
        this.connectors[Connector.FEEDBACK2] = SLOT.OP_OUT(env_out, 0);
      }
    } else {
      this.connectors[Connector.FEEDBACK2] = 0;
      CH[6].op1_out[1] = CH[6].op1_out[0];
      CH[6].op1_out[0] = 0;
    }
    SLOT = CH[6].SLOT[SLOT2];
    env_out = SLOT.OPL_CALC_SLOT();
    if (env_out < EG_ENT - 1) {
      if (SLOT.vib) SLOT.Cnt += (SLOT.Incr * this.connectors[Connector.VIB] / VIB_RATE) | 0;
      else SLOT.Cnt += SLOT.Incr;
      this.connectors[Connector.OUTD] += SLOT.OP_OUT(env_out, this.connectors[Connector.FEEDBACK2]) * 2;
    }

    const env_sd = this.SLOT7_2!.OPL_CALC_SLOT() + whitenoise;
    const env_tam = this.SLOT8_1!.OPL_CALC_SLOT();
    const env_top = this.SLOT8_2!.OPL_CALC_SLOT();
    const env_hh = this.SLOT7_1!.OPL_CALC_SLOT() + whitenoise;

    if (this.SLOT7_1!.vib) this.SLOT7_1!.Cnt += (2 * this.SLOT7_1!.Incr * this.connectors[Connector.VIB] / VIB_RATE | 0);
    else this.SLOT7_1!.Cnt += 2 * this.SLOT7_1!.Incr;
    if (this.SLOT7_2!.vib) this.SLOT7_2!.Cnt += ((CH[7].fc * 8) * this.connectors[Connector.VIB] / VIB_RATE | 0);
    else this.SLOT7_2!.Cnt += (CH[7].fc * 8);
    if (this.SLOT8_1!.vib) this.SLOT8_1!.Cnt += (this.SLOT8_1!.Incr * this.connectors[Connector.VIB] / VIB_RATE | 0);
    else this.SLOT8_1!.Cnt += this.SLOT8_1!.Incr;
    if (this.SLOT8_2!.vib) this.SLOT8_2!.Cnt += ((CH[8].fc * 48) * this.connectors[Connector.VIB] / VIB_RATE | 0);
    else this.SLOT8_2!.Cnt += (CH[8].fc * 48) | 0;

    const tone8 = this.SLOT8_2!.OP_OUT(whitenoise, 0);

    /* SD */
    if (env_sd < EG_ENT - 1)
      this.connectors[Connector.OUTD] += this.SLOT7_1!.OP_OUT(env_sd, 0) * 8;
    /* TAM */
    if (env_tam < EG_ENT - 1)
      this.connectors[Connector.OUTD] += this.SLOT8_1!.OP_OUT(env_tam, 0) * 2;
    /* TOP-CY */
    if (env_top < EG_ENT - 1)
      this.connectors[Connector.OUTD] += this.SLOT7_2!.OP_OUT(env_top, tone8) * 2;
    /* HH */
    if (env_hh < EG_ENT - 1)
      this.connectors[Connector.OUTD] += this.SLOT7_2!.OP_OUT(env_hh, tone8) * 2;
  }

  public init_timetables(ARRATE: number, DRRATE: number) {
    for (let i = 0; i < 4; i++) this.AR_TABLE[i] = this.DR_TABLE[i] = 0;
    for (let i = 4; i <= 60; i++) {
      let rate = this.freqbase;
      if (i < 60) rate *= 1.0 + (i & 3) * 0.25;
      rate *= 1 << ((i >> 2) - 1);
      rate *= EG_ENT << ENV_BITS;
      this.AR_TABLE[i] = rate / ARRATE | 0;
      this.DR_TABLE[i] = rate / DRRATE | 0;
    }
    for (let i = 60; i < 76; i++) {
      this.AR_TABLE[i] = EG_AED - 1;
      this.DR_TABLE[i] = this.DR_TABLE[60];
    }
  }

  public getState(): any {
    let state: any = {};

    state.connectors = SaveState.getArrayState(this.connectors);
    state.deltat = this.deltat.getState();
    state.P_CH = [];
    for (let i = 0; i < this.P_CH.length; i++) {
      state.P_CH[i] = this.P_CH[i].getState();
    }
    state.clock = this.clock;
    state.rate = this.rate;
    state.baseRate = this.baseRate;
    state.freqbase = this.freqbase;
    state.TimerBase = this.TimerBase;

    state.address = this.address;
    state.status = this.status;
    state.statusmask = this.statusmask;
    state.mode = this.mode;
    state.rythm = this.rythm;
    state.portDirection = this.portDirection;
    state.portLatch = this.portLatch;
    state.ams_table_idx = this.ams_table_idx;
    state.vib_table_idx = this.vib_table_idx;
    state.amsCnt = this.amsCnt;
    state.amsIncr = this.amsIncr;
    state.vibCnt = this.vibCnt;
    state.vibIncr = this.vibIncr;
    state.wavesel = this.wavesel;

    state.dacSampleVolume = this.dacSampleVolume;

    state.regs = SaveState.getArrayState(this.regs);
    state.reg6 = this.reg6;
    state.reg15 = this.reg15;
    state.reg16 = this.reg16;
    state.reg17 = this.reg17;

    return state;
  }

  public setState(state: any): void {
    SaveState.setArrayState(this.connectors, state.connectors);
    this.deltat.setState(state.deltat);
    for (let i = 0; i < this.P_CH.length; i++) {
      this.P_CH[i].setState(state.P_CH[i]);
    }
    this.clock = state.clock;
    this.rate = state.rate;
    this.baseRate = state.baseRate;
    this.freqbase = state.freqbase;
    this.TimerBase = state.TimerBase;

    this.address = state.address;
    this.status = state.status;
    this.statusmask = state.statusmask;
    this.mode = state.mode;
    this.rythm = state.rythm;
    this.portDirection = state.portDirection;
    this.portLatch = state.portLatch;
    this.ams_table_idx = state.ams_table_idx;
    this.vib_table_idx = state.vib_table_idx;
    this.amsCnt = state.amsCnt;
    this.amsIncr = state.amsIncr;
    this.vibCnt = state.vibCnt;
    this.vibIncr = state.vibIncr;
    this.wavesel = state.wavesel;

    this.dacSampleVolume = state.dacSampleVolume;

    SaveState.setArrayState(this.regs, state.regs);
    this.reg6 = state.reg6;
    this.reg15 = state.reg15;
    this.reg16 = state.reg16;
    this.reg17 = state.reg17;
  }

  private SLOT7_1?: OPL_SLOT;
  private SLOT7_2?: OPL_SLOT;
  private SLOT8_1?: OPL_SLOT;
  private SLOT8_2?: OPL_SLOT;

  private connectors = new Int32Array(4);
  private deltat = new YM_DELTAT(this.connectors);
  private P_CH = new Array<OPL_CH>(9);
  private clock = 0;
  private rate = 0;
  private baseRate = 0;
  private freqbase = 0;
  private TimerBase = 0;

  private type = OPL_TYPE_ADPCM | OPL_TYPE_KEYBOARD | OPL_TYPE_IO;
  public address = 0;
  private status = 0;
  private statusmask = 0;
  private mode = 0;
  private rythm = 0;
  private portDirection = 0;
  private portLatch = 0;
  private AR_TABLE = new Int32Array(75);
  private DR_TABLE = new Int32Array(75);
  private FN_TABLE = new Uint32Array(1024);
  private ams_table_idx = 0;
  private vib_table_idx = 0;
  private amsCnt = 0;
  private amsIncr = 0;
  private vibCnt = 0;
  private vibIncr = 0;
  private wavesel = 0;

  private dacSampleVolume = 0;

  private regs = new Uint8Array(256);
  private reg6 = 0;
  private reg15 = 0;
  private reg16 = 0;
  private reg17 = 0;
};

const FREQUENCY = 3579545;
const SAMPLERATE = FREQUENCY / 72 | 0;

const regsAvailAY8950 = [
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, // 0x00
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x20
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x40
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x60
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x80
  1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, // 0xa0
  1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0xc0
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1  // 0xe0
];



export class Y8950 extends AudioDevice {
  constructor(private board: Board) {
    super('Y-8950', false);

    this.board.getAudioManager().registerAudioDevice(this);

    this.opl = new FM_OPL(
      this.board, FREQUENCY, SAMPLERATE, 256,
      this.setTimer.bind(this), this.startTimer.bind(this),
      this.getNoteOn.bind(this),
      this.getAudioSwitch.bind(this));
    this.timer1 = board.getTimeoutManager().createTimer('Frame Change', this.onTimer1.bind(this));
    this.timer2 = board.getTimeoutManager().createTimer('Frame Change', this.onTimer2.bind(this));

    this.reset();
  }
  
  public sync(count: number): void {
    const audioBuffer = this.getAudioBufferMono();

    let d = 0;
    for (let i = 0; i < count; i++) {
      if (SAMPLERATE > this.sampleRate) {
        this.off -= SAMPLERATE - this.sampleRate;
        this.s1 = this.s2;
        this.s2 = this.opl.updateOne();
        if (this.off < 0) {
          this.off += this.sampleRate;
          this.s1 = this.s2;
          this.s2 = this.opl.updateOne();
        }
        audioBuffer[i] = ((this.s1 * (this.off >> 8) + this.s2 * ((SAMPLERATE - this.off) >> 8)) / (SAMPLERATE >> 8)) / 32768;
      }
      else {
        audioBuffer[i] = (d=this.opl.updateOne()) / 32768;
      }
    }
  }

  public reset() {
    this.startTimer(0, false);
    this.startTimer(1, false);
    this.opl.reset();
    this.off = 0;
    this.s1 = 0;
    this.s2 = 0;
  }

  public read(ioPort: number): number {
    switch (ioPort & 1) {
      case 0:
        return this.opl.read(0) & 0xff;
      case 1:
        if (this.opl.address == 0x14) {
          this.board.syncAudio();
        }
        return this.opl.read(1) & 0xff;
    }
    return 0xff;
  }

  public write(ioPort: number, value: number): void {
    switch (ioPort & 1) {
      case 0:
        this.opl.write(0, value);
        break;
      case 1:
        this.board.syncAudio();
        this.opl.write(1, value);
        break;
    }
  }

  private getAudioSwitch(): boolean {
    return false;
  }

  private getNoteOn(kbdLatch: number): number {
    let val = 0xff;
    for (let row = 0; row < 8; row++) {
      if ((1 << row) & kbdLatch) {
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 0) ? ~0x01 : 0xff;
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 1) ? ~0x02 : 0xff;
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 2) ? ~0x04 : 0xff;
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 3) ? ~0x08 : 0xff;
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 4) ? ~0x10 : 0xff;
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 5) ? ~0x20 : 0xff;
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 6) ? ~0x40 : 0xff;
//        val &= ykIoGetKeyState(y8950 -> ykIo, Y8950_KEY_START + row * 8 + 7) ? ~0x80 : 0xff;
      }
    }

    return val;

  }

  private setTimer(timer: number, count: number): void {
    if (timer == 0) {
      this.timerValue1 = count;
    }
    else {
      this.timerValue2 = count;
    }
  }

  private startTimer(timer: number, start: boolean): void {
    if (timer == 0) {
      if (start) {
        if (!this.timerRunning1) {
          const TIMER_FREQUENCY = 4 * this.board.getSystemFrequency() / SAMPLERATE;
          const systemTime = this.board.getSystemTime();
          const adjust = systemTime % TIMER_FREQUENCY;
          this.timeout1 = systemTime + TIMER_FREQUENCY * this.timerValue1 - adjust;
          this.timer1.setTimeout(this.timeout1);
          this.timerRunning1 = true;
        }
      }
      else {
        if (this.timerRunning1) {
          this.timer1.stop();
          this.timerRunning1 = false;
        }
      }
    }
    else {
      if (start) {
        if (!this.timerRunning2) {
          const TIMER_FREQUENCY = 4 * this.board.getSystemFrequency() / SAMPLERATE;
          const systemTime = this.board.getSystemTime();
          const adjust = systemTime % (4 * TIMER_FREQUENCY);
          this.timeout2 = systemTime + TIMER_FREQUENCY * this.timerValue2 - adjust;
          this.timer2.setTimeout(this.timeout2);
          this.timerRunning2 = true;
        }
      }
      else {
        if (this.timerRunning2) {
          this.timer1.stop();
          this.timerRunning2 = false;
        }
      }
    }
  }
  
  private onTimer1(time: number): void {
    this.timerRunning1 = false;
    if (this.opl.timerOver(0)) {
      this.startTimer(0, true);
    }
  }

  private onTimer2(time: number): void {
    this.timerRunning1 = false;
    if (this.opl.timerOver(1)) {
      this.startTimer(1, true);
    }
  }

  public getState(): any {
    let state: any = {};

    state.timerValue1 = this.timerValue1;
    state.timerValue2 = this.timerValue2;
    state.timeout1 = this.timeout1;
    state.timeout2 = this.timeout2;
    state.timerRunning1 = this.timerRunning1;
    state.timerRunning2 = this.timerRunning2;
    state.off = this.off;
    state.s1 = this.s1;
    state.s2 = this.s2;

    state.opl = this.opl.getState();
    state.timer1 = this.timer1.getState();
    state.timer2 = this.timer2.getState();

    return state;
  }

  public setState(state: any): void {
    this.timerValue1 = state.timerValue1;
    this.timerValue2 = state.timerValue2;
    this.timeout1 = state.timeout1;
    this.timeout2 = state.timeout2;
    this.timerRunning1 = state.timerRunning1;
    this.timerRunning2 = state.timerRunning2;
    this.off = state.off;
    this.s1 = state.s1;
    this.s2 = state.s2;

    this.opl.setState(state.opl);
    this.timer1.setState(state.timer1);
    this.timer2.setState(state.timer2);
  }

  private opl: FM_OPL;

  private timer1: Timer;
  private timer2: Timer;

  private timerValue1 = 0;
  private timerValue2 = 0;
  private timeout1 = 0;
  private timeout2 = 0;
  private timerRunning1 = false;
  private timerRunning2 = false;
  private off = 0;
  private s1 = 0;
  private s2 = 0;
}
