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

import { UserPrefs } from './userprefs';
import { Key, Input } from '../input/input';


class KeyCoord {
  constructor(
    public key: Key,
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {
  }
}

const KEY_COORDINATES = [
  new KeyCoord(Key.EC_NONE, 0, 0, 1, 1),

  new KeyCoord(Key.EC_F1, 24, 27, 40, 18),
  new KeyCoord(Key.EC_F2, 64, 27, 39, 18),
  new KeyCoord(Key.EC_F3, 103, 27, 39, 18),
  new KeyCoord(Key.EC_F4, 142, 27, 40, 18),
  new KeyCoord(Key.EC_F5, 182, 27, 40, 18),
  new KeyCoord(Key.EC_STOP, 231, 27, 39, 18),
  new KeyCoord(Key.EC_CLS, 270, 27, 40, 18),
  new KeyCoord(Key.EC_SELECT, 319, 27, 40, 18),
  new KeyCoord(Key.EC_INS, 359, 27, 39, 18),
  new KeyCoord(Key.EC_DEL, 398, 27, 40, 18),

  new KeyCoord(Key.EC_ESC, 11, 48, 29, 24),
  new KeyCoord(Key.EC_1, 40, 48, 30, 24),
  new KeyCoord(Key.EC_2, 70, 48, 29, 24),
  new KeyCoord(Key.EC_3, 99, 48, 30, 24),
  new KeyCoord(Key.EC_4, 129, 48, 29, 24),
  new KeyCoord(Key.EC_5, 158, 48, 29, 24),
  new KeyCoord(Key.EC_6, 187, 48, 29, 24),
  new KeyCoord(Key.EC_7, 217, 48, 29, 24),
  new KeyCoord(Key.EC_8, 246, 48, 30, 24),
  new KeyCoord(Key.EC_9, 276, 48, 29, 24),
  new KeyCoord(Key.EC_0, 305, 48, 29, 24),
  new KeyCoord(Key.EC_NEG, 334, 48, 30, 24),
  new KeyCoord(Key.EC_CIRCFLX, 364, 48, 30, 24),
  new KeyCoord(Key.EC_BKSLASH, 394, 48, 29, 24),
  new KeyCoord(Key.EC_BKSPACE, 423, 48, 30, 24),

  new KeyCoord(Key.EC_TAB, 11, 72, 43, 23),
  new KeyCoord(Key.EC_Q, 54, 72, 30, 23),
  new KeyCoord(Key.EC_W, 84, 72, 30, 23),
  new KeyCoord(Key.EC_E, 114, 72, 29, 23),
  new KeyCoord(Key.EC_R, 143, 72, 30, 23),
  new KeyCoord(Key.EC_T, 172, 72, 30, 23),
  new KeyCoord(Key.EC_Y, 202, 72, 29, 23),
  new KeyCoord(Key.EC_U, 231, 72, 30, 23),
  new KeyCoord(Key.EC_I, 261, 72, 30, 23),
  new KeyCoord(Key.EC_O, 291, 72, 30, 23),
  new KeyCoord(Key.EC_P, 319, 72, 30, 23),
  new KeyCoord(Key.EC_AT, 350, 72, 30, 23),
  new KeyCoord(Key.EC_LBRACK, 379, 72, 30, 23),

  new KeyCoord(Key.EC_CTRL, 11, 95, 51, 22),
  new KeyCoord(Key.EC_A, 63, 95, 30, 22),
  new KeyCoord(Key.EC_S, 93, 95, 29, 22),
  new KeyCoord(Key.EC_D, 122, 95, 30,22),
  new KeyCoord(Key.EC_F, 152, 95, 29, 22),
  new KeyCoord(Key.EC_G, 181, 95, 30, 22),
  new KeyCoord(Key.EC_H, 211, 95, 29, 22),
  new KeyCoord(Key.EC_J, 240, 95, 30, 22),
  new KeyCoord(Key.EC_K, 270, 95, 29, 22),
  new KeyCoord(Key.EC_L, 299, 95, 29, 22),
  new KeyCoord(Key.EC_SEMICOL, 328, 95, 30, 22),
  new KeyCoord(Key.EC_COLON, 358, 95, 29, 22),
  new KeyCoord(Key.EC_RBRACK, 387, 95, 30, 22),

  new KeyCoord(Key.EC_RETURN, 408, 72, 43, 42),

  new KeyCoord(Key.EC_LSHIFT, 11, 117, 67, 23),
  new KeyCoord(Key.EC_Z, 78, 117, 30, 23),
  new KeyCoord(Key.EC_X, 108, 117, 29, 23),
  new KeyCoord(Key.EC_C, 137, 117, 30, 23),
  new KeyCoord(Key.EC_V, 167, 117, 29, 23),
  new KeyCoord(Key.EC_B, 196, 117, 29, 23),
  new KeyCoord(Key.EC_N, 225, 117, 29, 23),
  new KeyCoord(Key.EC_M, 254, 117, 30, 23),
  new KeyCoord(Key.EC_COMMA, 284, 117, 30, 23),
  new KeyCoord(Key.EC_PERIOD, 314, 117, 29, 23),
  new KeyCoord(Key.EC_DIV, 343, 117, 30, 23),
  new KeyCoord(Key.EC_UNDSCRE, 373, 117, 29, 23),
  new KeyCoord(Key.EC_RSHIFT, 402, 117, 50, 23),

  new KeyCoord(Key.EC_CAPS, 78, 140, 30, 24),
  new KeyCoord(Key.EC_GRAPH, 108, 140, 29, 24),
  new KeyCoord(Key.EC_TORIKE, 137, 140, 30, 24),
  new KeyCoord(Key.EC_SPACE, 166, 140, 148, 24),
  new KeyCoord(Key.EC_JIKKOU, 314, 140, 59, 24),
  new KeyCoord(Key.EC_CODE, 373, 140, 29, 24),
  new KeyCoord(Key.EC_PAUSE, 402, 140, 50, 24),

  new KeyCoord(Key.EC_LEFT, 462, 134, 37, 34),
  new KeyCoord(Key.EC_UP, 499, 122, 43, 27),
  new KeyCoord(Key.EC_DOWN, 499, 149, 43, 28),
  new KeyCoord(Key.EC_RIGHT, 542, 134, 37, 36),
  
  new KeyCoord(Key.EC_NUM7, 462, 20, 29, 22),
  new KeyCoord(Key.EC_NUM8, 491, 20, 29, 22),
  new KeyCoord(Key.EC_NUM9, 520, 20, 30, 22),
  new KeyCoord(Key.EC_NUMDIV, 550, 20, 30, 22),
  new KeyCoord(Key.EC_NUM4, 462, 42, 29, 23),
  new KeyCoord(Key.EC_NUM5, 491, 42, 29, 23),
  new KeyCoord(Key.EC_NUM6, 520, 42, 30, 23),
  new KeyCoord(Key.EC_NUMMUL, 550, 42, 30, 23),
  new KeyCoord(Key.EC_NUM1, 462, 65, 29, 22),
  new KeyCoord(Key.EC_NUM2, 491, 65, 29, 22),
  new KeyCoord(Key.EC_NUM3, 520, 65, 30, 22),
  new KeyCoord(Key.EC_NUMSUB, 550, 65, 30, 22),
  new KeyCoord(Key.EC_NUM0, 462, 87, 29, 23),
  new KeyCoord(Key.EC_NUMPER, 491, 87, 29, 23),
  new KeyCoord(Key.EC_NUMCOM, 520, 87, 30, 23),
  new KeyCoord(Key.EC_NUMADD, 550, 87, 30, 23)
];

const JOYSTICK1_COORDINATES = [
  new KeyCoord(Key.EC_NONE, 0, 0, 1, 1),

  new KeyCoord(Key.EC_JOY1_UP, 52, 72, 21, 26),
  new KeyCoord(Key.EC_JOY1_DOWN, 52, 98, 21, 26),
  new KeyCoord(Key.EC_JOY1_LEFT, 35, 87, 28, 21),
  new KeyCoord(Key.EC_JOY1_RIGHT, 63, 87, 28, 21),
  new KeyCoord(Key.EC_JOY1_BT1, 229, 81, 29, 30),
  new KeyCoord(Key.EC_JOY1_BT2, 185, 82, 29, 29)
];

const JOYSTICK2_COORDINATES = [
  new KeyCoord(Key.EC_NONE, 0, 0, 1, 1),

  new KeyCoord(Key.EC_JOY2_UP, 52, 72, 21, 26),
  new KeyCoord(Key.EC_JOY2_DOWN, 52, 98, 21, 26),
  new KeyCoord(Key.EC_JOY2_LEFT, 35, 87, 28, 21),
  new KeyCoord(Key.EC_JOY2_RIGHT, 63, 87, 28, 21),
  new KeyCoord(Key.EC_JOY2_BT1, 229, 81, 29, 30),
  new KeyCoord(Key.EC_JOY2_BT2, 185, 82, 29, 29)
];

enum Config {
  NONE = 99,
  KEYBOARD = 0,
  JOYSTICK1 = 1,
  JOYSTICK2 = 2,
}

export class InputConfig {
  constructor(private userPrefs: UserPrefs) {
    const span = document.getElementById('inputConfigClose');
    span!.addEventListener('click', (event) => { event.preventDefault(); this.hide(); });

    document.addEventListener('inputtabpressed', this.onInputTabPressed.bind(this));
  }

