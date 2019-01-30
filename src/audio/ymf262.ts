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

import { Board, InterruptVector } from '../core/board';
import { Timer } from '../core/timeoutmanager';
import { SaveState } from '../core/savestate';

const R04_ST1 = 0x01;	// Timer1 Start
const R04_ST2 = 0x02;	// Timer2 Start
const R04_MASK_T2 = 0x20;	// Mask Timer2 flag 
const R04_MASK_T1 = 0x40;	// Mask Timer1 flag 
const R04_IRQ_RESET = 0x80;	// IRQ RESET 

// Bitmask for status register 
const STATUS_T2 = R04_MASK_T2;
const STATUS_T1 = R04_MASK_T1;

const FREQ_SH = 16;  // 16.16 fixed point (frequency calculations)
const EG_SH = 16;  // 16.16 fixed point (EG timing)
const LFO_SH = 15;  //  8.15 fixed point (LFO calculations)
const LFO_MASK = 0x007fffff;  //  8.15 fixed point (LFO calculations)
const TIMER_SH = 16;  // 16.16 fixed point (timers calculations)
const FREQ_MASK = (1 << FREQ_SH) - 1;
const EG_TIMER_OVERFLOW = 1 << EG_SH;

// envelope output entries
const ENV_BITS = 10;
const ENV_LEN = 1 << ENV_BITS;
const ENV_STEP = 128.0 / ENV_LEN;

const MAX_ATT_INDEX = (1 << (ENV_BITS - 1)) - 1; //511
const MIN_ATT_INDEX = 0;

// sinwave entries
const SIN_BITS = 10;
const SIN_LEN = 1 << SIN_BITS;
const SIN_MASK = SIN_LEN - 1;

const TL_RES_LEN = 256;	// 8 bits addressing (real chip)

// register number to channel number , slot offset
const SLOT1 = 0;
const SLOT2 = 1;

// Envelope Generator phases
const EG_ATT = 4;
const EG_DEC = 3;
const EG_SUS = 2;
const EG_REL = 1;
const EG_OFF = 0;


// mapping of register number (offset) to slot number used by the emulator
const slot_array = [
  0, 2, 4, 1, 3, 5, -1, -1,
  6, 8, 10, 7, 9, 11, -1, -1,
  12, 14, 16, 13, 15, 17, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1
];

// key scale level
// table is 3dB/octave , DV converts this into 6dB/octave
// 0.1875 is bit 0 weight of the envelope counter (volume) expressed in the 'decibel' scale
let DV = (x: number) => (x / (0.1875 / 2.0) | 0)
const ksl_tab = [
  // OCT 0
  DV(0.000), DV(0.000), DV(0.000), DV(0.000),
  DV(0.000), DV(0.000), DV(0.000), DV(0.000),
  DV(0.000), DV(0.000), DV(0.000), DV(0.000),
  DV(0.000), DV(0.000), DV(0.000), DV(0.000),
  // OCT 1
  DV(0.000), DV(0.000), DV(0.000), DV(0.000),
  DV(0.000), DV(0.000), DV(0.000), DV(0.000),
  DV(0.000), DV(0.750), DV(1.125), DV(1.500),
  DV(1.875), DV(2.250), DV(2.625), DV(3.000),
  // OCT 2
  DV(0.000), DV(0.000), DV(0.000), DV(0.000),
  DV(0.000), DV(1.125), DV(1.875), DV(2.625),
  DV(3.000), DV(3.750), DV(4.125), DV(4.500),
  DV(4.875), DV(5.250), DV(5.625), DV(6.000),
  // OCT 3
  DV(0.000), DV(0.000), DV(0.000), DV(1.875),
  DV(3.000), DV(4.125), DV(4.875), DV(5.625),
  DV(6.000), DV(6.750), DV(7.125), DV(7.500),
  DV(7.875), DV(8.250), DV(8.625), DV(9.000),
  // OCT 4 
  DV(0.000), DV(0.000), DV(3.000), DV(4.875),
  DV(6.000), DV(7.125), DV(7.875), DV(8.625),
  DV(9.000), DV(9.750), DV(10.125), DV(10.500),
  DV(10.875), DV(11.250), DV(11.625), DV(12.000),
  // OCT 5 
  DV(0.000), DV(3.000), DV(6.000), DV(7.875),
  DV(9.000), DV(10.125), DV(10.875), DV(11.625),
  DV(12.000), DV(12.750), DV(13.125), DV(13.500),
  DV(13.875), DV(14.250), DV(14.625), DV(15.000),
  // OCT 6 
  DV(0.000), DV(6.000), DV(9.000), DV(10.875),
  DV(12.000), DV(13.125), DV(13.875), DV(14.625),
  DV(15.000), DV(15.750), DV(16.125), DV(16.500),
  DV(16.875), DV(17.250), DV(17.625), DV(18.000),
  // OCT 7 
  DV(0.000), DV(9.000), DV(12.000), DV(13.875),
  DV(15.000), DV(16.125), DV(16.875), DV(17.625),
  DV(18.000), DV(18.750), DV(19.125), DV(19.500),
  DV(19.875), DV(20.250), DV(20.625), DV(21.000)
];

// sustain level table (3dB per step) 
// 0 - 15: 0, 3, 6, 9,12,15,18,21,24,27,30,33,36,39,42,93 (dB)
let SC = (db: number) => (db * (2.0 / ENV_STEP) | 0)
const sl_tab = [
  SC(0), SC(1), SC(2), SC(3), SC(4), SC(5), SC(6), SC(7),
  SC(8), SC(9), SC(10), SC(11), SC(12), SC(13), SC(14), SC(31)
];

const RATE_STEPS = 8;
const eg_inc = [
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
];

let O = (a: number) => (a * RATE_STEPS); 
// note that there is no O(13) in this table - it's directly in the code
const eg_rate_select = [
  // Envelope Generator rates (16 + 64 rates + 16 RKS)
  // 16 infinite time rates
  O(14), O(14), O(14), O(14), O(14), O(14), O(14), O(14),
  O(14), O(14), O(14), O(14), O(14), O(14), O(14), O(14),

  // rates 00-12
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

  // rate 13 
  O(4), O(5), O(6), O(7),

  // rate 14 
  O(8), O(9), O(10), O(11),

  // rate 15 
  O(12), O(12), O(12), O(12),

  // 16 dummy rates (same as 15 3) 
  O(12), O(12), O(12), O(12), O(12), O(12), O(12), O(12),
  O(12), O(12), O(12), O(12), O(12), O(12), O(12), O(12),
];

//rate  0,    1,    2,    3,   4,   5,   6,  7,  8,  9,  10, 11, 12, 13, 14, 15 
//shift 12,   11,   10,   9,   8,   7,   6,  5,  4,  3,  2,  1,  0,  0,  0,  0  
//mask  4095, 2047, 1023, 511, 255, 127, 63, 31, 15, 7,  3,  1,  0,  0,  0,  0  
O = (a: number) => (a * 1);
const eg_rate_shift = [
  // Envelope Generator counter shifts (16 + 64 rates + 16 RKS) 
  // 16 infinite time rates 
  O(0), O(0), O(0), O(0), O(0), O(0), O(0), O(0),
  O(0), O(0), O(0), O(0), O(0), O(0), O(0), O(0),

  // rates 00-15 
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

  // 16 dummy rates (same as 15 3)
  O(0), O(0), O(0), O(0), O(0), O(0), O(0), O(0),
  O(0), O(0), O(0), O(0), O(0), O(0), O(0), O(0),
];


// multiple table
let ML = (x: number) => (2 * x | 0); 
const mul_tab = [
  // 1/2, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,10,12,12,15,15
  ML(0.5), ML(1.0), ML(2.0), ML(3.0), ML(4.0), ML(5.0), ML(6.0), ML(7.0),
  ML(8.0), ML(9.0), ML(10.0), ML(10.0), ML(12.0), ML(12.0), ML(15.0), ML(15.0)
];

// TL_TAB_LEN is calculated as:
//  (12+1)=13 - sinus amplitude bits     (Y axis)
//  additional 1: to compensate for calculations of negative part of waveform
//  (if we don't add it then the greatest possible _negative_ value would be -2
//  and we really need -1 for waveform #7)
//  2  - sinus sign bit           (Y axis)
//  TL_RES_LEN - sinus resolution (X axis)

const TL_TAB_LEN = 13 * 2 * TL_RES_LEN;
const tl_tab = new Int32Array(TL_TAB_LEN);
const ENV_QUIET = TL_TAB_LEN >> 4;

// sin waveform table in 'decibel' scale
// there are eight waveforms on OPL3 chips
const sin_tab = new Uint32Array(SIN_LEN * 8);


// LFO Amplitude Modulation table (verified on real YM3812)
//  27 output levels (triangle waveform); 1 level takes one of: 192, 256 or 448 samples
//
// Length: 210 elements
//
// Each of the elements has to be repeated
// exactly 64 times (on 64 consecutive samples).
// The whole table takes: 64 * 210 = 13440 samples.
//
// When AM = 1 data is used directly
// When AM = 0 data is divided by 4 before being used (loosing precision is important)

const LFO_AM_TAB_ELEMENTS = 210;
const lfo_am_table = [
  0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1,
  2, 2, 2, 2,
  3, 3, 3, 3,
  4, 4, 4, 4,
  5, 5, 5, 5,
  6, 6, 6, 6,
  7, 7, 7, 7,
  8, 8, 8, 8,
  9, 9, 9, 9,
  10, 10, 10, 10,
  11, 11, 11, 11,
  12, 12, 12, 12,
  13, 13, 13, 13,
  14, 14, 14, 14,
  15, 15, 15, 15,
  16, 16, 16, 16,
  17, 17, 17, 17,
  18, 18, 18, 18,
  19, 19, 19, 19,
  20, 20, 20, 20,
  21, 21, 21, 21,
  22, 22, 22, 22,
  23, 23, 23, 23,
  24, 24, 24, 24,
  25, 25, 25, 25,
  26, 26, 26,
  25, 25, 25, 25,
  24, 24, 24, 24,
  23, 23, 23, 23,
  22, 22, 22, 22,
  21, 21, 21, 21,
  20, 20, 20, 20,
  19, 19, 19, 19,
  18, 18, 18, 18,
  17, 17, 17, 17,
  16, 16, 16, 16,
  15, 15, 15, 15,
  14, 14, 14, 14,
  13, 13, 13, 13,
  12, 12, 12, 12,
  11, 11, 11, 11,
  10, 10, 10, 10,
  9, 9, 9, 9,
  8, 8, 8, 8,
  7, 7, 7, 7,
  6, 6, 6, 6,
  5, 5, 5, 5,
  4, 4, 4, 4,
  3, 3, 3, 3,
  2, 2, 2, 2,
  1, 1, 1, 1
];

