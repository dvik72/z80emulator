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

import { MediaInfo, MediaType } from '../util/mediainfo';
import { Board } from '../core/board';
import { Mapper } from '../mappers/mapper';

import { MapperRomAscii8 } from './romascii8';
import { MapperRomAscii16 } from './romascii16';
import { MapperRomAscii8sram, Ascii8SramType } from './romascii8sram';
import { MapperRomAscii16sram } from './romascii16sram';
import { MapperRomKonami } from './romkonami';
import { MapperRomKonamiScc } from './romkonamiscc';
import { MapperRomMajutsushi } from './rommajutsushi';
import { MapperRomKorean80 } from './romkorean80';
import { MapperRomKorean90 } from './romkorean90';
import { MapperRomKorean126 } from './romkorean126';
import { MapperRom64kMirrored } from './rom64kmirrored';
import { MapperRomRtype } from './romrtype';
import { MapperRomGameMaster2 } from './romgamemaster2';
import { MapperRomCrossBlaim } from './romcrossblaim';
import { MapperRomHarryFox } from './romharryfox';
import { MapperRomLodeRunner } from './romloderunner';
import { MapperRomNormal } from './romnormal';
import { MapperRomMegaFlashRomScc } from './rommegaflashromscc';
import { MapperRomHolyQuran } from './romholyquran';
import { MapperRomMsxAudio } from './rommsxaudio'
import { MapperRomMoonsound } from './rommoonsound';


export function getSupportedCartridgeTypeNames(): Array<string> {
  let typeNames = new Array<string>();
  for (const mediaType of getSupportedCartridgeTypes()) {
    typeNames.push(mediaType.toString());
  }
  return typeNames;
}


export function getSupportedCartridgeTypes(): Array<MediaType> {
  return [
    MediaType.UNKNOWN,
    MediaType.ASCII8,
    MediaType.ASCII8SRAM,
    MediaType.ASCII16,
    MediaType.ASCII16SRAM,
    MediaType.KONAMI,
    MediaType.KONAMISCC,
    MediaType.NORMAL_0x4000,
    MediaType.BASIC,
    MediaType.NORMAL_MIRRORED,
    MediaType.RTYPE,
    MediaType.GAMEMASTER2,
    MediaType.CROSSBLAIM,
    MediaType.HARRYFOX,
    MediaType.LODERUNNER,
    MediaType.KOEI,
    MediaType.WIZARDRY,
    MediaType.KOREAN80,
    MediaType.KOREAN90,
    MediaType.KOREAN126,
    MediaType.MAJUTSUSHI,
    MediaType.MANBOW2,
    MediaType.MANBOW2_V2,
//    MediaType.HOLYQURAN,
    MediaType.HAMARAJANIGHT,
    MediaType.MSXAUDIO,
    MediaType.MOONSOUND
  ];
}

export function mapperFromMediaInfo(board: Board, mediaInfo: MediaInfo, slot: number, subslot: number): Mapper | undefined {
  switch (mediaInfo.type) {
    case MediaType.NORMAL_0x4000: return new MapperRomNormal(board, slot, subslot, 4, mediaInfo.data);
    case MediaType.BASIC: return new MapperRomNormal(board, slot, subslot, 4, mediaInfo.data);
    case MediaType.ASCII8: return new MapperRomAscii8(board, slot, subslot, mediaInfo.data);
    case MediaType.ASCII16: return new MapperRomAscii16(board, slot, subslot, mediaInfo.data);
    case MediaType.ASCII8SRAM: return new MapperRomAscii8sram(board, slot, subslot, mediaInfo.data);
    case MediaType.KOEI: return new MapperRomAscii8sram(board, slot, subslot, mediaInfo.data, Ascii8SramType.KOEI);
    case MediaType.WIZARDRY: return new MapperRomAscii8sram(board, slot, subslot, mediaInfo.data, Ascii8SramType.WIZARDRY);
    case MediaType.ASCII16SRAM: return new MapperRomAscii16sram(board, slot, subslot, mediaInfo.data);
    case MediaType.KONAMI: return new MapperRomKonami(board, slot, subslot, mediaInfo.data);
    case MediaType.KONAMISCC: return new MapperRomKonamiScc(board, slot, subslot, mediaInfo.data);
    case MediaType.MAJUTSUSHI: return new MapperRomMajutsushi(board, slot, subslot, mediaInfo.data);
    case MediaType.NORMAL_MIRRORED: return new MapperRom64kMirrored(board, slot, subslot, mediaInfo.data);
    case MediaType.RTYPE: return new MapperRomRtype(board, slot, subslot, mediaInfo.data);
    case MediaType.GAMEMASTER2: return new MapperRomGameMaster2(board, slot, subslot, mediaInfo.data);
    case MediaType.CROSSBLAIM: return new MapperRomCrossBlaim(board, slot, subslot, mediaInfo.data);
    case MediaType.HARRYFOX: return new MapperRomHarryFox(board, slot, subslot, mediaInfo.data);
    case MediaType.LODERUNNER: return new MapperRomLodeRunner(board, slot, subslot, mediaInfo.data);
    case MediaType.KOREAN80: return new MapperRomKorean80(board, slot, subslot, mediaInfo.data);
    case MediaType.KOREAN90: return new MapperRomKorean90(board, slot, subslot, mediaInfo.data);
    case MediaType.KOREAN126: return new MapperRomKorean126(board, slot, subslot, mediaInfo.data);
    case MediaType.MANBOW2: return new MapperRomMegaFlashRomScc(board, slot, subslot, mediaInfo.data.slice(0, 0x70000), 0x7f, 0x80000, false);
    case MediaType.MANBOW2_V2: return new MapperRomMegaFlashRomScc(board, slot, subslot, mediaInfo.data, 0x7f, 0x100000, true);
    case MediaType.HAMARAJANIGHT: return new MapperRomMegaFlashRomScc(board, slot, subslot, mediaInfo.data, 0xcf, 0x100000, true);
      //    case MediaType.HOLYQURAN: return new MapperRomHolyQuran(board, slot, subslot, mediaInfo.data);
      //    case MediaType.MEGAFLSHSCC: return new MapperRomMegaFlashRomScc(board, slot, subslot, mediaInfo.data, 0, 0x80000, false);
      //    case MediaType.MEGAFLSHSCCPLUS: return new MapperRomMegaFlashRomScc(board, slot, subslot, mediaInfo.data, 0, 0x100000, true);
    case MediaType.MSXAUDIO: return new MapperRomMsxAudio(board, slot, subslot, mediaInfo.data);
    case MediaType.MOONSOUND: return new MapperRomMoonsound(board, mediaInfo.data, 640);
    default:
      console.log('Unsuported ROM type: ' + mediaInfo.type);
      break;
  }

  return undefined;
}