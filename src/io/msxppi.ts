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

import { IoManager, Port } from '../core/iomanager';
import { SlotManager } from '../core/slotmanager';
import { I8255 } from './i8255';

export enum Key {
  EC_NONE,
  EC_F1,
  EC_F2,
  EC_F3,
  EC_F4,
  EC_F5,
  EC_STOP,
  EC_CLS,
  EC_SELECT,
  EC_INS,
  EC_DEL,

  // ROW 1
  EC_ESC,
  EC_1,
  EC_2,
  EC_3,
  EC_4,
  EC_5,
  EC_6,
  EC_7,
  EC_8,
  EC_9,
  EC_0,
  EC_NEG,
  EC_CIRCFLX,
  EC_BKSLASH,
  EC_BKSPACE,

  // ROW 2
  EC_TAB,
  EC_Q,
  EC_W,
  EC_E,
  EC_R,
  EC_T,
  EC_Y,
  EC_U,
  EC_I,
  EC_O,
  EC_P,
  EC_AT,
  EC_LBRACK,
  EC_RETURN,

  // ROW 3
  EC_CTRL,
  EC_A,
  EC_S,
  EC_D,
  EC_F,
  EC_G,
  EC_H,
  EC_J,
  EC_K,
  EC_L,
  EC_SEMICOL,
  EC_COLON,
  EC_RBRACK,

  // ROW 4
  EC_LSHIFT,
  EC_Z,
  EC_X,
  EC_C,
  EC_V,
  EC_B,
  EC_N,
  EC_M,
  EC_COMMA,
  EC_PERIOD,
  EC_DIV,
  EC_UNDSCRE,
  EC_RSHIFT,

  // ROW 5
  EC_CAPS,
  EC_GRAPH,
  EC_TORIKE,
  EC_SPACE,
  EC_JIKKOU,
  EC_CODE,
  EC_PAUSE,

  // ARROWS
  EC_LEFT,
  EC_UP,
  EC_DOWN,
  EC_RIGHT,

  // NUMERIC KEYBOARD
  EC_NUM7,
  EC_NUM8,
  EC_NUM9,
  EC_NUMDIV,
  EC_NUM4,
  EC_NUM5,
  EC_NUM6,
  EC_NUMMUL,
  EC_NUM1,
  EC_NUM2,
  EC_NUM3,
  EC_NUMSUB,
  EC_NUM0,
  EC_NUMPER,
  EC_NUMCOM,
  EC_NUMADD
};

export class MsxPpi {
  constructor(
    private ioManager: IoManager, 
    private slotManager: SlotManager) {
    this.readA = this.readA.bind(this);
    this.readB = this.readB.bind(this);
    this.readCLo = this.readCLo.bind(this);
    this.readCHi = this.readCHi.bind(this);
    this.writeA = this.writeA.bind(this);
    this.writeB = this.writeB.bind(this);
    this.writeCLo = this.writeCLo.bind(this);
    this.writeCHi = this.writeCHi.bind(this);

    this.i8255 = new I8255(this.readA, this.writeA, this.readB, this.writeB, this.readCLo, this.writeCLo, this.readCHi, this.writeCHi);
    this.ioManager.registerPort(0xa8, new Port(this.i8255.read, this.i8255.write));
    this.ioManager.registerPort(0xa9, new Port(this.i8255.read, this.i8255.write));
    this.ioManager.registerPort(0xaa, new Port(this.i8255.read, this.i8255.write));
    this.ioManager.registerPort(0xab, new Port(this.i8255.read, this.i8255.write));

    for (let i = 0; i < 128; i++) {
      this.s[i] = 0;
    }
  }

  private row = 0;
  private regA = 0;
  private regCHi = 0;
  private i8255: I8255;

  reset(): void {
    this.row = 0;
    this.regA = 0;
    this.regCHi = 0;

    this.i8255.reset();
  }

  public keyDown(key: Key) {
    this.s[key] = 1;
  }

  public keyUp(key: Key) {
    this.s[key] = 0;
  }

  private writeA(value: number) {
    if (value != this.regA) {
      this.regA = value;
      for (let i = 0; i < 4; i++) {
        this.slotManager.setRamSlot(i, value & 3);
        value >>= 2;
      }
    }
  }

  private writeB(value: number) { }

  private writeCLo(value: number) {
    this.row = value;
  }

  private writeCHi(value: number) {
    if (value != this.regCHi) {
      this.regCHi = value;
    }
  }

  private readA(): number {
    return 0xff;
  }

