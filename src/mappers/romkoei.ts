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

export class MapperRomKoei extends Mapper {
  static NAME = 'Koei';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomKoei.NAME);

    let size = 0x8000;
    while (size < romData.length) {
      size *= 2;
    }
    this.romMask = (size >> 13) - 1;

    this.pages = [];
    for (let romOffset = 0; romOffset < size;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }
    
    for (let page = 0; page < 4; page++) {
      let sram = new Uint8Array(0x2000);
      for (let i = 0; i < sram.length; i++) {
        sram[i] = 0xff;
      }
      this.sram[page] = sram;
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(), undefined, page == 1 ? this.writeCb.bind(this) : undefined);
      this.slotInfo[page].map(true, false, this.pages[0]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }
  }

  private writeCb(address: number, value: number): void {
    let bank = (address & 0x1800) >> 11;

    if (this.romMapper[bank] != value) {
      if (value & ~this.romMask) {
        this.slotInfo[bank].map(true, bank > 1, this.sram[value & 3]);
      }
      else {
        this.slotInfo[bank].map(true, false, this.pages[value]);
      }
      this.romMapper[bank] = value;
    }
  }

  private romMask = 0;
  private pages: Array<Uint8Array>;
  private sram = new Array<Uint8Array>(4);
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 0, 0, 0];
}
