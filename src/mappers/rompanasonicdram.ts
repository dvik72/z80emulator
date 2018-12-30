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
import { DramMapper } from '../core/drammanager';

export class MapperRomPanasonicDram extends Mapper {
  constructor(
    private board: Board,
    private slot: number,
    private sslot: number,
    private startPage: number, romData: Uint8Array) {
    super('Panasonic DRAM');

    const pages = (romData.length + 0x1fff) >> 13;
    const size = pages << 13;

    this.pages = [];
    for (let romOffset = 0; romOffset < size;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }
    
    for (let page = 0; page < pages; page++) {
      this.slotInfo[page] = new Slot(this.getName());
      board.getSlotManager().registerSlot(slot, sslot, page + startPage, this.slotInfo[page]);
    }

    const dramManager = board.getDramManager();
    dramManager && dramManager.registerMapper(new DramMapper(this.setDramMode.bind(this)));

    this.setDramMode(false);
  }

  private setDramMode(enable: boolean): void {
    if (enable) {
      if (this.slot == 0 && this.sslot == 0) {
        for (let page = 0; page < this.pages.length; page++) {
          this.slotInfo[page].map(true, false, this.board.getRamPage(page + this.startPage - 8));
        }
      }
      else if (this.slot == 3 && this.sslot == 1) {
        for (let page = 0; page < this.pages.length; page++) {
          this.slotInfo[page].map(true, false, this.board.getRamPage(page + this.startPage - 4));
        }
      }
    }
    else {
      for (let page = 0; page < this.pages.length; page++) {
        this.slotInfo[page].map(true, false, this.pages[page]);
      }
    }
  }

  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(8);
}
