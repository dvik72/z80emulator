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

const MASK = [ 0x0f, 0x03, 0x0f, 0xff ];
const PPB = [ 2, 4, 2, 1 ];
const PPL = [ 256, 512, 512, 256 ];
const SEARCH_TIMING = [ 92, 125, 92, 92, 0, 0, 0, 0 ];
const LINE_TIMING = [120, 147, 120, 120, 0, 0, 0, 0];
const HMMV_TIMING = [49, 65, 49, 62, 0, 0, 0, 0];
const LMMV_TIMING = [98, 137, 98, 124, 0, 0, 0, 0];
const YMMM_TIMING = [65, 125, 65, 68, 0, 0, 0, 0];
const HMMM_TIMING = [92, 136, 92, 97, 0, 0, 0, 0];
const LMMM_TIMING = [129, 197, 129, 132, 0, 0, 0, 0];

export class V9938Cmd {
  public constructor(
    private board: Board,
    private vram: Array<number>
  ){
  }

  public reset(): void {
    this.systemTime = this.board.getSystemTime();

    this.offset[0] = 0;
    this.offset[1] = this.vram.length > 0x20000 ? 0x20000 : 0;
    this.mask[0] = this.vram.length > 0x20000 ? 0x1ffff : this.vram.length - 1;
    this.mask[1] = this.vram.length > 0x20000 ? 0xffff : this.vram.length - 1;

    this.indexRead  = this.offset[0];
    this.indexWrite = this.offset[0];
    this.maskRead = this.mask[0];
    this.maskWrite = this.mask[0];
  }