// LFO Phase Modulation table (verified on real YM3812) 
const lfo_pm_table = [
  // FNUM2/FNUM = 00 0xxxxxxx (0x0000)
  0, 0, 0, 0, 0, 0, 0, 0,	//LFO PM depth = 0
  0, 0, 0, 0, 0, 0, 0, 0,	//LFO PM depth = 1

  // FNUM2/FNUM = 00 1xxxxxxx (0x0080)
  0, 0, 0, 0, 0, 0, 0, 0,	//LFO PM depth = 0
  1, 0, 0, 0, -1, 0, 0, 0,	//LFO PM depth = 1

  // FNUM2/FNUM = 01 0xxxxxxx (0x0100)
  1, 0, 0, 0, -1, 0, 0, 0,	//LFO PM depth = 0
  2, 1, 0, -1, -2, -1, 0, 1,	//LFO PM depth = 1

  // FNUM2/FNUM = 01 1xxxxxxx (0x0180)
  1, 0, 0, 0, -1, 0, 0, 0,	//LFO PM depth = 0
  3, 1, 0, -1, -3, -1, 0, 1,	//LFO PM depth = 1

  // FNUM2/FNUM = 10 0xxxxxxx (0x0200)
  2, 1, 0, -1, -2, -1, 0, 1,	//LFO PM depth = 0
  4, 2, 0, -2, -4, -2, 0, 2,	//LFO PM depth = 1

  // FNUM2/FNUM = 10 1xxxxxxx (0x0280)
  2, 1, 0, -1, -2, -1, 0, 1,	//LFO PM depth = 0
  5, 2, 0, -2, -5, -2, 0, 2,	//LFO PM depth = 1

  // FNUM2/FNUM = 11 0xxxxxxx (0x0300)
  3, 1, 0, -1, -3, -1, 0, 1,	//LFO PM depth = 0
  6, 3, 0, -3, -6, -3, 0, 3,	//LFO PM depth = 1

  // FNUM2/FNUM = 11 1xxxxxxx (0x0380)
  3, 1, 0, -1, -3, -1, 0, 1,	//LFO PM depth = 0
  7, 3, 0, -3, -7, -3, 0, 3	//LFO PM depth = 1
];

const PHASE_MOD1 = 18;
const PHASE_MOD2 = 19;


const chanOut = new Int32Array(20);		// 18 channels + two phase modulation


function init_tables(): void {
  for (let x = 0; x < TL_RES_LEN; x++) {
    let m = (1 << 16) / Math.pow(2, (x + 1) * (ENV_STEP / 4.0) / 8.0);
    m = Math.floor(m);

    // we never reach (1<<16) here due to the (x+1) 
    // result fits within 16 bits at maximum 
    let n = m | 0;		// 16 bits here 
    n >>= 4;		// 12 bits here 
    if (n & 1) {		// round to nearest 
      n = (n >> 1) + 1;
    } else {
      n = n >> 1;
    }
    // 11 bits here (rounded) 
    n <<= 1;		// 12 bits here (as in real chip) 
    tl_tab[x * 2 + 0] = n;
    tl_tab[x * 2 + 1] = ~tl_tab[x * 2 + 0]; // this _is_ different from OPL2 (verified on real YMF262)

    for (let i = 1; i < 13; i++) {
      tl_tab[x * 2 + 0 + i * 2 * TL_RES_LEN] = tl_tab[x * 2 + 0] >> i;
      tl_tab[x * 2 + 1 + i * 2 * TL_RES_LEN] = ~tl_tab[x * 2 + 0 + i * 2 * TL_RES_LEN];  // this _is_ different from OPL2 (verified on real YMF262) 
    }
  }

  const LOG2 = Math.log(2);
  for (let i = 0; i < SIN_LEN; i++) {
    // non-standard sinus
    let m = Math.sin(((i * 2) + 1) * Math.PI / SIN_LEN); // checked against the real chip 
    // we never reach zero here due to ((i * 2) + 1) 
    let o = (m > 0.0) ?
      8 * Math.log(1.0 / m) / LOG2 :	// convert to 'decibels' 
      8 * Math.log(-1.0 / m) / LOG2;	// convert to 'decibels'
    o = o / (ENV_STEP / 4);

    let n = 2 * o | 0;
    if (n & 1) {// round to nearest 
      n = (n >> 1) + 1;
    } else {
      n = n >> 1;
    }
    sin_tab[i] = n * 2 + (m >= 0.0 ? 0 : 1);
  }

  for (let i = 0; i < SIN_LEN; i++) {
    // these 'pictures' represent _two_ cycles 
    // waveform 1:  __      __     
    //             /  \____/  \____
    // output only first half of the sinus waveform (positive one) 
    if (i & (1 << (SIN_BITS - 1))) {
      sin_tab[1 * SIN_LEN + i] = TL_TAB_LEN;
    } else {
      sin_tab[1 * SIN_LEN + i] = sin_tab[i];
    }

    // waveform 2:  __  __  __  __ 
    //             /  \/  \/  \/  \.
    // abs(sin) 
    sin_tab[2 * SIN_LEN + i] = sin_tab[i & (SIN_MASK >> 1)];

    // waveform 3:  _   _   _   _  
    //             / |_/ |_/ |_/ |_
    // abs(output only first quarter of the sinus waveform) 
    if (i & (1 << (SIN_BITS - 2))) {
      sin_tab[3 * SIN_LEN + i] = TL_TAB_LEN;
    } else {
      sin_tab[3 * SIN_LEN + i] = sin_tab[i & (SIN_MASK >> 2)];
    }

    // waveform 4:                 
    //             /\  ____/\  ____
    //               \/      \/    
    // output whole sinus waveform in half the cycle(step=2) and output 0 on the other half of cycle
    if (i & (1 << (SIN_BITS - 1))) {
      sin_tab[4 * SIN_LEN + i] = TL_TAB_LEN;
    } else {
      sin_tab[4 * SIN_LEN + i] = sin_tab[i * 2];
    }

    // waveform 5:                 
    //             /\/\____/\/\____
    //                             
    // output abs(whole sinus) waveform in half the cycle(step=2) and output 0 on the other half of cycle 
    if (i & (1 << (SIN_BITS - 1))) {
      sin_tab[5 * SIN_LEN + i] = TL_TAB_LEN;
    } else {
      sin_tab[5 * SIN_LEN + i] = sin_tab[(i * 2) & (SIN_MASK >> 1)];
    }

    // waveform 6: ____    ____    
    //                             
    //                 ____    ____
    // output maximum in half the cycle and output minimum on the other half of cycle 
    if (i & (1 << (SIN_BITS - 1))) {
      sin_tab[6 * SIN_LEN + i] = 1;	// negative 
    } else {
      sin_tab[6 * SIN_LEN + i] = 0;	// positive
    }

    // waveform 7:                 
    //             |\____  |\____  
    //                   \|      \|
    // output sawtooth waveform    
    let x = (i & (1 << (SIN_BITS - 1))) ?
      ((SIN_LEN - 1) - i) * 16 + 1 : // negative: from 8177 to 1 
      i * 16;                        //positive: from 0 to 8176 
    if (x > TL_TAB_LEN) {
      x = TL_TAB_LEN;	// clip to the allowed range 
    }
    sin_tab[7 * SIN_LEN + i] = x;
  }
}

function op_calc(phase: number, env: number, pm: number, wave_tab: number): number {
  const i = (phase & ~FREQ_MASK) + (pm << 16);
  const p = (env << 4) + sin_tab[wave_tab + ((i >> FREQ_SH) & SIN_MASK)];
  if (p >= TL_TAB_LEN) {
    return 0;
  }
  return tl_tab[p];
}

function op_calc1(phase: number, env: number, pm: number, wave_tab: number): number {
  const i = (phase & ~FREQ_MASK) + pm;
  const p = (env << 4) + sin_tab[wave_tab + ((i >> FREQ_SH) & SIN_MASK)];
  if (p >= TL_TAB_LEN) {
    return 0;
  }
  return tl_tab[p];
}

class Slot {
  public constructor() {
  }

  public volume_calc(LFO_AM: number): number {
    return this.TLL + this.volume + (LFO_AM & this.AMmask);
  }

  public FM_KEYON(key_set: number): void {
    if (!this.key) {
      // restart Phase Generator 
      this.Cnt = 0;
      // phase -> Attack 
      this.state = EG_ATT;
    }
    this.key |= key_set;
  }

  public FM_KEYOFF(key_clr: number): void {
    if (this.key) {
      this.key &= key_clr;
      if (!this.key) {
        // phase -> Release 
        if (this.state > EG_REL) {
          this.state = EG_REL;
        }
      }
    }
  }

  public getState(): any {
    let state: any = {};

    state.ar = this.ar;
    state.dr = this.dr;
    state.rr = this.rr;
    state.KSR = this.KSR;
    state.ksl = this.ksl;
    state.ksr = this.ksr;
    state.mul = this.mul;

    state.Cnt = this.Cnt;
    state.Incr = this.Incr;
    state.FB = this.FB;
    state.op1_out = SaveState.getArrayState(this.op1_out);
    state.CON = this.CON;
    
    state.eg_type = this.eg_type;
    state.state = this.state;
    state.TL = this.TL;
    state.TLL = this.TLL;
    state.volume = this.volume;
    state.sl = this.sl;

    state.eg_m_ar = this.eg_m_ar;
    state.eg_sh_ar = this.eg_sh_ar;
    state.eg_sel_ar = this.eg_sel_ar;
    state.eg_m_dr = this.eg_m_dr;
    state.eg_sh_dr = this.eg_sh_dr;
    state.eg_sel_dr = this.eg_sel_dr;
    state.eg_m_rr = this.eg_m_rr;
    state.eg_sh_rr = this.eg_sh_rr;
    state.eg_sel_rr = this.eg_sel_rr;

    state.key = this.key;

    state.waveform_number = this.waveform_number;
    state.wavetable = this.wavetable;

    state.connect = this.connect;

    return state;
  }

