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
import { LedManager } from '../../core/ledmanager';

import { MapperF4Device } from '../../mappers/f4device';
import { MapperRamMapped } from '../../mappers/rammapped';
import { MapperRomNormal } from '../../mappers/romnormal';
import { MapperSramS1985 } from '../../mappers/srams1985';
import { MapperKanji } from '../../mappers/romkanji';
import { MapperSramMatsuchita } from '../../mappers/srammatsushita';
import { MapperMsxMusic } from '../../mappers/rommsxmusic';
import { MapperRomPanasonic } from '../../mappers/rompanasonic';
import { MapperRomTc8566af, Tc8566AfIo } from '../../mappers/romtc8566af';


export class PanasonicFsA1Wsx extends Msx2PlusBase {

  static NAME = 'Panasonic FS-A1WSX';

  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager,
    ledManager: LedManager
  ) {
    super(
      PanasonicFsA1Wsx.NAME,
      webAudio,
      diskManager,
      ledManager,
      ['a1wsbios', 'a1wskfn', 'a1wsmusp', 'a1wsext', 'a1wskdr', 'a1wsdisp', 'a1wsfirm']);
  }

  public init(): void {
    super.init();

    // Set up cartridge slots
    this.addCartridgeSlot(1);
    this.addCartridgeSlot(2);

    // Machine specific hardware
    this.getBoard().getSlotManager().setSubslotted(0, true);

    this.addMapper(new MapperSramS1985(this.getBoard()));
    this.addMapper(new MapperF4Device(this.getBoard(), true));
    this.addMapper(new MapperSramMatsuchita(this.getBoard(), false));

    // Configure slots
    this.addMapper(new MapperKanji(this.getBoard(), this.getSystemRom('a1wskfn')));
    this.addMapper(new MapperRomNormal(this.getBoard(), 0, 0, 0, this.getSystemRom('a1wsbios')));
    this.addMapper(new MapperMsxMusic(this.getBoard(), 0, 2, this.getSystemRom('a1wsmusp')));
    this.addMapper(new MapperRomNormal(this.getBoard(), 3, 1, 0, this.getSystemRom('a1wsext')));
    this.addMapper(new MapperRomNormal(this.getBoard(), 3, 1, 2, this.getSystemRom('a1wskdr')));
    this.addMapper(new MapperRomTc8566af(Tc8566AfIo.MSX2, this.getDiskManager(), this.getBoard(), 3, 2, this.getSystemRom('a1wsdisp')));
    this.addMapper(new MapperRomPanasonic(this.getBoard(), 3, 3, 6, this.getSystemRom('a1wsfirm'), 0x4000));

    const ramMapper = new MapperRamMapped(this.getBoard(), 3, 0, 64 * 1024);
    this.addMapper(ramMapper);
    this.getBoard().setMainRam(ramMapper.getRamPages());
  }
}
