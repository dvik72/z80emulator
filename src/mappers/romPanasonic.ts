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

const SRAM_BASE = 0x80;
const RAM_BASE = 0x180;

export class MapperRomPanasonic extends Mapper {
  constructor(
    private board: Board,
    slot: number,
    sslot: number,
    private mappedPages: number,
    romData: Uint8Array,
    private sramSize: number) {
    super('ROM Panasonic');

    this.pages = [];
    for (let romOffset = 0; romOffset < romData.length;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    this.readBlock = this.pages[0];

    this.sram = [];
    for (let offset = 0; offset < this.sramSize; offset += 0x2000) {
      let sramData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        sramData[i] = 0xff;
      }
      this.sram.push(sramData);
    }

    if (this.mappedPages == 6) {
      this.maxSRAMBank = SRAM_BASE + 8;
    }
    else {
      this.maxSRAMBank = SRAM_BASE + (this.sramSize >> 13);
    }

    this.slotInfo = new Array<Slot>(this.mappedPages);
    for (let page = 0; page < this.mappedPages; page++) {
      this.slotInfo[page] = new Slot(this.getName(), this.read.bind(this), this.write.bind(this));
      this.slotInfo[page].fullAddress = true;
      this.board.getSlotManager().registerSlot(slot, sslot, page, this.slotInfo[page]);
    }

    this.reset();
  }

  public reset(): void {
    this.control = 0;

    for (let page = 0; page < this.mappedPages; page++) {
      this.romMapper[page] = 0;
      this.slotInfo[page].map(page != 3, false, this.pages[0]);
    }
  }
    
  private read(address: number): number {
    if ((this.control & 0x04) && address >= 0x7ff0 && address < 0x7ff8) {
      return this.romMapper[address & 7] & 0xff;
    }

    if ((this.control & 0x10) && address == 0x7ff8) {
      let result = 0;
      for (let i = 7; i >= 0; i--) {
        result <<= 1;
        if (this.romMapper[i] & 0x100) {
          result++;
        }
      }
      return result;
    }

    if ((this.control & 0x08) && address == 0x7ff9) {
      return this.control;
    }

    return this.readBlock ? this.readBlock[address & 0x1fff] : 0xff;
  }

  private write(address: number, value: number): void {
    let region = 0;
    let bank = 0;

    if (address >= 0x6000 && address < 0x7ff0) {
      region = (address & 0x1c00) >> 10;
      if (region == 5 || region == 6) {
        region ^= 3;
      }

      const bank = this.romMapper[region];
      const newBank = (bank & ~0xff) | value;
      this.changeBank(region, newBank);
      return;
    }

    if (address == 0x7ff8) {
      for (region = 0; region < 8; region++) {
        if (value & 1) {
          this.changeBank(region, this.romMapper[region] | 0x100);
        } else {
          this.changeBank(region, this.romMapper[region] & ~0x100);
        }
        value >>= 1;
      }
      return;
    }

    if (address == 0x7ff9) {
      this.control = value;
      return;
    }

    if (address >= 0x8000 && address < 0xC000) {
      region = address >> 13;
      bank = this.romMapper[region];

      if (this.sramSize > 0 && bank >= SRAM_BASE && bank < this.maxSRAMBank) {
        const offset = (bank - SRAM_BASE) * 0x2000 & (this.sramSize - 1);
        this.sram[offset >> 13][address & 0x1fff] = value;
      }
      else if (bank >= RAM_BASE) {
        const ram = this.board.getRamPage(bank - RAM_BASE);
        if (ram) {
          ram[address & 0x1fff] = value;
        }
      }
    } 
  }

  private changeBank(region: number, bank: number): void {
    if (region >= this.mappedPages) {
      return;
    }

    if (bank == this.romMapper[region]) {
      return;
    }
    this.romMapper[region] = bank;
    if (this.sramSize > 0 && bank >= SRAM_BASE && bank < this.maxSRAMBank) {
      const offset = (bank - SRAM_BASE) * 0x2000 & (this.sramSize - 1);
      if (region == 3) {
        this.readBlock = this.sram[offset >> 13];
      }
      this.slotInfo[region].map(region != 3, false, this.sram[offset >> 13]);
    }
    else if (bank >= RAM_BASE) {
      const ram = this.board.getRamPage(bank - RAM_BASE);

      if (region == 3) {
        this.readBlock = ram;
      }
      this.slotInfo[region].map(region != 3, false, ram);
    }
    else {
      const offset = bank * 0x2000 & (this.pages.length * 0x2000 - 1);
      if (region == 3) {
        this.readBlock = this.pages[offset >> 13];
      }
      this.slotInfo[region].map(region != 3, false, this.pages[offset >> 13]);
    }
  }


  private sram: Array<Uint8Array>;
  private maxSRAMBank = 0;
  private control = 0;
  private slotInfo: Array<Slot>;
  private pages: Array<Uint8Array>;
  private readBlock?: Uint8Array;
  private romMapper = [0, 0, 0, 0, 0, 0, 0, 0];
}

