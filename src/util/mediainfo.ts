﻿//////////////////////////////////////////////////////////////////////////////
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

import { hex_sha1_arr } from './sha1';
import { romDatabase } from './romdatabase';
import { SaveState } from '../core/savestate';


export enum MediaType {
  UNKNOWN = 'Unknown',

  // Save State Media
  SAVESTATE = 'Save State',

  // Disk Media
  FLOPPY = 'Floppy Disk',

  // Generic Cartridge
  ROM = 'Cartridge',

  // Cartridge Media
  NORMAL_0x0000 = 'Normal',
  NORMAL_0x4000 = 'Normal - 0x4000',
  BASIC = 'Basic',
  NORMAL_0xc000 = 'Normal - 0xc000',
  NORMAL_MIRRORED = 'Mirrored',
  MSXDOS2 = 'MSXDOS2',
  ASCII16 = 'ASCII16',
  ASCII16SRAM = 'ASCII16 SRAM',
  ASCII8 = 'ASCII8',
  ASCII8SRAM = 'ASCII8 SRAM',
  KOEI = 'KOEI',
  KONAMI = 'Konami',
  KONAMISCC = 'Konami SCC',
  MUPACK = 'Music Pack',
  MANBOW2 = 'Manbow 2',
  MANBOW2_V2 = 'Manbow 2 v2',
  HAMARAJANIGHT = 'Hamaraja Night',
  MEGAFLSHSCC = 'MegaFlashRom SCC',
  MEGAFLSHSCCPLUS = 'MegaFlasRom SCC plus',
  HALNOTE = 'Halnote',
  HARRYFOX = 'Harry Fox',
  PLAYBALL = 'Play Ball',
  DOOLY = 'Dooly',
  HOLYQURAN = 'Holy Quran',
  CROSSBLAIM = 'Cross Blaim',
  KOREAN80 = 'Korean 80',
  KOREAN90 = 'Korean 90',
  KOREAN126 = 'Korean 126',
  GAMEMASTER2 = 'Game Master 2',
  LODERUNNER = 'Lode Runner',
  RTYPE = 'R-Type',
  MAJUTSUSHI = 'Majutsushi',
  KONAMISYNTH = 'Konami Synth',
  KONAMKBDMAS = 'Konami Keyboard Master',
  GENERIC_KONAMI = 'Generic Konami',
  SUPERPERROT = 'Super Perrot',
  KONWORDPRO = 'Konami Word Pro',
  MATRAINK = 'Matra Inc',
  NETTOUYAKYUU = 'Netto Yakuu',
  WIZARDRY = "Wizardry",
  MSXAUDIO = 'MSX-AUDIO',
  MSXMUSIC = 'MSX-MUSIC',
  MOONSOUND = 'MoonSound'
};

export class MediaInfo {
  constructor(
    public title: string,
    public company: string,
    public year: number,
    public country: string,
    public type: MediaType,
    public data: Uint8Array
  ) { }

  public getState(): any {
    let state: any = {};
    
    state.title = this.title;
    state.company = this.company;
    state.year = this.year
    state.country = this.country;
    state.type = this.type;

    state.data = SaveState.getArrayState(this.data);

    return state;
  }

  public setState(state: any): void {
    this.title = state.title;
    this.company = state.company;
    this.year = state.year
    this.country = state.country;
    this.type = state.type;

    const data = new Uint8Array(state.data.length);
    SaveState.setArrayState(data, state.data);
    this.data = data;
  }
}

function iequals(a: string, b: string): boolean {
  return !!a && !!b && a.toLowerCase() == b.toLowerCase();
}

class Dump {
  public type: MediaType;
  public hash?: string;

