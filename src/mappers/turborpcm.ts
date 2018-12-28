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
import { Counter } from '../core/timeoutmanager';
import { Port } from '../core/iomanager';
import { Dac } from '../audio/dac';

export class MapperTurboRPcm extends Mapper {
  constructor(private board: Board) {
    super('Turbo-R PCM');

    this.board.getIoManager().registerPort(0xa4, new Port(this.read.bind(this), this.write.bind(this)));
    this.board.getIoManager().registerPort(0xa5, new Port(this.read.bind(this), this.write.bind(this)));

    this.dac = new Dac(board, 8, false);
    this.counter = new Counter('Turbo-R PCM Counter', this.board, 15750);

    this.reset();
  }

  public reset() {
    this.counter.reset();
  }

  private read(port: number): number {
    switch (port & 0x01) {
      case 0:
        return this.counter.get();
      case 1:
        return (~this.sample & 0x80) | this.status;
    }
    return 0xff;
  }

  private write(port: number, value: number): void {
    switch (port & 0x01) {
      case 0:
        this.counter.reset();
        this.sample = value;
        if (this.status & 0x02) {
          this.dac.write(this.sample);
        }
        break;

      case 1:
        if ((value & 0x03) == 0x03 && (~this.status & 0x01)) {
          this.dac.write(this.sample);
        }
        this.status = value & 0x1f;

        this.board.getAudioManager().setEnable((this.status & 2) != 0);
        break;
    }
  }

  private status = 0;
  private sample = 0;
  private counter: Counter;
  private dac: Dac;
}