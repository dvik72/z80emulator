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

const VDPSTATUS_TR = 0x80;
const VDPSTATUS_BO = 0x10;
const VDPSTATUS_CE = 0x01;

const CM_ABRT = 0x00;
const CM_NOOP1 = 0x01;
const CM_NOOP2 = 0x02;
const CM_NOOP3 = 0x03;
const CM_POINT = 0x04;
const CM_PSET = 0x05;
const CM_SRCH = 0x06;
const CM_LINE = 0x07;
const CM_LMMV = 0x08;
const CM_LMMM = 0x09;
const CM_LMCM = 0x0a;
const CM_LMMC = 0x0b;
const CM_HMMV = 0x0c;
const CM_HMMM = 0x0d;
const CM_YMMM = 0x0e;
const CM_HMMC = 0x0f;


const MXD = 0x20;
const MXS = 0x10;
const DIY = 0x08;
const DIX = 0x04;
const EQ = 0x02;
const MAJ = 0x01;

abstract class GraphicMode {
  constructor(
    protected vram: Uint8Array,
    public COLOR_MASK: number,
    public PIXELS_PER_BYTE: number,
    public PIXELS_PER_BYTE_SHIFT: number,
    public PIXELS_PER_LINE: number,
    private OP_OFFSET_MASK: number,
    private OP_OFFSET_SHIFT: number,
    private OP_COLOR_MASK: number
  ) {
    this.offset[0] = 0;
    this.offset[1] = this.vram.length > 0x20000 ? 0x20000 : 0;
    this.mask[0] = this.vram.length > 0x20000 ? 0x1ffff : this.vram.length - 1;
    this.mask[1] = this.vram.length > 0x20000 ? 0xffff : this.vram.length - 1;

    this.updateOffsets(0);
  }

  public updateOffsets(arg: number): void {
    this.indexRead = this.offset[(arg >> 4) & 1];
    this.indexWrite = this.offset[(arg >> 5) & 1];
    this.maskRead = this.mask[(arg >> 4) & 1];
    this.maskWrite = this.mask[(arg >> 5) & 1];
  }

  public abstract getAddress(x: number, y: number): number;

  public readVram(x: number, y: number): number {
    const address = this.getAddress(x, y);
    return this.vram[this.indexRead + (address & this.maskRead)];
  }
  public writeVram(x: number, y: number, value: number): void {
    const address = this.getAddress(x, y);
    if (!(address & ~this.maskWrite)) this.vram[this.indexWrite + (address & this.maskWrite)] = value;
  }

  public getPixel(x: number, y: number): number {
    const address = this.getAddress(x, y);
    return (this.vram[this.indexRead + (address & this.maskRead)] >> (
      ((~x) & this.OP_OFFSET_MASK) << this.OP_OFFSET_SHIFT)) & this.OP_COLOR_MASK;
  }

  public setPixel(x: number, y: number, cl: number, op: number): void {
    const i = this.getAddress(x, y);
    const sh = (~x & this.OP_OFFSET_MASK) << this.OP_OFFSET_SHIFT;
    const m = ~(this.OP_COLOR_MASK << sh);
    cl <<= sh;

    switch (op) {
      case 0: // Imp
        this.vram[i] = (this.vram[i] & m) | cl;
        break;
      case 1: // And
        this.vram[i] = this.vram[i] & (cl | m);
        break;
      case 2: // Or
        this.vram[i] |= cl;
        break;
      case 3: // Xor
        this.vram[i] ^= cl;
        break;
      case 4: //Not
        this.vram[i] = (this.vram[i] & m) | ~(cl | m);
        break;
      case 8: // Transparent imp
        if (cl) this.vram[i] = (this.vram[i] & m) | cl;
        break;
      case 9: // Transparent and
        if (cl) this.vram[i] = this.vram[i] & (cl | m);
        break;
      case 10: // Transparent or
        if (cl) this.vram[i] |= cl;
        break;
      case 11: // Transparent xor
        if (cl) this.vram[i] ^= cl;
        break;
      case 12:// Transparent not
        if (cl) this.vram[i] = (this.vram[i] & m) | ~(cl | m);
        break;
    }
  }

