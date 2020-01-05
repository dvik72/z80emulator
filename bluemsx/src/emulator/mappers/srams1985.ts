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
import { SaveState } from '../util/savestate';


export class MapperSramS1985 extends Mapper {
  constructor(board: Board) {
    super('SRAM S1985');

    board.getIoManager().registerSubPort(0xfe, new Port(this.read.bind(this), this.write.bind(this)));
  }

  private read(port: number): number {
    switch (port & 0x0f) {
      case 0:
        return ~0xfe;
      case 2:
        return this.sram[this.address];
      case 7:
        const result = (this.pattern & 0x80) ? this.color2 : this.color1;
        this.pattern = ((this.pattern << 1) & 0xff) | (this.pattern >> 7);
        return result;
      default:
        return 0xff;
    }
  }

  private write(port: number, value: number): void {
    switch (port & 0x0f) {
      case 1:
        this.address = value & 0x0f;
        break;
      case 2:
        this.sram[this.address] = value;
        break;
      case 6:
        this.color2 = this.color1;
        this.color1 = value;
        break;
      case 7:
        this.pattern = value;
        break;
    }
  }

  public getState(): any {
    let state: any = {};

    state.address = this.address;
    state.color1 = this.color1;
    state.color2 = this.color2;
    state.pattern = this.pattern;

    state.sram = SaveState.getArrayState(this.sram);

    return state;
  }

  public setState(state: any): void {
    this.address = state.address;
    this.color1 = state.color1;
    this.color2 = state.color2;
    this.pattern = state.pattern;

    SaveState.setArrayState(this.sram, state.sram);
  }

  private sram = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  private address = 0;
  private color1 = 0;
  private color2 = 0;
  private pattern = 0;
}

