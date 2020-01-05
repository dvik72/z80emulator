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

  EC_0,
  EC_1,
  EC_2,
  EC_3,
  EC_4,
  EC_5,
  EC_6,
  EC_7,
  EC_8,
  EC_9,

  EC_A,
  EC_B,
  EC_C,
  EC_D,
  EC_E,
  EC_F,
  EC_G,
  EC_H,
  EC_I,
  EC_J,
  EC_K,
  EC_L,
  EC_M,
  EC_N,
  EC_O,
  EC_P,
  EC_Q,
  EC_R,
  EC_S,
  EC_T,
  EC_U,
  EC_V,
  EC_W,
  EC_X,
  EC_Y,
  EC_Z,

  EC_STOP,
  EC_CLS,
  EC_SELECT,
  EC_INS,
  EC_DEL,
  EC_ESC,
  EC_CIRCFLX,
  EC_BKSLASH,
  EC_BKSPACE,
  EC_TAB,
  EC_NEG,
  EC_AT,
  EC_LBRACK,
  EC_RETURN,
  EC_CTRL,
  EC_SEMICOL,
  EC_COLON,
  EC_RBRACK,
  EC_LSHIFT,

  EC_COMMA,
  EC_PERIOD,
  EC_DIV,
  EC_UNDSCRE,
  EC_RSHIFT,
  EC_CAPS,
  EC_GRAPH,
  EC_TORIKE,
  EC_SPACE,
  EC_JIKKOU,
  EC_CODE,
  EC_PAUSE,

  EC_LEFT,
  EC_UP,
  EC_DOWN,
  EC_RIGHT,

  EC_NUM0,
  EC_NUM1,
  EC_NUM2,
  EC_NUM3,
  EC_NUM4,
  EC_NUM5,
  EC_NUM6,
  EC_NUM7,
  EC_NUM8,
  EC_NUM9,
  EC_NUMCOM,
  EC_NUMADD,
  EC_NUMSUB,
  EC_NUMMUL,
  EC_NUMDIV,
  EC_NUMPER,

  EC_JOY1_UP,
  EC_JOY1_DOWN,
  EC_JOY1_LEFT,
  EC_JOY1_RIGHT,
  EC_JOY1_BT1,
  EC_JOY1_BT2,

  EC_JOY2_UP,
  EC_JOY2_DOWN,
  EC_JOY2_LEFT,
  EC_JOY2_RIGHT,
  EC_JOY2_BT1,
  EC_JOY2_BT2,

  EC_MAX_KEY_NUM
};

const KEY_NAME_MAP = new Array<string>(Key.EC_MAX_KEY_NUM);

KEY_NAME_MAP[Key.EC_NONE] = 'None';
KEY_NAME_MAP[Key.EC_F1] = 'F1';
KEY_NAME_MAP[Key.EC_F2] = 'F2';
KEY_NAME_MAP[Key.EC_F3] = 'F3';
KEY_NAME_MAP[Key.EC_F4] = 'F4';
KEY_NAME_MAP[Key.EC_F5] = 'F5';

KEY_NAME_MAP[Key.EC_0] = '0';
KEY_NAME_MAP[Key.EC_1] = '1';
KEY_NAME_MAP[Key.EC_2] = '2';
KEY_NAME_MAP[Key.EC_3] = '3';
KEY_NAME_MAP[Key.EC_4] = '4';
KEY_NAME_MAP[Key.EC_5] = '5';
KEY_NAME_MAP[Key.EC_6] = '6';
KEY_NAME_MAP[Key.EC_7] = '7';
KEY_NAME_MAP[Key.EC_8] = '8';
KEY_NAME_MAP[Key.EC_9] = '9';

