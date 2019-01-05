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
import { Machine } from '../machines/machine';
import { PanasonicFsA1 } from '../machines/msx2/panasonic_fs_a1';
import { PhilipsVg8020 } from '../machines/msx/philips_vg_8020';
import { GenericMsx2 } from '../machines/msx2/genericmsx2';
import { GenericMsx2Plus } from '../machines/msx2plus/genericmsx2plus';
import { PanasonicFsA1Wsx } from '../machines/msx2plus/panasonic_fs_a1wsx';
import { PanasonicFsA1Gt } from '../machines/msxtr/panasonicfsa1gt';

import { WebAudio } from '../audio/webaudio';
import { DiskManager } from '../disk/diskmanager';

export class MachineManager {
  constructor(
    private webAudio: WebAudio,
    private diskManager: DiskManager
  ) {
  }

  public getDefaultMachineName(): string {
    return GenericMsx2Plus.NAME;
  }
  
  public getMachineNames(): Array<string> {
    return this.machineNames;
  }

  public createMachine(name: string): Machine | undefined {
    switch (name) {
      case PanasonicFsA1.NAME:
        return new PanasonicFsA1(this.webAudio, this.diskManager);
      case PhilipsVg8020.NAME:
        return new PhilipsVg8020(this.webAudio, this.diskManager);
      case GenericMsx2.NAME:
        return new GenericMsx2(this.webAudio, this.diskManager);
      case GenericMsx2Plus.NAME:
        return new GenericMsx2Plus(this.webAudio, this.diskManager);
      case PanasonicFsA1Wsx.NAME:
        return new PanasonicFsA1Wsx(this.webAudio, this.diskManager);
      case PanasonicFsA1Gt.NAME:
        return new PanasonicFsA1Gt(this.webAudio, this.diskManager);
    }

    return undefined;
  }

  private machineNames = [
    PhilipsVg8020.NAME,
    GenericMsx2.NAME,
    PanasonicFsA1.NAME,
    GenericMsx2Plus.NAME,
    PanasonicFsA1Wsx.NAME,
    PanasonicFsA1Gt.NAME
  ];
}