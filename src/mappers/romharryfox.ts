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

export class MapperRomHarryFox extends Mapper {
  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super('ROM Harry Fox');

    this.pages = [];
    for (let romOffset = 0; romOffset < 0x10000;) {
      let pageData = new Array<number>(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(), undefined, page == 1 ? this.writeCb.bind(this) : undefined);
      this.slotInfo[page].map(true, false, this.pages[page]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }
  }

  private writeCb(address: number, value: number): void {
    if (address & 0x0fff) {
      return;
    }

    let bank = address >> 12;
    value = ((value & 1) << 1) + bank;

    if (this.romMapper[bank] != value) {
      this.romMapper[bank] = value;
      this.slotInfo[bank * 2].map(true, false, this.pages[value * 2]);
      this.slotInfo[bank * 2 + 1].map(true, false, this.pages[value * 2 + 1]);
    }
  }

  private pages: Array<Array<number>>;
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 1];
}
