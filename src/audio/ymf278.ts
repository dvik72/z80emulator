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

import { Board } from '../core/board';


const EG_SH = 16;	// 16.16 fixed point (EG timing)
const EG_TIMER_OVERFLOW = 1 << EG_SH;

// envelope output entries
const ENV_BITS = 10;
const ENV_LEN = 1 << ENV_BITS;
const ENV_STEP = 128.0 / ENV_LEN;
const MAX_ATT_INDEX = (1 << (ENV_BITS - 1)) - 1; //511
const MIN_ATT_INDEX = 0;

// Envelope Generator phases
const EG_ATT = 4;
const EG_DEC = 3;
const EG_SUS = 2;
const EG_REL = 1;
const EG_OFF = 0;

const EG_REV = 5;	//pseudo reverb
const EG_DMP = 6;	//damp

// Pan values, units are -3dB, i.e. 8.
const pan_left = [
  0, 8, 16, 24, 32, 40, 48, 256, 256, 0, 0, 0, 0, 0, 0, 0
];

const pan_right = [
  0, 0, 0, 0, 0, 0, 0, 0, 256, 256, 48, 40, 32, 24, 16, 8
];

// Mixing levels, units are -3dB, and add some marging to avoid clipping
const mix_level = [
  8, 16, 24, 32, 40, 48, 56, 256
];

// decay level table (3dB per step)
// 0 - 15: 0, 3, 6, 9,12,15,18,21,24,27,30,33,36,39,42,93 (dB)
let SC = (db: number) => (db * (2.0 / ENV_STEP) | 0);

const dl_tab = [
  SC(0), SC(1), SC(2), SC(3), SC(4), SC(5), SC(6), SC(7),
  SC(8), SC(9), SC(10), SC(11), SC(12), SC(13), SC(14), SC(31)
];

const RATE_STEPS = 8;
const eg_inc = new Uint8Array([
  //cycle:0 1  2 3  4 5  6 7
  0, 1, 0, 1, 0, 1, 0, 1, //  0  rates 00..12 0 (increment by 0 or 1)
  0, 1, 0, 1, 1, 1, 0, 1, //  1  rates 00..12 1
  0, 1, 1, 1, 0, 1, 1, 1, //  2  rates 00..12 2
  0, 1, 1, 1, 1, 1, 1, 1, //  3  rates 00..12 3

  1, 1, 1, 1, 1, 1, 1, 1, //  4  rate 13 0 (increment by 1)
  1, 1, 1, 2, 1, 1, 1, 2, //  5  rate 13 1
  1, 2, 1, 2, 1, 2, 1, 2, //  6  rate 13 2
  1, 2, 2, 2, 1, 2, 2, 2, //  7  rate 13 3

  2, 2, 2, 2, 2, 2, 2, 2, //  8  rate 14 0 (increment by 2)
  2, 2, 2, 4, 2, 2, 2, 4, //  9  rate 14 1
  2, 4, 2, 4, 2, 4, 2, 4, // 10  rate 14 2
  2, 4, 4, 4, 2, 4, 4, 4, // 11  rate 14 3

  4, 4, 4, 4, 4, 4, 4, 4, // 12  rates 15 0, 15 1, 15 2, 15 3 for decay
  8, 8, 8, 8, 8, 8, 8, 8, // 13  rates 15 0, 15 1, 15 2, 15 3 for attack (zero time)
  0, 0, 0, 0, 0, 0, 0, 0, // 14  infinity rates for attack and decay(s)
]);

let O = (a: number) => (a * RATE_STEPS);
const eg_rate_select = new Uint8Array([
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(0), O(1), O(2), O(3),
  O(4), O(5), O(6), O(7),
  O(8), O(9), O(10), O(11),
  O(12), O(12), O(12), O(12),
]);