  protected indexRead = 0;
  protected indexWrite = 0;
  protected maskRead = 0;
  protected maskWrite = 0;
  private offset = new Array<number>(2);
  private mask = new Array<number>(2);
}

class Graphic4Mode extends GraphicMode {
  constructor(
    vram: Uint8Array
  ) {
    super(vram, 0x0f, 2, 1, 256, 1, 2, 15);
  }

  public getAddress(x: number, y: number): number {
    return ((y & 1023) << 7) | ((x & 255) >> 1);
  }
}

class Graphic5Mode extends GraphicMode {
  constructor(
    vram: Uint8Array
  ) {
    super(vram, 0x03, 4, 2, 512, 3, 1, 3);
  }

  public getAddress(x: number, y: number): number {
    return ((y & 1023) << 7) | ((x & 511) >> 2);
  }
}

class Graphic6Mode extends GraphicMode {
  constructor(
    vram: Uint8Array
  ) {
    super(vram, 0x0f, 2, 1, 512, 1, 2, 15);
  }

  public getAddress(x: number, y: number): number {
    return ((x & 2) << 15) | ((y & 511) << 7) | ((x & 511) >> 2);
  }
}

class Graphic7Mode extends GraphicMode {
  constructor(
    vram: Uint8Array
  ) {
    super(vram, 0xff, 1, 0, 256, 0, 0, 255);
  }

  public getAddress(x: number, y: number): number {
    return ((x & 1) << 16) | ((y & 511) << 7) | ((x & 255) >> 1);
  }
}

const SEARCH_TIMING = [ 92, 125, 92, 92, 0, 0, 0, 0 ];
const LINE_TIMING = [120, 147, 120, 120, 0, 0, 0, 0];
const HMMV_TIMING = [49, 65, 49, 62, 0, 0, 0, 0];
const LMMV_TIMING = [98, 137, 98, 124, 0, 0, 0, 0];
const YMMM_TIMING = [65, 125, 65, 68, 0, 0, 0, 0];
const HMMM_TIMING = [92, 136, 92, 97, 0, 0, 0, 0];
const LMMM_TIMING = [129, 197, 129, 132, 0, 0, 0, 0];

function clipNX_1_pixel(mode: GraphicMode, DX: number, NX: number, ARG: number): number {
  if (DX >= mode.PIXELS_PER_LINE) {
    return 1;
  }
  NX = NX ? NX : mode.PIXELS_PER_LINE;
  return (ARG & DIX)
    ? Math.min(NX, DX + 1)
    : Math.min(NX, mode.PIXELS_PER_LINE - DX);
}

function clipNX_1_byte(mode: GraphicMode, DX: number, NX: number, ARG: number): number {
  const BYTES_PER_LINE = mode.PIXELS_PER_LINE >> mode.PIXELS_PER_BYTE_SHIFT;

  DX >>= mode.PIXELS_PER_BYTE_SHIFT;
  if (BYTES_PER_LINE <= DX) {
    return 1;
  }
  NX >>= mode.PIXELS_PER_BYTE_SHIFT;
  NX = NX ? NX : BYTES_PER_LINE;
  return (ARG & DIX)
    ? Math.min(NX, DX + 1)
    : Math.min(NX, BYTES_PER_LINE - DX);
}

function clipNX_2_pixel(mode: GraphicMode, SX: number, DX: number, NX: number, ARG: number) {
  if (SX >= mode.PIXELS_PER_LINE || DX >= mode.PIXELS_PER_LINE) {
    return 1;
  }
  NX = NX ? NX : mode.PIXELS_PER_LINE;
  return (ARG & DIX)
    ? Math.min(NX, Math.min(SX, DX) + 1)
    : Math.min(NX, mode.PIXELS_PER_LINE - Math.max(SX, DX));
}