  public show(): void {
    this.keySelected = Key.EC_NONE;
    this.currentConfig = Config.NONE;

    const kbdDiv = document.getElementById('keyboard-config');
    kbdDiv!.addEventListener('click', this.onKeyboardClick.bind(this));

    document.addEventListener('emukeypressed', this.onEmuKeyPressed.bind(this));

    const modal = document.getElementById('inputConfigModal');
    window.onclick = (event: Event) => {
      if (event!.target == modal) {
        this.hide();
      }
    }

    modal!.style.display = 'block';

    this.setConfig(Config.JOYSTICK1);
  }

  private hide(): void {
    const modal = document.getElementById('inputConfigModal');
    modal!.style.display = 'none';

    this.currentConfig = Config.NONE;

    this.userPrefs.save();
  }

  private setConfig(config: Config): void {
    if (this.currentConfig == config) {
      return;
    }
    this.currentConfig = config;

    this.updateSelectState();

    const tabs = [
      'inputconfig-keyboard',
      'inputconfig-joystick1',
      'inputconfig-joystick2'
    ];

    for (let i = 0; i < tabs.length; i++) {
      const tab = document.getElementById(tabs[i]);
      if (i == config) {
        tab!.classList.add('active');
      } else {
        tab!.classList.remove('active');
      }
    }
    
    const img = document.getElementById('keyboard-config');
    (img as any).src = [
      'img/keyboard.png',
      'img/joystick.png',
      'img/joystick.png'
    ][config];
    
    const containerStyles = [
      'config-image-keyboard',
      'config-image-joystick',
      'config-image-joystick'
    ];
    const imgContainer = document.getElementById('config-image-container');
    for (const style of containerStyles) {
      imgContainer!.classList.remove(style);
    }
    imgContainer!.classList.add(containerStyles[config]);
    
    this.coordinates = [
      KEY_COORDINATES,
      JOYSTICK1_COORDINATES,
      JOYSTICK2_COORDINATES
    ][config];

    this.pressedImg = [
      'img/keyboardpressed.png',
      'img/joystickpressed.png',
      'img/joystickpressed.png'
    ][config];
  }