O = (a: number) => (a);
const eg_rate_shift = new Uint8Array([
  O(12), O(12), O(12), O(12),
  O(11), O(11), O(11), O(11),
  O(10), O(10), O(10), O(10),
  O(9), O(9), O(9), O(9),
  O(8), O(8), O(8), O(8),
  O(7), O(7), O(7), O(7),
  O(6), O(6), O(6), O(6),
  O(5), O(5), O(5), O(5),
  O(4), O(4), O(4), O(4),
  O(3), O(3), O(3), O(3),
  O(2), O(2), O(2), O(2),
  O(1), O(1), O(1), O(1),
  O(0), O(0), O(0), O(0),
  O(0), O(0), O(0), O(0),
  O(0), O(0), O(0), O(0),
  O(0), O(0), O(0), O(0),
]);

O = (a: number) => ((EG_TIMER_OVERFLOW / a) / 6 | 0);
const lfo_period = [
  O(0.168), O(2.019), O(3.196), O(4.206),
  O(5.215), O(5.888), O(6.224), O(7.066)
];


O = (a: number) => (a * 65536 | 0)
const vib_depth = [
  O(0), O(3.378), O(5.065), O(6.750),
  O(10.114), O(20.170), O(40.106), O(79.307)
];

SC = (db: number) => (db * (2.0 / ENV_STEP) | 0)
const am_depth = [
  SC(0), SC(1.781), SC(2.906), SC(3.656),
  SC(4.406), SC(5.906), SC(7.406), SC(11.91)
];


class Slot {
  public constructor() {
    this.reset();
  }

  public reset(): void {
    this.wave = 0;
    this.FN = 0;
    this.OCT = 0;
    this.PRVB = 0;
    this.LD = 0;
    this.TL = 0;
    this.pan = 0;
    this.lfo = 0;
    this.vib = 0;
    this.AM = 0;
    this.AR = 0;
    this.D1R = 0;
    this.DL = 0;
    this.D2R = 0;
    this.RC = 0;
    this.RR = 0;
    this.step = 0;
    this.stepptr = 0;
    this.bits = 0;
    this.startaddr = 0;
    this.loopaddr = 0;
    this.endaddr = 0;
    this.env_vol = MAX_ATT_INDEX;
    //env_vol_step = env_vol_lim = 0;

    this.lfo_active = false;
    this.lfo_cnt = this.lfo_step = 0;
    this.lfo_max = lfo_period[0];

    this.state = EG_OFF;
    this.active = false;
  }

  public log() {
    console.log(
      ' W:' + this.wave +
      ' F:' + this.FN +
      ' O:' + this.OCT +
      ' P:' + this.PRVB +
      ' L:' + this.LD +
      ' T:' + this.TL +
      ' p:' + this.pan +
      ' l:' + this.lfo +
      ' v:' + this.vib +
      ' A:' + this.AM +
      ' A:' + this.AR +
      ' D:' + this.D1R +
      ' D:' + this.DL +
      ' D:' + this.D2R +
      ' R:' + this.RC +
      ' R:' + this.RR +
      ' s:' + this.step +
      ' s:' + this.stepptr +
      ' b:' + this.bits +
      ' s:' + this.startaddr +
      ' l:' + this.loopaddr +
      ' e:' + this.endaddr +
      ' e:' + this.env_vol +
      ' l:' + this.lfo_active +
      ' l:' + this.lfo_cnt +
      ' l:' + this.lfo_step +
      ' p:' + this.pos +
      ' s:' + this.sample1 +
      ' s:' + this.sample2 +
      ' a:' + this.active +
      ' b:' + this.bits +
      ' s:' + this.state +
      ' e:' + this.env_vol_step +
      ' e:' + this.env_vol_lim +
      ' l:' + this.lfo_max
    )
  }
  
  public compute_rate(val: number): number {
    if (val == 0) {
      return 0;
    } else if (val == 15) {
      return 63;
    }
    let res = 0;
    if (this.RC != 15) {
      let oct = this.OCT;
      if (oct & 8) {
        oct |= -8;
      }
      res = (oct + this.RC) * 2 + (this.FN & 0x200 ? 1 : 0) + val * 4;
    } else {
      res = val * 4;
    }
    if (res < 0) {
      res = 0;
    } else if (res > 63) {
      res = 63;
    }
    return res;
  }
  
  public compute_vib(): number {
    return (((this.lfo_step << 8) / this.lfo_max | 0) * vib_depth[this.vib | 0]) >> 24;
  }