function clipNX_2_byte(mode: GraphicMode, SX: number, DX: number, NX: number, ARG: number): number {
  const BYTES_PER_LINE = mode.PIXELS_PER_LINE >> mode.PIXELS_PER_BYTE_SHIFT;

  SX >>= mode.PIXELS_PER_BYTE_SHIFT;
  DX >>= mode.PIXELS_PER_BYTE_SHIFT;
  if (BYTES_PER_LINE <= SX || BYTES_PER_LINE <= DX) {
    return 1;
  }
  NX >>= mode.PIXELS_PER_BYTE_SHIFT;
  NX = NX ? NX : BYTES_PER_LINE;
  return (ARG & DIX)
    ? Math.min(NX, Math.min(SX, DX) + 1)
    : Math.min(NX, BYTES_PER_LINE - Math.max(SX, DX));
}

function clipNY_1(DY: number, NY: number, ARG: number): number {
  NY = NY ? NY : 1024;
  return (ARG & DIY) ? Math.min(NY, DY + 1) : NY;
}

function clipNY_2(SY: number, DY: number, NY: number, ARG: number): number {
  NY = NY ? NY : 1024;
  return (ARG & DIY) ? Math.min(NY, Math.min(SY, DY) + 1) : NY;
}

export class V9938Cmd {
  public constructor(
    private board: Board,
    private vram: Uint8Array
  ) {
    this.graphicModes[0] = new Graphic4Mode(this.vram);
    this.graphicModes[1] = new Graphic5Mode(this.vram);
    this.graphicModes[2] = new Graphic6Mode(this.vram);
    this.graphicModes[3] = new Graphic7Mode(this.vram);
  }

  public reset(): void {
    this.systemTime = this.board.getSystemTime();
  }

  public write(index: number, value: number): void {
    switch (index) {
      case 0x00: // source X low
        this.SX = (this.SX & 0x100) | value;
        break;
      case 0x01: // source X high
        this.SX = (this.SX & 0x0FF) | ((value & 0x01) << 8);
        break;
      case 0x02: // source Y low
        this.SY = (this.SY & 0x300) | value;
        break;
      case 0x03: // source Y high
        this.SY = (this.SY & 0x0FF) | ((value & 0x03) << 8);
        break;
      case 0x04: // destination X low
        this.DX = (this.DX & 0x100) | value;
        break;
      case 0x05: // destination X high
        this.DX = (this.DX & 0x0FF) | ((value & 0x01) << 8);
        break;
      case 0x06: // destination Y low
        this.DY = (this.DY & 0x300) | value;
        break;
      case 0x07: // destination Y high
        this.DY = (this.DY & 0x0FF) | ((value & 0x03) << 8);
        break;
      case 0x08: // number X low
        this.NX = (this.NX & 0x300) | value;
        break;
      case 0x09: // number X high
        this.NX = (this.NX & 0x0FF) | ((value & 0x03) << 8);
        break;
      case 0x0A: // number Y low
        this.NY = (this.NY & 0x300) | value;
        break;
      case 0x0B: // number Y high
        this.NY = (this.NY & 0x0FF) | ((value & 0x03) << 8);
        break;

      case 0x0C: // color
        this.CL = value;
        if (!this.CM) this.status &= 0x7F;
        this.status &= ~VDPSTATUS_TR;
        break;
      case 0x0D: // argument
        this.ARG = value;
        for (const mode of this.graphicModes) {
          mode.updateOffsets(value);
        }
        break;
      case 0x0E: // command
        this.LO = value & 0x0F;
        this.CM = value >> 4;
        this.setCommand();
        break;
    }
  }

  public execute(): void {
    this.opsCount += this.board.getTimeSince(this.systemTime);
    this.systemTime = this.board.getSystemTime();

    if (this.opsCount <= 0) {
      return;
    }

    switch (this.CM) {
      case CM_SRCH:
        this.srchEngine();
        break;
      case CM_LINE:
        this.lineEngine();
        break;
      case CM_LMMV:
        this.lmmvEngine();
        break;
      case CM_LMMM:
        this.lmmmEngine();
        break;
      case CM_LMCM:
        this.lmcmEngine();
        break;
      case CM_LMMC:
        this.lmmcEngine();
        break;
      case CM_HMMV:
        this.hmmvEngine();
        break;
      case CM_HMMM:
        this.hmmmEngine();
        break;
      case CM_YMMM:
        this.ymmmEngine();
        break;
      case CM_HMMC:
        this.hmmcEngine();
        break;
      default:
        this.opsCount = 0;
    }
  }

