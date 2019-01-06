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
import { Port } from '../core/iomanager';
import { Slot } from '../core/slotmanager';
import { Ym2413 } from '../audio/ym2413';

export class MapperMsxMusic extends Mapper {
  static NAME = 'MSX MUsic';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperMsxMusic.NAME);

    let romOffset = 0;

    for (let page = 2; page < 6; page++) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      let slotInfo = new Slot(this.getName());
      slotInfo.map(true, false, pageData);
      board.getSlotManager().registerSlot(slot, sslot, page, slotInfo);
    }

    board.getIoManager().registerPort(0x7c, new Port(undefined, this.write.bind(this)));
    board.getIoManager().registerPort(0x7d, new Port(undefined, this.write.bind(this)));

    this.ym2413 = new Ym2413(board);

    this.ym2413.reset();
  }

  private write(port: number, value: number): void {
    switch (port & 1) {
      case 0:
        this.latch = value & 0x3f;
        break;
      case 1:
        this.ym2413.writeReg(this.latch, value);
        break;
    }
  }

  private ym2413: Ym2413;
  private latch = 0;
}