  public compute_am(): number {
    if (this.lfo_active && this.AM != 0) {
      return (((this.lfo_step << 8) / this.lfo_max | 0) * am_depth[this.AM | 0]) >> 12;
    }

    return 0;
  }

  public set_lfo(newlfo: number) {
    this.lfo_step = (((this.lfo_step << 8) / this.lfo_max | 0) * newlfo) >> 8;
    this.lfo_cnt = (((this.lfo_cnt << 8) / this.lfo_max | 0) * newlfo) >> 8;

    this.lfo = newlfo;
    this.lfo_max = lfo_period[this.lfo | 0];
  }

  public wave = 0;		// wavetable number
  public FN = 0;		// f-number
  public OCT = 0;		// octave
  public PRVB = 0;		// pseudo-reverb
  public LD = 0;		// level direct
  public TL = 0;		// total level
  public pan = 0;		// panpot
  public lfo = 0;		// LFO
  public vib = 0;		// vibrato
  public AM = 0;		// AM level

  public AR = 0;
  public D1R = 0;
  public DL = 0;
  public D2R = 0;
  public RC = 0;   		// rate correction
  public RR = 0;

  public step = 0;               // fixed-point frequency step
  public stepptr = 0;		// fixed-point pointer into the sample
  public pos = 0;
  public sample1 = 0
  public sample2 = 0;

  public active = false;		// slot keyed on
  public bits = 0;		// width of the samples
  public startaddr = 0;
  public loopaddr = 0;
  public endaddr = 0;

  public state = 0;
  public env_vol = 0;
  public env_vol_step = 0;
  public env_vol_lim = 0;

  public lfo_active = false;
  public lfo_cnt = 0;
  public lfo_step = 0;
  public lfo_max = 0;
}