  public setScreenMode(screenMode: number, commandEnable: boolean): void {
    if (screenMode > 8 && screenMode <= 12) {
      screenMode = 3;
    }
    else if (screenMode < 5 || screenMode > 12) {
      if (commandEnable) {
        screenMode = 2;
      }
      else {
        screenMode = -1;
      }
    }
    else {
      screenMode -= 5;
    }
    if (this.screenMode != screenMode) {
      this.screenMode = screenMode;
      if (this.screenMode < 0) {
        this.CM = 0;
        this.status &= ~VDPSTATUS_CE;
      }
    }
  }
  
  public setTimingMode(timingMode: number): void {
    this.timingMode = timingMode;
  }

  public getStatus(): number {
    return this.status;
  }

  public getBorderX(): number {
    return this.borderX;
  }

  public getColor(): number {
    this.status &= ~VDPSTATUS_TR;
    return this.CL;
  }

  private setCommand() {
    this.systemTime = this.board.getSystemTime();
    this.graphicMode = this.graphicModes[this.screenMode];

    if (!this.graphicMode) {
      this.CM = 0;
      this.status &= ~VDPSTATUS_CE;
      return;
    }

    switch (this.CM) {
      case CM_ABRT:
        this.CM = 0;
        this.status &= ~VDPSTATUS_CE;
        return;

      case CM_NOOP1:
      case CM_NOOP2:
      case CM_NOOP3:
        this.CM = 0;
        return;

      case CM_POINT:
        this.CM = 0;
        this.status &= ~VDPSTATUS_CE;
        this.CL = this.graphicMode.getPixel(this.SX, this.SY);
        return;

      case CM_PSET:
        this.CM = 0;
        this.status &= ~VDPSTATUS_CE;
        this.graphicMode.setPixel(this.DX, this.DY, this.CL, this.LO)
        return;

      case CM_SRCH:
        this.ASX = this.SX;
        break;

      case CM_LINE:
        this.NY &= 1023;
        this.ASX = ((this.NX - 1) >> 1);
        this.ADX = this.DX;
        this.ANX = 0;
        break;

      case CM_LMMV:
        this.NY &= 1023;
        this.ANX = clipNX_1_pixel(this.graphicMode, this.DX, this.NX, this.ARG);
        this.ADX = this.DX;
        break;

      case CM_LMMM:
        this.NY &= 1023;
        this.ANX = clipNX_2_pixel(this.graphicMode, this.SX, this.DX, this.NX, this.ARG);
        this.ASX = this.SX;
        this.ADX = this.DX;

      case CM_LMCM:
        this.NY &= 1023;
        this.ANX = clipNX_1_pixel(this.graphicMode, this.SX, this.NX, this.ARG);
        this.ASX = this.SX;
        //this.status |= 0x80;
        this.statusChangeTime = this.systemTime;
        break;

      case CM_LMMC:
        this.NY &= 1023;
        this.ANX = clipNX_1_pixel(this.graphicMode, this.DX, this.NX, this.ARG);
        this.ADX = this.DX;
        this.statusChangeTime = this.systemTime;
        //this.status |= 0x80;
        break;

      case CM_HMMV:
        this.NY &= 1023;
        this.ANX = clipNX_1_byte(this.graphicMode, this.DX, this.NX, this.ARG);
        this.ADX = this.DX;
        break;

      case CM_HMMM:
        this.NY &= 1023;
        this.ANX = clipNX_2_byte(this.graphicMode, this.SX, this.DX, this.NX, this.ARG);
        this.ASX = this.SX;
        this.ADX = this.DX;
        break;

      case CM_YMMM:
        this.NY &= 1023;
        this.ANX = clipNX_1_byte(this.graphicMode, this.DX, 512, this.ARG);
        this.ADX = this.DX;
        break;

      case CM_HMMC:
        this.NY &= 1023;
        this.ANX = clipNX_1_byte(this.graphicMode, this.DX, this.NX, this.ARG);
        this.ADX = this.DX;
        this.statusChangeTime = this.systemTime;
        //this.status |= 0x80;
    }

//    console.log(this.CM, " - " + this.LO);

    // Command execution started 
    this.status |= VDPSTATUS_CE;
  }