  private onInputTabPressed(event: CustomEvent): void {
    if (event.detail == 'keyboard') {
      this.setConfig(Config.KEYBOARD);
    } else if (event.detail == 'joystick1') {
      this.setConfig(Config.JOYSTICK1);
    } else if (event.detail == 'joystick2') {
      this.setConfig(Config.JOYSTICK2);
    }
  }

  private onEmuKeyPressed(event: CustomEvent): void {
    if (this.currentConfig == Config.NONE) {
      return;
    }
    
    if (this.keySelected != Key.EC_NONE) {
      const keyMapped = event.detail;
      const keyMappedDiv = document.getElementById('key-mapped-data');
      keyMappedDiv!.innerHTML = keyMapped;
      Input.mapKey(this.keySelected, keyMapped);
    }
  }

  private onKeyboardClick(event: MouseEvent): void {
    this.updateSelectState(event.offsetX, event.offsetY)
  }

  private updateSelectState(x = -1, y = -1): void {
    let keyCoord = this.coordinates[Key.EC_NONE];
    for (const coord of this.coordinates) {
      const dx = x - coord.x;
      const dy = y - coord.y;
      if (dx >= 0 && dy >= 0 && dx < coord.width && dy < coord.height) {
        keyCoord = coord;
      }
    }

    const keyDiv = document.getElementById('keyboard-key');
    
    if (keyCoord.key == Key.EC_NONE) {
      keyDiv!.style.background = 'img/empty.gif';
      keyDiv!.style.width = 1 + 'px';
      keyDiv!.style.height = 1 + 'px';

      const keySelectedDiv = document.getElementById('key-selected-data');
      keySelectedDiv!.innerHTML = '';
      this.keySelected = Key.EC_NONE;
      const keyMappedDiv = document.getElementById('key-mapped-data');
      keyMappedDiv!.innerHTML = '';
    }
    else {
      keyDiv!.style.left = keyCoord.x + 'px';
      keyDiv!.style.top = keyCoord.y + 'px';
      keyDiv!.style.width = keyCoord.width + 'px';
      keyDiv!.style.height = keyCoord.height + 'px';
      keyDiv!.style.background = 'url(' + this.pressedImg + ') -' + (1 + keyCoord.x) + 'px -' + (1 + keyCoord.y) + 'px';
      
      if (keyCoord.key != this.keySelected) {
        const keyMappedDiv = document.getElementById('key-mapped-data');
        keyMappedDiv!.innerHTML = Input.getMappedKey(keyCoord.key);
      }
      this.keySelected = keyCoord.key;
      const keySelectedDiv = document.getElementById('key-selected-data');
      keySelectedDiv!.innerHTML = Input.getKeyName(keyCoord.key);
    }
  }

  private keySelected = Key.EC_NONE;
  private currentConfig = Config.NONE;
  private coordinates = KEY_COORDINATES;
  private pressedImg = 'img/keyboardpressed.png';
}