KEY_NAME_MAP[Key.EC_A] = 'A';
KEY_NAME_MAP[Key.EC_B] = 'B';
KEY_NAME_MAP[Key.EC_C] = 'C';
KEY_NAME_MAP[Key.EC_D] = 'D';
KEY_NAME_MAP[Key.EC_E] = 'E';
KEY_NAME_MAP[Key.EC_F] = 'F';
KEY_NAME_MAP[Key.EC_G] = 'G';
KEY_NAME_MAP[Key.EC_H] = 'H';
KEY_NAME_MAP[Key.EC_I] = 'I';
KEY_NAME_MAP[Key.EC_J] = 'J';
KEY_NAME_MAP[Key.EC_K] = 'K';
KEY_NAME_MAP[Key.EC_L] = 'L';
KEY_NAME_MAP[Key.EC_M] = 'M';
KEY_NAME_MAP[Key.EC_N] = 'N';
KEY_NAME_MAP[Key.EC_O] = 'O';
KEY_NAME_MAP[Key.EC_P] = 'P';
KEY_NAME_MAP[Key.EC_Q] = 'Q';
KEY_NAME_MAP[Key.EC_R] = 'R';
KEY_NAME_MAP[Key.EC_S] = 'S';
KEY_NAME_MAP[Key.EC_T] = 'T';
KEY_NAME_MAP[Key.EC_U] = 'U';
KEY_NAME_MAP[Key.EC_V] = 'V';
KEY_NAME_MAP[Key.EC_W] = 'W';
KEY_NAME_MAP[Key.EC_X] = 'X';
KEY_NAME_MAP[Key.EC_Y] = 'Y';
KEY_NAME_MAP[Key.EC_Z] = 'Z';

KEY_NAME_MAP[Key.EC_STOP] = 'Stop';
KEY_NAME_MAP[Key.EC_CLS] = 'Cls';
KEY_NAME_MAP[Key.EC_SELECT] = 'Select';
KEY_NAME_MAP[Key.EC_INS] = 'Ins';
KEY_NAME_MAP[Key.EC_DEL] = 'Del';
KEY_NAME_MAP[Key.EC_ESC] = 'Esc';
KEY_NAME_MAP[Key.EC_CIRCFLX] = 'Circomflex';
KEY_NAME_MAP[Key.EC_BKSLASH] = 'Backslash';
KEY_NAME_MAP[Key.EC_BKSPACE] = 'Backspace';
KEY_NAME_MAP[Key.EC_TAB] = 'Tab';
KEY_NAME_MAP[Key.EC_NEG] = 'Neg';
KEY_NAME_MAP[Key.EC_AT] = 'At';
KEY_NAME_MAP[Key.EC_LBRACK] = 'Left Bracket';
KEY_NAME_MAP[Key.EC_RETURN] = 'Return';
KEY_NAME_MAP[Key.EC_CTRL] = 'Ctrl';
KEY_NAME_MAP[Key.EC_SEMICOL] = 'Semicolon';
KEY_NAME_MAP[Key.EC_COLON] = 'Colon';
KEY_NAME_MAP[Key.EC_RBRACK] = 'Rigth Bracket';
KEY_NAME_MAP[Key.EC_LSHIFT] = 'Left Shift';

KEY_NAME_MAP[Key.EC_COMMA] = 'Comma';
KEY_NAME_MAP[Key.EC_PERIOD] = 'Period';
KEY_NAME_MAP[Key.EC_DIV] = 'Div';
KEY_NAME_MAP[Key.EC_UNDSCRE] = 'Underscore';
KEY_NAME_MAP[Key.EC_RSHIFT] = 'Right Shift';
KEY_NAME_MAP[Key.EC_CAPS] = 'Caps';
KEY_NAME_MAP[Key.EC_GRAPH] = 'Graph';
KEY_NAME_MAP[Key.EC_TORIKE] = 'Torike';
KEY_NAME_MAP[Key.EC_SPACE] = 'Space';
KEY_NAME_MAP[Key.EC_JIKKOU] = 'Jikkou';
KEY_NAME_MAP[Key.EC_CODE] = 'Code';
KEY_NAME_MAP[Key.EC_PAUSE] = 'Pause';

KEY_NAME_MAP[Key.EC_LEFT] = 'Left';
KEY_NAME_MAP[Key.EC_UP] = 'Up';
KEY_NAME_MAP[Key.EC_DOWN] = 'Down';
KEY_NAME_MAP[Key.EC_RIGHT] = 'Right';

