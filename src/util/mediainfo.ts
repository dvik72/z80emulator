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

import { hex_sha1_arr } from '../util/sha1';

export enum MediaType {
  UNKNOWN,
  NORMAL_0x0000,
  NORMAL_0x4000,
  BASIC,
  NORMAL_0xc000,
  NORMAL_MIRRORED,
  ASCII16,
  ASCII16SRAM,
  ASCII8,
  ASCII8SRAM,
  KOEI,
  KONAMI,
  KONAMISCC,
  MUPACK,
  MANBOW2,
  MANBOW2_V2,
  HAMARAJANIGHT,
  MEGAFLSHSCC,
  MEGAFLSHSCCPLUS,
  HALNOTE,
  HARRYFOX,
  PLAYBALL,
  DOOLY,
  HOLYQURAN,
  CROSSBLAIM,
  KOREAN80,
  KOREAN90,
  KOREAN126,
  GAMEMASTER2,
  LODERUNNER,
  RTYPE,
  MAJUTSUSHI,
  KONAMISYNTH,
  KONAMKBDMAS,
  KONAMI4NF,
  ASCII16N,
  KONWORDPRO,
  MATRAINK,
  NETTOUYAKYUU,
};

export class MediaInfo {
  constructor(
    public title: string,
    public company: string,
    public year: number,
    public country: string,
    public type: MediaType,
    public data: Uint8Array
  ) {}
}

export class MediaInfoFactory {
  constructor(
  ) {
  }

  public mediaInfoFromData(data: Uint8Array): MediaInfo {
    console.log('SHA1: ' + hex_sha1_arr(data));

    const title = 'Best game ever';
    const company = 'Konami';
    const year = 1983;
    const country = 'Japan';
    const type = MediaType.NORMAL_MIRRORED;
    return new MediaInfo(title, company, year, country, type, data);
  }
}
