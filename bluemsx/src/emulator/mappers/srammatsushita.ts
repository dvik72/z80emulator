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


export class MapperSramMatsuchita extends Mapper {
  constructor(private board: Board, private inverted: boolean = false) {
    super('SRAM Matsuchita');

    board.getIoManager().registerSubPort(0x08, new Port(this.read.bind(this), this.write.bind(this)));

    for (let i = 0; i < 0x800; i++) {
      this.sram[i] = 0xff;
    }
  }

  private read(port: number): number {
    let rv = 0xff;

    switch (port & 0x0f) {
      case 0:
        return ~0x08

      case 1:
        return this.board.getFromSwitch() ? 0x7f : 0xff;

      case 3:
        rv = (((this.pattern & 0x80) ? this.color2 : this.color1) << 4)
          | ((this.pattern & 0x40) ? this.color2 : this.color1);
        this.pattern = (this.pattern << 2) | (this.pattern >> 6);
        return rv;

      case 9:
        if (this.address < 0x800) {
          rv = this.sram[this.address];
        } else {
          rv = 0xff;
        }
        this.address = (this.address + 1) & 0x1fff;
        return rv;

      default:
        return 0xff;
    }
  }

  private write(port: number, value: number): void {
    switch (port & 0x0f) {
      case 1:
        this.board.setZ80Freq15((value & 1) == (this.inverted ? 0 : 1));
        return;

      case 3:
        this.color2 = value >> 4;
        this.color1 = value & 0x0f;
        return;

      case 4:
        this.pattern = value;
        return;

      case 7:
        this.address = (this.address & 0xff00) | value;
        return;

      case 8:
        this.address = (this.address & 0x00ff) | ((value & 0x1f) << 8);
        return;

      case 9:
        if (this.address < 0x800) {
          this.sram[this.address] = value;
        }
        this.address = (this.address + 1) & 0x1fff;
        return;
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

  private address = 0;
  private color1 = 0;
  private color2 = 0;
  private pattern = 0;
  private sram = new Uint8Array(0x800);
}