KEY_NAME_MAP[Key.EC_NUM0] = 'Num 0';
KEY_NAME_MAP[Key.EC_NUM1] = 'Num 1';
KEY_NAME_MAP[Key.EC_NUM2] = 'Num 2';
KEY_NAME_MAP[Key.EC_NUM3] = 'Num 3';
KEY_NAME_MAP[Key.EC_NUM4] = 'Num 4';
KEY_NAME_MAP[Key.EC_NUM5] = 'Num 5';
KEY_NAME_MAP[Key.EC_NUM6] = 'Num 6';
KEY_NAME_MAP[Key.EC_NUM7] = 'Num 7';
KEY_NAME_MAP[Key.EC_NUM8] = 'Num 8';
KEY_NAME_MAP[Key.EC_NUM9] = 'Num 9';
KEY_NAME_MAP[Key.EC_NUMCOM] = 'Num Comma';
KEY_NAME_MAP[Key.EC_NUMADD] = 'Num Add';
KEY_NAME_MAP[Key.EC_NUMSUB] = 'Num Sub';
KEY_NAME_MAP[Key.EC_NUMMUL] = 'Num Mul';
KEY_NAME_MAP[Key.EC_NUMDIV] = 'Num Div';
KEY_NAME_MAP[Key.EC_NUMPER] = 'Num Period';

KEY_NAME_MAP[Key.EC_JOY1_UP] = 'Joy1 Up';
KEY_NAME_MAP[Key.EC_JOY1_DOWN] = 'Joy1 Down';
KEY_NAME_MAP[Key.EC_JOY1_LEFT] = 'Joy1 Left';
KEY_NAME_MAP[Key.EC_JOY1_RIGHT] = 'Joy1 Right';
KEY_NAME_MAP[Key.EC_JOY1_BT1] = 'Joy1 Button 1';
KEY_NAME_MAP[Key.EC_JOY1_BT2] = 'Joy1 Button 2';

KEY_NAME_MAP[Key.EC_JOY2_UP] = 'Joy2 Up';
KEY_NAME_MAP[Key.EC_JOY2_DOWN] = 'Joy2 Down';
KEY_NAME_MAP[Key.EC_JOY2_LEFT] = 'Joy2 Left';
KEY_NAME_MAP[Key.EC_JOY2_RIGHT] = 'Joy2 Right';
KEY_NAME_MAP[Key.EC_JOY2_BT1] = 'Joy2 Button 1';
KEY_NAME_MAP[Key.EC_JOY2_BT2] = 'Joy2 Button 2';


export class Input {
  public static keyDown(keyCode: string): void {
    Input.keyArray[keyCode] = true;

    document.dispatchEvent(new CustomEvent('emukeypressed', { detail: keyCode }));

    for (let i = 0; i < Input.keyMap.length; i++) {
      Input.keyMap[i] == keyCode && (Input.keyState[i] = 1);
    }
  }

  public static keyUp(keyCode: string) {
    Input.keyArray[keyCode] = true;

    for (let i = 0; i < Input.keyMap.length; i++) {
      Input.keyMap[i] == keyCode && (Input.keyState[i] = 0);
    }
  }

  public static getKeyStateMap(): Array<number> {
    return Input.keyState;
  }

  public static getKeyName(key: Key): string {
    return KEY_NAME_MAP[key];
  }

  public static getMappedKey(key: Key): string {
    return Input.keyMap[key] || 'none';
  }

  public static mapKey(key: Key, value: string) {
    if (key != Key.EC_NONE) {
      Input.keyMap[key] = value;
    }
  }