  public setState(state: any): void {
    this.ar = state.ar;
    this.dr = state.dr;
    this.rr = state.rr;
    this.KSR = state.KSR;
    this.ksl = state.ksl;
    this.ksr = state.ksr;
    this.mul = state.mul;

    this.Cnt = state.Cnt;
    this.Incr = state.Incr;
    this.FB = state.FB;
    SaveState.setArrayState(this.op1_out, state.op1_out);
    this.CON = state.CON;

    this.eg_type = state.eg_type;
    this.state = state.state;
    this.TL = state.TL;
    this.TLL = state.TLL;
    this.volume = state.volume;
    this.sl = state.sl;

    this.eg_m_ar = state.eg_m_ar;
    this.eg_sh_ar = state.eg_sh_ar;
    this.eg_sel_ar = state.eg_sel_ar;
    this.eg_m_dr = state.eg_m_dr;
    this.eg_sh_dr = state.eg_sh_dr;
    this.eg_sel_dr = state.eg_sel_dr;
    this.eg_m_rr = state.eg_m_rr;
    this.eg_sh_rr = state.eg_sh_rr;
    this.eg_sel_rr = state.eg_sel_rr;

    this.key = state.key;

    this.waveform_number = state.waveform_number;
    this.wavetable = state.wavetable;

    this.connect = state.connect;
  }

  public ar = 0;	// attack rate: AR<<2
  public dr = 0;	// decay rate:  DR<<2
  public rr = 0;	// release rate:RR<<2
  public KSR = 0;	// key scale rate
  public ksl = 0;	// keyscale level
  public ksr = 0;	// key scale rate: kcode>>KSR
  public mul = 0;	// multiple: mul_tab[ML]

  // Phase Generator 
  public Cnt = 0;	// frequency counter
  public Incr = 0;	// frequency counter step
  public FB = 0;	// feedback shift value
  public op1_out = [0, 0];	// slot1 output for feedback
  public CON = 0;	// connection (algorithm) type

  // Envelope Generator 
  public eg_type = 0;	// percussive/non-percussive mode 
  public state = 0;	// phase type
  public TL = 0;	// total level: TL << 2
  public TLL = 0;	// adjusted now TL
  public volume = 0;	// envelope counter
  public sl = 0;		// sustain level: sl_tab[SL]

  public eg_m_ar = 0;// (attack state)
  public eg_sh_ar = 0;	// (attack state)
  public eg_sel_ar = 0;	// (attack state)
  public eg_m_dr = 0;// (decay state)
  public eg_sh_dr = 0;	// (decay state)
  public eg_sel_dr = 0;	// (decay state)
  public eg_m_rr = 0;// (release state)
  public eg_sh_rr = 0;	// (release state)
  public eg_sel_rr = 0;	// (release state)

  public key = 0;	// 0 = KEY OFF, >0 = KEY ON

  // LFO 
  public AMmask = 0;	// LFO Amplitude Modulation enable mask 
  public vib = 0;	// LFO Phase Modulation enable flag (active high)

  // waveform select 
  public waveform_number = 0;
  public wavetable = 0;

  public connect = 0;	// slot output pointer
}

class Channel {
  public constructor() {
  }

  public chan_calc(LFO_AM: number): void {
    chanOut[PHASE_MOD1] = 0;
    chanOut[PHASE_MOD2] = 0;
    chanOut[PHASE_MOD1] = 0;
    chanOut[PHASE_MOD2] = 0;

    // SLOT 1 
    let env = this.slots[SLOT1].volume_calc(LFO_AM);
    let out = this.slots[SLOT1].op1_out[0] + this.slots[SLOT1].op1_out[1];
    this.slots[SLOT1].op1_out[0] = this.slots[SLOT1].op1_out[1];
    this.slots[SLOT1].op1_out[1] = 0;
    if (env < ENV_QUIET) {
      if (!this.slots[SLOT1].FB) {
        out = 0;
      }
      this.slots[SLOT1].op1_out[1] = op_calc1(this.slots[SLOT1].Cnt, env, (out << this.slots[SLOT1].FB), this.slots[SLOT1].wavetable);
    }
    chanOut[this.slots[SLOT1].connect] += this.slots[SLOT1].op1_out[1];

    // SLOT 2 
    env = this.slots[SLOT2].volume_calc(LFO_AM);
    if (env < ENV_QUIET) {
      chanOut[this.slots[SLOT2].connect] += op_calc(this.slots[SLOT2].Cnt, env, chanOut[PHASE_MOD1], this.slots[SLOT2].wavetable);
    }
  }

  public chan_calc_ext(LFO_AM: number): void {
    chanOut[PHASE_MOD1] = 0;

    // SLOT 1
    let env = this.slots[SLOT1].volume_calc(LFO_AM);
    if (env < ENV_QUIET) {
      chanOut[this.slots[SLOT1].connect] += op_calc(this.slots[SLOT1].Cnt, env, chanOut[PHASE_MOD2], this.slots[SLOT1].wavetable);
    }

    // SLOT 2
    env = this.slots[SLOT2].volume_calc(LFO_AM);
    if (env < ENV_QUIET) {
      chanOut[this.slots[SLOT2].connect] += op_calc(this.slots[SLOT2].Cnt, env, chanOut[PHASE_MOD1], this.slots[SLOT2].wavetable);
    }
  }

  public CALC_FCSLOT(slot: Slot): void {
    // (frequency) phase increment counter 
    slot.Incr = this.fc * slot.mul;
    const ksr = this.kcode >> slot.KSR;

    if (slot.ksr != ksr) {
      slot.ksr = ksr;

      // calculate envelope generator rates 
      if ((slot.ar + slot.ksr) < 16 + 60) {
        slot.eg_sh_ar = eg_rate_shift[slot.ar + slot.ksr];
        slot.eg_m_ar = (1 << slot.eg_sh_ar) - 1;
        slot.eg_sel_ar = eg_rate_select[slot.ar + slot.ksr];
      } else {
        slot.eg_sh_ar = 0;
        slot.eg_m_ar = (1 << slot.eg_sh_ar) - 1;
        slot.eg_sel_ar = 13 * RATE_STEPS;
      }
      slot.eg_sh_dr = eg_rate_shift[slot.dr + slot.ksr];
      slot.eg_m_dr = (1 << slot.eg_sh_dr) - 1;
      slot.eg_sel_dr = eg_rate_select[slot.dr + slot.ksr];
      slot.eg_sh_rr = eg_rate_shift[slot.rr + slot.ksr];
      slot.eg_m_rr = (1 << slot.eg_sh_rr) - 1;
      slot.eg_sel_rr = eg_rate_select[slot.rr + slot.ksr];
    }
  }

  public getState(): any {
    let state: any = {};

    state.slots = [];
    for (let i = 0; i < this.slots.length; i++) {
      state.slots[i] = this.slots[i].getState();
    }

    state.block_fnum = this.block_fnum;
    state.fc = this.fc;
    state.ksl_base = this.ksl_base;
    state.kcode = this.kcode;

    state.extended = this.extended;

    return state;
  }

  public setState(state: any): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].setState(state.slots[i]);
    }

    this.block_fnum = state.block_fnum;
    this.fc = state.fc;
    this.ksl_base = state.ksl_base;
    this.kcode = state.kcode;

    this.extended = state.extended;
  }

  public slots = [new Slot(), new Slot()];

  public block_fnum = 0;	// block+fnum
  public fc = 0;		// Freq. Increment base
  public ksl_base = 0;	// KeyScaleLevel Base step
  public kcode = 0;	// key code (for key scaling)

  // there are 12 2-operator channels which can be combined in pairs
  // to form six 4-operator channel, they are:
  //  0 and 3,
  //  1 and 4,
  //  2 and 5,
  //  9 and 12,
  //  10 and 13,
  //  11 and 14
  public extended = 0;	// set to 1 if this channel forms up a 4op channel with another channel(only used by first of pair of channels, ie 0,1,2 and 9,10,11) 
}

export class Ymf262 {
  constructor(
    private board: Board,
    private oplOversampling = 1
  ) {
    this.timer1 = this.board.getTimeoutManager().createTimer(name, this.onTimer1.bind(this));
    this.timer2 = this.board.getTimeoutManager().createTimer(name, this.onTimer2.bind(this));

    for (let i = 0; i < this.channels.length; i++) {
      this.channels[i] = new Channel();
    }

    init_tables();

    this.reset();
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

    const rhythmEnabled = (this.rhythm & 0x20) != 0;

    for (let bufferIndex = 0; bufferIndex < count; bufferIndex++) {
      let a = 0;
      let b = 0;
      let c = 0;
      let d = 0;
      let count = this.oplOversampling;
      while (count--) {
        this.advance_lfo();

        // clear channel outputs 
        for (let i = 0; i < 18; i++) {
          chanOut[i] = 0;
        }

        // register set #1 
        // extended 4op ch#0 part 1 or 2op ch#0 
        this.channels[0].chan_calc(this.LFO_AM);
        if (this.channels[0].extended) {
          // extended 4op ch#0 part 2 
          this.channels[3].chan_calc_ext(this.LFO_AM);
        } else {
          // standard 2op ch#3 
          this.channels[3].chan_calc(this.LFO_AM);
        }

        // extended 4op ch#1 part 1 or 2op ch#1 
        this.channels[1].chan_calc(this.LFO_AM);
        if (this.channels[1].extended) {
          // extended 4op ch#1 part 2 
          this.channels[4].chan_calc_ext(this.LFO_AM);
        } else {
          // standard 2op ch#4 
          this.channels[4].chan_calc(this.LFO_AM);
        }

        // extended 4op ch#2 part 1 or 2op ch#2 
        this.channels[2].chan_calc(this.LFO_AM);
        if (this.channels[2].extended) {
          // extended 4op ch#2 part 2 
          this.channels[5].chan_calc_ext(this.LFO_AM);
        } else {
          // standard 2op ch#5 
          this.channels[5].chan_calc(this.LFO_AM);
        }

        if (!rhythmEnabled) {
          this.channels[6].chan_calc(this.LFO_AM);
          this.channels[7].chan_calc(this.LFO_AM);
          this.channels[8].chan_calc(this.LFO_AM);
        } else {
          // Rhythm part 
          this.chan_calc_rhythm((this.noise_rng & 1) != 0);
        }

        // register set #2 
        this.channels[9].chan_calc(this.LFO_AM);
        if (this.channels[9].extended) {
          this.channels[12].chan_calc_ext(this.LFO_AM);
        } else {
          this.channels[12].chan_calc(this.LFO_AM);
        }

        this.channels[10].chan_calc(this.LFO_AM);
        if (this.channels[10].extended) {
          this.channels[13].chan_calc_ext(this.LFO_AM);
        } else {
          this.channels[13].chan_calc(this.LFO_AM);
        }

        this.channels[11].chan_calc(this.LFO_AM);
        if (this.channels[11].extended) {
          this.channels[14].chan_calc_ext(this.LFO_AM);
        } else {
          this.channels[14].chan_calc(this.LFO_AM);
        }

        // channels 15,16,17 are fixed 2-operator channels only 
        this.channels[15].chan_calc(this.LFO_AM);
        this.channels[16].chan_calc(this.LFO_AM);
        this.channels[17].chan_calc(this.LFO_AM);

        for (let i = 0; i < 18; i++) {
          a += chanOut[i] & this.pan[4 * i + 0];
          b += chanOut[i] & this.pan[4 * i + 1];
          c += chanOut[i] & this.pan[4 * i + 2];
          d += chanOut[i] & this.pan[4 * i + 3];
        }

        this.advance();
      }
      audioBufferLeft[bufferIndex] = (a << 3) / this.oplOversampling;
      audioBufferRight[bufferIndex] = (b << 3) / this.oplOversampling;
    }

    this.checkMute();

    return this.audioBuffer;
  }

