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

import { IoManager, Port } from './iomanager';

export class RamMapper {
  constructor(
    public size: number,
    writeCb?: (a: number, v: number) => void) {
    this.writeCb = writeCb;
  }
  
  writeCb?: (a: number, v: number) => void;
}

export class RamManager {
  constructor(private ioManager: IoManager) {
    ioManager.registerPort(0xfc, new Port(this.read.bind(this), this.write.bind(this)));
    ioManager.registerPort(0xfd, new Port(this.read.bind(this), this.write.bind(this)));
    ioManager.registerPort(0xfe, new Port(this.read.bind(this), this.write.bind(this)));
    ioManager.registerPort(0xff, new Port(this.read.bind(this), this.write.bind(this)));
  }

  public registerMapper(mapper: RamMapper): void {
    this.mappers.push(mapper);

    this.updatetMask();
  }

  public unregisterMapper(mapper: RamMapper): void {
    this.mappers = this.mappers.filter(obj => obj !== mapper);

    this.updatetMask();
  }

  public getPortValue(ioPort: number): number {
    return this.port[ioPort & 3];
  }

  private read(ioPort: number): number {
    return this.port[ioPort & 3] | ~this.mask;
  }

  private write(ioPort: number, value: number): void {
    ioPort &= 3;

    if (this.port[ioPort] != value) {
      this.port[ioPort] = value;

      for (const mapper of this.mappers) {
        mapper.writeCb && mapper.writeCb(ioPort, value);
      }
    }
  }

  private updatetMask(): void {
    let size = 1;

    for (const mapper of this.mappers) {
      while (size < mapper.size) {
        size <<= 1;
      }
    }

    this.mask = (size >> 14) - 1;
  }

  private mask = 0;
  private port = [-1, -1, -1, -1];
  private mappers = new Array<RamMapper>();
};
