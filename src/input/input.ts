﻿//////////////////////////////////////////////////////////////////////////////
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

export class Input {
  public static keyDown(keyCode: string): void {
    Input.keyArray[keyCode] = true;

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

  public static init(): void {
    Input.keyMap[Key.EC_0] = 'Digit0';
    Input.keyMap[Key.EC_1] = 'Digit1';
    Input.keyMap[Key.EC_2] = 'Digit2';
    Input.keyMap[Key.EC_3] = 'Digit3';
    Input.keyMap[Key.EC_4] = 'Digit4';
    Input.keyMap[Key.EC_5] = 'Digit5';
    Input.keyMap[Key.EC_6] = 'Digit6';
    Input.keyMap[Key.EC_7] = 'Digit7';
    Input.keyMap[Key.EC_8] = 'Digit8';
    Input.keyMap[Key.EC_9] = 'Digit9';

    Input.keyMap[Key.EC_A] = 'KeyA';
    Input.keyMap[Key.EC_B] = 'KeyB';
    Input.keyMap[Key.EC_C] = 'KeyC';
    Input.keyMap[Key.EC_D] = 'KeyD';
    Input.keyMap[Key.EC_E] = 'KeyE';
    Input.keyMap[Key.EC_F] = 'KeyF';
    Input.keyMap[Key.EC_G] = 'KeyG';
    Input.keyMap[Key.EC_H] = 'KeyH';
    Input.keyMap[Key.EC_I] = 'KeyI';
    Input.keyMap[Key.EC_J] = 'KeyJ';
    Input.keyMap[Key.EC_K] = 'KeyK';
    Input.keyMap[Key.EC_L] = 'KeyL';
    Input.keyMap[Key.EC_M] = 'KeyM';
    Input.keyMap[Key.EC_N] = 'KeyN';
    Input.keyMap[Key.EC_O] = 'KeyO';
    Input.keyMap[Key.EC_P] = 'KeyP';
    Input.keyMap[Key.EC_Q] = 'KeyQ';
    Input.keyMap[Key.EC_R] = 'KeyR';
    Input.keyMap[Key.EC_S] = 'KeyS';
    Input.keyMap[Key.EC_T] = 'KeyT';
    Input.keyMap[Key.EC_U] = 'KeyU';
    Input.keyMap[Key.EC_V] = 'KeyV';
    Input.keyMap[Key.EC_W] = 'KeyW';
    Input.keyMap[Key.EC_X] = 'KeyX';
    Input.keyMap[Key.EC_Y] = 'KeyY';
    Input.keyMap[Key.EC_Z] = 'KeyZ';

    Input.keyMap[Key.EC_COMMA] = 'Comma';
    Input.keyMap[Key.EC_PERIOD] = 'Period';
    Input.keyMap[Key.EC_SEMICOL] = 'Semicolon';
    Input.keyMap[Key.EC_COLON] = 'Quote';
    Input.keyMap[Key.EC_LBRACK] = 'BracketLeft';
    Input.keyMap[Key.EC_RBRACK] = 'BracketRight';
    Input.keyMap[Key.EC_BKSLASH] = 'Backslash';
    Input.keyMap[Key.EC_NEG] = 'Minus';
    Input.keyMap[Key.EC_CIRCFLX] = 'Equal';
    Input.keyMap[Key.EC_BKSPACE] = 'Backspace';

    Input.keyMap[Key.EC_TORIKE] = 'AltLeft';
    Input.keyMap[Key.EC_JIKKOU] = 'AltRight';
    Input.keyMap[Key.EC_CAPS] = 'CapsLock';
    Input.keyMap[Key.EC_CTRL] = 'ControlLeft';
    Input.keyMap[Key.EC_UNDSCRE] = 'ControlRight';
    Input.keyMap[Key.EC_GRAPH] = 'OSLeft';
    Input.keyMap[Key.EC_LSHIFT] = 'ShiftLeft';
    Input.keyMap[Key.EC_RSHIFT] = 'ShiftRight';
    Input.keyMap[Key.EC_RETURN] = 'Enter';
    Input.keyMap[Key.EC_SPACE] = 'Space';
    Input.keyMap[Key.EC_TAB] = 'Tab';
    Input.keyMap[Key.EC_DOWN] = 'ArrowDown';
    Input.keyMap[Key.EC_LEFT] = 'ArrowLeft';
    Input.keyMap[Key.EC_RIGHT] = 'ArrowRight';
    Input.keyMap[Key.EC_UP] = 'ArrowUp';
    Input.keyMap[Key.EC_ESC] = 'Escape';
    Input.keyMap[Key.EC_PAUSE] = 'Pause';

    Input.keyMap[Key.EC_F1] = 'F1';
    Input.keyMap[Key.EC_F2] = 'F2';
    Input.keyMap[Key.EC_F3] = 'F3';
    Input.keyMap[Key.EC_F4] = 'F4';
    Input.keyMap[Key.EC_F5] = 'F5';

    Input.keyMap[Key.EC_NUM0] = 'Numpad0';
    Input.keyMap[Key.EC_NUM1] = 'Numpad1';
    Input.keyMap[Key.EC_NUM2] = 'Numpad2';
    Input.keyMap[Key.EC_NUM3] = 'Numpad3';
    Input.keyMap[Key.EC_NUM4] = 'Numpad4';
    Input.keyMap[Key.EC_NUM5] = 'Numpad5';
    Input.keyMap[Key.EC_NUM6] = 'Numpad6';
    Input.keyMap[Key.EC_NUM7] = 'Numpad7';
    Input.keyMap[Key.EC_NUM8] = 'Numpad8';
    Input.keyMap[Key.EC_NUM9] = 'Numpad9';
    Input.keyMap[Key.EC_NUMADD] = 'NumpadAdd';
    Input.keyMap[Key.EC_NUMCOM] = 'NumpadComma';
    Input.keyMap[Key.EC_NUMPER] = 'NumpadDecimal';
    Input.keyMap[Key.EC_NUMSUB] = 'NumpadSubtract';
    Input.keyMap[Key.EC_NUMDIV] = 'NumpadDivide';
    Input.keyMap[Key.EC_NUMMUL] = 'NumpadMultiply';

    Input.keyMap[Key.EC_JOY1_UP] = 'Gamepad1_Up1';
    Input.keyMap[Key.EC_JOY1_DOWN] = 'Gamepad1_Down1';
    Input.keyMap[Key.EC_JOY1_LEFT] = 'Gamepad1_Left1';
    Input.keyMap[Key.EC_JOY1_RIGHT] = 'Gamepad1_Right1';
    Input.keyMap[Key.EC_JOY1_BT1] = 'Gamepad1_Button1';
    Input.keyMap[Key.EC_JOY1_BT2] = 'Gamepad1_Button2';

    Input.keyMap[Key.EC_JOY2_UP] = 'Gamepad2_Up1';
    Input.keyMap[Key.EC_JOY2_DOWN] = 'Gamepad2_Down1';
    Input.keyMap[Key.EC_JOY2_LEFT] = 'Gamepad2_Left1';
    Input.keyMap[Key.EC_JOY2_RIGHT] = 'Gamepad2_Right1';
    Input.keyMap[Key.EC_JOY2_BT1] = 'Gamepad2_Button1';
    Input.keyMap[Key.EC_JOY2_BT2] = 'Gamepad2_Button2';

    Input.updateGamepadsCache();
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
