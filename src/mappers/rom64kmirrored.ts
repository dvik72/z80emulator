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

import { Mapper } from './mapper';
import { Board } from '../core/board';
import { Slot } from '../core/slotmanager';

export class MapperRom64kMirrored extends Mapper {
  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super('ROM 64k Mirrored');

    // Align ROM size up to next valid rom size
    let size = 0x10000;
    if (romData.length <= 0x2000) size = 0x2000;
    else if (romData.length <= 0x4000) size = 0x4000;
    else if (romData.length <= 0x8000) size = 0x8000;
    else if (romData.length <= 0xc000) size = 0xc000;

    const romStart = this.getRomStart(romData, size);

    let romOffset = 0;
    for (let page = 0; page < 8; page++) {
      switch (size) {
        case 0x2000:
          romOffset &= 0x1fff;
          break;
        case 0x4000:
          romOffset &= 0x3fff;
          break;
        case 0x8000:
          if (romStart == 0x4000 && page == 0) romOffset = 0x4000; 
          romOffset &= 0x7fff;
          break;
        case 0xc000:
          if (romStart == 0x4000 && page == 2) romOffset = 0; 
          romOffset %= 0xc000; break;
        default:
          break;
      }

      let pageData = new Array<number>(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romData[romOffset] || 0;
        romOffset++;
      }

      let slotInfo = new Slot(this.getName() + ' - ' + page);
      slotInfo.map(true, false, pageData);
      board.getSlotManager().registerSlot(slot, sslot, page, slotInfo);
    }
  }

  private getRomStart(romData: Uint8Array, size: number): number {
    let pages = [0, 0, 0];

    for (let startPage = 0; startPage < 2; startPage++) {
      let offset = 0x4000 * startPage;

      if (romData.length < 0x4000 * startPage + 0x10) {
        break;
      }
      if (romData[offset] == 0x41 && romData[offset + 1] == 0x42) {
        for (let i = 0; i < 4; i++) {
          const address = romData[offset + 2 * i + 2] + 256 * romData[offset + 2 * i + 3];

          if (address > 0) {
            const page = (address >> 14) - startPage;

            if (page < 3) {
              pages[page]++;
            }
          }
        }
      }
    }

    if (pages[1] && (pages[1] >= pages[0]) && (pages[1] >= pages[2])) {
      return 0x4000;
    }

    if (pages[0] && pages[0] >= pages[2]) {
      return 0x0000;
    }

    if (pages[2]) {
      return 0x8000;
    }

    return 0x0000;
  }
}
