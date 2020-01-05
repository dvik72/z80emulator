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
import { Port } from '../core/iomanager';
import { LedType } from '../core/ledmanager';
import { KeyClick } from '../audio/keyclick';
import { I8255 } from './i8255';
import { Input, Key } from '../api/input';

export class MsxPpi {
  constructor(
    private board: Board) {
    this.readA = this.readA.bind(this);
    this.readB = this.readB.bind(this);
    this.readCLo = this.readCLo.bind(this);
    this.readCHi = this.readCHi.bind(this);
    this.writeA = this.writeA.bind(this);
    this.writeB = this.writeB.bind(this);
    this.writeCLo = this.writeCLo.bind(this);
    this.writeCHi = this.writeCHi.bind(this);

    this.i8255 = new I8255(this.readA, this.writeA, this.readB, this.writeB, this.readCLo, this.writeCLo, this.readCHi, this.writeCHi);
    this.board.getIoManager().registerPort(0xa8, new Port(this.i8255.read, this.i8255.write));
    this.board.getIoManager().registerPort(0xa9, new Port(this.i8255.read, this.i8255.write));
    this.board.getIoManager().registerPort(0xaa, new Port(this.i8255.read, this.i8255.write));
    this.board.getIoManager().registerPort(0xab, new Port(this.i8255.read, this.i8255.write));

    this.keyClickAudio = new KeyClick(board);
  }

  public getState(): any {
    const state: any = {};

    state.row = this.row;
    state.regA = this.regA;
    state.regCHi = this.regCHi;

    state.i8255 = this.i8255.getState();

    return state;
  }

  public setState(state: any): void {
    this.row = state.row;
    this.row = state.row;
    this.row = state.row;

    this.i8255.setState(state.i8255);
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
  
  private writeA(value: number): void {
    if (value != this.regA) {
      this.regA = value;
      for (let i = 0; i < 4; i++) {
        this.board.getSlotManager().setRamSlot(i, value & 3);
        value >>= 2;
      }
    }
  }

  private writeB(value: number): void { }

  private writeCLo(value: number): void {
    this.row = value;
  }

  private writeCHi(value: number): void {
    if (value != this.regCHi) {
      this.regCHi = value;
      
      this.keyClickAudio.click((value & 0x08) != 0);
      this.board.getLedManager().getLed(LedType.CAPS_LOCK).set((value & 0x04) == 0);
    }
  }

  private readA(): number {
    return 0xff;
  }

  private getKeyState(): number {
    const s = Input.getKeyStateMap();

    switch (this.row) {
      case 0: return ~(
        s[Key.EC_7] << 7 | s[Key.EC_6] << 6 | s[Key.EC_5] << 5 | s[Key.EC_4] << 4 |
        s[Key.EC_3] << 3 | s[Key.EC_2] << 2 | s[Key.EC_1] << 1 | s[Key.EC_0]
      );
      case 1: return ~(
        s[Key.EC_SEMICOL] << 7 | s[Key.EC_LBRACK] << 6 | s[Key.EC_AT] << 5 | s[Key.EC_BKSLASH] << 4 | 
        s[Key.EC_CIRCFLX] << 3 | s[Key.EC_NEG] << 2 | s[Key.EC_9] << 1 | s[Key.EC_8]
      );
      case 2: return ~(
        s[Key.EC_B] << 7 | s[Key.EC_A] << 6 | s[Key.EC_UNDSCRE] << 5 | s[Key.EC_DIV] << 4 | 
        s[Key.EC_PERIOD] << 3 | s[Key.EC_COMMA] << 2 | s[Key.EC_RBRACK] << 1 | s[Key.EC_COLON]
      );
      case 3: return ~(
        s[Key.EC_J] << 7 | s[Key.EC_I] << 6 | s[Key.EC_H] << 5 | s[Key.EC_G] << 4 | 
        s[Key.EC_F] << 3 | s[Key.EC_E] << 2 | s[Key.EC_D] << 1 | s[Key.EC_C]
      );
      case 4: return ~(
        s[Key.EC_R] << 7 | s[Key.EC_Q] << 6 | s[Key.EC_P] << 5 | s[Key.EC_O] << 4 | 
        s[Key.EC_N] << 3 | s[Key.EC_M] << 2 | s[Key.EC_L] << 1 | s[Key.EC_K]
      );
      case 5: return ~(
        s[Key.EC_Z] << 7 | s[Key.EC_Y] << 6 | s[Key.EC_X] << 5 | s[Key.EC_W] << 4 | 
        s[Key.EC_V] << 3 | s[Key.EC_U] << 2 | s[Key.EC_T] << 1 | s[Key.EC_S]
      );
      case 6: return ~(
        s[Key.EC_F3] << 7 | s[Key.EC_F2] << 6 | s[Key.EC_F1] << 5 | s[Key.EC_CODE] << 4 | 
        s[Key.EC_CAPS] << 3 | s[Key.EC_GRAPH] << 2 | s[Key.EC_CTRL] << 1 | s[Key.EC_LSHIFT] | s[Key.EC_RSHIFT]
      );
      case 7: return ~(
        s[Key.EC_RETURN] << 7 | s[Key.EC_SELECT] << 6 | s[Key.EC_BKSPACE] << 5 | s[Key.EC_STOP] << 4 | 
        s[Key.EC_TAB] << 3 | s[Key.EC_ESC] << 2 | s[Key.EC_F5] << 1 | s[Key.EC_F4]
        );
      case 8: return ~(
        s[Key.EC_RIGHT] << 7 | s[Key.EC_DOWN] << 6 | s[Key.EC_UP] << 5 | s[Key.EC_LEFT] << 4 | 
        s[Key.EC_DEL] << 3 | s[Key.EC_INS] << 2 | s[Key.EC_CLS] << 1 | s[Key.EC_SPACE]
      );
      case 9: return ~(
        s[Key.EC_NUM4] << 7 | s[Key.EC_NUM3] << 6 | s[Key.EC_NUM2] << 5 | s[Key.EC_NUM1] << 4 | 
        s[Key.EC_NUM0] << 3 | s[Key.EC_NUMDIV] << 2 | s[Key.EC_NUMADD] << 1 | s[Key.EC_NUMMUL]
      );
      case 10: return ~(
        s[Key.EC_NUMPER] << 7 | s[Key.EC_NUMCOM] << 6 | s[Key.EC_NUMSUB] << 5 | s[Key.EC_NUM9] << 4 | 
        s[Key.EC_NUM8] << 3 | s[Key.EC_NUM7] << 2 | s[Key.EC_NUM6] << 1 | s[Key.EC_NUM5]
      );
      case 11: return ~(s[Key.EC_TORIKE] << 3 | s[Key.EC_JIKKOU] << 1);
      default: 
        return 0xff;
    }
  }

  private readB(): number {
    const value = this.getKeyState();

    if (this.row == 8) {
      // Implement Rensha joystick autofire
      this.board.getLedManager().getLed(LedType.RENSHA).set(false);
    }

    return value;
  }

  private readCLo(): number {
    return 0xff;
  }

  private readCHi(): number {
    return 0xff;
  }

  private keyClickAudio: KeyClick;
}
