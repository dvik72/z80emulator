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

const ST_IDLE = 0;
const ST_IDENT = 1;

class AmdCmd {
  public address = 0;
  public value = 0;
}

export enum AmdType { TYPE_1, TYPE_2 }

export class AmdFlash {
  constructor(
    type: AmdType,
    private flashSize: number,
    private sectorSize: number,
    private writeProtectMask: number,
    romData?: Uint8Array
  ) {
    for (let i = 0; i < 8; i++) {
      this.cmd[i] = new AmdCmd();
    }

    if (type == AmdType.TYPE_1) {
      this.cmdAddr1 = 0xaaa;
      this.cmdAddr2 = 0x555;
    }
    else {
      this.cmdAddr1 = 0x555;
      this.cmdAddr2 = 0x2aa;
    }

    this.pages = [];
    for (let romOffset = 0; romOffset < this.flashSize;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romData && romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }
  }

  public read(address: number): number {
    if (this.state == ST_IDENT) {
      this.cmdIdx = 0;
      switch (address & 0x03) {
        case 0:
           return 0x01;
        case 1:
           return 0xa4;
        case 2:
          return (this.writeProtectMask >> (address / this.sectorSize)) & 1;
        case 3:
           return 0x01;
      }
       return 0xff;
    }

    address &= this.flashSize - 1;

    return this.pages[address >> 13][address & 0x1fff];
  }

  public write(address: number, value: number): void {
    if (this.cmdIdx < this.cmd.length) {
      let stateValid = false;

      this.cmd[this.cmdIdx].address = address;
      this.cmd[this.cmdIdx].value   = value;
      this.cmdIdx++;
      stateValid = this.checkCommandManifacturer() || stateValid;
      stateValid = this.checkCommandEraseSector() || stateValid;
      stateValid = this.checkCommandProgram() || stateValid;
      stateValid = this.checkCommandEraseChip() || stateValid;
      if (stateValid) {
        if (value == 0xf0) {
          this.state = ST_IDLE;
          this.cmdIdx = 0;
        }
      }

      if (!stateValid) {
        this.state = ST_IDLE;
        this.cmdIdx = 0;
      }
    }
  }

  public getPage(page: number): Uint8Array {
    return this.pages[page & (this.pages.length - 1)];
  }

  public cmdInProgress(): boolean {
    return this.cmdIdx != 0;
  }

  public reset(): void {
    this.cmdIdx = 0;
    this.state = ST_IDLE;
  }

  private checkCommandEraseSector(): boolean {
    if (this.cmdIdx > 0 && ((this.cmd[0].address & 0x7ff) != this.cmdAddr1 || this.cmd[0].value != 0xaa)) return false;
    if (this.cmdIdx > 1 && ((this.cmd[1].address & 0x7ff) != this.cmdAddr2 || this.cmd[1].value != 0x55))  return false;
    if (this.cmdIdx > 2 && ((this.cmd[2].address & 0x7ff) != this.cmdAddr1 || this.cmd[2].value != 0x80))  return false;
    if (this.cmdIdx > 3 && ((this.cmd[3].address & 0x7ff) != this.cmdAddr1 || this.cmd[3].value != 0xaa))  return false;
    if (this.cmdIdx > 4 && ((this.cmd[4].address & 0x7ff) != this.cmdAddr2 || this.cmd[4].value != 0x55))  return false;
    if (this.cmdIdx > 5 && (this.cmd[5].value != 0x30)) return false;

    if (this.cmdIdx < 6) return true;

    if (((this.writeProtectMask >> (this.cmd[5].address / this.sectorSize | 0)) & 1) == 0) {
      let offset = this.cmd[5].address & ~(this.sectorSize - 1) & (this.flashSize - 1);
      for (let count = this.sectorSize; count--;) {
        this.pages[offset >> 13][offset & 0x1fff] = 0xff;
        offset++;
      }
    }
    return false;
  }

  private checkCommandEraseChip(): boolean {
    if (this.cmdIdx > 0 && ((this.cmd[0].address & 0x7ff) != this.cmdAddr1 || this.cmd[0].value != 0xaa))  return false;
    if (this.cmdIdx > 1 && ((this.cmd[1].address & 0x7ff) != this.cmdAddr2 || this.cmd[1].value != 0x55))  return false;
    if (this.cmdIdx > 2 && ((this.cmd[2].address & 0x7ff) != this.cmdAddr1 || this.cmd[2].value != 0x80))  return false;
    if (this.cmdIdx > 3 && ((this.cmd[3].address & 0x7ff) != this.cmdAddr1 || this.cmd[3].value != 0xaa))  return false;
    if (this.cmdIdx > 4 && ((this.cmd[4].address & 0x7ff) != this.cmdAddr2 || this.cmd[4].value != 0x55))  return false;
    if (this.cmdIdx > 5 && (this.cmd[5].value != 0x10)) return false;

    if (this.cmdIdx < 6) return true;

    let offset = 0;
    for (let count = this.flashSize; count--;) {
      this.pages[offset >> 13][offset & 0x1fff] = 0xff;
      offset++;
    }
    return false;
  }

  private checkCommandProgram(): boolean {
    if (this.cmdIdx > 0 && ((this.cmd[0].address & 0x7ff) != this.cmdAddr1 || this.cmd[0].value != 0xaa))  return false;
    if (this.cmdIdx > 1 && ((this.cmd[1].address & 0x7ff) != this.cmdAddr2 || this.cmd[1].value != 0x55))  return false;
    if (this.cmdIdx > 2 && ((this.cmd[2].address & 0x7ff) != this.cmdAddr1 || this.cmd[2].value != 0xa0))  return false;

    if (this.cmdIdx < 4) return true;

    if (((this.writeProtectMask >> (this.cmd[3].address / this.sectorSize | 0)) & 1) == 0) {
      const offset = this.cmd[3].address & (this.flashSize - 1);
      this.pages[offset >> 13][offset & 0x1fff] &= this.cmd[3].value;

    }
    return false;
  }

  private checkCommandManifacturer(): boolean {
    if (this.cmdIdx > 0 && ((this.cmd[0].address & 0x7ff) != this.cmdAddr1 || this.cmd[0].value != 0xaa))  return false;
    if (this.cmdIdx > 1 && ((this.cmd[1].address & 0x7ff) != this.cmdAddr2 || this.cmd[1].value != 0x55))  return false;
    if (this.cmdIdx > 2 && ((this.cmd[2].address & 0x7ff) != this.cmdAddr1 || this.cmd[2].value != 0x90))  return false;

    if (this.cmdIdx == 3) {
      this.state = ST_IDENT;
    }
    if (this.cmdIdx < 4) return true;

    return false;
  }

  private cmdAddr1 = 0;
  private cmdAddr2 = 0;
  private state = 0;
  private cmd = new Array<AmdCmd>(8);
  private cmdIdx = 0;
  private pages: Array<Uint8Array>;
}