  public static init(inputConfig: any): void {
    Input.keyMap[Key.EC_0] = inputConfig.key_0 || 'Digit0';
    Input.keyMap[Key.EC_1] = inputConfig.key_1 || 'Digit1';
    Input.keyMap[Key.EC_2] = inputConfig.key_2 || 'Digit2';
    Input.keyMap[Key.EC_3] = inputConfig.key_3 || 'Digit3';
    Input.keyMap[Key.EC_4] = inputConfig.key_4 || 'Digit4';
    Input.keyMap[Key.EC_5] = inputConfig.key_5 || 'Digit5';
    Input.keyMap[Key.EC_6] = inputConfig.key_6 || 'Digit6';
    Input.keyMap[Key.EC_7] = inputConfig.key_7 || 'Digit7';
    Input.keyMap[Key.EC_8] = inputConfig.key_8 || 'Digit8';
    Input.keyMap[Key.EC_9] = inputConfig.key_9 || 'Digit9';

    Input.keyMap[Key.EC_A] = inputConfig.key_a || 'KeyA';
    Input.keyMap[Key.EC_B] = inputConfig.key_b || 'KeyB';
    Input.keyMap[Key.EC_C] = inputConfig.key_c || 'KeyC';
    Input.keyMap[Key.EC_D] = inputConfig.key_d || 'KeyD';
    Input.keyMap[Key.EC_E] = inputConfig.key_e || 'KeyE';
    Input.keyMap[Key.EC_F] = inputConfig.key_f || 'KeyF';
    Input.keyMap[Key.EC_G] = inputConfig.key_g || 'KeyG';
    Input.keyMap[Key.EC_H] = inputConfig.key_h || 'KeyH';
    Input.keyMap[Key.EC_I] = inputConfig.key_i || 'KeyI';
    Input.keyMap[Key.EC_J] = inputConfig.key_j || 'KeyJ';
    Input.keyMap[Key.EC_K] = inputConfig.key_k || 'KeyK';
    Input.keyMap[Key.EC_L] = inputConfig.key_l || 'KeyL';
    Input.keyMap[Key.EC_M] = inputConfig.key_m || 'KeyM';
    Input.keyMap[Key.EC_N] = inputConfig.key_n || 'KeyN';
    Input.keyMap[Key.EC_O] = inputConfig.key_o || 'KeyO';
    Input.keyMap[Key.EC_P] = inputConfig.key_p || 'KeyP';
    Input.keyMap[Key.EC_Q] = inputConfig.key_q || 'KeyQ';
    Input.keyMap[Key.EC_R] = inputConfig.key_r || 'KeyR';
    Input.keyMap[Key.EC_S] = inputConfig.key_s || 'KeyS';
    Input.keyMap[Key.EC_T] = inputConfig.key_t || 'KeyT';
    Input.keyMap[Key.EC_U] = inputConfig.key_u || 'KeyU';
    Input.keyMap[Key.EC_V] = inputConfig.key_v || 'KeyV';
    Input.keyMap[Key.EC_W] = inputConfig.key_w || 'KeyW';
    Input.keyMap[Key.EC_X] = inputConfig.key_x || 'KeyX';
    Input.keyMap[Key.EC_Y] = inputConfig.key_y || 'KeyY';
    Input.keyMap[Key.EC_Z] = inputConfig.key_z || 'KeyZ';

    Input.keyMap[Key.EC_COMMA] = inputConfig.key_comma || 'Comma';
    Input.keyMap[Key.EC_PERIOD] = inputConfig.key_period || 'Period';
    Input.keyMap[Key.EC_SEMICOL] = inputConfig.key_semicol || 'Semicolon';
    Input.keyMap[Key.EC_COLON] = inputConfig.key_colon || 'Quote';
    Input.keyMap[Key.EC_LBRACK] = inputConfig.key_lbrack || 'BracketLeft';
    Input.keyMap[Key.EC_RBRACK] = inputConfig.key_rbrack || 'BracketRight';
    Input.keyMap[Key.EC_BKSLASH] = inputConfig.key_bkslash || 'Backslash';
    Input.keyMap[Key.EC_NEG] = inputConfig.key_neg || 'Minus';
    Input.keyMap[Key.EC_CIRCFLX] = inputConfig.key_circlflx || 'Equal';
    Input.keyMap[Key.EC_BKSPACE] = inputConfig.key_bkspace || 'Backspace';

    Input.keyMap[Key.EC_TORIKE] = inputConfig.key_torike || 'AltLeft';
    Input.keyMap[Key.EC_JIKKOU] = inputConfig.key_jikkou || 'AltRight';
    Input.keyMap[Key.EC_CAPS] = inputConfig.key_caps || 'CapsLock';
    Input.keyMap[Key.EC_CTRL] = inputConfig.key_ctrl || 'ControlLeft';
    Input.keyMap[Key.EC_UNDSCRE] = inputConfig.key_undscre || 'ControlRight';
    Input.keyMap[Key.EC_GRAPH] = inputConfig.key_graph || 'OSLeft';
    Input.keyMap[Key.EC_LSHIFT] = inputConfig.key_lshift || 'ShiftLeft';
    Input.keyMap[Key.EC_RSHIFT] = inputConfig.key_rshift || 'ShiftRight';
    Input.keyMap[Key.EC_RETURN] = inputConfig.key_return || 'Enter';
    Input.keyMap[Key.EC_SPACE] = inputConfig.key_space || 'Space';
    Input.keyMap[Key.EC_TAB] = inputConfig.key_tab || 'Tab';
    Input.keyMap[Key.EC_DOWN] = inputConfig.key_down || 'ArrowDown';
    Input.keyMap[Key.EC_LEFT] = inputConfig.key_left || 'ArrowLeft';
    Input.keyMap[Key.EC_RIGHT] = inputConfig.key_right || 'ArrowRight';
    Input.keyMap[Key.EC_UP] = inputConfig.key_up || 'ArrowUp';
    Input.keyMap[Key.EC_ESC] = inputConfig.key_esc || 'Escape';
    Input.keyMap[Key.EC_PAUSE] = inputConfig.key_pause || 'Pause';

    Input.keyMap[Key.EC_F1] = inputConfig.key_f1 || 'F1';
    Input.keyMap[Key.EC_F2] = inputConfig.key_f2 || 'F2';
    Input.keyMap[Key.EC_F3] = inputConfig.key_f3 || 'F3';
    Input.keyMap[Key.EC_F4] = inputConfig.key_f4 || 'F4';
    Input.keyMap[Key.EC_F5] = inputConfig.key_f5 || 'F5';

    Input.keyMap[Key.EC_NUM0] = inputConfig.key_num0 || 'Numpad0';
    Input.keyMap[Key.EC_NUM1] = inputConfig.key_num1 || 'Numpad1';
    Input.keyMap[Key.EC_NUM2] = inputConfig.key_num2 || 'Numpad2';
    Input.keyMap[Key.EC_NUM3] = inputConfig.key_num3 || 'Numpad3';
    Input.keyMap[Key.EC_NUM4] = inputConfig.key_num4 || 'Numpad4';
    Input.keyMap[Key.EC_NUM5] = inputConfig.key_num5 || 'Numpad5';
    Input.keyMap[Key.EC_NUM6] = inputConfig.key_num6 || 'Numpad6';
    Input.keyMap[Key.EC_NUM7] = inputConfig.key_num7 || 'Numpad7';
    Input.keyMap[Key.EC_NUM8] = inputConfig.key_num8 || 'Numpad8';
    Input.keyMap[Key.EC_NUM9] = inputConfig.key_num9 || 'Numpad9';
    Input.keyMap[Key.EC_NUMADD] = inputConfig.key_numadd || 'NumpadAdd';
    Input.keyMap[Key.EC_NUMCOM] = inputConfig.key_numcom || 'NumpadComma';
    Input.keyMap[Key.EC_NUMPER] = inputConfig.key_numper || 'NumpadDecimal';
    Input.keyMap[Key.EC_NUMSUB] = inputConfig.key_numsub || 'NumpadSubtract';
    Input.keyMap[Key.EC_NUMDIV] = inputConfig.key_numdiv || 'NumpadDivide';
    Input.keyMap[Key.EC_NUMMUL] = inputConfig.key_nummul || 'NumpadMultiply';

    Input.keyMap[Key.EC_JOY1_UP] = inputConfig.joy1_up || 'Gamepad1_Up1';
    Input.keyMap[Key.EC_JOY1_DOWN] = inputConfig.joy1_down || 'Gamepad1_Down1';
    Input.keyMap[Key.EC_JOY1_LEFT] = inputConfig.joy1_left || 'Gamepad1_Left1';
    Input.keyMap[Key.EC_JOY1_RIGHT] = inputConfig.joy1_right || 'Gamepad1_Right1';
    Input.keyMap[Key.EC_JOY1_BT1] = inputConfig.joy1_bt1 || 'Gamepad1_Button1';
    Input.keyMap[Key.EC_JOY1_BT2] = inputConfig.joy1_bt2 || 'Gamepad1_Button2';

    Input.keyMap[Key.EC_JOY2_UP] = inputConfig.joy2_up || 'Gamepad2_Up1';
    Input.keyMap[Key.EC_JOY2_DOWN] = inputConfig.joy2_down || 'Gamepad2_Down1';
    Input.keyMap[Key.EC_JOY2_LEFT] = inputConfig.joy2_left || 'Gamepad2_Left1';
    Input.keyMap[Key.EC_JOY2_RIGHT] = inputConfig.joy2_right || 'Gamepad2_Right1';
    Input.keyMap[Key.EC_JOY2_BT1] = inputConfig.joy2_bt1 || 'Gamepad2_Button1';
    Input.keyMap[Key.EC_JOY2_BT2] = inputConfig.joy2_bt2 || 'Gamepad2_Button2';

    Input.updateGamepadsCache();
  }