  public reset(): void {
    this.eg_timer = 0;
    this.eg_cnt = 0;

    this.noise_rng = 1;	// noise shift register
    this.nts = 0;	// note split
    this.resetStatus(0x60);

    // reset with register write
    this.writeRegForce(0x01, 0); // test register
    this.writeRegForce(0x02, 0); // Timer1
    this.writeRegForce(0x03, 0); // Timer2
    this.writeRegForce(0x04, 0); // IRQ mask clear

    //FIX IT  registers 101, 104 and 105
    //FIX IT (dont change CH.D, CH.C, CH.B and CH.A in C0-C8 registers)
    for (let c = 0xFF; c >= 0x20; c--) {
      this.writeRegForce(c, 0);
    }
    //FIX IT (dont change CH.D, CH.C, CH.B and CH.A in C0-C8 registers)
    for (let c = 0x1FF; c >= 0x120; c--) {
      this.writeRegForce(c, 0);
    }

    // reset operator parameters 
    for (let c = 0; c < 9 * 2; c++) {
      const ch = this.channels[c];
      for (let s = 0; s < 2; s++) {
        ch.slots[s].state = EG_OFF;
        ch.slots[s].volume = MAX_ATT_INDEX;
      }
    }

    this.internalMute = true;
  }

  public writeReg(r: number, v: number): void {
    if (!this.OPL3_mode && (r != 0x105)) {
      // in OPL2 mode the only accessible in set #2 is register 0x05 
      r &= ~0x100;
    }
    this.writeRegForce(r, v);
    this.checkMute();
  }

  public readReg(reg: number): number {
    return this.reg[reg];
  }

  public readStatus(): number {
    const result = this.status | this.status2;
    this.status2 = 0;
    return result;
  }
  
  public setSampleRate(sampleRate: number): void {
    const CLCK_FREQ = 14318180;
    let freqbase = (CLCK_FREQ / (8.0 * 36)) / (sampleRate * this.oplOversampling);

    // make fnumber -> increment counter table 
    for (let i = 0; i < 1024; i++) {
      // opn phase increment counter = 20bit 
      // -10 because chip works with 10.10 fixed point, while we use 16.16 
      this.fn_tab[i] = i * 64 * freqbase * (1 << (FREQ_SH - 10)) | 0;
    }

    // Amplitude modulation: 27 output levels (triangle waveform);
    // 1 level takes one of: 192, 256 or 448 samples 
    // One entry from LFO_AM_TABLE lasts for 64 samples 
    this.lfo_am_inc = (1 << LFO_SH) * freqbase / 64 | 0;

    // Vibrato: 8 output levels (triangle waveform); 1 level takes 1024 samples
    this.lfo_pm_inc = (1 << LFO_SH) * freqbase / 1024 | 0;

    // Noise generator: a step takes 1 sample 
    this.noise_f = (1 << FREQ_SH) * freqbase | 0;

    this.eg_timer_add = (1 << EG_SH) * freqbase | 0;
  }

  private update_channels(channel: Channel): void {
  }
  
