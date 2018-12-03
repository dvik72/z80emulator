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

import { Mapper } from '../../mappers/mapper';
import { MapperRamNormal } from '../../mappers/ramnormal';
import { MapperRomNormal } from '../../mappers/romnormal';
import { MapperSramS1985 } from '../../mappers/srams1985';

import { a1biosRom } from '../../nano/a1biosrom';
import { a1extRom } from '../../nano/a1extrom';
import { a1desk1Rom } from '../../nano/a1desk1rom';
import { a1desk2Rom } from '../../nano/a1desk2rom';


export class PanasonicFsA1 extends Msx2Base {
  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager
  ) {
    super('Panasonic FS-A1', webAudio, diskManager);
  }

  public init(): void {
    super.init();

    if (!this.board) {
      return;
    }
    
    // Set up cartridge slots
    this.addCartridgeSlot(1);
    this.addCartridgeSlot(2);

    // Configure slots
    this.msxRom = new MapperRomNormal(this.board, 0, 0, 0, a1biosRom);
    this.msxE1Rom = new MapperRomNormal(this.board, 3, 1, 0, a1extRom);
    this.msxE2Rom = new MapperRomNormal(this.board, 3, 2, 2, a1desk1Rom);
    this.msxE3Rom = new MapperRomNormal(this.board, 3, 3, 2, a1desk2Rom);
    this.ram = new MapperRamNormal(this.board, 3, 0, 0, 0x10000);

    // TODO: Add for panasonic machines with disk drives
    // this.diskRom = new MapperRomTc8566af(this.diskManager, this.board, 2, 0, new Uint8Array(panasonicDiskRom));
  }
  
  // MSX components
  private ram?: Mapper;
  private msxRom?: Mapper;
  private msxE1Rom?: Mapper;
  private msxE2Rom?: Mapper;
  private msxE3Rom?: Mapper;
}
