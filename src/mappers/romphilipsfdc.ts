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
import { DiskManager } from '../disk/diskmanager';
import { Wd2793, Wd2793Type } from '../disk/wd2793';
import { SaveState } from '../core/savestate';

export class MapperRomPhilipsFdc extends Mapper {
  static NAME = 'Philips WD2793';

  constructor(diskManager: DiskManager, board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomPhilipsFdc.NAME);

    this.wd2793 = new Wd2793(diskManager, board, Wd2793Type.WD2793);

    this.pages = [];
    for (let romOffset = 0; romOffset < 0x4000;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(),
        page & 1 ? this.read.bind(this) : undefined, page & 1 ? this.write.bind(this) : undefined);
      this.slotInfo[page].fullAddress = true;
      this.slotInfo[page].map(page == 0, false, this.pages[page & 1]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }

    this.reset();
  }

  public reset(): void {
    this.wd2793.reset();
    this.write(0x1ffc, 0);
    this.write(0x1ffd, 0);
  }

  private read(address: number): number {
    switch (address & 0x1fff) {
      case 0x1ff8:
        return this.wd2793.getStatusReg();
      case 0x1ff9:
        return this.wd2793.getTrackReg();
      case 0x1ffa:
        return this.wd2793.getSectorReg();
      case 0x1ffb:
        return this.wd2793.getDataReg();
      case 0x1ffc:
        return this.sideReg;
      case 0x1ffd:
        return this.driveReg;
      case 0x1ffe:
        return 0xff;
      case 0x1fff:
        return (this.wd2793.getIrq() ? 0 : 0x40) | (this.wd2793.getDataRequest() ? 0 : 0x80);
      default:
        return address < 0x8000 ? this.pages[1][address & 0x1fff] : 0xff;
    }
  }

  private write(address: number, value: number): void {
    switch (address & 0x1fff) {
      case 0x1ff8:
        this.wd2793.setCommandReg(value);
        break;
      case 0x1ff9:
        this.wd2793.setTrackReg(value);
        break;
      case 0x1ffa:
        this.wd2793.setSectorReg(value);
        break;
      case 0x1ffb:
        this.wd2793.setDataReg(value);
        break;
      case 0x1ffc:
        this.sideReg = value;
        this.wd2793.setSide(value & 1);
        break;
      case 0x1ffd:
        switch (value & 3) {
          case 0:
          case 2:
            this.wd2793.setDrive(0);
            this.wd2793.setMotor((value & 0x80) != 0);
            break;
          case 1:
            this.wd2793.setDrive(1);
            this.wd2793.setMotor((value & 0x80) != 0);
            break;
          default:
            this.wd2793.setDrive(-1);
            this.wd2793.setMotor(false);
        }
        break;
    }
  }

  public getState(): any {
    let state: any = {};

    state.sideReg = this.sideReg;
    state.driveReg = this.driveReg;

    state.wd2793 = this.wd2793.getState();

    return state;
  }

  public setState(state: any): void {
    this.sideReg = state.sideReg;
    this.driveReg = state.driveReg

    this.wd2793.setState(state.wd2793);
  }

  private wd2793: Wd2793;
  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(4);

  private sideReg = 0;
  private driveReg = 0;
}
