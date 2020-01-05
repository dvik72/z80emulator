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
import { Port } from '../core/iomanager';
import { SaveState } from '../util/savestate';

export class MapperRomKorean90 extends Mapper {
  static NAME = 'Korean 90';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomKorean90.NAME);

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
      this.slotInfo[page] = new Slot(this.getName());
      this.slotInfo[page].map(true, false, this.pages[this.romMapper[page]]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }

    board.getIoManager().registerPort(0x77, new Port(undefined, this.writeCb.bind(this)));
  }

  private writeCb(port: number, value: number): void {
    const page = ((value & 0x7f) << 1) & (this.pages.length - 1);

    if (value & 0x80) {
      // 32K mode
      this.romMapper[0] = (page & 0xfc) + 0;
      this.romMapper[1] = (page & 0xfc) + 1;
      this.romMapper[2] = (page & 0xfc) + 2;
      this.romMapper[3] = (page & 0xfc) + 3;
    }
    else {
      // 16K mode
      this.romMapper[0] = page + 0;
      this.romMapper[1] = page + 1;
      this.romMapper[2] = page + 0;
      this.romMapper[3] = page + 1;
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page].map(true, false, this.pages[this.romMapper[page]]);
    }
  }

  public getState(): any {
    let state: any = {};

    state.romMapper = SaveState.getArrayState(this.romMapper);

    return state;
  }

  public setState(state: any): void {
    SaveState.setArrayState(this.romMapper, state.romMapper);

    for (let bank = 0; bank < 4; bank++) {
      const page = this.pages[this.romMapper[bank]];
      this.slotInfo[bank].map(true, false, page);
    }
  }

  private romMask = 0;
  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 1, 0, 1];
}