  constructor(json: any) {
    this.type = MediaType.UNKNOWN;

    if (json.megarom) {
      this.hash = json.megarom.hash && json.megarom.hash['#text'];
      let type = json.megarom.type;
      this.type = this.typeFromString(type);
    } 

    if (json.rom) {
      this.hash = json.rom.hash && json.rom.hash['#text'];
      let type = json.rom.type;
      this.type = MediaType.NORMAL_MIRRORED;
      if (iequals(type,'Normal')) {
        let start = +json.rom.start || 0;
        switch (start) {
          case 0x4000: this.type = MediaType.NORMAL_0x4000;
          case 0x8000: this.type = MediaType.BASIC;
          case 0xc000: this.type = MediaType.NORMAL_0xc000;
          default: this.type = MediaType.NORMAL_0x0000;
        }
      }
    }
  }

  private typeFromString(name: string): MediaType {
    if (iequals(name, "ASCII16")) return MediaType.ASCII16;
    if (iequals(name, "ASCII16SRAM2")) return MediaType.ASCII16SRAM;
    if (iequals(name, "ASCII8")) return MediaType.ASCII8;
    if (iequals(name, "ASCII8SRAM8")) return MediaType.ASCII8SRAM;
    if (iequals(name, "MSXDOS2")) return MediaType.MSXDOS2;
    if (iequals(name, "KoeiSRAM8")) return MediaType.KOEI;
    if (iequals(name, "KoeiSRAM32")) return MediaType.KOEI;
    if (iequals(name, "Konami")) return MediaType.KONAMI;
    if (iequals(name, "KonamiSCC")) return MediaType.KONAMISCC;
    if (iequals(name, "MuPack")) return MediaType.MUPACK;
    if (iequals(name, "Manbow2")) return MediaType.MANBOW2;
    if (iequals(name, "Manbow2v2")) return MediaType.MANBOW2_V2;
    if (iequals(name, "HamarajaNight")) return MediaType.HAMARAJANIGHT;
    if (iequals(name, "MegaFlashRomScc")) return MediaType.MEGAFLSHSCC;
    if (iequals(name, "MegaFlashRomSccPlus")) return MediaType.MEGAFLSHSCCPLUS;
    if (iequals(name, "Halnote")) return MediaType.HALNOTE;
    if (iequals(name, "HarryFox")) return MediaType.HARRYFOX;
    if (iequals(name, "Playball")) return MediaType.PLAYBALL;
    if (iequals(name, "Dooly")) return MediaType.DOOLY;
    if (iequals(name, "HolyQuran")) return MediaType.HOLYQURAN;
    if (iequals(name, "CrossBlaim")) return MediaType.CROSSBLAIM;
    if (iequals(name, "Zemina80in1")) return MediaType.KOREAN80;
    if (iequals(name, "Zemina90in1")) return MediaType.KOREAN90;
    if (iequals(name, "Zemina126in1")) return MediaType.KOREAN126;
    if (iequals(name, "Wizardry")) return MediaType.WIZARDRY;
    if (iequals(name, "GameMaster2")) return MediaType.GAMEMASTER2;
    if (iequals(name, "SuperLodeRunner")) return MediaType.LODERUNNER;
    if (iequals(name, "R-Type")) return MediaType.RTYPE;
    if (iequals(name, "Majutsushi")) return MediaType.MAJUTSUSHI;
    if (iequals(name, "Synthesizer")) return MediaType.KONAMISYNTH;
    if (iequals(name, "KeyboardMaster")) return MediaType.KONAMKBDMAS;
    if (iequals(name, "GenericKonami")) return MediaType.GENERIC_KONAMI;
    if (iequals(name, "SuperPierrot")) return MediaType.SUPERPERROT;
    if (iequals(name, "WordPro")) return MediaType.KONWORDPRO;
    if (iequals(name, "Normal")) return MediaType.NORMAL_MIRRORED;
    if (iequals(name, "MatraInk")) return MediaType.MATRAINK;
    if (iequals(name, "NettouYakyuu")) return MediaType.NETTOUYAKYUU;
    if (iequals(name, "MSX-AUDIO")) return MediaType.MSXAUDIO;
    if (iequals(name, "MSX-MUSIC")) return MediaType.MSXMUSIC;
    if (iequals(name, "MoonSound")) return MediaType.MOONSOUND;

    return MediaType.UNKNOWN;
  }
}