  public write(reg: number, value: number): void {
    switch (reg & 0x1f) {
      case 0x00: this.SX = (this.SX & 0xff00) | value; break;
      case 0x01: this.SX = (this.SX & 0x00ff) | ((value & 0x01) << 8); break;
      case 0x02: this.SY = (this.SY & 0xff00) | value; break;
      case 0x03: this.SY = (this.SY & 0x00ff) | ((value & 0x03) << 8); break;
      case 0x04: this.DX = (this.DX & 0xff00) | value; break;
      case 0x05: this.DX = (this.DX & 0x00ff) | ((value & 0x01) << 8); break;
      case 0x06: this.DY = (this.DY & 0xff00) | value; break;
      case 0x07: this.DY = (this.DY & 0x00ff) | ((value & 0x03) << 8); break;
      case 0x08: this.kNX = (this.kNX & 0xff00) | value; break;
      case 0x09: this.kNX = (this.kNX & 0x00ff) | ((value & 0x03) << 8); break;
      case 0x0a: this.NY = (this.NY & 0xff00) | value; break;
      case 0x0b: this.NY = (this.NY & 0x00ff) | ((value & 0x03) << 8); break;
      case 0x0c:
        this.CL = value;
        this.status &= ~VDPSTATUS_TR;
        break;
      case 0x0d:
        if ((this.ARG ^ value) & 0x30) {
          this.indexRead  = this.offset[(value >> 4) & 1];
          this.indexWrite = this.offset[(value >> 5) & 1];
          this.maskRead = this.mask[(value >> 4) & 1];
          this.maskWrite = this.mask[(value >> 5) & 1];
        }
        this.ARG = value;
        break;
      case 0x0e:
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
    if (this.newScreenMode != screenMode) {
      this.newScreenMode = screenMode;
      if (screenMode == -1) {
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

  private readVram(x: number, y: number): number {
    switch (this.screenMode) {
      case 0:
        return this.vram[this.indexRead + (((y & 1023) << 7) + (((x & 255) >> 1)) & this.maskRead)];
      case 1:
        return this.vram[this.indexRead + (((y & 1023) << 7) + (((x & 511) >> 2)) & this.maskRead)];
      case 2:
        return this.vram[this.indexRead + (((y & 511) << 7) + ((((x & 511) >> 2) + ((x & 2) << 15))) & this.maskRead)];
      case 3:
        return this.vram[this.indexRead + (((y & 511) << 7) + ((((x & 255) >> 1) + ((x & 1) << 16))) & this.maskRead)];
    }
    return 0;
  }

  private writeVram(x: number, y: number, value: number): void {
    let offset = 0;
    switch (this.screenMode) {
      case 0:
        offset = ((y & 1023) << 7) + (((x & 255) >> 1));
        break;
      case 1:
        offset = ((y & 1023) << 7) + (((x & 511) >> 2));
        break;
      case 2:
        offset = ((y & 511) << 7) + ((((x & 511) >> 2) + ((x & 2) << 15)));
        break;
      case 3:
        offset = ((y & 511) << 7) + ((((x & 255) >> 1) + ((x & 1) << 16)));
        break;
    }

    if (!(offset & ~this.maskRead)) this.vram[this.indexWrite + (offset & this.maskWrite)] = value;
  }

  private getPixel(x: number, y: number): number {
    switch (this.screenMode) {
      case 0:
        return (this.vram[this.indexRead + (((y & 1023) << 7) + (((x & 255) >> 1)) & this.maskRead)] >> (((~x) & 1) << 2)) & 15;
      case 1:
        return (this.vram[this.indexRead + (((y & 1023) << 7) + (((x & 511) >> 2)) & this.maskRead)] >> (((~x) & 3) << 1)) & 3;
      case 2:
        return (this.vram[this.indexRead + (((y & 511) << 7) + ((((x & 511) >> 2) + ((x & 2) << 15))) & this.maskRead)] >> (((~x) & 1) << 2)) & 15;
      case 3:
        return this.vram[this.indexRead + (((y & 511) << 7) + ((((x & 255) >> 1) + ((x & 1) << 16))) & this.maskRead)];
    }
    return 0;
  }

  private setPixel(x: number, y: number, cl: number, op: number) {
    let offset = 0;
    switch (this.screenMode) {
      case 0:
        offset = ((y & 1023) << 7) + (((x & 255) >> 1));
        break;
      case 1:
        offset = ((y & 1023) << 7) + (((x & 511) >> 2));
        break;
      case 2:
        offset = ((y & 511) << 7) + ((((x & 511) >> 2) + ((x & 2) << 15)));
        break;
      case 3:
        offset = ((y & 511) << 7) + ((((x & 255) >> 1) + ((x & 1) << 16)));
        break;
    }

    if (offset & ~this.maskRead) {
      return;
    } 

    const i = this.indexWrite + (offset & this.maskWrite);

    let sh = 0;
    let m = 0xff;

    switch (this.screenMode) {
      case 0:
        sh = (~x & 1) << 2;
        m = ~(15 << sh);
        break;
      case 1:
        sh = (~x & 3) << 1;
        m = ~(3 << sh);
        break;
      case 2:
        sh = (~x & 1) << 2;
        m = ~(15 << sh);
        break;
      case 3:
        sh = 0;
        m = 0xff;
        break;
    }

    cl <<= sh;

    switch (op) {
      case 0: 
        this.vram[i] = (this.vram[i] & m) | cl;
        break;
      case 1: 
        this.vram[i] = this.vram[i] & (cl | m);
        break;
      case 2: 
        this.vram[i] |= cl;
        break;
      case 3: 
        this.vram[i] ^= cl;
        break;
      case 4: 
        this.vram[i] = (this.vram[i] & m) | ~(cl | m);
        break;
      case 8:
        if (cl) this.vram[i] = (this.vram[i] & m) | cl;
        break;
      case 9:
        if (cl) this.vram[i] = this.vram[i] & (cl | m);
        break;
      case 10:
        if (cl) this.vram[i] |= cl;
        break;
      case 11:
        if (cl) this.vram[i] ^= cl;
        break;
      case 12:
        if (cl) this.vram[i] = (this.vram[i] & m) | ~(cl | m);
        break;
    }
  }

  private setCommand() {
    this.systemTime = this.board.getSystemTime();
    this.screenMode = this.newScreenMode;

    if (this.screenMode < 0) {
      this.CM = 0;
      this.status &= ~VDPSTATUS_CE;
      return;
    }

    this.SX &= 0x1ff;
    this.SY &= 0x3ff;
    this.DX &= 0x1ff;
    this.DY &= 0x3ff;
    this.NX &= 0x3ff;
    this.NY &= 0x3ff;
    
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
        this.CL = this.getPixel(this.SX, this.SY);
        return;

      case CM_PSET:
        this.CM = 0;
        this.status &= ~VDPSTATUS_CE;
        this.setPixel(this.DX, this.DY, this.CL & MASK[this.screenMode], this.LO);
        return;
    }

    this.MX = PPL[this.screenMode];
    this.TY = this.ARG & 0x08 ? -1 : 1;
    
    if ((this.CM & 0x0C) == 0x0C) {
      this.TX = this.ARG & 0x04 ? -PPB[this.screenMode] : PPB[this.screenMode];
      this.NX = this.kNX / PPB[this.screenMode] | 0;
    }
    else {
      this.NX = this.kNX;
      this.TX = this.ARG & 0x04 ? -1 : 1;
    }

    // X loop variables are treated specially for LINE command 
    if (this.CM == CM_LINE) {
      this.ASX = ((this.NX - 1) >> 1) & 0xff;
      this.ADX = 0;
    }
    else {
      this.ASX = this.SX;
      this.ADX = this.DX;
    }

    //console.log(this.CM);

    // NX loop variable is treated specially for SRCH command 
    if (this.CM == CM_SRCH) {
      this.ANX = (this.ARG & 0x02) != 0 ? 1 : 0; // Do we look for "==" or "!="?
    }
    else {
      this.ANX = this.NX;
    }

    // Command execution started 
    this.status |= VDPSTATUS_CE;
  }


  private srchEngine(): void {
    let SX = this.SX;
    const SY = this.SY;
    const TX = this.TX;
    const ANX = !!this.ANX;
    let CL = this.CL & MASK[this.screenMode];
    const delta = SEARCH_TIMING[this.timingMode];
    const MX = this.screenMode == 0 || this.screenMode == 3 ? 256 : 512;

    let cnt = this.opsCount;

    while (cnt > 0) {
      if ((this.getPixel(SX, SY) == CL) != ANX) {
        this.status |= VDPSTATUS_BO;
        break;
      }
      if ((SX += TX) & MX) {
        this.status |= VDPSTATUS_BO;
        break;
      }
      cnt -= delta;
    }

    this.opsCount = cnt;

    if ((cnt) > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
      // Update SX in VDP registers
      this.borderX = 0xfe00 | SX;
    }
    else {
      this.SX = SX;
    }
  }

  private lineEngine(): void {
    let DX = this.DX;
    let DY = this.DY;
    let TX = this.TX;
    let TY = this.TY;
    let NX = this.NX;
    let NY = this.NY;
    let ASX = this.ASX;
    let ADX = this.ADX;
    let CL = this.CL & MASK[this.screenMode];
    let LO = this.LO;
    const delta = LINE_TIMING[this.timingMode];
    const MX = this.screenMode == 0 || this.screenMode == 3 ? 256 : 512;

    let cnt = this.opsCount;

    if ((this.ARG & 0x01) == 0) {
      // X-Axis is major direction
      while (cnt > 0) {
        this.setPixel(DX, DY, CL, LO);
        DX += TX;
        if (ADX++ == NX || (DX & MX))
          break;
        if ((ASX -= NY) < 0) {
          ASX += NX;
          DY += TY;
        }
        ASX &= 1023; // Mask to 10 bits range
        cnt -= delta;
      }
    }
    else {
      // Y-Axis is major direction
      while (cnt > 0) {
        this.setPixel(DX, DY, CL, LO);
        DY += TY;
        if ((ASX -= NY) < 0) {
          ASX += NX;
          DX += TX;
        }
        ASX &= 1023; // Mask to 10 bits range
        if (ADX++ == NX || (DX & MX))
          break;
        cnt -= delta;
      }
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM = 0;
      this.DY = DY & 0x03ff;
    }
    else {
      this.DX = DX;
      this.DY = DY;
      this.ASX = ASX;
      this.ADX = ADX;
    }
  }

  private lmmvEngine(): void {
    let DX = this.DX;
    let DY = this.DY;
    let TX = this.TX;
    let TY = this.TY;
    let NX = this.NX;
    let NY = this.NY;
    let ADX = this.ADX;
    let ANX = this.ANX;
    let CL = this.CL & MASK[this.screenMode];
    let LO = this.LO;
    const delta = LMMV_TIMING[this.timingMode];
    const MX = this.screenMode == 0 || this.screenMode == 3 ? 256 : 512;

    let cnt = this.opsCount;

    while (cnt > 0) {
      this.setPixel(ADX, DY, CL, LO);
      ADX += TX;
      if (--ANX == 0 || (ADX & MX)) {
        DY += TY;
        ADX = DX; ANX = NX;
        if ((--NY & 1023) == 0 || DY == -1) {
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
      this.DY = DY & 0x03ff;
      this.NY = NY & 0x03ff;
    }
    else {
      this.DY = DY;
      this.NY = NY;
      this.ANX = ANX;
      this.ADX = ADX;
    }
  }

  private lmmmEngine(): void {
    let SX = this.SX;
    let SY = this.SY;
    let DX = this.DX;
    let DY = this.DY;
    let TX = this.TX;
    let TY = this.TY;
    let NX = this.NX;
    let NY = this.NY;
    let ASX = this.ASX;
    let ADX = this.ADX;
    let ANX = this.ANX;
    let LO = this.LO;
    let delta = LMMM_TIMING[this.timingMode];
    const MX = this.screenMode == 0 || this.screenMode == 3 ? 256 : 512;

    let cnt = this.opsCount;

    while (cnt > 0) {
      this.setPixel(ADX, DY, this.getPixel(ASX, SY), LO);
      ASX += TX; ADX += TX; 
      if (--ANX == 0 || ((ASX | ADX) & MX)) {
        SY += TY; DY += TY; 
        ASX = SX; ADX = DX; ANX = NX; 
        if ((--NY & 1023) == 0 || SY == -1 || DY == -1) {
          break; 
        } 
      } 
      cnt -= delta; 
    }

    this.opsCount = cnt;

    if (cnt > 0) {
      // Command execution done
      this.status &= ~VDPSTATUS_CE;
      this.CM=0;
      this.DY=DY & 0x03ff;
      this.SY=SY & 0x03ff;
      this.NY=NY & 0x03ff;
    }
    else {
      this.SY=SY;
      this.DY=DY;
      this.NY=NY;
      this.ANX=ANX;
      this.ASX=ASX;
      this.ADX=ADX;
    }
  }

  private lmcmEngine(): void {
    if (!(this.status & VDPSTATUS_TR)) {
      this.CL = this.getPixel(this.ASX, this.SY);
      this.status |= VDPSTATUS_TR;

      if (!--this.ANX || ((this.ASX+= this.TX) & this.MX)) {
        this.SY+=this.TY;
        if (!(--this.NY & 1023) || this.SY == -1) {
          this.status &= ~VDPSTATUS_CE;
          this.CM = 0;
        }
        else {
          this.ASX=this.SX;
          this.ANX=this.NX;
        }
      }
    }
  }

  private lmmcEngine(): void {
    if (!(this.status & VDPSTATUS_TR)) {
      const CL = this.CL & MASK[this.screenMode];

      this.setPixel(this.ADX, this.DY, CL, this.LO);
      this.status |= VDPSTATUS_TR;

      if (!--this.ANX || ((this.ADX+= this.TX) & this.MX)) {
        this.DY+=this.TY;
        if (!(--this.NY & 1023) || this.DY == -1) {
          this.status &= ~VDPSTATUS_CE;
          this.CM = 0;
        }
        else {
          this.ADX=this.DX;
          this.ANX=this.NX;
        }
      }
    }
  }

  private hmmvEngine(): void {
    let DX = this.DX;
    let DY = this.DY;
    let TX = this.TX;
    let TY = this.TY;
    let NX = this.NX;
    let NY = this.NY;
    let ADX = this.ADX;
    let ANX = this.ANX;
    let CL = this.CL;
    const delta = HMMV_TIMING[this.timingMode];
    const MX = this.screenMode == 0 || this.screenMode == 3 ? 256 : 512;

    let cnt = this.opsCount;

    while (cnt > 0) {
      this.writeVram(ADX, DY, CL);
      ADX += TX;
      if (--ANX == 0 || (ADX & MX)) {
        DY += TY;
        ADX = DX; ANX = NX;
        if ((--NY & 1023) == 0 || DY == -1) {
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
      this.DY=DY & 0x03ff;
      this.NY=NY & 0x03ff;
    }
    else {
      this.DY=DY;
      this.NY=NY;
      this.ANX=ANX;
      this.ADX=ADX;
    }
  }

  private hmmmEngine(): void {
    let SX = this.SX;
    let SY = this.SY;
    let DX = this.DX;
    let DY = this.DY;
    let TX = this.TX;
    let TY = this.TY;
    let NX = this.NX;
    let NY = this.NY;
    let ASX = this.ASX;
    let ADX = this.ADX;
    let ANX = this.ANX;
    let LO = this.LO;
    let delta = HMMM_TIMING[this.timingMode];
    const MX = this.screenMode == 0 || this.screenMode == 3 ? 256 : 512;

    let cnt = this.opsCount;

    while (cnt > 0) {
      this.writeVram(ADX, DY, this.readVram(ASX, SY));
      ASX += TX; ADX += TX;
      if (--ANX == 0 || ((ASX | ADX) & MX)) {
        SY += TY; DY += TY;
        ASX = SX; ADX = DX; ANX = NX;
        if ((--NY & 1023) == 0 || SY == -1 || DY == -1) {
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
      this.DY = DY & 0x03ff;
      this.SY = SY & 0x03ff;
      this.NY = NY & 0x03ff;
    }
    else {
      this.SY = SY;
      this.DY = DY;
      this.NY = NY;
      this.ANX = ANX;
      this.ASX = ASX;
      this.ADX = ADX;
    }
  }

  private ymmmEngine(): void {
    let SY = this.SY;
    let DX = this.DX;
    let DY = this.DY;
    let TX = this.TX;
    let TY = this.TY;
    let NY = this.NY;
    let ADX = this.ADX;
    const delta = YMMM_TIMING[this.timingMode];

    const MX = this.screenMode == 0 || this.screenMode == 3 ? 256 : 512;

    let cnt = this.opsCount;

    while (cnt > 0) {
      this.writeVram(ADX, DY, this.readVram(ADX, SY));
      ADX += TX; 
      if (ADX & MX) {
        SY += TY; DY += TY; 
        ADX = DX; 
        if ((--NY & 1023) == 0 || SY == -1 || DY == -1) {
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
      this.DY=DY & 0x03ff;
      this.SY=SY & 0x03ff;
      this.NY=NY & 0x03ff;
    }
    else {
      this.SY=SY;
      this.DY=DY;
      this.NY=NY;
      this.ADX=ADX;
    }
  }

  private hmmcEngine(): void {
    if (!(this.status & VDPSTATUS_TR)) {
      this.writeVram(this.ADX, this.DY, this.CL);
      this.opsCount -= HMMV_TIMING[this.timingMode];
      this.status |= VDPSTATUS_TR;

      if (!--this.ANX || ((this.ADX += this.TX) & this.MX)) {
        this.DY += this.TY;
        if (!(--this.NY & 1023) || this.DY == -1) {
          this.status &= ~VDPSTATUS_CE;
          this.CM = 0;
        }
        else {
          this.ADX = this.DX;
          this.ANX = this.NX;
        }
      }
    }
  }

  private indexRead = 0;
  private indexWrite = 0;
  private maskRead = 0;
  private maskWrite = 0;
  private offset = [0, 0];
  private mask = [0, 0];
  private SX = 0;
  private SY = 0;
  private DX = 0;
  private DY = 0;
  private NX = 0;
  private kNX = 0;
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
  private TX = 0;
  private TY = 0;
  private MX = 0;
  private opsCount = 0;
  private systemTime = 0;
  private screenMode = 0;
  private newScreenMode = 0;
  private timingMode = 0;
};
