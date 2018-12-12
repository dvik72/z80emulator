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

import { Msx2Base } from './Msx2base';
import { WebAudio } from '../../audio/webaudio';
import { DiskManager } from '../../disk/diskmanager';

import { MapperRamMapped } from '../../mappers/rammapped';
import { MapperRomNormal } from '../../mappers/romnormal';
import { MapperRomTc8566af } from '../../mappers/romTc8566af';
import { MapperMsxMusic } from '../../mappers/rommsxmusic';


export class GenericMsx2 extends Msx2Base {

  static NAME = 'Generic MSX2';

  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager
  ) {
    super(
      GenericMsx2.NAME,
      webAudio,
      diskManager,
      ['msx2bios', 'msx2ext', 'panasonicdisk', 'msx2pmus']);
  }

  public init(): void {
    super.init();

    // Set up cartridge slots
    this.addCartridgeSlot(1);
    this.addCartridgeSlot(2);

    // Configure slots
    new MapperRomNormal(this.getBoard(), 0, 0, 0, this.getSystemRom('msx2bios'));
    new MapperRomNormal(this.getBoard(), 3, 1, 0, this.getSystemRom('msx2ext'));
    new MapperRomTc8566af(this.getDiskManager(), this.getBoard(), 3, 1, this.getSystemRom('panasonicdisk'));
    new MapperRamMapped(this.getBoard(), 3, 2, 512 * 1024);
    new MapperMsxMusic(this.getBoard(), 3, 3, this.getSystemRom('msx2pmus'));
  }
}
