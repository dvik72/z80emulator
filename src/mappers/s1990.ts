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
import { Z80Mode } from '../z80/z80';

export class MapperS1990 extends Mapper {
  constructor(private board: Board) {
    super('S1990');

    this.board.getIoManager().registerPort(0xe4, new Port(this.read.bind(this), this.write.bind(this)));
    this.board.getIoManager().registerPort(0xe5, new Port(this.read.bind(this), this.write.bind(this)));

    this.reset();
  }

  public reset(): void {
    this.registerSelect = 0;
    this.updateStatus(96);
  }

  private read(port: number): number {
    switch (port & 0x01) {
      case 0:
        return this.registerSelect;
      case 1:
        switch (this.registerSelect) {
          case 5:
            //return switchGetFront() ? 0x40 : 0x00;
            return 0;
          case 6:
            return this.cpuStatus;
          case 13:
            return 0x03;	//TODO
          case 14:
            return 0x2f;	//TODO
          case 15:
            return 0x8b;	//TODO
          default:
            return 0xff;
        }
    }

    return 0;
  }

  private write(port: number, value: number): void {
    switch (port & 0x01) {
      case 0:
        this.registerSelect = value;
        break;
      case 1:
        switch (this.registerSelect) {
          case 6:
            this.updateStatus(value);
            break;
        }
        break;
    }
  }

  private updateStatus(value: number): void {
    this.cpuStatus = value & 0x60;
    this.board.getZ80().setMode((this.cpuStatus & 0x20) ? Z80Mode.Z80 : Z80Mode.R800);
    const dramManager = this.board.getDramManager();
    dramManager && dramManager.setDram((this.cpuStatus & 0x40) == 0);
  }

  private cpuStatus = 0;
  private registerSelect = 0;
}
