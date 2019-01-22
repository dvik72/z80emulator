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

export class Port {
  constructor(
    readCb?: (a: number) => number,
    writeCb?: (a: number, v: number) => void) {
    this.readCb = readCb;
    this.writeCb = writeCb;
  }

  readCb?: (a: number) => number;
  writeCb?: (a: number, v: number) => void;
}

export class IoManager {
  constructor(private enableSubPorts: boolean) {
    this.read = this.read.bind(this);
    this.write = this.write.bind(this);

    for (let i = 0; i < 256; i++) {
      this.ioTable[i] = new Port();
      this.ioSubTable[i] = new Port();
    }
  }

  isPortRegistered(port: number): boolean {
    const portInfo = this.ioTable[port];
    return portInfo.readCb == undefined && portInfo.writeCb == undefined;
  }

  registerPort(port: number, portInfo: Port): void {
    this.ioTable[port] = portInfo;
  }

  unregisterPort(port: number): void {
    this.ioTable[port] = new Port();
  }

  registerSubPort(port: number, portInfo: Port): void {
    this.ioSubTable[port] = portInfo;
  }

  unregisterSubPort(port: number): void {
    this.ioSubTable[port] = new Port();
  }

  read(port: number): number {
    port &= 0xff;

    if (this.enableSubPorts && port >= 0x40 && port < 0x50) {
      let readCb = this.ioSubTable[this.subPort].readCb;
      return readCb ? readCb(port) : 0xff;
    }

    let readCb = this.ioTable[port].readCb;
    return readCb ? readCb(port) : 0xff;
  }

  write(port: number, value: number): void {
    port &= 0xff;

    if (this.enableSubPorts && port >= 0x40 && port < 0x50) {
      if (port == 0x40) {
        this.subPort = value;
      }
      else {
        let writeCb = this.ioSubTable[this.subPort].writeCb;
        if(writeCb) writeCb(port, value);
      }
      return;
    }

    let writeCb = this.ioTable[port].writeCb;
    if (writeCb) writeCb(port, value);
  }

  private ioTable: Port[] = new Array<Port>(256);
  private ioSubTable: Port[] = new Array<Port>(256);
  private subPort = 0;
}