  private readB(): number {
    switch (this.row) {
      case 0: return ~(
        this.s[Key.EC_7] << 7 | this.s[Key.EC_6] << 6 | this.s[Key.EC_5] << 5 | this.s[Key.EC_4] << 4 |
        this.s[Key.EC_3] << 3 | this.s[Key.EC_2] << 2 | this.s[Key.EC_1] << 1 | this.s[Key.EC_0]
      );
      case 1: return ~(
        this.s[Key.EC_SEMICOL] << 7 | this.s[Key.EC_LBRACK] << 6 | this.s[Key.EC_AT] << 5 | this.s[Key.EC_BKSLASH] << 4 | 
        this.s[Key.EC_CIRCFLX] << 3 | this.s[Key.EC_NEG] << 2 | this.s[Key.EC_9] << 1 | this.s[Key.EC_8]
      );
      case 2: return ~(
        this.s[Key.EC_B] << 7 | this.s[Key.EC_A] << 6 | this.s[Key.EC_UNDSCRE] << 5 | this.s[Key.EC_DIV] << 4 | 
        this.s[Key.EC_PERIOD] << 3 | this.s[Key.EC_COMMA] << 2 | this.s[Key.EC_RBRACK] << 1 | this.s[Key.EC_COLON]
      );
      case 3: return ~(
        this.s[Key.EC_J] << 7 | this.s[Key.EC_I] << 6 | this.s[Key.EC_H] << 5 | this.s[Key.EC_G] << 4 | 
        this.s[Key.EC_F] << 3 | this.s[Key.EC_E] << 2 | this.s[Key.EC_D] << 1 | this.s[Key.EC_C]
      );
      case 4: return ~(
        this.s[Key.EC_R] << 7 | this.s[Key.EC_Q] << 6 | this.s[Key.EC_P] << 5 | this.s[Key.EC_O] << 4 | 
        this.s[Key.EC_N] << 3 | this.s[Key.EC_M] << 2 | this.s[Key.EC_L] << 1 | this.s[Key.EC_K]
      );
      case 5: return ~(
        this.s[Key.EC_Z] << 7 | this.s[Key.EC_Y] << 6 | this.s[Key.EC_X] << 5 | this.s[Key.EC_W] << 4 | 
        this.s[Key.EC_V] << 3 | this.s[Key.EC_U] << 2 | this.s[Key.EC_T] << 1 | this.s[Key.EC_S]
      );
      case 6: return ~(
        this.s[Key.EC_F3] << 7 | this.s[Key.EC_F2] << 6 | this.s[Key.EC_F1] << 5 | this.s[Key.EC_CODE] << 4 | 
        this.s[Key.EC_CAPS] << 3 | this.s[Key.EC_GRAPH] << 2 | this.s[Key.EC_CTRL] << 1 | this.s[Key.EC_LSHIFT] | this.s[Key.EC_RSHIFT]
      );
      case 7: return ~(
        this.s[Key.EC_RETURN] << 7 | this.s[Key.EC_SELECT] << 6 | this.s[Key.EC_BKSPACE] << 5 | this.s[Key.EC_STOP] << 4 | 
        this.s[Key.EC_TAB] << 3 | this.s[Key.EC_ESC] << 2 | this.s[Key.EC_F5] << 1 | this.s[Key.EC_F4]
        );
      case 8: return ~(
        this.s[Key.EC_RIGHT] << 7 | this.s[Key.EC_DOWN] << 6 | this.s[Key.EC_UP] << 5 | this.s[Key.EC_LEFT] << 4 | 
        this.s[Key.EC_DEL] << 3 | this.s[Key.EC_INS] << 2 | this.s[Key.EC_CLS] << 1 | this.s[Key.EC_SPACE]
      );
      case 9: return ~(
        this.s[Key.EC_NUM4] << 7 | this.s[Key.EC_NUM3] << 6 | this.s[Key.EC_NUM2] << 5 | this.s[Key.EC_NUM1] << 4 | 
        this.s[Key.EC_NUM0] << 3 | this.s[Key.EC_NUMDIV] << 2 | this.s[Key.EC_NUMADD] << 1 | this.s[Key.EC_NUMMUL]
      );
      case 10: return ~(
        this.s[Key.EC_NUMPER] << 7 | this.s[Key.EC_NUMCOM] << 6 | this.s[Key.EC_NUMSUB] << 5 | this.s[Key.EC_NUM9] << 4 | 
        this.s[Key.EC_NUM8] << 3 | this.s[Key.EC_NUM7] << 2 | this.s[Key.EC_NUM6] << 1 | this.s[Key.EC_NUM5]
      );
      case 11: return ~(this.s[Key.EC_TORIKE] << 3 | this.s[Key.EC_JIKKOU] << 1);
      default: 
        return 0xff;
    }
  }

  private readCLo(): number {
    return 0xff;
  }

  private readCHi(): number {
    return 0xff;
  }

  private s = new Array<number>(128);
}