  private statusChangeTime = 0;

  private srchEngine(): void {
    const mode = this.graphicMode!;
    const delta = SEARCH_TIMING[this.timingMode];
    let cnt = this.opsCount;

    let CL = this.CL & mode.COLOR_MASK;
    let TX = (this.ARG & DIX) ? -1 : 1;
    let AEQ = (this.ARG & EQ) != 0; // TODO: Do we look for "==" or "!="?

    while (cnt > 0) {
      let p = mode.getPixel(this.ASX, this.SY);
      if ((p == CL) !== AEQ) {
        this.status |= VDPSTATUS_BO; // border detected
        break;
      }
      if ((this.ASX += TX) & mode.PIXELS_PER_LINE) {
        this.status &= 0xEF; // border not detected
        break;
      }
      cnt -= delta;
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
      // Update SX in VDP registers
      this.borderX = 0xfe00 | this.SX;
    }
  }

  private lineEngine(): void {
    const mode = this.graphicMode!;
    const delta = LINE_TIMING[this.timingMode];
    let cnt = this.opsCount;

    let CL = this.CL & mode.COLOR_MASK;
    let TX = (this.ARG & DIX) ? -1 : 1;
    let TY = (this.ARG & DIY) ? -1 : 1;

    while (cnt > 0) {
      mode.setPixel(this.ADX, this.DY, CL, this.LO);

      if ((this.ARG & MAJ) == 0) {
        // X-Axis is major direction.
        this.ADX += TX;
        if (this.ANX++ == this.NX || (this.ADX & mode.PIXELS_PER_LINE)) {
          break;
        }
        if (this.ASX < this.NY) {
          this.ASX += this.NX;
          this.DY += TY;
        }
        this.ASX -= this.NY;
        this.ASX &= 1023;
      } else {
        this.DY += TY;
        if (this.ASX < this.NY) {
          this.ASX += this.NX;
          this.ADX += TX;
        }
        this.ASX -= this.NY;
        this.ASX &= 1023;
        if (this.ANX++ == this.NX || (this.ADX & mode.PIXELS_PER_LINE)) {
          break;
        }
      }
      cnt -= delta;
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
    }
  }