class Software {
  constructor(json: any) {
    this.title = json.title && json.title['#text'];
    this.company = json.company;
    this.year = +json.year || undefined;
    this.country = json.country;
    this.dump = new Array<Dump>();
    if (json.dump instanceof Array) {
      for (let i = 0; i < json.dump.length; i++) {
        this.dump.push(new Dump(json.dump[i]));
      }
    } else {
      this.dump.push(new Dump(json.dump));
    }
  }

  public title?: string;
  public company?: string;
  public year?: number;
  public country?: string;
  public dump: Array<Dump>;
}

export class MediaInfoFactory {
  constructor(
  ) {
    this.softwareByHash = {};

    const json = JSON.parse(romDatabase);
    const jsonSoftwareList = json.softwaredb.software;
    if (jsonSoftwareList instanceof Array) {
      for (let i = 0; i < jsonSoftwareList.length; i++) {
        const software = new Software(jsonSoftwareList[i]);
        for (const dump of software.dump) {
          if (dump.hash && dump.type != MediaType.UNKNOWN) {
            this.softwareByHash[dump.hash] = software;
          }
        }
      }
    }
  }

  public mediaInfoFromData(data: Uint8Array): MediaInfo {
    const hash = hex_sha1_arr(data);
    const software = this.softwareByHash[hash];
    if (software) {
      let type = MediaType.UNKNOWN;
      for (const dump of software.dump) {
        if (dump.hash == hash) {
          type = dump.type;
        }
      }
      return new MediaInfo(
        software.title || 'Unknown',
        software.company || '',
        software.year || 1900,
        software.country || '',
        type,
        data);
    }

    const mediaType = this.guessMediaType(data);

    return new MediaInfo('Unknown Software', '', 1900, '', mediaType, data);
  }

  public guessMediaType(data: Uint8Array): MediaType {
    if (data.length <= 0x10000) {
      if (data.length == 0x10000) {
        return data[0x4000] == 0x41 && data[0x4001] == 0x42 ? MediaType.NORMAL_MIRRORED : MediaType.ASCII16;
      }

      if (data.length <= 0x4000 && data[0] == 0x41 && data[1] == 0x42) {
        const init = data[2] + 256 * data[3];
        const text = data[8] + 256 * data[9];
        return (text & 0xc000) == 0x8000 ? MediaType.BASIC : MediaType.NORMAL_MIRRORED;
      }
    }

    const counters = [0, 0, 0, 0, 0, 0];

    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] == 0x32) {
        const value = data[i + 1] + 256 * data[i + 2];

        switch (value) {
          case 0x4000:
          case 0x8000:
          case 0xa000:
            counters[3]++;
            break;

          case 0x5000:
          case 0x9000:
          case 0xb000:
            counters[2]++;
            break;

          case 0x6000:
            counters[3]++;
            counters[4]++;
            counters[5]++;
            break;

          case 0x6800:
          case 0x7800:
            counters[4]++;
            break;

          case 0x7000:
            counters[2]++;
            counters[4]++;
            counters[5]++;
            break;

          case 0x77ff:
            counters[5]++;
            break;
        }
      }
    }

    let mapper = 0;
    counters[4] -= counters[4] ? 1 : 0;

    for (let i = 0; i <= 5; i++) {
      if (counters[i] > 0 && counters[i] >= counters[mapper]) {
        mapper = i;
      }
    }

    if (mapper == 5 && counters[0] == counters[5]) {
      mapper = 0;
    }

    switch (mapper) {
      default:
      case 0: return MediaType.NORMAL_0x4000;
      case 1: return MediaType.MSXDOS2;
      case 2: return MediaType.KONAMISCC;
      case 3: return MediaType.KONAMI;
      case 4: return MediaType.ASCII8;
      case 5: return MediaType.ASCII16;
    }

    return MediaType.UNKNOWN;
  }
  
  private softwareByHash: { [key: string]: Software };
}
