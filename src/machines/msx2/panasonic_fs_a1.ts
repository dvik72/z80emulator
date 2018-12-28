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

import { Msx2Base } from './msx2base';
import { WebAudio } from '../../audio/webaudio';
import { DiskManager } from '../../disk/diskmanager';

import { MapperRamNormal } from '../../mappers/ramnormal';
import { MapperRomNormal } from '../../mappers/romnormal';


export class PanasonicFsA1 extends Msx2Base {

  static NAME = 'Panasonic FS-A1';

  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager
  ) {
    super(
      PanasonicFsA1.NAME,
      webAudio,
      diskManager,
      ['a1bios', 'a1desk1', 'a1desk2', 'a1ext']);
  }

  public init(): void {
    super.init();

    // Set up cartridge slots
    this.addCartridgeSlot(1);
    this.addCartridgeSlot(2);

    // Configure slots
    new MapperRomNormal(this.getBoard(), 0, 0, 0, this.getSystemRom('a1bios'));
    new MapperRomNormal(this.getBoard(), 3, 1, 0, this.getSystemRom('a1ext'));
    new MapperRomNormal(this.getBoard(), 3, 2, 2, this.getSystemRom('a1desk1'));
    new MapperRomNormal(this.getBoard(), 3, 3, 2, this.getSystemRom('a1desk2'));
    new MapperRamNormal(this.getBoard(), 3, 0, 0, 0x10000);
  }
}