  private writeRegForce(r: number, v: number): void {
    this.reg[r] = v;

    let ch_offset = 0;
    if (r & 0x100) {
      switch (r) {
        case 0x101:	// test register
          return;

        case 0x104: { // 6 channels enable 
          const ch0 = this.channels[0];
          let prev = ch0.extended;
          ch0.extended = (v >> 0) & 1;
          if (prev != ch0.extended) {
            this.update_channels(ch0);
          }
          const ch1 = this.channels[1];
          prev = ch1.extended;
          ch1.extended = (v >> 1) & 1;
          if (prev != ch1.extended) {
            this.update_channels(ch1);
          }
          const ch2 = this.channels[2];
          prev = ch2.extended;
          ch2.extended = (v >> 2) & 1;
          if (prev != ch2.extended) {
            this.update_channels(ch2);
          }
          const ch9 = this.channels[9];
          prev = ch9.extended;
          ch9.extended = (v >> 3) & 1;
          if (prev != ch9.extended) {
            this.update_channels(ch9);
          }
          const ch10 = this.channels[10];
          prev = ch10.extended;
          ch10.extended = (v >> 4) & 1;
          if (prev != ch10.extended) {
            this.update_channels(ch10);
          }
          const ch11 = this.channels[11];
          prev = ch11.extended;
          ch11.extended = (v >> 5) & 1;
          if (prev != ch11.extended) {
            this.update_channels(ch11);
          }
          return;
        }
        case 0x105:	// OPL3 extensions enable register 
          // OPL3 mode when bit0=1 otherwise it is OPL2 mode 
          this.OPL3_mode = (v & 0x01) != 0;
          if (this.OPL3_mode) {
            this.status2 = 0x02;
          }

          // following behaviour was tested on real YMF262,
          // switching OPL3/OPL2 modes on the fly:
          //  - does not change the waveform previously selected
          //    (unless when ....)
          //  - does not update CH.A, CH.B, CH.C and CH.D output
          //    selectors (registers c0-c8) (unless when ....)
          //  - does not disable channels 9-17 on OPL3->OPL2 switch
          //  - does not switch 4 operator channels back to 2
          //    operator channels
          return;

        default:
          break;
      }
      ch_offset = 9;	// register page #2 starts from channel 9
    }

    r &= 0xFF;
    switch (r & 0xE0) {
      case 0x00: // 00-1F:control 
        switch (r & 0x1F) {
          case 0x01: // test register
            break;

          case 0x02: // Timer 1
            {
              const prev = this.timer1Period;
              this.timer1Period = 256 - v;
              if (this.timer1Period != prev || !this.timer1.isRunning()) {
                this.timer1.setTimeout(
                  this.board.getSystemTime() +
                  this.board.getSystemFrequency() / 12380 * this.timer1Period);
              }
            }
          break;

          case 0x03: // Timer 2 
            {
              const prev = this.timer2Period;
              this.timer2Period = 4 * (256 - v);
              if (this.timer2Period != prev || !this.timer2.isRunning()) {
                this.timer2.setTimeout(
                  this.board.getSystemTime() +
                  this.board.getSystemFrequency() / 12380 * this.timer2Period);
              }
            }
            break;

          case 0x04: // IRQ clear / mask and Timer enable 
            if (v & 0x80) {
              // IRQ flags clear 
              this.resetStatus(0x60);
            } else {
              this.changeStatusMask((~v) & 0x60);
              if ((v & R04_ST1) != 0) {
                this.timer1.setTimeout(
                  this.board.getSystemTime() +
                  this.board.getSystemFrequency() / 12380 * this.timer1Period);
              }
              else {
                this.timer1.stop();
              }
              if ((v & R04_ST2) != 0) {
                this.timer2.setTimeout(
                  this.board.getSystemTime() +
                  this.board.getSystemFrequency() / 12380 * this.timer2Period);
              }
              else {
                this.timer2.stop();
              }
            }
            break;

          case 0x08: // x,NTS,x,x, x,x,x,x
            this.nts = v;
            break;

          default:
            break;
        }
        break;

      case 0x20: { // am ON, vib ON, ksr, eg_type, mul 
        const slot = slot_array[r & 0x1F];
        if (slot < 0) return;
        this.set_mul(slot + ch_offset * 2, v);
        break;
      }
      case 0x40: {
        const slot = slot_array[r & 0x1F];
        if (slot < 0) return;
        this.set_ksl_tl(slot + ch_offset * 2, v);
        break;
      }
      case 0x60: {
        const slot = slot_array[r & 0x1F];
        if (slot < 0) return;
        this.set_ar_dr(slot + ch_offset * 2, v);
        break;
      }
      case 0x80: {
        const slot = slot_array[r & 0x1F];
        if (slot < 0) return;
        this.set_sl_rr(slot + ch_offset * 2, v);
        break;
      }
      case 0xA0: {
        if (r == 0xBD) {
          // am depth, vibrato depth, r,bd,sd,tom,tc,hh 
          if (ch_offset != 0) {
            // 0xbd register is present in set #1 only 
            return;
          }
          this.lfo_am_depth = v & 0x80;
          this.lfo_pm_depth_range = (v & 0x40) ? 8 : 0;
          this.rhythm = v & 0x3F;

          if (this.rhythm & 0x20) {
            // BD key on/off 
            if (v & 0x10) {
              this.channels[6].slots[SLOT1].FM_KEYON(2);
              this.channels[6].slots[SLOT2].FM_KEYON(2);
            } else {
              this.channels[6].slots[SLOT1].FM_KEYOFF(~2);
              this.channels[6].slots[SLOT2].FM_KEYOFF(~2);
            }
            // HH key on/off 
            if (v & 0x01) {
              this.channels[7].slots[SLOT1].FM_KEYON(2);
            } else {
              this.channels[7].slots[SLOT1].FM_KEYOFF(~2);
            }
            // SD key on/off 
            if (v & 0x08) {
              this.channels[7].slots[SLOT2].FM_KEYON(2);
            } else {
              this.channels[7].slots[SLOT2].FM_KEYOFF(~2);
            }
            // TOM key on/off 
            if (v & 0x04) {
              this.channels[8].slots[SLOT1].FM_KEYON(2);
            } else {
              this.channels[8].slots[SLOT1].FM_KEYOFF(~2);
            }
            // TOP-CY key on/off 
            if (v & 0x02) {
              this.channels[8].slots[SLOT2].FM_KEYON(2);
            } else {
              this.channels[8].slots[SLOT2].FM_KEYOFF(~2);
            }
          } else {
            // BD key off 
            this.channels[6].slots[SLOT1].FM_KEYOFF(~2);
            this.channels[6].slots[SLOT2].FM_KEYOFF(~2);
            // HH key off 
            this.channels[7].slots[SLOT1].FM_KEYOFF(~2);
            // SD key off 
            this.channels[7].slots[SLOT2].FM_KEYOFF(~2);
            // TOM key off 
            this.channels[8].slots[SLOT1].FM_KEYOFF(~2);
            // TOP-CY off 
            this.channels[8].slots[SLOT2].FM_KEYOFF(~2);
          }
          return;
        }

        // keyon,block,fnum 
        if ((r & 0x0F) > 8) {
          return;
        }
        const chan_no = (r & 0x0F) + ch_offset;
        const ch = this.channels[chan_no];
        const ch3 = this.channels[chan_no + 3];
        let block_fnum;
        if (!(r & 0x10)) {
          // a0-a8 
          block_fnum = (ch.block_fnum & 0x1F00) | v;
        } else {
          // b0-b8 
          block_fnum = ((v & 0x1F) << 8) | (ch.block_fnum & 0xFF);
          if (this.OPL3_mode) {
            // in OPL3 mode 
            // DO THIS:
            // if this is 1st channel forming up a 4-op channel
            // ALSO keyon/off slots of 2nd channel forming up 4-op channel
            // else normal 2 operator function keyon/off
            // OR THIS:
            // if this is 2nd channel forming up 4-op channel just do nothing
            // else normal 2 operator function keyon/off
            switch (chan_no) {
              case 0: case 1: case 2:
              case 9: case 10: case 11:
                if (ch.extended) {
                  //if this is 1st channel forming up a 4-op channel
                  //ALSO keyon/off slots of 2nd channel forming up 4-op channel
                  if (v & 0x20) {
                    ch.slots[SLOT1].FM_KEYON(1);
                    ch.slots[SLOT2].FM_KEYON(1);
                    ch3.slots[SLOT1].FM_KEYON(1);
                    ch3.slots[SLOT2].FM_KEYON(1);
                  } else {
                    ch.slots[SLOT1].FM_KEYOFF(~1);
                    ch.slots[SLOT2].FM_KEYOFF(~1);
                    ch3.slots[SLOT1].FM_KEYOFF(~1);
                    ch3.slots[SLOT2].FM_KEYOFF(~1);
                  }
                } else {
                  //else normal 2 operator function keyon/off
                  if (v & 0x20) {
                    ch.slots[SLOT1].FM_KEYON(1);
                    ch.slots[SLOT2].FM_KEYON(1);
                  } else {
                    ch.slots[SLOT1].FM_KEYOFF(~1);
                    ch.slots[SLOT2].FM_KEYOFF(~1);
                  }
                }
                break;

              case 3:
              case 4:
              case 5:
              case 12:
              case 13:
              case 14: {
                const ch_3 = this.channels[chan_no - 3];
                if (ch_3.extended) {
                  //if this is 2nd channel forming up 4-op channel just do nothing
                } else {
                  //else normal 2 operator function keyon/off
                  if (v & 0x20) {
                    ch.slots[SLOT1].FM_KEYON(1);
                    ch.slots[SLOT2].FM_KEYON(1);
                  } else {
                    ch.slots[SLOT1].FM_KEYOFF(~1);
                    ch.slots[SLOT2].FM_KEYOFF(~1);
                  }
                }
                break;
              }
              default:
                if (v & 0x20) {
                  ch.slots[SLOT1].FM_KEYON(1);
                  ch.slots[SLOT2].FM_KEYON(1);
                } else {
                  ch.slots[SLOT1].FM_KEYOFF(~1);
                  ch.slots[SLOT2].FM_KEYOFF(~1);
                }
                break;
            }
          } else {
            if (v & 0x20) {
              ch.slots[SLOT1].FM_KEYON(1);
              ch.slots[SLOT2].FM_KEYON(1);
            } else {
              ch.slots[SLOT1].FM_KEYOFF(~1);
              ch.slots[SLOT2].FM_KEYOFF(~1);
            }
          }
        }
        // update
        if (ch.block_fnum != block_fnum) {
          const block = block_fnum >> 10;
          ch.block_fnum = block_fnum;
          ch.ksl_base = ksl_tab[block_fnum >> 6];
          ch.fc = this.fn_tab[block_fnum & 0x03FF] >> (7 - block);

          // BLK 2,1,0 bits -> bits 3,2,1 of kcode 
          ch.kcode = (ch.block_fnum & 0x1C00) >> 9;

          // the info below is actually opposite to what is stated
          // in the Manuals (verifed on real YMF262)
          // if notesel == 0 -> lsb of kcode is bit 10 (MSB) of fnum  
          // if notesel == 1 -> lsb of kcode is bit 9 (MSB-1) of fnum 
          if (this.nts & 0x40) {
            ch.kcode |= (ch.block_fnum & 0x100) >> 8;	// notesel == 1 
          } else {
            ch.kcode |= (ch.block_fnum & 0x200) >> 9;	// notesel == 0 
          }
          if (this.OPL3_mode) {
            const chan_no = (r & 0x0F) + ch_offset;
            // in OPL3 mode 
            //DO THIS:
            //if this is 1st channel forming up a 4-op channel
            //ALSO update slots of 2nd channel forming up 4-op channel
            //else normal 2 operator function keyon/off
            //OR THIS:
            //if this is 2nd channel forming up 4-op channel just do nothing
            //else normal 2 operator function keyon/off
            switch (chan_no) {
              case 0: case 1: case 2:
              case 9: case 10: case 11:
                if (ch.extended) {
                  //if this is 1st channel forming up a 4-op channel
                  //ALSO update slots of 2nd channel forming up 4-op channel

                  // refresh Total Level in FOUR SLOTs of this channel and channel+3 using data from THIS channel 
                  ch.slots[SLOT1].TLL = ch.slots[SLOT1].TL + (ch.ksl_base >> ch.slots[SLOT1].ksl);
                  ch.slots[SLOT2].TLL = ch.slots[SLOT2].TL + (ch.ksl_base >> ch.slots[SLOT2].ksl);
                  ch3.slots[SLOT1].TLL = ch3.slots[SLOT1].TL + (ch.ksl_base >> ch3.slots[SLOT1].ksl);
                  ch3.slots[SLOT2].TLL = ch3.slots[SLOT2].TL + (ch.ksl_base >> ch3.slots[SLOT2].ksl);

                  // refresh frequency counter in FOUR SLOTs of this channel and channel+3 using data from THIS channel 
                  ch.CALC_FCSLOT(ch.slots[SLOT1]);
                  ch.CALC_FCSLOT(ch.slots[SLOT2]);
                  ch.CALC_FCSLOT(ch3.slots[SLOT1]);
                  ch.CALC_FCSLOT(ch3.slots[SLOT2]);
                } else {
                  //else normal 2 operator function
                  // refresh Total Level in both SLOTs of this channel 
                  ch.slots[SLOT1].TLL = ch.slots[SLOT1].TL + (ch.ksl_base >> ch.slots[SLOT1].ksl);
                  ch.slots[SLOT2].TLL = ch.slots[SLOT2].TL + (ch.ksl_base >> ch.slots[SLOT2].ksl);

                  // refresh frequency counter in both SLOTs of this channel 
                  ch.CALC_FCSLOT(ch.slots[SLOT1]);
                  ch.CALC_FCSLOT(ch.slots[SLOT2]);
                }
                break;

              case 3:
              case 4:
              case 5:
              case 12:
              case 13:
              case 14: {
                const ch_3 = this.channels[chan_no - 3];
                if (ch_3.extended) {
                  //if this is 2nd channel forming up 4-op channel just do nothing
                } else {
                  //else normal 2 operator function
                  // refresh Total Level in both SLOTs of this channel 
                  ch.slots[SLOT1].TLL = ch.slots[SLOT1].TL + (ch.ksl_base >> ch.slots[SLOT1].ksl);
                  ch.slots[SLOT2].TLL = ch.slots[SLOT2].TL + (ch.ksl_base >> ch.slots[SLOT2].ksl);

                  // refresh frequency counter in both SLOTs of this channel 
                  ch.CALC_FCSLOT(ch.slots[SLOT1]);
                  ch.CALC_FCSLOT(ch.slots[SLOT2]);
                }
                break;
              }
              default:
                // refresh Total Level in both SLOTs of this channel 
                ch.slots[SLOT1].TLL = ch.slots[SLOT1].TL + (ch.ksl_base >> ch.slots[SLOT1].ksl);
                ch.slots[SLOT2].TLL = ch.slots[SLOT2].TL + (ch.ksl_base >> ch.slots[SLOT2].ksl);

                // refresh frequency counter in both SLOTs of this channel 
                ch.CALC_FCSLOT(ch.slots[SLOT1]);
                ch.CALC_FCSLOT(ch.slots[SLOT2]);
                break;
            }
          } else {
            // in OPL2 mode 
            // refresh Total Level in both SLOTs of this channel 
            ch.slots[SLOT1].TLL = ch.slots[SLOT1].TL + (ch.ksl_base >> ch.slots[SLOT1].ksl);
            ch.slots[SLOT2].TLL = ch.slots[SLOT2].TL + (ch.ksl_base >> ch.slots[SLOT2].ksl);

            // refresh frequency counter in both SLOTs of this channel 
            ch.CALC_FCSLOT(ch.slots[SLOT1]);
            ch.CALC_FCSLOT(ch.slots[SLOT2]);
          }
        }
        break;
      }
      case 0xC0: {
        // CH.D, CH.C, CH.B, CH.A, FB(3bits), C 
        if ((r & 0xF) > 8) {
          return;
        }
        const chan_no = (r & 0x0F) + ch_offset;
        const ch = this.channels[chan_no];

        const base = chan_no * 4;
        if (this.OPL3_mode) {
          // OPL3 mode 
          this.pan[base + 0] = (v & 0x10) ? ~0 : 0;	// ch.A 
          this.pan[base + 1] = (v & 0x20) ? ~0 : 0;	// ch.B 
          this.pan[base + 2] = (v & 0x40) ? ~0 : 0;	// ch.C 
          this.pan[base + 3] = (v & 0x80) ? ~0 : 0;	// ch.D
        } else {
          // OPL2 mode - always enabled 
          this.pan[base + 0] = ~0;	// ch.A 
          this.pan[base + 1] = ~0;	// ch.B 
          this.pan[base + 2] = ~0;	// ch.C 
          this.pan[base + 3] = ~0;	// ch.D 
        }

        ch.slots[SLOT1].FB = (v >> 1) & 7 ? ((v >> 1) & 7) + 7 : 0;
        ch.slots[SLOT1].CON = v & 1;

        if (this.OPL3_mode) {
          switch (chan_no) {
            case 0: case 1: case 2:
            case 9: case 10: case 11:
              if (ch.extended) {
                const ch3 = this.channels[chan_no + 3];
                switch ((ch.slots[SLOT1].CON << 1) | ch3.slots[SLOT1].CON) {
                  case 0:
                    // 1 -> 2 -> 3 -> 4 - out 
                    ch.slots[SLOT1].connect = PHASE_MOD1;
                    ch.slots[SLOT2].connect = PHASE_MOD2;
                    ch3.slots[SLOT1].connect = PHASE_MOD1;
                    ch3.slots[SLOT2].connect = chan_no + 3;
                    break;

                  case 1:
                    // 1 -> 2 -\.
                    // 3 -> 4 -+- out 
                    ch.slots[SLOT1].connect = PHASE_MOD1;
                    ch.slots[SLOT2].connect = chan_no;
                    ch3.slots[SLOT1].connect = PHASE_MOD1;
                    ch3.slots[SLOT2].connect = chan_no + 3;
                    break;

                  case 2:
                    // 1 -----------\.
                    // 2 -> 3 -> 4 -+- out 
                    ch.slots[SLOT1].connect = chan_no;
                    ch.slots[SLOT2].connect = PHASE_MOD2;
                    ch3.slots[SLOT1].connect = PHASE_MOD1;
                    ch3.slots[SLOT2].connect = chan_no + 3;
                    break;

                  case 3:
                    // 1 ------\.
                    // 2 -> 3 -+- out
                    // 4 ------/     
                    ch.slots[SLOT1].connect = chan_no;
                    ch.slots[SLOT2].connect = PHASE_MOD2;
                    ch3.slots[SLOT1].connect = chan_no + 3;
                    ch3.slots[SLOT2].connect = chan_no + 3;
                    break;
                }
              } else {
                // 2 operators mode 
                ch.slots[SLOT1].connect = ch.slots[SLOT1].CON ? chan_no : PHASE_MOD1;
                ch.slots[SLOT2].connect = chan_no;
              }
              break;

            case 3:
            case 4:
            case 5:
            case 12:
            case 13:
            case 14: {
              const ch3 = this.channels[chan_no - 3];
              if (ch3.extended) {
                switch ((ch3.slots[SLOT1].CON << 1) | ch.slots[SLOT1].CON) {
                  case 0:
                    // 1 -> 2 -> 3 -> 4 - out 
                    ch3.slots[SLOT1].connect = PHASE_MOD1;
                    ch3.slots[SLOT2].connect = PHASE_MOD2;
                    ch.slots[SLOT1].connect = PHASE_MOD1;
                    ch.slots[SLOT2].connect = chan_no;
                    break;

                  case 1:
                    // 1 -> 2 -\.
                    // 3 -> 4 -+- out 
                    ch3.slots[SLOT1].connect = PHASE_MOD1;
                    ch3.slots[SLOT2].connect = chan_no - 3;
                    ch.slots[SLOT1].connect = PHASE_MOD1;
                    ch.slots[SLOT2].connect = chan_no;
                    break;

                  case 2:
                    // 1 -----------\.
                    // 2 -> 3 -> 4 -+- out 
                    ch3.slots[SLOT1].connect = chan_no - 3;
                    ch3.slots[SLOT2].connect = PHASE_MOD2;
                    ch.slots[SLOT1].connect = PHASE_MOD1;
                    ch.slots[SLOT2].connect = chan_no;
                    break;

                  case 3:
                    // 1 ------\.
                    // 2 -> 3 -+- out
                    // 4 ------/     
                    ch3.slots[SLOT1].connect = chan_no - 3;
                    ch3.slots[SLOT2].connect = PHASE_MOD2;
                    ch.slots[SLOT1].connect = chan_no;
                    ch.slots[SLOT2].connect = chan_no;
                    break;
                }
              } else {
                // 2 operators mode 
                ch.slots[SLOT1].connect = ch.slots[SLOT1].CON ? chan_no : PHASE_MOD1;
                ch.slots[SLOT2].connect = chan_no;
              }
              break;
            }
            default:
              // 2 operators mode 
              ch.slots[SLOT1].connect = ch.slots[SLOT1].CON ? chan_no : PHASE_MOD1;
              ch.slots[SLOT2].connect = chan_no;
              break;
          }
        } else {
          // OPL2 mode - always 2 operators mode
          ch.slots[SLOT1].connect = ch.slots[SLOT1].CON ? chan_no : PHASE_MOD1;
          ch.slots[SLOT2].connect = chan_no;
        }
        break;
      }
      case 0xE0: {
        // waveform select 
        let slot = slot_array[r & 0x1f];
        if (slot < 0) return;
        slot += ch_offset * 2;
        const ch = this.channels[slot >> 1];

        // store 3-bit value written regardless of current OPL2 or OPL3
        // mode... (verified on real YMF262) 
        v &= 7;
        ch.slots[slot & 1].waveform_number = v;
        // ... but select only waveforms 0-3 in OPL2 mode 
        if (!this.OPL3_mode) {
          v &= 3;
        }
        ch.slots[slot & 1].wavetable = v * SIN_LEN;
        break;
      }
    }
  }
  
