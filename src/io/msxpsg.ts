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

import { Board } from '../core/board';
import { Ay8910, Ay8910ConnectorType, PsgType } from '../audio/ay8910';

export class MsxPsg {
  constructor(
    private board: Board,
    private maxPorts : number,
    private readCassetteLIne?: () => number
  ) {
    this.readIo = this.readIo.bind(this);
    this.writeIo = this.writeIo.bind(this);

    this.ay8910 = new Ay8910(this.board, Ay8910ConnectorType.MSX, PsgType.AY8910, this.readIo, this.writeIo);
  }

  public reset(): void {
    this.joystickPort  = 0;
    this.regs[0] = 0;
    this.regs[1] = 0;
    this.readValue[0] = 0;
    this.readValue[1] = 0;

    this.ay8910.reset();
  }

  private readIo(address: number): number {
    if (address & 1) {
      return this.regs[1];
    }

    /* joystick pins */
    const renshaSpeed = 0; // TODO: Connect user configruable switch
    let state = 0x3f;

    // TODO: Hook up joystick controllers

    /* ANSI/JIS */
    state |= 0x40;

    /* cas signal */
    // Call cassette Callback (for coin select
    if (this.readCassetteLIne && this.readCassetteLIne()) {
      state |= 0x80;
    }

    this.readValue[address & 1] = state;

    return state;
  }

  private writeIo(address: number, value: number): void {
    if (address & 1) {
      this.joystickPort = (value >> 6) & 0x01;

      // TODO: Set Kana led if value & 0x80
    }
    this.regs[address & 1] = value;
  }

  private ay8910: Ay8910;
  private joystickPort = 0;
  private regs = new Array<number>(2);
  private readValue = new Array<number>(2);
}