  private lmmvEngine(): void {
    const mode = this.graphicMode!;
    const delta = LMMV_TIMING[this.timingMode];
    let cnt = this.opsCount;

    this.NY &= 1023;
    let tmpNX = clipNX_1_pixel(mode, this.DX, this.NX, this.ARG);
    let tmpNY = clipNY_1(this.DY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -1 : 1;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_1_pixel(mode, this.ADX, this.ANX, this.ARG);
    let CL = this.CL & mode.COLOR_MASK;

    while (cnt > 0) {
      mode.setPixel(this.ADX, this.DY, CL, this.LO);

      this.ADX += TX;
      if (--this.ANX == 0) {
        this.DY += TY;
        --this.NY;
        this.ADX = this.DX;
        this.ANX = tmpNX;
        if (--tmpNY == 0) {
          break;
        }
      }

      cnt -= delta;
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
    }
    else {
    }
  }

  private lmmmEngine(): void {
    const mode = this.graphicMode!;
    const delta = LMMM_TIMING[this.timingMode];
    let cnt = this.opsCount;
    
    this.NY &= 1023;
    let tmpNX = clipNX_2_pixel(mode, this.SX, this.DX, this.NX, this.ARG);
    let tmpNY = clipNY_2(this.SY, this.DY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -1 : 1;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_2_pixel(mode, this.ASX, this.ADX, this.ANX, this.ARG);
    let srcExt = (this.ARG & MXS) != 0;
    let dstExt = (this.ARG & MXD) != 0;

    while (cnt > 0) {
      mode.setPixel(this.ADX, this.DY, mode.getPixel(this.ASX, this.SY), this.LO);

      this.ASX += TX; this.ADX += TX;
      if (--this.ANX == 0) {
        this.SY += TY; this.DY += TY; --this.NY;
        this.ASX = this.SX; this.ADX = this.DX; this.ANX = tmpNX;
        if (--tmpNY == 0) {
          break;
        }
      }

      cnt -= delta; 
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
    }
  }

  private lmcmEngine(): void {
    const mode = this.graphicMode!;
    
    this.NY &= 1023;
    let tmpNX = clipNX_1_pixel(mode, this.SX, this.NX, this.ARG);
    let tmpNY = clipNY_1(this.SY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -1 : 1;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_1_pixel(mode, this.ASX, this.ANX, this.ARG);

    if (!(this.status & VDPSTATUS_TR)) {
      this.CL = mode.getPixel(this.ASX, this.SY);
      this.status |= VDPSTATUS_TR;

      this.ASX += TX; --this.ANX;
      if (this.ANX == 0) {
        this.SY += TY; --this.NY;
        this.ASX = this.SX; this.ANX = tmpNX;
        if (--tmpNY == 0) {
          this.status &= ~VDPSTATUS_CE;
          this.CM = 0;
        }
      }
    }
  }

  private lmmcEngine(): void {
    const mode = this.graphicMode!;

    this.NY &= 1023;
    let tmpNX = clipNX_1_pixel(mode, this.DX, this.NX, this.ARG);
    let tmpNY = clipNY_1(this.DY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -1 : 1;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_1_pixel(mode, this.ADX, this.ANX, this.ARG);

    if (!(this.status & VDPSTATUS_TR)) {
      const CL = this.CL & mode.COLOR_MASK;

      mode.setPixel(this.ADX, this.DY, CL, this.LO);

      this.status |= VDPSTATUS_TR;

      this.ADX += TX; --this.ANX;
      if (this.ANX == 0) {
        this.DY += TY; --this.NY;
        this.ADX = this.DX; this.ANX = tmpNX;
        if (--tmpNY == 0) {
          this.status &= ~VDPSTATUS_CE;
          this.CM = 0;
        }
      }
    }
  }

  private hmmvEngine(): void {
    const mode = this.graphicMode!;
    const delta = HMMV_TIMING[this.timingMode];
    let cnt = this.opsCount;

    this.NY &= 1023;
    let tmpNX = clipNX_1_byte(mode, this.DX, this.NX, this.ARG);
    let tmpNY = clipNY_1(this.DY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -mode.PIXELS_PER_BYTE: mode.PIXELS_PER_BYTE;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_1_byte(mode, this.ADX, this.ANX << mode.PIXELS_PER_BYTE_SHIFT, this.ARG);

    while (cnt > 0) {
      mode.writeVram(this.ADX, this.DY, this.CL);
      
      this.ADX += TX;
      if (--this.ANX == 0) {
        this.DY += TY; --this.NY;
        this.ADX = this.DX; this.ANX = tmpNX;
        if (--tmpNY == 0) {
          break;
        }
      }

      cnt -= delta;
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
    }
  }

  private hmmmEngine(): void {
    const mode = this.graphicMode!;
    const delta = HMMM_TIMING[this.timingMode];
    let cnt = this.opsCount;

    this.NY &= 1023;
    let tmpNX = clipNX_2_byte(mode, this.SX, this.DX, this.NX, this.ARG);
    let tmpNY = clipNY_2(this.SY, this.DY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -mode.PIXELS_PER_BYTE: mode.PIXELS_PER_BYTE;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_2_byte(mode, this.ASX, this.ADX, this.ANX << mode.PIXELS_PER_BYTE_SHIFT, this.ARG);

    while (cnt > 0) {
      mode.writeVram(this.ADX, this.DY, mode.readVram(this.ASX, this.SY));

      this.ASX += TX; this.ADX += TX;
      if (--this.ANX == 0) {
        this.SY += TY; this.DY += TY; --this.NY;
        this.ASX = this.SX; this.ADX = this.DX; this.ANX = tmpNX;
        if (--tmpNY == 0) {
          break;
        }
      }
      cnt -= delta;
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
    }
  }

  private ymmmEngine(): void {
    const mode = this.graphicMode!;
    const delta = YMMM_TIMING[this.timingMode];
    let cnt = this.opsCount;

    this.NY &= 1023;
    let tmpNX = clipNX_1_byte(mode, this.DX, 512, this.ARG);
    let tmpNY = clipNY_2(this.SY, this.DY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -mode.PIXELS_PER_BYTE: mode.PIXELS_PER_BYTE;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_1_byte(mode, this.ADX, 512, this.ARG);

    while (cnt > 0) {
      mode.writeVram(this.ADX, this.DY, mode.readVram(this.ADX, this.SY));
      
      this.ADX += TX;
      if (--this.ANX == 0) {
        // note: going to the next line does not take extra time
        this.SY += TY; this.DY += TY; --this.NY;
        this.ADX = this.DX; this.ANX = tmpNX;
        if (--tmpNY == 0) {
          break;
        }
      }

      cnt -= delta; 
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &=~VDPSTATUS_CE;
      this.CM = 0;
    }
  }

  private hmmcEngine(): void {
    const mode = this.graphicMode!;
    
    this.NY &= 1023;
    let tmpNX = clipNX_1_byte(mode, this.DX, this.NX, this.ARG);
    let tmpNY = clipNY_1(this.DY, this.NY, this.ARG);
    let TX = (this.ARG & DIX) ? -mode.PIXELS_PER_BYTE: mode.PIXELS_PER_BYTE;
    let TY = (this.ARG & DIY) ? -1 : 1;
    this.ANX = clipNX_1_byte(mode, this.ADX, this.ANX << mode.PIXELS_PER_BYTE_SHIFT, this.ARG);

    if (!(this.status & VDPSTATUS_TR)) {
      mode.writeVram(this.ADX, this.DY, this.CL);
      this.opsCount -= HMMV_TIMING[this.timingMode];

      this.status |= VDPSTATUS_TR;

      this.ADX += TX; --this.ANX;
      if (this.ANX == 0) {
        this.DY += TY; --this.NY;
        this.ADX = this.DX; this.ANX = tmpNX;
        if (--tmpNY == 0) {
          this.status &= ~VDPSTATUS_CE;
          this.CM = 0;
        }
      }
    }
  }

  public getState(): any {
    const state: any = {};

    state.SX = this.SX;
    state.SY = this.SY;
    state.DX = this.DX;
    state.DY = this.DY;
    state.NX = this.NX;
    state.NY = this.NY;
    state.ASX = this.ASX;
    state.ADX = this.ADX;
    state.ANX = this.ANX;
    state.ARG = this.ARG;
    state.CL = this.CL;
    state.LO = this.LO;
    state.CM = this.CM;
    state.status = this.status;
    state.borderX = this.borderX;
    state.opsCount = this.opsCount;
    state.systemTime = this.systemTime;
    state.timingMode = this.timingMode;
    state.screenMode = this.screenMode;

    return state;
  }

  public setState(state: any): void {
    this.SX = state.SX;
    this.SY = state.SY;
    this.DX = state.DX;
    this.DY = state.DY;
    this.NX = state.NX;
    this.NY = state.NY;
    this.ASX = state.ASX;
    this.ADX = state.ADX;
    this.ANX = state.ANX;
    this.ARG = state.ARG;
    this.CL = state.CL;
    this.LO = state.LO;
    this.CM = state.CM;
    this.status = state.status;
    this.borderX = state.borderX;
    this.opsCount = state.opsCount;
    this.systemTime = state.systemTime;
    this.timingMode = state.timingMode;
    this.screenMode = state.screenMode;

    this.graphicMode = this.graphicModes[this.screenMode];
  }
  
  private SX = 0;
  private SY = 0;
  private DX = 0;
  private DY = 0;
  private NX = 0;
  private NY = 0;
  private ASX = 0;
  private ADX = 0;
  private ANX = 0;
  private ARG = 0;
  private CL = 0;
  private LO = 0;
  private CM = 0;
  private status = 0;
  private borderX = 0;
  private opsCount = 0;
  private systemTime = 0;
  private timingMode = 0;
  private screenMode = -1;
  private graphicMode?: GraphicMode;
  private graphicModes = new Array<GraphicMode>(4);
};
