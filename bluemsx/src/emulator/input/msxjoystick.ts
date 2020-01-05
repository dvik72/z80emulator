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

import { Input, Key } from '../api/input';
import { JoystickDevice } from './joystickportmanager';

export class MsxJoystick extends JoystickDevice {
  constructor() {
    super();
  }

  public read(): number {
    const s = Input.getKeyStateMap();

    let state = 0;
    switch (this.port) {
      case 0:
        state =
          s[Key.EC_JOY1_UP] << 0 |
          s[Key.EC_JOY1_DOWN] << 1 |
          s[Key.EC_JOY1_LEFT] << 2 |
          s[Key.EC_JOY1_RIGHT] << 3 |
          s[Key.EC_JOY1_BT1] << 4 |
          s[Key.EC_JOY1_BT2] << 5;
        break;
      case 1:
        state =
          s[Key.EC_JOY2_UP] << 0 |
          s[Key.EC_JOY2_DOWN] << 1 |
          s[Key.EC_JOY2_LEFT] << 2 |
          s[Key.EC_JOY2_RIGHT] << 3 |
          s[Key.EC_JOY2_BT1] << 4 |
          s[Key.EC_JOY2_BT2] << 5;
        break;
    }

    return ~state & 0x3f;;
  }
}

