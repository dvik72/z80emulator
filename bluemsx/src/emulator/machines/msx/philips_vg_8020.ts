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

import { MsxBase } from './msxbase';
import { WebAudio } from '../../api/webaudio';
import { DiskManager } from '../../disk/diskmanager';
import { LedManager } from '../../core/ledmanager';

import { MapperRamNormal } from '../../mappers/ramnormal';
import { MapperRomNormal } from '../../mappers/romnormal';


export class PhilipsVg8020 extends MsxBase {

  static NAME = 'Philips VG-8020';

  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager,
    ledManager: LedManager
  ) {
    super(
      PhilipsVg8020.NAME,
      webAudio,
      diskManager,
      ledManager,
      ['vg8020']
    );
  }

  public init(): void {
    super.init();

    // Set up cartridge slots
    this.addCartridgeSlot(1);
    this.addCartridgeSlot(2);

    // Configure slots
    this.addMapper(new MapperRomNormal(this.getBoard(), 0, 0, 0, this.getSystemRom('vg8020')));
    this.addMapper(new MapperRamNormal(this.getBoard(), 3, 0, 0, 0x10000));
  }
}