  private setStatus(flag: number): void {
    // set status flag masking out disabled IRQs 
    this.status |= flag;
    if (this.status & this.statusMask) {
      this.status |= 0x80;
      this.board.setInt(InterruptVector.YMF262);
    }
  }

  private resetStatus(flag: number): void {
    // reset status flag 
    this.status &= ~flag;
    if (!(this.status & this.statusMask)) {
      this.status &= 0x7f;
      this.board.clearInt(InterruptVector.YMF262);
    }
  }

  private changeStatusMask(flag: number): void {
    this.statusMask = flag;
    this.status &= this.statusMask;
    if (this.status) {
      this.status |= 0x80;
      this.board.setInt(InterruptVector.YMF262);
    } else {
      this.status &= 0x7f;
      this.board.clearInt(InterruptVector.YMF262);
    }
  }

  private advance_lfo(): void {
    // LFO 
    this.lfo_am_cnt += this.lfo_am_inc;
    if (this.lfo_am_cnt >= (LFO_AM_TAB_ELEMENTS << LFO_SH)) {
      // lfo_am_table is 210 elements long 
      this.lfo_am_cnt -= (LFO_AM_TAB_ELEMENTS << LFO_SH);
    }

    const tmp = lfo_am_table[this.lfo_am_cnt >> LFO_SH];
    if (this.lfo_am_depth) {
      this.LFO_AM = tmp;
    } else {
      this.LFO_AM = tmp >> 2;
    }
    this.lfo_pm_cnt = this.lfo_pm_cnt + this.lfo_pm_inc & LFO_MASK;
    this.LFO_PM = ((this.lfo_pm_cnt >> LFO_SH) & 7) | this.lfo_pm_depth_range;
  }

