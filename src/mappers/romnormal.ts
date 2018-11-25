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

export class MapperRomNormal extends Mapper {
  constructor(board: Board, slot: number, sslot: number, startPage: number, romData: number[]) {
    super('ROM Normal');

    let pages = romData.length + 0x1fff >> 13;
    let romOffset = 0;
    while (pages--) {
      let pageData = new Array<number>(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romData[romOffset] || 0;
        romOffset++;
      }
      let slotInfo = new Slot(this.getName() + ' - ' + startPage);
      slotInfo.map(true, false, pageData);
      board.getSlotManager().registerSlot(slot, sslot, startPage, slotInfo);
      startPage++;
    }
  }
}