export class Ymf278 {
  public constructor(
    private board: Board,
    ramSize: number,
    private rom: Uint8Array,
    private oplOversampling = 1
  ) {
    this.ram = new Uint8Array(1024 * ramSize);
    for (let i = 0; i < this.ram.length; i++) {
      this.ram[i] = 0;
    }

    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i] = new Slot();
    }

    this.setInternalVolume();

    this.reset();
  }

  public reset(): void {
    this.eg_timer = 0;
    this.eg_cnt = 0;
    
    for (let i = 0; i < 24; i++) {
      this. slots[i].reset();
    }
    for (let i = 255; i >= 0; i--) { // reverse order to avoid UMR
      this.writeReg(i, 0);
    }

    this.internalMute = true;

    this.wavetblhdr = 0;
    this.memmode = 0;
    this.memadr = 0;

    this.fm_l = 0;
    this.fm_r = 0;
    this.pcm_l = 0;
    this.pcm_r = 0;

    const time = this.board.getSystemTime();
    this.BUSY_Time = time;
    this.BUSY_Time_Length = 0;
    this.LD_Time = time;
  }

  public writeReg(reg: number, data: number): void {
    const time = this.board.getSystemTime();
    this.BUSY_Time = time;
    this.BUSY_Time_Length = 60;

    // Handle slot registers specifically
    if (reg >= 0x08 && reg <= 0xF7) {
      const snum = (reg - 8) % 24;
      const slot = this.slots[snum];

      switch ((reg - 8) / 24 | 0) {
        case 0: {
          this.LD_Time = time;
          slot.wave = (slot.wave & 0x100) | data;
          const base = (slot.wave < 384 || !this.wavetblhdr) ?
            (slot.wave * 12) :
            (this.wavetblhdr * 0x80000 + ((slot.wave - 384) * 12));
          let buf = new Uint8Array(12);
          for (let i = 0; i < 12; i++) {
            buf[i] = this.readMem(base + i);
          }
          slot.bits = (buf[0] & 0xC0) >> 6;
          slot.set_lfo((buf[7] >> 3) & 7);
          slot.vib = buf[7] & 7;
          slot.AR = buf[8] >> 4;
          slot.D1R = buf[8] & 0xF;
          slot.DL = dl_tab[buf[9] >> 4];
          slot.D2R = buf[9] & 0xF;
          slot.RC = buf[10] >> 4;
          slot.RR = buf[10] & 0xF;
          slot.AM = buf[11] & 7;
          slot.startaddr = buf[2] | (buf[1] << 8) |
            ((buf[0] & 0x3F) << 16);
          slot.loopaddr = buf[4] + (buf[3] << 8);
          slot.endaddr = (((buf[6] + (buf[5] << 8)) ^ 0xFFFF) + 1);
          if ((this.regs[reg + 4] & 0x080)) {
            this.keyOnHelper(slot);
          }
          break;
        }
        case 1: {
          slot.wave = (slot.wave & 0xFF) | ((data & 0x1) << 8);
          slot.FN = (slot.FN & 0x380) | (data >> 1);
          let oct = slot.OCT;
          if (oct & 8) {
            oct |= -8;
          }
          oct += 5;
          slot.step = oct >= 0 ? (slot.FN | 1024) << oct : (slot.FN | 1024) >> -oct;
          break;
        }
        case 2: {
          slot.FN = (slot.FN & 0x07F) | ((data & 0x07) << 7);
          slot.PRVB = ((data & 0x08) >> 3);
          slot.OCT = ((data & 0xF0) >> 4);
          let oct = slot.OCT;
          if (oct & 8) {
            oct |= -8;
          }
          oct += 5;
          slot.step = oct >= 0 ? (slot.FN | 1024) << oct : (slot.FN | 1024) >> -oct;
          break;
        }
        case 3:
          slot.TL = data >> 1;
          slot.LD = data & 0x1;

          // TODO
          if (slot.LD) {
            // directly change volume
          } else {
            // interpolate volume
          }
          break;
        case 4:
          if (data & 0x10) {
            // output to DO1 pin:
            // this pin is not used in moonsound
            // we emulate this by muting the sound
            slot.pan = 8; // both left/right -inf dB
          } else {
            slot.pan = data & 0x0F;
          }

          if (data & 0x020) {
            // LFO reset
            slot.lfo_active = false;
            slot.lfo_cnt = 0;
            slot.lfo_max = lfo_period[slot.vib | 0];
            slot.lfo_step = 0;
          } else {
            // LFO activate
            slot.lfo_active = true;
          }

          switch (data >> 6) {
            case 0:	//tone off, no damp
              if (slot.active && (slot.state != EG_REV)) {
                slot.state = EG_REL;
              }
              break;
            case 2:	//tone on, no damp
              if (!(this.regs[reg] & 0x080)) {
                this.keyOnHelper(slot);
              }
              break;
            case 1:	//tone off, damp
            case 3:	//tone on, damp
              slot.state = EG_DMP;
              break;
          }
          break;
        case 5:
          slot.vib = data & 0x7;
          slot.set_lfo((data >> 3) & 0x7);
          break;
        case 6:
          slot.AR = data >> 4;
          slot.D1R = data & 0xF;
          break;
        case 7:
          slot.DL = dl_tab[data >> 4];
          slot.D2R = data & 0xF;
          break;
        case 8:
          slot.RC = data >> 4;
          slot.RR = data & 0xF;
          break;
        case 9:
          slot.AM = data & 0x7;
          break;
      }
    } else {
      // All non-slot registers
      switch (reg) {
        case 0x00:    	// TEST
        case 0x01:
          break;

        case 0x02:
          this.wavetblhdr = (data >> 2) & 0x7;
          this.memmode = data & 1;
          break;

        case 0x03:
          this.memadr = (this.memadr & 0x00FFFF) | (data << 16);
          break;

        case 0x04:
          this.memadr = (this.memadr & 0xFF00FF) | (data << 8);
          break;

        case 0x05:
          this.memadr = (this.memadr & 0xFFFF00) | data;
          break;

        case 0x06:  // memory data
          this.BUSY_Time_Length += 18;
          this.writeMem(this.memadr, data);
          this.memadr = (this.memadr + 1) & 0xFFFFFF;
          break;

        case 0xF8:
          // TODO use these
          this.fm_l = data & 0x7;
          this.fm_r = (data >> 3) & 0x7;
          break;

        case 0xF9:
          this.pcm_l = data & 0x7;
          this.pcm_r = (data >> 3) & 0x7;
          break;
      }
    }

    this.regs[reg] = data;
  }

  public readReg(reg: number): number {
  const time = this.board.getSystemTime();
    this.BUSY_Time = time;
    this.BUSY_Time_Length = 0;
    
    switch (reg) {
      case 2: // 3 upper bits are device ID
        return (this.regs[2] & 0x1F) | 0x20;

      case 6: // Memory Data Register
        this.BUSY_Time_Length += 25;
        const result = this.readMem(this.memadr);
        this.memadr = (this.memadr + 1) & 0xFFFFFF;
        return result;

      default:
        return this.regs[reg];
    }
  }

  public readStatus(): number {
    let result = 0;
    if (this.board.getTimeSince(this.BUSY_Time) < this.BUSY_Time_Length) {
      result |= 0x01;
    }
    if (this.board.getTimeSince(this.LD_Time) < 6600) {
      result |= 0x02;
    }
    return result;
  }

  public getRom(): Uint8Array {
    return this.rom;
  }

  public getRam() {
    return this.ram;
  }

  public setSampleRate(sampleRate: number): void {
    this.eg_timer_add = (1 << EG_SH) / this.oplOversampling | 0;
  }

  public setInternalVolume(): void {
    let volume = 32768 / 32;
    // Volume table, 1 = -0.375dB, 8 = -3dB, 256 = -96dB
    for (let i = 0; i < 256; i++) {
      this.volume[i] = 4.0 * volume * Math.pow(2.0, (-0.375 / 6) * i);
    }
    for (let i = 256; i < 256 * 4; i++) {
      this.volume[i] = 0;
    }
  }

  public sync(count: number): Array<Float32Array> { // updateBuffer
    const audioBufferLeft = this.audioBuffer[0];
    const audioBufferRight = this.audioBuffer[1];

    if (this.internalMute) {
      for (let bufferIndex = 0; bufferIndex < count; bufferIndex++) {
        audioBufferLeft[bufferIndex] = 0;
        audioBufferRight[bufferIndex] = 0;
      }
      return this.audioBuffer;
    }

    let vl = mix_level[this.pcm_l];
    let vr = mix_level[this.pcm_r];

    for (let bufferIndex = 0; bufferIndex < count; bufferIndex++) {
      let left = 0;
      let right = 0;
      let cnt = this.oplOversampling;
      while (cnt--) {
        for (let i = 0; i < 24; i++) {
          const sl = this.slots[i];
          if (!sl.active) {
            continue;
          }

          let sample = (sl.sample1 * (0x1000 - (sl.stepptr >> 4)) + sl.sample2 * (sl.stepptr >> 4)) / (1 << 12);
          const vol = sl.TL + (sl.env_vol >> 2) + sl.compute_am();

          let volLeft = vol + pan_left[sl.pan | 0] + vl;
          let volRight = vol + pan_right[sl.pan | 0] + vr;

          // TODO prob doesn't happen in real chip
          if (volLeft < 0) {
            volLeft = 0;
          }
          if (volRight < 0) {
            volRight = 0;
          }

          left += (sample * this.volume[volLeft]) / (1 << 10);
          right += (sample * this.volume[volRight]) / (1 << 10);

          if (sl.lfo_active && sl.vib) {
            let oct = sl.OCT;
            if (oct & 8) {
              oct |= -8;
            }
            oct += 5;
            sl.stepptr += (oct >= 0 ? ((sl.FN | 1024) + sl.compute_vib()) << oct
              : ((sl.FN | 1024) + sl.compute_vib()) >> -oct) / this.oplOversampling;
          } else {
            sl.stepptr += sl.step / this.oplOversampling;
          }

          let count = (sl.stepptr >> 16) & 0x0f;
          sl.stepptr &= 0xffff;
          while (count--) {
            sl.sample1 = sl.sample2;
            sl.pos++;
            if (sl.pos >= sl.endaddr) {
              sl.pos = sl.loopaddr;
            }
            sl.sample2 = this.getSample(sl);
          }
        }
        this.advance();
      }

      audioBufferLeft[bufferIndex] = left / this.oplOversampling;
      audioBufferRight[bufferIndex] = right / this.oplOversampling;
    }

    return this.audioBuffer;
  }

  private readMem(address: number): number {
    if (address < this.rom.length) {
      return this.rom[address];
    }
    address -= this.rom.length;

    if (address < this.ram.length) {
      return this.ram[address];
    }

    return 0xff;
  }

  private writeMem(address: number, value: number) {
    address -= this.rom.length;
    if (address >= 0 && address < this.ram.length) {
      this.ram[address] = value;
    }
  }

  private getSample(op: Slot): number {
    let sample = 0;
    switch (op.bits) {
      case 0: {
        // 8 bit
        sample = this.readMem(op.startaddr + op.pos) << 8;
        break;
      }
      case 1: {
        // 12 bit
        const addr = op.startaddr + ((op.pos >> 1) * 3);
        if (op.pos & 1) {
          sample = this.readMem(addr + 2) << 8 |
            ((this.readMem(addr + 1) << 4) & 0xF0);
        } else {
          sample = this.readMem(addr + 0) << 8 |
            (this.readMem(addr + 1) & 0xF0);
        }
        break;
      }
      case 2: {
        // 16 bit
        const addr = op.startaddr + (op.pos * 2);
        sample = (this.readMem(addr + 0) << 8) |
          (this.readMem(addr + 1));
        break;
      }
      default:
        // TODO unspecified
        sample = 0;
    }
    if (sample > 32767) sample -= 65536;
    return sample;
  }

  private advance(): void {
    this.eg_timer += this.eg_timer_add;

    if (this.eg_timer > 4 * EG_TIMER_OVERFLOW) {
      this.eg_timer = EG_TIMER_OVERFLOW;
    }

    while (this.eg_timer >= EG_TIMER_OVERFLOW) {
      this.eg_timer -= EG_TIMER_OVERFLOW;
      this.eg_cnt++;

      for (let i = 0; i < 24; i++) {
        let op = this.slots[i];

        if (op.lfo_active) {
          op.lfo_cnt++;
          if (op.lfo_cnt < op.lfo_max) {
            op.lfo_step++;
          } else if (op.lfo_cnt < (op.lfo_max * 3)) {
            op.lfo_step--;
          } else {
            op.lfo_step++;
            if (op.lfo_cnt == (op.lfo_max * 4)) {
              op.lfo_cnt = 0;
            }
          }
        }

        // Envelope Generator
        switch (op.state) {
          case EG_ATT: {	// attack phase
            const rate = op.compute_rate(op.AR);
            if (rate < 4) {
              break;
            }
            const shift = eg_rate_shift[rate];
            if (!(this.eg_cnt & ((1 << shift) - 1))) {
              const select = eg_rate_select[rate];
              op.env_vol += (~op.env_vol * eg_inc[select + ((this.eg_cnt >> shift) & 7)]) >> 3;
              if (op.env_vol <= MIN_ATT_INDEX) {
                op.env_vol = MIN_ATT_INDEX;
                if (op.DL == 0) {
                  op.state = EG_SUS;
                }
                else {
                  op.state = EG_DEC;
                }
              }
            }
            break;
          }
          case EG_DEC: {	// decay phase
            const rate = op.compute_rate(op.D1R);
            if (rate < 4) {
              break;
            }
            const shift = eg_rate_shift[rate];
            if (!(this.eg_cnt & ((1 << shift) - 1))) {
              const select = eg_rate_select[rate];
              op.env_vol += eg_inc[select + ((this.eg_cnt >> shift) & 7)];

              if ((op.env_vol > dl_tab[6]) && op.PRVB != 0) {
                op.state = EG_REV;
              } else {
                if (op.env_vol >= op.DL) {
                  op.state = EG_SUS;
                }
              }
            }
            break;
          }
          case EG_SUS: {	// sustain phase
            const rate = op.compute_rate(op.D2R);
            if (rate < 4) {
              break;
            }
            const shift = eg_rate_shift[rate];
            if (!(this.eg_cnt & ((1 << shift) - 1))) {
              const select = eg_rate_select[rate];
              op.env_vol += eg_inc[select + ((this.eg_cnt >> shift) & 7)];

              if ((op.env_vol > dl_tab[6]) && op.PRVB != 0) {
                op.state = EG_REV;
              } else {
                if (op.env_vol >= MAX_ATT_INDEX) {
                  op.env_vol = MAX_ATT_INDEX;
                  op.active = false;
                  this.checkMute();
                }
              }
            }
            break;
          }
          case EG_REL: {	// release phase
            const rate = op.compute_rate(op.RR);
            if (rate < 4) {
              break;
            }
            const shift = eg_rate_shift[rate];
            if (!(this.eg_cnt & ((1 << shift) - 1))) {
              const select = eg_rate_select[rate];
              op.env_vol += eg_inc[select + ((this.eg_cnt >> shift) & 7)];

              if ((op.env_vol > dl_tab[6]) && op.PRVB != 0) {
                op.state = EG_REV;
              } else {
                if (op.env_vol >= MAX_ATT_INDEX) {
                  op.env_vol = MAX_ATT_INDEX;
                  op.active = false;
                  this.checkMute();
                }
              }
            }
            break;
          }
          case EG_REV: {	//pseudo reverb
            //TODO improve env_vol update
            const rate = op.compute_rate(5);
            //if (rate < 4) {
            //	break;
            //}
            const shift = eg_rate_shift[rate];
            if (!(this.eg_cnt & ((1 << shift) - 1))) {
              const select = eg_rate_select[rate];
              op.env_vol += eg_inc[select + ((this.eg_cnt >> shift) & 7)];

              if (op.env_vol >= MAX_ATT_INDEX) {
                op.env_vol = MAX_ATT_INDEX;
                op.active = false;
                this.checkMute();
              }
            }
            break;
          }
          case EG_DMP: {	//damping
            //TODO improve env_vol update, damp is just fastest decay now
            const rate = 56;
            const shift = eg_rate_shift[rate];
            if (!(this.eg_cnt & ((1 << shift) - 1))) {
              const select = eg_rate_select[rate];
              op.env_vol += eg_inc[select + ((this.eg_cnt >> shift) & 7)];

              if (op.env_vol >= MAX_ATT_INDEX) {
                op.env_vol = MAX_ATT_INDEX;
                op.active = false;
                this.checkMute();
              }
            }
            break;
          }
          case EG_OFF:
            // nothing
            break;

          default:
            break;
        }
      }
    }
  }

  private checkMute(): void {
    this.internalMute = !this.anyActive();
  }

  private anyActive(): boolean {
    for (let i = 0; i < 24; i++) {
      if (this.slots[i].active) {
        return true;
      }
    }
    return false;
  }

  private keyOnHelper(slot: Slot): void {
    slot.active = true;
    this.internalMute = false;

    let oct = slot.OCT;
    if (oct & 8) {
      oct |= -8;
    }
    oct += 5;
    slot.step = oct >= 0 ? (slot.FN | 1024) << oct : (slot.FN | 1024) >> -oct;
    slot.state = EG_ATT;
    slot.stepptr = 0;
    slot.pos = 0;
    slot.sample1 = this.getSample(slot);
    slot.pos = 1;
    slot.sample2 = this.getSample(slot);
  }
  
  private ram: Uint8Array;

  private freqbase = 0;
  
  private slots = new Array<Slot>(24);

  private eg_cnt = 0; // global envelope generator counter
  private eg_timer = 0; // global envelope generator counter
  private eg_timer_add = 0;  // step of eg_timer
  private eg_timer_overflow = 0; // envelope generator timer overlfows every 1 sample (on real chip)

  private wavetblhdr = 0;
  private memmode = 0;
  private memadr = 0;

  private fm_l = 0;
  private fm_r = 0;
  private pcm_l = 0;
  private pcm_r = 0;

  // precalculated attenuation values with some marging for
  // enveloppe and pan levels
  private volume = new Float32Array(256 * 4);

  
  private regs = new Uint8Array(256);

  private LD_Time = 0;
  private BUSY_Time = 0;
  private BUSY_Time_Length = 0;

  private internalMute = true;

  private audioBuffer = [new Float32Array(8192), new Float32Array(8192)];
}