  private advance(): void {
    this.eg_timer += this.eg_timer_add;

    if (this.eg_timer > 4 * EG_TIMER_OVERFLOW) {
      this.eg_timer = EG_TIMER_OVERFLOW;
    }
    while (this.eg_timer >= EG_TIMER_OVERFLOW) {
      this.eg_timer -= EG_TIMER_OVERFLOW;
      this.eg_cnt++;

      for (let i = 0; i < 18 * 2; i++) {
        const ch = this.channels[i >> 1];
        const op = ch.slots[i & 1];
        // Envelope Generator 
        switch (op.state) {
          case EG_ATT:	// attack phase 
            if (!(this.eg_cnt & op.eg_m_ar)) {
              op.volume += (~op.volume * eg_inc[op.eg_sel_ar + ((this.eg_cnt >> op.eg_sh_ar) & 7)]) >> 3;
              if (op.volume <= MIN_ATT_INDEX) {
                op.volume = MIN_ATT_INDEX;
                op.state = EG_DEC;
              }
            }
            break;

          case EG_DEC:	// decay phase 
            if (!(this.eg_cnt & op.eg_m_dr)) {
              op.volume += eg_inc[op.eg_sel_dr + ((this.eg_cnt >> op.eg_sh_dr) & 7)];
              if (op.volume >= op.sl) {
                op.state = EG_SUS;
              }
            }
            break;

          case EG_SUS:	// sustain phase 
            // this is important behaviour:
            // one can change percusive/non-percussive
            // modes on the fly and the chip will remain
            // in sustain phase - verified on real YM3812 
            if (op.eg_type) {
              // non-percussive mode 
              // do nothing 
            } else {
              // percussive mode 
              // during sustain phase chip adds Release Rate (in percussive mode) 
              if (!(this.eg_cnt & op.eg_m_rr)) {
                op.volume += eg_inc[op.eg_sel_rr + ((this.eg_cnt >> op.eg_sh_rr) & 7)];
                if (op.volume >= MAX_ATT_INDEX) {
                  op.volume = MAX_ATT_INDEX;
                }
              } else {
                // do nothing in sustain phase
              }
            }
            break;

          case EG_REL:	// release phase 
            if (!(this.eg_cnt & op.eg_m_rr)) {
              op.volume += eg_inc[op.eg_sel_rr + ((this.eg_cnt >> op.eg_sh_rr) & 7)];
              if (op.volume >= MAX_ATT_INDEX) {
                op.volume = MAX_ATT_INDEX;
                op.state = EG_OFF;
              }
            }
            break;

          default:
            break;
        }
      }
    }

    let i = 0;
    for (i = 0; i < 18 * 2; i++) {
      const ch = this.channels[i >> 1];
      const op = ch.slots[i & 1];

      // Phase Generator 
      if (op.vib) {
        let block = 0;
        let block_fnum = ch.block_fnum;
        const fnum_lfo = (block_fnum & 0x0380) >> 7;
        const lfo_fn_table_index_offset = lfo_pm_table[this.LFO_PM + 16 * fnum_lfo];

        if (lfo_fn_table_index_offset) {
          // LFO phase modulation active 
          block_fnum += lfo_fn_table_index_offset;
          block = (block_fnum & 0x1c00) >> 10;
          op.Cnt += (this.fn_tab[block_fnum & 0x03ff] >> (7 - block)) * op.mul;
        } else {
          // LFO phase modulation  = zero 
          op.Cnt += op.Incr;
        }
      } else {
        // LFO phase modulation disabled for this operator 
        op.Cnt += op.Incr;
      }
    }

    // The Noise Generator of the YM3812 is 23-bit shift register.
    // Period is equal to 2^23-2 samples.
    // Register works at sampling frequency of the chip, so output
    // can change on every sample.
    //
    // Output of the register and input to the bit 22 is:
    // bit0 XOR bit14 XOR bit15 XOR bit22
    //
    // Simply use bit 22 as the noise output.
    this.noise_p +=this. noise_f;
    i = (this.noise_p >> FREQ_SH) & 0x1f;		// number of events (shifts of the shift register) 
    this.noise_p &= FREQ_MASK;
    while (i--) {
      // unsigned j = ( (noise_rng) ^ (noise_rng>>14) ^ (noise_rng>>15) ^ (noise_rng>>22) ) & 1;
      // noise_rng = (j<<22) | (noise_rng>>1);
      //
      // Instead of doing all the logic operations above, we
      // use a trick here (and use bit 0 as the noise output).
      // The difference is only that the noise bit changes one
      // step ahead. This doesn't matter since we don't know
      // what is real state of the noise_rng after the reset.

      if (this.noise_rng & 1) {
        this.noise_rng ^= 0x800302;
      }
      this.noise_rng >>= 1;
    }
  }

  private chan_calc_rhythm(noise: boolean): void {
    const SLOT6_1 = this.channels[6].slots[SLOT1];
    const SLOT6_2 = this.channels[6].slots[SLOT2];
    const SLOT7_1 = this.channels[7].slots[SLOT1];
    const SLOT7_2 = this.channels[7].slots[SLOT2];
    const SLOT8_1 = this.channels[8].slots[SLOT1];
    const SLOT8_2 = this.channels[8].slots[SLOT2];

    // Bass Drum (verified on real YM3812):
    //  - depends on the channel 6 'connect' register:
    //      when connect = 0 it works the same as in normal (non-rhythm) mode (op1->op2->out)
    //      when connect = 1 _only_ operator 2 is present on output (op2->out), operator 1 is ignored
    //  - output sample always is multiplied by 2

    chanOut[PHASE_MOD1] = 0;

    // SLOT 1 
    let env = SLOT6_1.volume_calc(this.LFO_AM);
    let out = SLOT6_1.op1_out[0] + SLOT6_1.op1_out[1];
    SLOT6_1.op1_out[0] = SLOT6_1.op1_out[1];

    if (!SLOT6_1.CON) {
      chanOut[PHASE_MOD1] = SLOT6_1.op1_out[0];
    } else {
      // ignore output of operator 1
    }

    SLOT6_1.op1_out[1] = 0;
    if (env < ENV_QUIET) {
      if (!SLOT6_1.FB) {
        out = 0;
      }
      SLOT6_1.op1_out[1] = op_calc1(SLOT6_1.Cnt, env, (out << SLOT6_1.FB), SLOT6_1.wavetable);
    }

    // SLOT 2 
    env = SLOT6_2.volume_calc(this.LFO_AM);
    if (env < ENV_QUIET) {
      chanOut[6] += op_calc(SLOT6_2.Cnt, env, chanOut[PHASE_MOD1], SLOT6_2.wavetable) * 2;
    }

    // Phase generation is based on: 
    // HH  (13) channel 7->slot 1 combined with channel 8->slot 2 (same combination as TOP CYMBAL but different output phases)
    // SD  (16) channel 7->slot 1
    // TOM (14) channel 8->slot 1
    // TOP (17) channel 7->slot 1 combined with channel 8->slot 2 (same combination as HIGH HAT but different output phases)

    // Envelope generation based on: 
    // HH  channel 7->slot1
    // SD  channel 7->slot2
    // TOM channel 8->slot1
    // TOP channel 8->slot2

    // The following formulas can be well optimized.
    // I leave them in direct form for now (in case I've missed something).

    // High Hat (verified on real YM3812) 
    env = SLOT7_1.volume_calc(this.LFO_AM);
    if (env < ENV_QUIET) {
      // high hat phase generation:
      // phase = d0 or 234 (based on frequency only)
      // phase = 34 or 2d0 (based on noise)

      // base frequency derived from operator 1 in channel 7 
      const bit7 = ((SLOT7_1.Cnt >> FREQ_SH) & 0x80) != 0;
      const bit3 = ((SLOT7_1.Cnt >> FREQ_SH) & 0x08) != 0;
      const bit2 = ((SLOT7_1.Cnt >> FREQ_SH) & 0x04) != 0;
      const res1 = (bit2 !== bit7) || bit3;
      // when res1 = 0 phase = 0x000 | 0xd0; 
      // when res1 = 1 phase = 0x200 | (0xd0>>2); 
      let phase = res1 ? (0x200 | (0xd0 >> 2)) : 0xd0;

      // enable gate based on frequency of operator 2 in channel 8 
      const bit5e = ((SLOT8_2.Cnt >> FREQ_SH) & 0x20) != 0;
      const bit3e = ((SLOT8_2.Cnt >> FREQ_SH) & 0x08) != 0;
      const res2 = bit3e !== bit5e;
      // when res2 = 0 pass the phase from calculation above (res1); 
      // when res2 = 1 phase = 0x200 | (0xd0>>2); 
      if (res2) {
        phase = (0x200 | (0xd0 >> 2));
      }

      // when phase & 0x200 is set and noise=1 then phase = 0x200|0xd0 
      // when phase & 0x200 is set and noise=0 then phase = 0x200|(0xd0>>2), ie no change 
      if (phase & 0x200) {
        if (noise) {
          phase = 0x200 | 0xd0;
        }
      } else {
        // when phase & 0x200 is clear and noise=1 then phase = 0xd0>>2 
        // when phase & 0x200 is clear and noise=0 then phase = 0xd0, ie no change 
        if (noise) {
          phase = 0xd0 >> 2;
        }
      }
      chanOut[7] += op_calc(phase << FREQ_SH, env, 0, SLOT7_1.wavetable) * 2;
    }

    // Snare Drum (verified on real YM3812) 
    env = SLOT7_2.volume_calc(this.LFO_AM);
    if (env < ENV_QUIET) {
      // base frequency derived from operator 1 in channel 7 
      const bit8 = ((SLOT7_1.Cnt >> FREQ_SH) & 0x100) != 0;
      // when bit8 = 0 phase = 0x100; 
      // when bit8 = 1 phase = 0x200; 
      let phase = bit8 ? 0x200 : 0x100;

      // Noise bit XOR'es phase by 0x100 
      // when noisebit = 0 pass the phase from calculation above 
      // when noisebit = 1 phase ^= 0x100;
      // in other words: phase ^= (noisebit<<8); 
      if (noise) {
        phase ^= 0x100;
      }
      chanOut[7] += op_calc(phase << FREQ_SH, env, 0, SLOT7_2.wavetable) * 2;
    }

    // Tom Tom (verified on real YM3812) 
    env = SLOT8_1.volume_calc(this.LFO_AM);
    if (env < ENV_QUIET) {
      chanOut[8] += op_calc(SLOT8_1.Cnt, env, 0, SLOT8_1.wavetable) * 2;
    }

    // Top Cymbal (verified on real YM3812) 
    env = SLOT8_2.volume_calc(this.LFO_AM);
    if (env < ENV_QUIET) {
      // base frequency derived from operator 1 in channel 7 
      const bit7 = ((SLOT7_1.Cnt >> FREQ_SH) & 0x80) != 0;
      const bit3 = ((SLOT7_1.Cnt >> FREQ_SH) & 0x08) != 0;
      const bit2 = ((SLOT7_1.Cnt >> FREQ_SH) & 0x04) != 0;
      const res1 = (bit2 !== bit7) || bit3;
      // when res1 = 0 phase = 0x000 | 0x100; 
      // when res1 = 1 phase = 0x200 | 0x100; 
      let phase = res1 ? 0x300 : 0x100;

      // enable gate based on frequency of operator 2 in channel 8 
      const bit5e = ((SLOT8_2.Cnt >> FREQ_SH) & 0x20) != 0;
      const bit3e = ((SLOT8_2.Cnt >> FREQ_SH) & 0x08) != 0;
      const res2 = bit3e !== bit5e;
      // when res2 = 0 pass the phase from calculation above (res1);
      // when res2 = 1 phase = 0x200 | 0x100; 
      if (res2) {
        phase = 0x300;
      }
      chanOut[8] += op_calc(phase << FREQ_SH, env, 0, SLOT8_2.wavetable) * 2;
    }
  }

