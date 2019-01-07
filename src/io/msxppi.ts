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

enum Key {
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

  function keyCodeToKey(keyCode: string): Key {
  switch (keyCode) {
    case 'Digit0': return Key.EC_0;
    case 'Digit1': return Key.EC_1;
    case 'Digit2': return Key.EC_2;
    case 'Digit3': return Key.EC_3;
    case 'Digit4': return Key.EC_4;
    case 'Digit5': return Key.EC_5;
    case 'Digit6': return Key.EC_6;
    case 'Digit7': return Key.EC_7;
    case 'Digit8': return Key.EC_8;
    case 'Digit9': return Key.EC_9;

    case 'KeyA': return Key.EC_A;
    case 'KeyB': return Key.EC_B;
    case 'KeyC': return Key.EC_C;
    case 'KeyD': return Key.EC_D;
    case 'KeyE': return Key.EC_E;
    case 'KeyF': return Key.EC_F;
    case 'KeyG': return Key.EC_G;
    case 'KeyH': return Key.EC_H;
    case 'KeyI': return Key.EC_I;
    case 'KeyJ': return Key.EC_J;
    case 'KeyK': return Key.EC_K;
    case 'KeyL': return Key.EC_L;
    case 'KeyM': return Key.EC_M;
    case 'KeyN': return Key.EC_N;
    case 'KeyO': return Key.EC_O;
    case 'KeyP': return Key.EC_P;
    case 'KeyQ': return Key.EC_Q;
    case 'KeyR': return Key.EC_R;
    case 'KeyS': return Key.EC_S;
    case 'KeyT': return Key.EC_T;
    case 'KeyU': return Key.EC_U;
    case 'KeyV': return Key.EC_V;
    case 'KeyW': return Key.EC_W;
    case 'KeyX': return Key.EC_X;
    case 'KeyY': return Key.EC_Y;
    case 'KeyZ': return Key.EC_Z;

    case 'Comma': return Key.EC_COMMA;
    case 'Period': return Key.EC_PERIOD;
    case 'Semicolon': return Key.EC_SEMICOL;
    case 'Quote': return Key.EC_COLON;
    case 'BracketLeft': return Key.EC_LBRACK;
    case 'BracketRight': return Key.EC_RBRACK;
    case 'Backquote': return Key.EC_NONE;
    case 'Backslash': return Key.EC_BKSLASH;
    case 'Minus': return Key.EC_NEG;
    case 'Equal': return Key.EC_CIRCFLX;
    case 'IntlRo': return Key.EC_NONE;
    case 'IntlYen': return Key.EC_NONE;
    case 'Backspace': return Key.EC_BKSPACE;

    case 'AltLeft': return Key.EC_TORIKE;
    case 'AltRight': return Key.EC_JIKKOU;
    case 'CapsLock': return Key.EC_CAPS;
    case 'ControlLeft': return Key.EC_CTRL;
    case 'ControlRight': return Key.EC_UNDSCRE;
    case 'OSLeft': return Key.EC_GRAPH;
    case 'OSRight': return Key.EC_NONE;
    case 'ShiftLeft': return Key.EC_LSHIFT;
    case 'ShiftRight': return Key.EC_RSHIFT;
    case 'ContextMenu': return Key.EC_NONE;
    case 'Enter': return Key.EC_RETURN;
    case 'Space': return Key.EC_SPACE;
    case 'Tab': return Key.EC_TAB;
    case 'Delete': return Key.EC_NONE;
    case 'End': return Key.EC_NONE;
    case 'Help': return Key.EC_NONE;
    case 'Home': return Key.EC_NONE;
    case 'Insert': return Key.EC_NONE;
    case 'PageDown': return Key.EC_NONE;
    case 'PageUp': return Key.EC_NONE;
    case 'ArrowDown': return Key.EC_DOWN;
    case 'ArrowLeft': return Key.EC_LEFT;
    case 'ArrowRight': return Key.EC_RIGHT;
    case 'ArrowUp': return Key.EC_UP;
    case 'Escape': return Key.EC_NONE;
    case 'PrintScreen': return Key.EC_NONE;
    case 'ScrollLock': return Key.EC_NONE;
    case 'Pause': return Key.EC_PAUSE;

    case 'F1': return Key.EC_F1;
    case 'F2': return Key.EC_F2;
    case 'F3': return Key.EC_F3;
    case 'F4': return Key.EC_F4;
    case 'F5': return Key.EC_F5;

    case 'NumLock': return Key.EC_NONE;
    case 'Numpad0': return Key.EC_NUM0;
    case 'Numpad1': return Key.EC_NUM1;
    case 'Numpad2': return Key.EC_NUM2;
    case 'Numpad3': return Key.EC_NUM3;
    case 'Numpad4': return Key.EC_NUM4;
    case 'Numpad5': return Key.EC_NUM5;
    case 'Numpad6': return Key.EC_NUM6;
    case 'Numpad7': return Key.EC_NUM7;
    case 'Numpad8': return Key.EC_NUM8;
    case 'Numpad9': return Key.EC_NUM9;
    case 'NumpadAdd': return Key.EC_NUMADD;
    case 'NumpadComma': return Key.EC_NUMCOM;
    case 'NumpadDecimal': return Key.EC_NUMPER;
    case 'NumpadSubtract': return Key.EC_NUMSUB;
    case '"NumpadDivide': return Key.EC_NUMDIV;
    case 'NumpadMultiply': return Key.EC_NUMMUL;
  }
  return Key.EC_NONE;
}


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

  private row = 0;
  private regA = 0;
  private regCHi = 0;
  private i8255: I8255;

  reset(): void {
    for (let i = 0; i < 128; i++) {
      this.s[i] = 0;
    }

    this.row = 0;
    this.regA = 0;
    this.regCHi = 0;

    this.i8255.reset();
  }
  
  public keyDown(keyCode: string): void {
    this.s[keyCodeToKey(keyCode)] = 1;
  }

  public keyUp(keyCode: string) {
    this.s[keyCodeToKey(keyCode)] = 0;
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

  private s = new Array<number>(128);
  private keyClickAudio: KeyClick;
}
