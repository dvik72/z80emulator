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

import { Msx2PlusBase } from './msx2plusbase';
import { WebAudio } from '../../audio/webaudio';
import { DiskManager } from '../../disk/diskmanager';

import { MapperF4Device } from '../../mappers/f4device';
import { MapperRamMapped } from '../../mappers/rammapped';
import { MapperRomNormal } from '../../mappers/romnormal';
import { MapperSramS1985 } from '../../mappers/srams1985';
import { MapperKanji } from '../../mappers/romkanji';
import { MapperSramMatsuchita } from '../../mappers/srammatsushita';
import { MapperMsxMusic } from '../../mappers/rommsxmusic';
import { MapperRomPanasonic } from '../../mappers/rompanasonic';
import { MapperRomTc8566af } from '../../mappers/romTc8566af';


export class GenericMsx2Plus extends Msx2PlusBase {

  static NAME = 'Generic MSX2 Plus';

  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager
  ) {
    super(
      GenericMsx2Plus.NAME,
      webAudio,
      diskManager,
      ['msx2pbios', 'kanji', 'msx2pmus', 'msx2pext', 'msxkanji', 'panasonicdisk', 'xbasic']);
  }

  public init(): void {
    super.init();

    // Set up cartridge slots
    this.addCartridgeSlot(1);
    this.addCartridgeSlot(2);

    // Machine specific hardware
    this.getBoard().getSlotManager().setSubslotted(0, true);
    new MapperF4Device(this.getBoard(), true);

    // Configure slots
    new MapperKanji(this.getBoard(), this.getSystemRom('kanji'));
    new MapperRomNormal(this.getBoard(), 0, 0, 0, this.getSystemRom('msx2pbios'));
    new MapperMsxMusic(this.getBoard(), 0, 2, this.getSystemRom('msx2pmus'));
    new MapperRomNormal(this.getBoard(), 3, 1, 0, this.getSystemRom('msx2pext'));
    new MapperRomNormal(this.getBoard(), 3, 1, 2, this.getSystemRom('msxkanji'));
    new MapperRomTc8566af(this.getDiskManager(), this.getBoard(), 3, 2, this.getSystemRom('panasonicdisk'));
    new MapperRomNormal(this.getBoard(), 3, 3, 2, this.getSystemRom('xbasic'));

    const ramMapper = new MapperRamMapped(this.getBoard(), 3, 0, 512 * 1024);
    this.getBoard().setMainRam(ramMapper.getRamPages());
  }
}
