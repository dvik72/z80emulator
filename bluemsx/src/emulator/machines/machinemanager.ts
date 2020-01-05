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

import { WebAudio } from '../api/webaudio';
import { DiskManager } from '../disk/diskmanager';
import { LedManager } from '../core/ledmanager';

export class MachineManager {
  constructor(
    private webAudio: WebAudio,
    private diskManager: DiskManager,
    private ledManager: LedManager
  ) {
  }

  public getDefaultMachineName(): string {
    return GenericMsx2Plus.NAME;
  }
  
  public getMachineNames(): Array<string> {
    return this.machineNames;
  }

  public createMachine(name: string, machineRomState?: any): Machine | undefined {
    let machine: Machine | undefined = undefined;
    switch (name) {
      case PanasonicFsA1.NAME:
        machine = new PanasonicFsA1(this.webAudio, this.diskManager, this.ledManager);
        break;
      case PhilipsVg8020.NAME:
        machine = new PhilipsVg8020(this.webAudio, this.diskManager, this.ledManager);
        break;
      case GenericMsx2.NAME:
        machine = new GenericMsx2(this.webAudio, this.diskManager, this.ledManager);
        break;
      case GenericMsx2Plus.NAME:
        machine = new GenericMsx2Plus(this.webAudio, this.diskManager, this.ledManager);
        break;
      case PanasonicFsA1Wsx.NAME:
        machine = new PanasonicFsA1Wsx(this.webAudio, this.diskManager, this.ledManager);
        break;
      case PanasonicFsA1Gt.NAME:
        machine = new PanasonicFsA1Gt(this.webAudio, this.diskManager, this.ledManager);
        break;
    }

    if (machine) {
      machine.loadSystemRoms(machineRomState);
    }

    return machine;
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