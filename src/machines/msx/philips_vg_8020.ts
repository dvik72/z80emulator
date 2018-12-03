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
import { WebAudio } from '../../audio/webaudio';
import { DiskManager } from '../../disk/diskmanager';

import { Mapper } from '../../mappers/mapper';
import { MapperRamNormal } from '../../mappers/ramnormal';
import { MapperRomNormal } from '../../mappers/romnormal';

import { msxDosRom } from '../../nano/msxdosrom';


export class PanasonicFsA1 extends MsxBase {
  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager
  ) {
    super('Philips VG-8020', webAudio, diskManager);
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
    this.msxRom = new MapperRomNormal(this.board, 0, 0, 0, msxDosRom);
    this.ram = new MapperRamNormal(this.board, 3, 0, 0, 0x10000);
  }

  // MSX components
  private ram?: Mapper;
  private msxRom?: Mapper;
}
