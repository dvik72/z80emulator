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

import { MsxTrBase } from './msxtrbase';
import { WebAudio } from '../../api/webaudio';
import { DiskManager } from '../../disk/diskmanager';
import { LedManager } from '../../core/ledmanager';

import { MsxMidi } from '../../io/msxmidi';
import { MapperF4Device } from '../../mappers/f4device';
import { MapperRamMapped } from '../../mappers/rammapped';
import { MapperRomNormal } from '../../mappers/romnormal';
import { MapperS1990 } from '../../mappers/s1990';
import { MapperTurboRIo } from '../../mappers/turborio';
import { MapperTurboRPcm } from '../../mappers/turborpcm';
import { MapperTurboRTimer } from '../../mappers/turbortimer';
import { MapperRomPanasonicDram } from '../../mappers/rompanasonicdram';
import { MapperKanji } from '../../mappers/romkanji';
import { MapperSramMatsuchita } from '../../mappers/srammatsushita';
import { MapperMsxMusic } from '../../mappers/rommsxmusic';
import { MapperRomTc8566af, Tc8566AfIo } from '../../mappers/romtc8566af';
import { MapperRomPanasonic } from '../../mappers/rompanasonic';


export class PanasonicFsA1Gt extends MsxTrBase {

  static NAME = 'Panasonic FS-A1GT';

  public constructor(
    webAudio: WebAudio,
    diskManager: DiskManager,
    ledManager: LedManager
  ) {
    super(
      PanasonicFsA1Gt.NAME,
      webAudio,
      diskManager,
      ledManager,
      ['a1gtbios', 'a1gtdos', 'a1gtext', 'a1gtfirm', 'a1gtkdr', 'a1gtkfn', 'a1gtmus', 'a1gtopt']);
  }

  public init(): void {
    super.init();

    // Set up cartridge slots
    this.addCartridgeSlot(1);
    this.addCartridgeSlot(2);

    // Machine specific hardware
    this.addMapper(new MapperS1990(this.getBoard()));
    this.addMapper(new MapperTurboRTimer(this.getBoard()));
    this.addMapper(new MapperTurboRPcm(this.getBoard()));
    this.addMapper(new MapperTurboRIo(this.getBoard()));
    this.addMapper(new MapperF4Device(this.getBoard(), false));
    this.addMapper(new MapperSramMatsuchita(this.getBoard(), false));
    this.addMapper(new MapperKanji(this.getBoard(), this.getSystemRom('a1gtkfn')));
    this.addMapper(new MsxMidi(this.getBoard()));

    // Configure slots
    this.addMapper(new MapperRomPanasonicDram(this.getBoard(), 0, 0, 0, this.getSystemRom('a1gtbios')));
    this.addMapper(new MapperMsxMusic(this.getBoard(), 0, 2, this.getSystemRom('a1gtmus')));
    this.addMapper(new MapperRomNormal(this.getBoard(), 0, 3, 2, this.getSystemRom('a1gtopt')));

    this.addMapper(new MapperRomPanasonicDram(this.getBoard(), 3, 1, 0, this.getSystemRom('a1gtext')));
    this.addMapper(new MapperRomPanasonicDram(this.getBoard(), 3, 1, 2, this.getSystemRom('a1gtkdr')));
    this.addMapper(new MapperRomTc8566af(Tc8566AfIo.MSXTR, this.getDiskManager(), this.getBoard(), 3, 2, this.getSystemRom('a1gtdos')));
    this.addMapper(new MapperRomPanasonic(this.getBoard(), 3, 3, 8, this.getSystemRom('a1gtfirm'), 0x8000));

    const ramMapper = new MapperRamMapped(this.getBoard(), 3, 0, 512 * 1024);
    this.addMapper(ramMapper);
    this.getBoard().setMainRam(ramMapper.getRamPages());
  }
}
