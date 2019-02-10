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

export class Input {
  public static keyDown(keyCode: string): void {
    Input.s[Input.keyMap[keyCode] || Key.EC_NONE] = 1;
  }

  public static keyUp(keyCode: string) {
    Input.s[Input.keyMap[keyCode] || Key.EC_NONE] = 0;
  }

  public static getKeyState(key: Key): boolean {
    return !!Input.s[key];
  }

  public static getKeyStateMap(): Array<number> {
    return Input.s;
  }

  public static init(): void {
    Input.keyMap = {};

    Input.keyMap['Digit0'] = Key.EC_0;
    Input.keyMap['Digit1'] = Key.EC_1;
    Input.keyMap['Digit2'] = Key.EC_2;
    Input.keyMap['Digit3'] = Key.EC_3;
    Input.keyMap['Digit4'] = Key.EC_4;
    Input.keyMap['Digit5'] = Key.EC_5;
    Input.keyMap['Digit6'] = Key.EC_6;
    Input.keyMap['Digit7'] = Key.EC_7;
    Input.keyMap['Digit8'] = Key.EC_8;
    Input.keyMap['Digit9'] = Key.EC_9;

    Input.keyMap['KeyA'] = Key.EC_A;
    Input.keyMap['KeyB'] = Key.EC_B;
    Input.keyMap['KeyC'] = Key.EC_C;
    Input.keyMap['KeyD'] = Key.EC_D;
    Input.keyMap['KeyE'] = Key.EC_E;
    Input.keyMap['KeyF'] = Key.EC_F;
    Input.keyMap['KeyG'] = Key.EC_G;
    Input.keyMap['KeyH'] = Key.EC_H;
    Input.keyMap['KeyI'] = Key.EC_I;
    Input.keyMap['KeyJ'] = Key.EC_J;
    Input.keyMap['KeyK'] = Key.EC_K;
    Input.keyMap['KeyL'] = Key.EC_L;
    Input.keyMap['KeyM'] = Key.EC_M;
    Input.keyMap['KeyN'] = Key.EC_N;
    Input.keyMap['KeyO'] = Key.EC_O;
    Input.keyMap['KeyP'] = Key.EC_P;
    Input.keyMap['KeyQ'] = Key.EC_Q;
    Input.keyMap['KeyR'] = Key.EC_R;
    Input.keyMap['KeyS'] = Key.EC_S;
    Input.keyMap['KeyT'] = Key.EC_T;
    Input.keyMap['KeyU'] = Key.EC_U;
    Input.keyMap['KeyV'] = Key.EC_V;
    Input.keyMap['KeyW'] = Key.EC_W;
    Input.keyMap['KeyX'] = Key.EC_X;
    Input.keyMap['KeyY'] = Key.EC_Y;
    Input.keyMap['KeyZ'] = Key.EC_Z;

    Input.keyMap['Comma'] = Key.EC_COMMA;
    Input.keyMap['Period'] = Key.EC_PERIOD;
    Input.keyMap['Semicolon'] = Key.EC_SEMICOL;
    Input.keyMap['Quote'] = Key.EC_COLON;
    Input.keyMap['BracketLeft'] = Key.EC_LBRACK;
    Input.keyMap['BracketRight'] = Key.EC_RBRACK;
    Input.keyMap['Backquote'] = Key.EC_NONE;
    Input.keyMap['Backslash'] = Key.EC_BKSLASH;
    Input.keyMap['Minus'] = Key.EC_NEG;
    Input.keyMap['Equal'] = Key.EC_CIRCFLX;
    Input.keyMap['IntlRo'] = Key.EC_NONE;
    Input.keyMap['IntlYen'] = Key.EC_NONE;
    Input.keyMap['Backspace'] = Key.EC_BKSPACE;

    Input.keyMap['AltLeft'] = Key.EC_TORIKE;
    Input.keyMap['AltRight'] = Key.EC_JIKKOU;
    Input.keyMap['CapsLock'] = Key.EC_CAPS;
    Input.keyMap['ControlLeft'] = Key.EC_CTRL;
    Input.keyMap['ControlRight'] = Key.EC_UNDSCRE;
    Input.keyMap['OSLeft'] = Key.EC_GRAPH;
    Input.keyMap['OSRight'] = Key.EC_NONE;
    Input.keyMap['ShiftLeft'] = Key.EC_LSHIFT;
    Input.keyMap['ShiftRight'] = Key.EC_RSHIFT;
    Input.keyMap['ContextMenu'] = Key.EC_NONE;
    Input.keyMap['Enter'] = Key.EC_RETURN;
    Input.keyMap['Space'] = Key.EC_SPACE;
    Input.keyMap['Tab'] = Key.EC_TAB;
    Input.keyMap['Delete'] = Key.EC_NONE;
    Input.keyMap['End'] = Key.EC_NONE;
    Input.keyMap['Help'] = Key.EC_NONE;
    Input.keyMap['Home'] = Key.EC_NONE;
    Input.keyMap['Insert'] = Key.EC_NONE;
    Input.keyMap['PageDown'] = Key.EC_NONE;
    Input.keyMap['PageUp'] = Key.EC_NONE;
    Input.keyMap['ArrowDown'] = Key.EC_DOWN;
    Input.keyMap['ArrowLeft'] = Key.EC_LEFT;
    Input.keyMap['ArrowRight'] = Key.EC_RIGHT;
    Input.keyMap['ArrowUp'] = Key.EC_UP;
    Input.keyMap['Escape'] = Key.EC_ESC;
    Input.keyMap['PrintScreen'] = Key.EC_NONE;
    Input.keyMap['ScrollLock'] = Key.EC_NONE;
    Input.keyMap['Pause'] = Key.EC_PAUSE;

    Input.keyMap['F1'] = Key.EC_F1;
    Input.keyMap['F2'] = Key.EC_F2;
    Input.keyMap['F3'] = Key.EC_F3;
    Input.keyMap['F4'] = Key.EC_F4;
    Input.keyMap['F5'] = Key.EC_F5;

    Input.keyMap['NumLock'] = Key.EC_NONE;
    Input.keyMap['Numpad0'] = Key.EC_NUM0;
    Input.keyMap['Numpad1'] = Key.EC_NUM1;
    Input.keyMap['Numpad2'] = Key.EC_NUM2;
    Input.keyMap['Numpad3'] = Key.EC_NUM3;
    Input.keyMap['Numpad4'] = Key.EC_NUM4;
    Input.keyMap['Numpad5'] = Key.EC_NUM5;
    Input.keyMap['Numpad6'] = Key.EC_NUM6;
    Input.keyMap['Numpad7'] = Key.EC_NUM7;
    Input.keyMap['Numpad8'] = Key.EC_NUM8;
    Input.keyMap['Numpad9'] = Key.EC_NUM9;
    Input.keyMap['NumpadAdd'] = Key.EC_NUMADD;
    Input.keyMap['NumpadComma'] = Key.EC_NUMCOM;
    Input.keyMap['NumpadDecimal'] = Key.EC_NUMPER;
    Input.keyMap['NumpadSubtract'] = Key.EC_NUMSUB;
    Input.keyMap['"NumpadDivide'] = Key.EC_NUMDIV;
    Input.keyMap['NumpadMultiply'] = Key.EC_NUMMUL;
  }

  private static s = new Array<number>(256);  
  private static keyMap: { [key: string]: Key };
}