  private set_mul(sl: number, v: number): void {
    const chan_no = sl >> 1;
    const ch  = this.channels[chan_no];
    const slot = ch.slots[sl & 1];

    slot.mul = mul_tab[v & 0x0f];
    slot.KSR = (v & 0x10) ? 0 : 2;
    slot.eg_type = (v & 0x20);
    slot.vib = (v & 0x40);
    slot.AMmask = (v & 0x80) ? ~0 : 0;

    if (this.OPL3_mode) {
      // in OPL3 mode
      // DO THIS:
      //  if this is one of the slots of 1st channel forming up a 4-op channel
      //  do normal operation
      //  else normal 2 operator function
      // OR THIS:
      //  if this is one of the slots of 2nd channel forming up a 4-op channel
      //  update it using channel data of 1st channel of a pair
      //  else normal 2 operator function
      switch (chan_no) {
        case 0:
        case 1:
        case 2:
        case 9:
        case 10:
        case 11:
          if (ch.extended) {
            // normal
            ch.CALC_FCSLOT(slot);
          } else {
            // normal 
            ch.CALC_FCSLOT(slot);
          }
          break;
        case 3:
        case 4:
        case 5:
        case 12:
        case 13:
        case 14: {
          const ch3 = this.channels[chan_no - 3];
          if (ch3.extended) {
            // update this slot using frequency data for 1st channel of a pair 
            ch3.CALC_FCSLOT(slot);
          } else {
            // normal 
            ch.CALC_FCSLOT(slot);
          }
          break;
        }
        default:
          // normal 
          ch.CALC_FCSLOT(slot);
          break;
      }
    } else {
      // in OPL2 mode 
      ch.CALC_FCSLOT(slot);
    }
  }

  private set_ksl_tl(sl: number, v: number): void {
    const chan_no = sl >> 1;
    const ch = this.channels[chan_no];
    const slot = ch.slots[sl & 1];

    const ksl = v >> 6; // 0 / 1.5 / 3.0 / 6.0 dB/OCT 

    slot.ksl = ksl ? 3 - ksl : 31;
    slot.TL = (v & 0x3F) << (ENV_BITS - 1 - 7); // 7 bits TL (bit 6 = always 0) 

    if (this.OPL3_mode) {

      // in OPL3 mode 
      //DO THIS:
      //if this is one of the slots of 1st channel forming up a 4-op channel
      //do normal operation
      //else normal 2 operator function
      //OR THIS:
      //if this is one of the slots of 2nd channel forming up a 4-op channel
      //update it using channel data of 1st channel of a pair
      //else normal 2 operator function
      switch (chan_no) {
        case 0:
        case 1:
        case 2:
        case 9:
        case 10:
        case 11:
          if (ch.extended) {
            // normal 
            slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
          } else {
            // normal 
            slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
          }
          break;
        case 3:
        case 4:
        case 5:
        case 12:
        case 13:
        case 14: {
          const ch3 = this.channels[chan_no - 3];
          if (ch3.extended) {
            // update this slot using frequency data for 1st channel of a pair 
            slot.TLL = slot.TL + (ch3.ksl_base >> slot.ksl);
          } else {
            // normal 
            slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
          }
          break;
        }
        default:
          // normal
          slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
          break;
      }
    } else {
      // in OPL2 mode 
      slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
    }
  }

  private set_ar_dr(sl: number, v: number): void {
    const ch = this.channels[sl >> 1];
    const slot = ch.slots[sl & 1];

    slot.ar = (v >> 4) ? 16 + ((v >> 4) << 2) : 0;

    if ((slot.ar + slot.ksr) < 16 + 60) {
      // verified on real YMF262 - all 15 x rates take "zero" time 
      slot.eg_sh_ar = eg_rate_shift[slot.ar + slot.ksr];
      slot.eg_m_ar = (1 << slot.eg_sh_ar) - 1;
      slot.eg_sel_ar = eg_rate_select[slot.ar + slot.ksr];
    } else {
      slot.eg_sh_ar = 0;
      slot.eg_m_ar = (1 << slot.eg_sh_ar) - 1;
      slot.eg_sel_ar = 13 * RATE_STEPS;
    }

    slot.dr = (v & 0x0f) ? 16 + ((v & 0x0f) << 2) : 0;
    slot.eg_sh_dr = eg_rate_shift[slot.dr + slot.ksr];
    slot.eg_m_dr = (1 << slot.eg_sh_dr) - 1;
    slot.eg_sel_dr = eg_rate_select[slot.dr + slot.ksr];
  }

  private set_sl_rr(sl: number, v: number): void {
    const ch = this.channels[sl >> 1];
    const slot = ch.slots[sl & 1];

    slot.sl = sl_tab[v >> 4];
    slot.rr = (v & 0x0f) ? 16 + ((v & 0x0f) << 2) : 0;
    slot.eg_sh_rr = eg_rate_shift[slot.rr + slot.ksr];
    slot.eg_m_rr = (1 << slot.eg_sh_rr) - 1;
    slot.eg_sel_rr = eg_rate_select[slot.rr + slot.ksr];
  }
  
  private checkMute(): void {
    this.internalMute = !this.anyActive();
  }

  private anyActive(): boolean {
    for (let i = 0; i < 18; i++) {
      for (let j = 0; j < 2; j++) {
        const sl = this.channels[i].slots[j];
        if (!((sl.state == EG_OFF) ||
          ((sl.state == EG_REL) &&
            ((sl.TLL + sl.volume) >= ENV_QUIET)))) {
          return true;
        }
      }
    }
    return false;
  }

  private checkMuteHelper(): boolean {
    return false;
  }

  private onTimer1(): void {
    this.setStatus(STATUS_T1);
    this.timer1.addTimeout(this.board.getSystemFrequency() / 12380 * this.timer1Period);
  }

  private onTimer2(): void {
    this.setStatus(STATUS_T2);
    this.timer2.addTimeout(this.board.getSystemFrequency() / 12380 * this.timer2Period);
  }

  public getState(): any {
    let state: any = {};

    state.timer1 = this.timer1.getState();
    state.timer2 = this.timer2.getState();

    state.timer1Period = this.timer1Period;
    state.timer2Period = this.timer2Period;

    state.channels = []
    for (let i = 0; i < this.channels.length; i++) {
      state.channels[i] = this.channels[i].getState();
    }

    state.reg = SaveState.getArrayState(this.reg);
    state.pan = SaveState.getArrayState(this.pan);

    state.eg_cnt = this.eg_cnt;
    state.eg_timer = this.eg_timer;
    state.eg_timer_add = this.eg_timer_add;

    state.fn_tab = SaveState.getArrayState(this.fn_tab);

    state.LFO_AM = this.LFO_AM;
    state.LFO_PM = this.LFO_PM;

    state.lfo_am_depth = this.lfo_am_depth;
    state.lfo_pm_depth_range = this.lfo_pm_depth_range;
    state.lfo_am_cnt = this.lfo_am_cnt;
    state.lfo_am_inc = this.lfo_am_inc;
    state.lfo_pm_cnt = this.lfo_pm_cnt;
    state.lfo_pm_inc = this.lfo_pm_inc;

    state.noise_rng = this.noise_rng;
    state.noise_p = this.noise_p;
    state.noise_f = this.noise_f;

    state.OPL3_mode = this.OPL3_mode;
    state.rhythm = this.rhythm;
    state.nts = this.nts;

    state.status = this.status;
    state.status2 = this.status2;
    state.statusMask = this.statusMask;

    state.internalMute = this.internalMute;

    return state;
  }

  public setState(state: any): void {
    this.timer1.setState(state.timer1);
    this.timer2.setState(state.timer2);

    state.timer1Period = state.timer1Period;
    state.timer2Period = state.timer2Period;
    
    for (let i = 0; i < this.channels.length; i++) {
      this.channels[i].setState(state.channels[i]);
    }

    SaveState.setArrayState(this.reg, state.reg);
    SaveState.setArrayState(this.pan, state.pan);

    this.eg_cnt = state.eg_cnt;
    this.eg_timer = state.eg_timer;
    this.eg_timer_add = state.eg_timer_add;

    SaveState.setArrayState(this.fn_tab, state.fn_tab);

    this.LFO_AM = state.LFO_AM;
    this.LFO_PM = state.LFO_PM;

    this.lfo_am_depth = state.lfo_am_depth;
    this.lfo_pm_depth_range = state.lfo_pm_depth_range;
    this.lfo_am_cnt = state.lfo_am_cnt;
    this.lfo_am_inc = state.lfo_am_inc;
    this.lfo_pm_cnt = state.lfo_pm_cnt;
    this.lfo_pm_inc = state.lfo_pm_inc;

    this.noise_rng = state.noise_rng;
    this.noise_p = state.noise_p;
    this.noise_f = state.noise_f;

    this.OPL3_mode = state.OPL3_mode;
    this.rhythm = state.rhythm;
    this.nts = state.nts;

    this.status = state.status;
    this.status2 = state.status2;
    this.statusMask = state.statusMask;

    this.internalMute = state.internalMute;
  }

  private timer1: Timer;
  private timer2: Timer;

  private timer1Period = 0;
  private timer2Period = 0;

  channels = new Array<Channel>(18);

  private reg = new Uint8Array(512);

  private pan = new Uint32Array(18 * 4);		// channels output masks (0xffffffff = enable); 4 masks per one channel 

  private eg_cnt = 0;		// global envelope generator counter
  private eg_timer = 0;		// global envelope generator counter works at frequency = chipclock/288 (288=8*36) 
  private eg_timer_add = 0;		// step of eg_timer

  private fn_tab = new Uint32Array(1024);		// fnumber->increment counter

  // LFO 
  private LFO_AM = 0;
  private LFO_PM = 0;

  private lfo_am_depth = 0;
  private lfo_pm_depth_range = 0;
  private lfo_am_cnt = 0;
  private lfo_am_inc = 0;
  private lfo_pm_cnt = 0;
  private lfo_pm_inc = 0;

  private noise_rng = 0;		// 23 bit noise shift register
  private noise_p = 0;		// current noise 'phase'
  private noise_f = 0;		// current noise period

  private OPL3_mode = false;			// OPL3 extension enable flag
  private rhythm = 0;			// Rhythm mode
  private nts = 0;			// NTS (note select)

  private status = 0;			// status flag
  private status2 = 0;
  private statusMask = 0;		// status mask

  private audioBuffer = [new Float32Array(8192), new Float32Array(8192)];

  private internalMute = true;
}