  public static serialize(): any {
    let inputConfig: any = {};

    inputConfig.key_0 = Input.keyMap[Key.EC_0];
    inputConfig.key_1 = Input.keyMap[Key.EC_1];
    inputConfig.key_2 = Input.keyMap[Key.EC_2];
    inputConfig.key_3 = Input.keyMap[Key.EC_3];
    inputConfig.key_4 = Input.keyMap[Key.EC_4];
    inputConfig.key_5 = Input.keyMap[Key.EC_5];
    inputConfig.key_6 = Input.keyMap[Key.EC_6];
    inputConfig.key_7 = Input.keyMap[Key.EC_7];
    inputConfig.key_8 = Input.keyMap[Key.EC_8];
    inputConfig.key_9 = Input.keyMap[Key.EC_9];

    inputConfig.key_a = Input.keyMap[Key.EC_A];
    inputConfig.key_b = Input.keyMap[Key.EC_B];
    inputConfig.key_c = Input.keyMap[Key.EC_C];
    inputConfig.key_d = Input.keyMap[Key.EC_D];
    inputConfig.key_e = Input.keyMap[Key.EC_E];
    inputConfig.key_f = Input.keyMap[Key.EC_F];
    inputConfig.key_g = Input.keyMap[Key.EC_G];
    inputConfig.key_h = Input.keyMap[Key.EC_H];
    inputConfig.key_i = Input.keyMap[Key.EC_I];
    inputConfig.key_j = Input.keyMap[Key.EC_J];
    inputConfig.key_k = Input.keyMap[Key.EC_K];
    inputConfig.key_l = Input.keyMap[Key.EC_L];
    inputConfig.key_m = Input.keyMap[Key.EC_M];
    inputConfig.key_n = Input.keyMap[Key.EC_N];
    inputConfig.key_o = Input.keyMap[Key.EC_O];
    inputConfig.key_p = Input.keyMap[Key.EC_P];
    inputConfig.key_q = Input.keyMap[Key.EC_Q];
    inputConfig.key_r = Input.keyMap[Key.EC_R];
    inputConfig.key_s = Input.keyMap[Key.EC_S];
    inputConfig.key_t = Input.keyMap[Key.EC_T];
    inputConfig.key_u = Input.keyMap[Key.EC_U];
    inputConfig.key_v = Input.keyMap[Key.EC_V];
    inputConfig.key_w = Input.keyMap[Key.EC_W];
    inputConfig.key_x = Input.keyMap[Key.EC_X];
    inputConfig.key_y = Input.keyMap[Key.EC_Y];
    inputConfig.key_z = Input.keyMap[Key.EC_Z];

    inputConfig.key_comma = Input.keyMap[Key.EC_COMMA];
    inputConfig.key_period = Input.keyMap[Key.EC_PERIOD];
    inputConfig.key_semicol = Input.keyMap[Key.EC_SEMICOL];
    inputConfig.key_colon = Input.keyMap[Key.EC_COLON];
    inputConfig.key_lbrack = Input.keyMap[Key.EC_LBRACK];
    inputConfig.key_rbrack = Input.keyMap[Key.EC_RBRACK];
    inputConfig.key_bkslash = Input.keyMap[Key.EC_BKSLASH];
    inputConfig.key_neg = Input.keyMap[Key.EC_NEG];
    inputConfig.key_circlflx = Input.keyMap[Key.EC_CIRCFLX];
    inputConfig.key_bkspace = Input.keyMap[Key.EC_BKSPACE];

    inputConfig.key_torike = Input.keyMap[Key.EC_TORIKE];
    inputConfig.key_jikkou = Input.keyMap[Key.EC_JIKKOU];
    inputConfig.key_caps = Input.keyMap[Key.EC_CAPS];
    inputConfig.key_ctrl = Input.keyMap[Key.EC_CTRL];
    inputConfig.key_undscre = Input.keyMap[Key.EC_UNDSCRE];
    inputConfig.key_graph = Input.keyMap[Key.EC_GRAPH];
    inputConfig.key_lshift = Input.keyMap[Key.EC_LSHIFT];
    inputConfig.key_rshift = Input.keyMap[Key.EC_RSHIFT];
    inputConfig.key_return = Input.keyMap[Key.EC_RETURN];
    inputConfig.key_space = Input.keyMap[Key.EC_SPACE];
    inputConfig.key_tab = Input.keyMap[Key.EC_TAB];
    inputConfig.key_down = Input.keyMap[Key.EC_DOWN];
    inputConfig.key_left = Input.keyMap[Key.EC_LEFT];
    inputConfig.key_right = Input.keyMap[Key.EC_RIGHT];
    inputConfig.key_up = Input.keyMap[Key.EC_UP];
    inputConfig.key_esc = Input.keyMap[Key.EC_ESC];
    inputConfig.key_pause = Input.keyMap[Key.EC_PAUSE];

    inputConfig.key_f1 = Input.keyMap[Key.EC_F1];
    inputConfig.key_f2 = Input.keyMap[Key.EC_F2];
    inputConfig.key_f3 = Input.keyMap[Key.EC_F3];
    inputConfig.key_f4 = Input.keyMap[Key.EC_F4];
    inputConfig.key_f5 = Input.keyMap[Key.EC_F5];

    inputConfig.key_num0 = Input.keyMap[Key.EC_NUM0];
    inputConfig.key_num1 = Input.keyMap[Key.EC_NUM1];
    inputConfig.key_num2 = Input.keyMap[Key.EC_NUM2];
    inputConfig.key_num3 = Input.keyMap[Key.EC_NUM3];
    inputConfig.key_num4 = Input.keyMap[Key.EC_NUM4];
    inputConfig.key_num5 = Input.keyMap[Key.EC_NUM5];
    inputConfig.key_num6 = Input.keyMap[Key.EC_NUM6];
    inputConfig.key_num7 = Input.keyMap[Key.EC_NUM7];
    inputConfig.key_num8 = Input.keyMap[Key.EC_NUM8];
    inputConfig.key_num9 = Input.keyMap[Key.EC_NUM9];
    inputConfig.key_numadd = Input.keyMap[Key.EC_NUMADD];
    inputConfig.key_numcom = Input.keyMap[Key.EC_NUMCOM];
    inputConfig.key_numper = Input.keyMap[Key.EC_NUMPER];
    inputConfig.key_numsub = Input.keyMap[Key.EC_NUMSUB];
    inputConfig.key_numdiv = Input.keyMap[Key.EC_NUMDIV];
    inputConfig.key_nummul = Input.keyMap[Key.EC_NUMMUL];

    inputConfig.joy1_up = Input.keyMap[Key.EC_JOY1_UP];
    inputConfig.joy1_down = Input.keyMap[Key.EC_JOY1_DOWN];
    inputConfig.joy1_left = Input.keyMap[Key.EC_JOY1_LEFT];
    inputConfig.joy1_right = Input.keyMap[Key.EC_JOY1_RIGHT];
    inputConfig.joy1_bt1 = Input.keyMap[Key.EC_JOY1_BT1];
    inputConfig.joy1_bt2 = Input.keyMap[Key.EC_JOY1_BT2];

    inputConfig.joy2_up = Input.keyMap[Key.EC_JOY2_UP];
    inputConfig.joy2_down = Input.keyMap[Key.EC_JOY2_DOWN];
    inputConfig.joy2_left = Input.keyMap[Key.EC_JOY2_LEFT];
    inputConfig.joy2_right = Input.keyMap[Key.EC_JOY2_RIGHT];
    inputConfig.joy2_bt1 = Input.keyMap[Key.EC_JOY2_BT1];
    inputConfig.joy2_bt2 = Input.keyMap[Key.EC_JOY2_BT2];

    return inputConfig;
  }

