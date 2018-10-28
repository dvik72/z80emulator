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

import { IoManager, Port } from '../core/iomanager';

export enum Ay8910ConnectorType { MSX, SCCPLUS, SVI };

const regMask = [
  0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0x3f,
  0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
];

export class Ay8910 {
  constructor(
    private ioManager: IoManager,
    connectorType: Ay8910ConnectorType,
    private readCb?: (port: number) => number,
    private writeCb?: (port: number, value: number) => void
  ) {
    this.writeAddress = this.writeAddress.bind(this);
    this.writeData = this.writeData.bind(this);
    this.readData = this.readData.bind(this);

    switch (connectorType) {
      case Ay8910ConnectorType.MSX:
        this.ioManager.registerPort(0xa0, new Port(undefined, this.writeAddress));
        this.ioManager.registerPort(0xa1, new Port(undefined, this.writeData));
        this.ioManager.registerPort(0xa2, new Port(this.readData, undefined));
        break;
      case Ay8910ConnectorType.SCCPLUS:
        this.ioManager.registerPort(0x10, new Port(undefined, this.writeAddress));
        this.ioManager.registerPort(0x11, new Port(undefined, this.writeData));
        this.ioManager.registerPort(0x12, new Port(this.readData, undefined));
        break;
      case Ay8910ConnectorType.SVI:
        this.ioManager.registerPort(0x88, new Port(undefined, this.writeAddress));
        this.ioManager.registerPort(0x8c, new Port(undefined, this.writeData));
        this.ioManager.registerPort(0x90, new Port(this.readData, undefined));
        break;
    }
  }

  public reset(): void {
    for (let i = 0; i < 16; i++) {
      this.writeAddress(0, i);
      this.writeData(1, 0);
    }
  }

  private writeAddress(unusedAddress: number, value: number): void {
    this.address = value & 0x0f;
  }

  private writeData(unusedAddress: number, value: number): void {
    value &= regMask[this.address];

    this.regs[this.address] = value;

    switch (this.address) {
      case 14:
      case 15:
        if (this.writeCb) {
          const port = value & 1;
          this.writeCb(port, value);
        }
    }
  }

  private readData(unusedAddress: number): number {
    if (this.address >= 14) {
      const port = this.address & 1;
      if (this.readCb) {
        this.regs[this.address] = this.readCb(port);
      }
    }
    return this.regs[this.address];    
  }

  private regs = new Array<number>(16);
  private address = 0;
}