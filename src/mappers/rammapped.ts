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
import { RamMapper, RamManager } from '../core/rammanager';


export class MapperRamMapped extends Mapper {
  constructor(board: Board, slot: number, sslot: number, size: number) {
    super('RAM Mapped');
    
    const pageCount = size >> 14;
    this.mask = pageCount - 1;
    this.size = pageCount << 14;

    this.pages = [];

    for (let page = 0; page < pageCount * 2; page++) {
      let pageData = new Array<number>(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = 0xff;
      }
      this.pages.push(pageData);
    }

    for (let page = 0; page < 8; page++) {
      this.slotInfo[page] = new Slot(this.getName() + ' - ' + page);
      this.slotInfo[page].map(true, true, this.pages[page]);
      board.getSlotManager().registerSlot(slot, sslot, page, this.slotInfo[page]);
    }

    this.ramManager = board.getRamManager();
    this.ramManager && this.ramManager.registerMapper(new RamMapper(size, this.writeIo.bind(this)));

    this.reset();
  }

  public setDramMode(enable: boolean): void {
    this.dramMode = enable;

    for (let bank = 0; bank < 4; bank++) {
      if (this.ramManager) {
        this.writeIo(bank, this.ramManager.getPortValue(bank));
      }
    }
  }

  public reset(): void {
    this.setDramMode(false);
  }

  private writeIo(bank: number, value: number): void {
    bank &= 3;
    value &= this.mask;
    this.port[bank] = value;
    if (this.dramMode && 0x4000 * value >= (this.size - 0x10000)) {
      this.slotInfo[2 * bank].map(false, false);
      this.slotInfo[2 * bank + 1].map(false, false);
    }
    else {
      this.slotInfo[2 * bank].map(true, true, this.pages[2 * value]);
      this.slotInfo[2 * bank + 1].map(true, true, this.pages[2 * value + 1]);
    }
  }

  private slotInfo = new Array<Slot>(8);
  private pages: Array<Array<number>>;
  private dramMode = false;
  private port = [0, 0, 0, 0];
  private mask = 0;
  private size = 0;
  private ramManager?: RamManager;
}