  private static updateGamepadsCache(): void {
    Input.gamepadCache = [];

    for (let i = 0; i < Key.EC_MAX_KEY_NUM; i++) {
      if (Input.keyMap[i] && Input.keyMap[i].substr(0, 7) == 'Gamepad') {
        Input.gamepadCache.push(Input.keyMap[i]);
      }
    }
  }
  
  private static registerGamepadIndex(index: number): void {
    for (let i of Input.gamepadMapping) {
      if (i == index) {
        return;
      }
    }
    Input.gamepadMapping.push(index);
  }

  private static getGamepadIndex(index: number): number {
    let offset = 0;
    for (let i of Input.gamepadMapping) {
      if (i == index) {
        return offset;
      }
      offset++;
    }
    return -1;
  }
  
  public static pollGamepads(): void {
    let gamepads = navigator.getGamepads ? navigator.getGamepads() : ((navigator as any).webkitGetGamepads ? (navigator as any).webkitGetGamepads() : []);

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];

      if (gp) {
        for (let j = 0; j < gp.axes.length / 2; j++) {
          const up = gp.axes[2 * j + 1] < -Input.AXIS_THRESHOLD;
          const down = gp.axes[2 * j + 1] > Input.AXIS_THRESHOLD;
          const left = gp.axes[2 * j] < -Input.AXIS_THRESHOLD;
          const right = gp.axes[2 * j] > Input.AXIS_THRESHOLD;

          if (up || down || left || right) {
            Input.registerGamepadIndex(i);
          }
          const gpIdx = Input.getGamepadIndex(i) + 1;

          const keyCodeUp = 'Gamepad' + gpIdx + '_Up' + (j + 1);
          if (Input.gamepadCache.indexOf(keyCodeUp) >= 0) {
            up ? Input.keyDown(keyCodeUp) : Input.keyUp(keyCodeUp);
          }
          const keyCodeDown = 'Gamepad' + gpIdx + '_Down' + (j + 1);
          if (Input.gamepadCache.indexOf(keyCodeDown) >= 0) {
            down ? Input.keyDown(keyCodeDown) : Input.keyUp(keyCodeDown);
          }
          const keyCodeLeft = 'Gamepad' + gpIdx + '_Left' + (j + 1);
          if (Input.gamepadCache.indexOf(keyCodeLeft) >= 0) {
            left ? Input.keyDown(keyCodeLeft) : Input.keyUp(keyCodeLeft);
          }
          const keyCodeRight = 'Gamepad' + gpIdx + '_Right' + (j + 1);
          if (Input.gamepadCache.indexOf(keyCodeRight) >= 0) {
            right ? Input.keyDown(keyCodeRight) : Input.keyUp(keyCodeRight);
          }
        }

        for (let j = 0; j < gp.buttons.length; j++) {
          const b = gp.buttons[j];
          let pressed = false;
          if (typeof (b) == 'object') {
            pressed = !!b.pressed;
          }
          else {
            pressed = b == 1.0;
          }

          if (pressed) {
            Input.registerGamepadIndex(i);
          }
          const gpIdx = Input.getGamepadIndex(i) + 1;

          const keyCode = 'Gamepad' + gpIdx + '_Button' + (j + 1);
          if (Input.gamepadCache.indexOf(keyCode) >= 0) {
            pressed ? Input.keyDown(keyCode) : Input.keyUp(keyCode);
          }
        }
      }
    }
  }
  
  private static keyState = new Array<number>(Key.EC_MAX_KEY_NUM);
  private static keyMap = new Array<string>(Key.EC_MAX_KEY_NUM);
  private static keyArray: { [key: string]: boolean } = {};
  private static gamepadCache = new Array<string>(0);
  private static gamepadMapping = new Array<number>(0);
  private static AXIS_THRESHOLD = 0.5;
}
