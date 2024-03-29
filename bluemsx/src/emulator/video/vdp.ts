﻿//////////////////////////////////////////////////////////////////////////////
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

import { Board, InterruptVector } from '../core/board';
import { Timer } from '../core/timeoutmanager';
import { Port } from '../core/iomanager';
import { V9938Cmd } from './v9938cmd';
import { SaveState } from '../util/savestate';


export enum VdpVersion { V9938, V9958, TMS9929A, TMS99x8A };
export enum VdpSyncMode { SYNC_AUTO, SYNC_50HZ, SYNC_60HZ };
export enum VdpConnectorType { MSX, SVI, COLECO, SG1000 };

const registerValueMaskMSX1 = [
  0x03, 0xfb, 0x0f, 0xff, 0x07, 0x7f, 0x07, 0xff
];

const registerValueMaskMSX2 = [
  0x7e, 0x7b, 0x7f, 0xff, 0x3f, 0xff, 0x3f, 0xff,
  0xfb, 0xbf, 0x07, 0x03, 0xff, 0xff, 0x07, 0x0f,
  0x0f, 0xbf, 0xff, 0xff, 0x3f, 0x3f, 0x3f, 0xff,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
];

const registerValueMaskMSX2p = [
  0x7e, 0x7b, 0x7f, 0xff, 0x3f, 0xff, 0x3f, 0xff,
  0xfb, 0xbf, 0x07, 0x03, 0xff, 0xff, 0x07, 0x0f,
  0x0f, 0xbf, 0xff, 0xff, 0x3f, 0x3f, 0x3f, 0xff,
  0x00, 0x7f, 0x3f, 0x07, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
];

const HPERIOD = 1368;

const BORDER_WIDTH = 8;
const DISPLAY_WIDTH = 256;
const SCREEN_WIDTH = 2 * BORDER_WIDTH + DISPLAY_WIDTH;
const SCREEN_HEIGHT = 240;

const MSX1_PALETTE = [
  [0, 0, 0],
  [0, 0, 0],
  [62, 184, 73],
  [116, 208, 125],
  [89, 85, 224],
  [128, 118, 241],
  [185, 94, 81],
  [101, 219, 239],
  [219, 101, 89],
  [255, 137, 125],
  [204, 195, 94],
  [222, 208, 135],
  [58, 162, 65],
  [183, 102, 181],
  [204, 204, 204],
  [255, 255, 255]
];

const MSX2_PALETTE = [
  [0x00, 0x00, 0x00],
  [0x00, 0x00, 0x00],
  [0x24, 0xda, 0x24],
  [0x68, 0xff, 0x68],
  [0x24, 0x24, 0xff],
  [0x48, 0x68, 0xff],
  [0xb6, 0x24, 0x24],
  [0x48, 0xda, 0xff],
  [0xff, 0x24, 0x24],
  [0xff, 0x68, 0x68],
  [0xda, 0xda, 0x24],
  [0xda, 0xda, 0x91],
  [0x24, 0x91, 0x24],
  [0xda, 0x48, 0xb6],
  [0xb6, 0xb6, 0xb6],
  [0xff, 0xff, 0xff]
];

const DEFAULT_PALETTE_REGS = [
  0x0000, 0x0000, 0x0611, 0x0733, 0x0117, 0x0327, 0x0151, 0x0627,
  0x0171, 0x0373, 0x0661, 0x0664, 0x0411, 0x0265, 0x0555, 0x0777
];

class SpriteAttribute {
  constructor(
    public color: number,
    public offset: number,
    public pattern: number
  ) { }
};


const TMS9XXXA_ANALOG_OUTPUT = [
  [0.00, 0.47, 0.47],
  [0.00, 0.47, 0.47],
  [0.53, 0.07, 0.20],
  [0.67, 0.17, 0.27],
  [0.40, 0.40, 1.00],
  [0.53, 0.43, 0.93],
  [0.47, 0.83, 0.30],
  [0.73, 0.00, 0.70],
  [0.53, 0.93, 0.27],
  [0.67, 0.93, 0.27],
  [0.73, 0.57, 0.07],
  [0.80, 0.57, 0.17],
  [0.47, 0.13, 0.23],
  [0.53, 0.73, 0.67],
  [0.80, 0.47, 0.47],
  [1.00, 0.47, 0.47],
];

function makeTmsPalette(saturationPr: number, saturationPb: number): Array<Uint8Array> {
  let palette = Array<Uint8Array>(16);
  for (let color = 0; color < 16; color++) {
    // convert from analog output to YPbPr
    let Y = TMS9XXXA_ANALOG_OUTPUT[color][0];
    let Pr = TMS9XXXA_ANALOG_OUTPUT[color][1] - 0.5;
    let Pb = TMS9XXXA_ANALOG_OUTPUT[color][2] - 0.5;
    // apply the saturation
    Pr *= saturationPr;
    Pb *= saturationPb;
    let R = Y + 0 + 1.402 * Pr;
    let G = Y - 0.344 * Pb - 0.714 * Pr;
    let B = Y + 1.722 * Pb + 0;
    R *= 255;
    G *= 255;
    B *= 255;
    palette[color] = new Uint8Array(3);
    palette[color][0] = Math.min(255, Math.max(0, R + 0.5 | 0));
    palette[color][1] = Math.min(255, Math.max(0, G + 0.5 | 0));
    palette[color][2] = Math.min(255, Math.max(0, B + 0.5 | 0));
  }

  return palette;
}

const TMS_PALETTE = makeTmsPalette(0.75, 0.5);

export class Vdp {
  constructor(
    private board: Board,
    private version: VdpVersion,
    private syncMode: VdpSyncMode,
    private connectorType: VdpConnectorType,
    private vramPages: number
  ) {
    this.frameBuffer = this.frameBuffers[this.frameBufferWriteIndex ^= 1];

    this.refreshLineCb = this.refreshLineBlank.bind(this);

    this.initPalette();

    this.frameTimer = board.getTimeoutManager().createTimer('Frame Change', this.onFrameChange.bind(this));
    this.screenModeChangeTimer = board.getTimeoutManager().createTimer('Screen Mode Change', this.onScreenModeChange.bind(this));
    this.vStartTimer = board.getTimeoutManager().createTimer('VStart', this.onVStart.bind(this));
    this.vIntTimer = board.getTimeoutManager().createTimer('VInt', this.onVInt.bind(this));
    this.hIntTimer = board.getTimeoutManager().createTimer('hInt', this.onHInt.bind(this));
    this.drawAreaStartTimer = board.getTimeoutManager().createTimer('Draw Area Start', this.onDrawAreaStart.bind(this));
    this.drawAreaEndTimer = board.getTimeoutManager().createTimer('Draw Area End', this.onDrawAreaEnd.bind(this));

    this.vramSize = this.vramPages << 14;
    this.vram192 = this.vramPages == 12;
    this.vram16 = this.vramPages == 1;

    this.offsets[0] = 0;
    this.offsets[1] = this.vramSize > 0x20000 ? 0x20000 : 0;
    this.vramMasks[0] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
    this.vramMasks[1] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
    this.vramMasks[2] = this.vramSize > 0x20000 ? 0x1ffff : this.vramSize - 1;
    this.vramMasks[3] = this.vramSize > 0x20000 ? 0xffff : this.vramSize - 1;
    this.vramAccMask = this.vramMasks[2];

    if (this.vramPages > 8) {
      this.vramPages = 8;
    }

    this.vram128 = this.vramPages >= 8 ? 0x10000 : 0;
    this.vramMask = (this.vramPages << 14) - 1;

    if (this.syncMode == VdpSyncMode.SYNC_AUTO) {
      this.palMask = ~0;
      this.palValue = 0;
    }
    else if (this.syncMode == VdpSyncMode.SYNC_50HZ) {
      this.palMask = ~0x02;
      this.palValue = 0x02;
    }
    else if (this.syncMode == VdpSyncMode.SYNC_60HZ) {
      this.palMask = ~0x02;
      this.palValue = 0x00;
    }

    this.vram = new Uint8Array(this.vramSize);
    for (let i = 0; i < 0x4000; i++) {
      this.vram[i] = 0;
    }

    // Create V9938 command engine
    this.v9938Cmd = new V9938Cmd(this.board, this.vram);

    switch (this.version) {
      case VdpVersion.TMS9929A:
        this.registerValueMask = registerValueMaskMSX1;
        this.registerMask = 0x07;
        this.hAdjustSc0 = -2; // 6
        break;
      case VdpVersion.TMS99x8A:
        this.registerValueMask = registerValueMaskMSX1;
        this.registerMask = 0x07;
        this.regs[9] &= ~0x02;
        this.hAdjustSc0 = -2; // 6
        break;
      case VdpVersion.V9938:
        this.registerValueMask = registerValueMaskMSX2;
        this.registerMask = 0x3f;
        this.hAdjustSc0 = 1; // 9
        break;
      case VdpVersion.V9958:
        this.registerValueMask = registerValueMaskMSX2p;
        this.registerMask = 0x3f;
        this.hAdjustSc0 = 1; // 9
        break;
    }

    this.read = this.read.bind(this);
    this.write = this.write.bind(this);
    this.readStatus = this.readStatus.bind(this);
    this.writeLatch = this.writeLatch.bind(this);
    this.writePaletteLatch = this.writePaletteLatch.bind(this);
    this.writeRegister = this.writeRegister.bind(this);

    switch (this.connectorType) {
      case VdpConnectorType.MSX:
        this.board.getIoManager().registerPort(0x98, new Port(this.read, this.write));
        this.board.getIoManager().registerPort(0x99, new Port(this.readStatus, this.writeLatch));
        if (this.version == VdpVersion.V9938 || this.version == VdpVersion.V9958) {
          this.board.getIoManager().registerPort(0x9a, new Port(undefined, this.writePaletteLatch));
          this.board.getIoManager().registerPort(0x9b, new Port(undefined, this.writeRegister));
        }
        break;

      case VdpConnectorType.SVI:
        this.board.getIoManager().registerPort(0x80, new Port(undefined, this.write));
        this.board.getIoManager().registerPort(0x81, new Port(undefined, this.writeLatch));
        this.board.getIoManager().registerPort(0x84, new Port(this.read, undefined));
        this.board.getIoManager().registerPort(0x85, new Port(this.readStatus, undefined));
        break;

      case VdpConnectorType.COLECO:
        for (let i = 0xa0; i < 0xc0; i += 2) {
          this.board.getIoManager().registerPort(i, new Port(this.read, this.write));
          this.board.getIoManager().registerPort(i + 1, new Port(this.readStatus, this.writeLatch));
        }
        break;

      case VdpConnectorType.SG1000:
        this.board.getIoManager().registerPort(0xbe, new Port(this.read, this.write));
        this.board.getIoManager().registerPort(0xbf, new Port(this.readStatus, this.writeLatch));
        break;
    }
  }

  reset(): void {
    this.v9938Cmd.reset();

    for (let i = 0; i < 64; i++) this.regs[i] = 0;
    for (let i = 0; i < 16; i++) this.status[i] = 0;

    this.status[0] = 0x9f;
    this.status[1] = this.version == VdpVersion.V9958 ? 0x04 : 0;
    this.status[2] = 0x6c;

    this.regs[1] = 0x10;
    this.regs[2] = 0xff;
    this.regs[3] = 0xff;
    this.regs[4] = 0xff;
    this.regs[5] = 0xff;
    this.regs[8] = 0x08;
    this.regs[9] = (0x02 & this.palMask) | this.palValue;
    this.regs[21] = 0x3b;
    this.regs[22] = 0x05;

    this.vdpKey = 0;
    this.vdpData = 0;
    this.vdpDataLatch = 0;
    this.vramAddress = 0;
    this.screenMode = 0;
    this.vramOffset = this.offsets[0];

    this.fgColor = 0;
    this.bgColor = 0;
    this.xfgColor = 0;
    this.xbgColor = 0;
    this.blinkFlag = false;
    this.blinkCnt = 0;
    this.vramEnable = true;
    this.palKey = 0;
    this.vramPage = 0;
    this.vramAccMask = this.vramMasks[2];

    this.scr0splitLine = 0;
    this.lineOffset = 0;
    this.curLine = 0;

    this.isDrawArea = false;

    const palette = this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A ? TMS_PALETTE : MSX2_PALETTE;
    for (let i = 0; i < 16; i++) {
      this.updatePalette(i, palette[i][0], palette[i][1], palette[i][2]);
    }

    for (let i = 0; i < 16; i++) {
      this.paletteReg[i] = DEFAULT_PALETTE_REGS[i];
    }

    this.clearSpriteLine(this.spriteLines[0]);
    this.clearSpriteLine(this.spriteLines[1]);

    this.onScreenModeChange();
    this.onFrameChange();
  }

  private updatePalette(index: number, r: number, g: number, b: number) {
    const color = this.videoGetColor(r, g, b);

    this.palette[index] = color;

    if (index == 0) {
      this.palette0 = color;
      this.updateOutputMode();
    }
    else {
      if (index == this.bgColor) {
        this.updateOutputMode();
      }
    }
  }

  private mapVram(addr: number): number {
    const offset = this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
    return this.vram[offset];
  }

  private readVram(addr: number): number {
    const offset = this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
    return this.vram[this.vramOffset + offset & this.vramAccMask];
  }

  private getVramIndex(addr: number): number {
    return this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
  }

  private read(port: number): number {
    this.sync();

    const value = this.vdpData;
    this.vdpData = this.enable ? this.readVram((this.regs[14] << 14) | this.vramAddress) : 0xff;
    this.vramAddress = (this.vramAddress + 1) & 0x3fff;
    if (this.vramAddress == 0 && this.screenMode > 3) {
      this.regs[14] = (this.regs[14] + 1) & (this.vramPages - 1);
    }
    this.vdpKey = 0;

    return value;
  }

  private readStatus(port: number): number {
    this.sync();

    this.vdpKey = 0;

    if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
      const status = this.status[0];
      this.status[0] &= 0x1f;
      this.board.clearInt(InterruptVector.VDP_IE0);
      return status;
    }

    let status = this.status[this.regs[15]];

    switch (this.regs[15]) {
      case 0:
        this.status[0] &= 0x1f;
        this.board.clearInt(InterruptVector.VDP_IE0);
        break;
      case 1:
        if (this.regs[0] & 0x10) {
          if (this.board.getInt(InterruptVector.VDP_IE1)) {
            this.board.clearInt(InterruptVector.VDP_IE1);
            status |= 0x01;
          }
        }
        else {
          if (this.board.getTimeSince(this.hIntTime) < HPERIOD - this.displayArea) {
            status |= 0x01;
          }
        }
        break;
      case 2:
        {
          const frameTime = this.board.getTimeSince(this.frameStartTime);
          status |= 0x40 | 0x20 | this.v9938Cmd.getStatus();

          const checkTime = frameTime - ((this.firstLine - 1) * HPERIOD + this.leftBorder - 10);
          if (this.isDrawArea || (checkTime >= 0 && checkTime < 4 * HPERIOD)) {
            status &= ~0x40;
          }
          const checkTime2 = frameTime % HPERIOD - this.leftBorder - 30;
          if (checkTime2 >= 0 && checkTime2 < this.displayArea + 30) {
            status &= ~0x20;
          }
        }
        break;

      case 7:
        status = this.v9938Cmd.getColor();
        break;

      case 8:
        status = this.v9938Cmd.getBorderX() & 0xff;
        break;

      case 9:
        status = (this.v9938Cmd.getBorderX() >> 8) & 0xff;
        break;

      default:
        break;
    }

    return status;
  }

  private write(port: number, value: number): void {
    this.sync();

    if (this.enable) {
      const index = this.getVramIndex((this.regs[14] << 14) | this.vramAddress);
      if (!(index & ~this.vramAccMask)) {
        this.vram[index] = value;
      }
    }
    this.vdpData = value;
    this.vdpKey = 0;
    this.vramAddress = (this.vramAddress + 1) & 0x3fff;
    if (this.vramAddress == 0 && this.screenMode > 3) {
      this.regs[14] = (this.regs[14] + 1) & (this.vramPages - 1);
    }
  }

  private writeLatch(port: number, value: number): void {
    this.sync();

    if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
      if (this.vdpKey) {
        this.vramAddress = (value << 8 | (this.vramAddress & 0xff)) & 0x3fff;
        if (!(value & 0x40)) {
          if (value & 0x80) this.updateRegisters(value, this.vdpDataLatch);
          else this.read(port);
        }
        this.vdpKey = 0;
      }
      else {
        this.vramAddress = (this.vramAddress & 0x3f00) | value;
        this.vdpDataLatch = value;
        this.vdpKey = 1;
      }
    } else {
      if (this.vdpKey) {
        if (value & 0x80) {
          if (!(value & 0x40)) this.updateRegisters(value, this.vdpDataLatch);
        }
        else {
          this.vramAddress = (value << 8 | this.vdpDataLatch) & 0x3fff;
          if (!(value & 0x40)) this.read(port);
        }
        this.vdpKey = 0;
      }
      else {
        this.vdpDataLatch = value;
        this.vdpKey = 1;
      }
    }
  }

  private updateRegisters(reg: number, value: number): void {
    this.sync();

    reg &= this.registerMask;
    value &= this.registerValueMask[reg];
    const change = this.regs[reg] ^ value;
    this.regs[reg] = value;

    if (reg >= 0x20) {
      if (reg == 0x2d && (change & 0x40)) {
        this.vramOffset = this.offsets[(value >> 6) & 1];
        this.vramAccMask = this.vramMasks[((this.regs[8] & 0x08) >> 2) | (((this.regs[0x2d] >> 6) & 1))];
        this.vramEnable = this.vram192 || !((value >> 6) & 1);
      }
      this.v9938Cmd.write(reg - 0x20, value);
      return;
    }

    switch (reg) {
      case 0:
        if (!(value & 0x10)) {
          this.board.clearInt(InterruptVector.VDP_IE1);
        }

        if (change & 0x0e) {
          this.scheduleScrModeChange();
        }

        if (change & 0x40) {
          this.updateOutputMode();
        }

        break;

      case 1:
        if (this.status[0] & 0x80) {
          if (value & 0x20) {
            this.board.setInt(InterruptVector.VDP_IE0);
          }
          else {
            this.board.clearInt(InterruptVector.VDP_IE0);
          }
        }

        if (change & 0x58) {
          this.scheduleScrModeChange();
        }

        this.v9938Cmd.setTimingMode(((value >> 6) & (this.isDrawArea ? 1 : 0)) | (this.regs[8] & 2));
        break;

      case 2:
        this.chrTabBase = (((this.regs[2] << 10) & ~((this.regs[25] & 1) << 15)) | ~(-1 << 10)) & this.vramMask;
        break;

      case 3:
        this.colTabBase = ((this.regs[10] << 14) | (value << 6) | ~(-1 << 6)) & this.vramMask;
        break;

      case 4:
        this.chrGenBase = ((value << 11) | ~(-1 << 11)) & this.vramMask;
        break;

      case 5:
        this.sprTabBase = ((this.regs[11] << 15) | (value << 7) | ~(-1 << 7)) & ((this.vramPages << 14) - 1);
        break;

      case 6:
        this.sprGenBase = ((value << 11) | ~(-1 << 11)) & ((this.vramPages << 14) - 1);
        break;

      case 7:
        this.fgColor = value >> 4;
        this.bgColor = value & 0x0F;
        this.updateOutputMode();
        break;

      case 8:
        this.vramAccMask = this.vramMasks[((this.regs[8] & 0x08) >> 2) | (((this.regs[0x2d] >> 6) & 1))];

        this.v9938Cmd.setTimingMode(((value >> 6) & (this.isDrawArea ? 1 : 0)) | (this.regs[8] & 2));

        if (change & 0xb0) {
          this.updateOutputMode();
        }
        break;

      case 9:
        value = (value & this.palMask) | this.palValue;
        if (change & 0x80) {
          this.scheduleVInt();
          this.scheduleDrawAreaEnd();
        }
        if (change & 0x30) {
          this.updateOutputMode();
        }
        break;

      case 10:
        this.colTabBase = ((value << 14) | (this.regs[3] << 6) | ~(-1 << 6)) & this.vramMask;
        break;

      case 11:
        this.sprTabBase = ((value << 15) | (this.regs[5] << 7) | ~(-1 << 7)) & ((this.vramPages << 14) - 1);
        break;

      case 14:
        value &= this.vramPages - 1;
        this.vramPage = value << 14;
        if (this.vram16) {
          this.vramEnable = value == 0;
        }
        break;

      case 16:
        this.palKey = 0;
        break;

      case 18:
        if (change) {
          this.scheduleScrModeChange();
        }
        break;

      case 19:
        this.board.clearInt(InterruptVector.VDP_IE1);
        if (change) {
          this.scheduleHInt();
        }
        break;

      case 23:
        if (change) {
          this.scheduleHInt();
          this.invalidateSpriteLine(this.getCurrentScanline());
        }
        if (!(this.regs[0] & 0x10)) {
          this.board.clearInt(InterruptVector.VDP_IE1);
        }
        break;

      case 25:
        if (change) {
          this.scheduleScrModeChange();
        }
        break;

      default:
        break;
    }
  }

  private getCurrentScanline(): number {
    return this.board.getTimeSince(this.frameStartTime) / HPERIOD | 0;
  }

  private scheduleScrModeChange(): void {
    const timeout = this.frameStartTime + HPERIOD * (1 + this.getCurrentScanline());
    this.screenModeChangeTimer.setTimeout(timeout);
  }

  private scheduleNextFrame(): void {
    const timeout = this.frameStartTime + HPERIOD * this.scanLineCount;
    this.frameTimer.setTimeout(timeout);
  }

  private scheduleVStart(): void {
    const timeout = this.frameStartTime + HPERIOD * (this.firstLine - 1) + this.leftBorder - 10;
    this.vStartTimer.setTimeout(timeout);
  }

  private scheduleVInt(): void {
    const timeout = this.frameStartTime + HPERIOD * (this.firstLine + ((this.regs[9] & 0x80) ? 212 : 192)) + this.leftBorder - 10;
    this.vIntTimer.setTimeout(timeout);
  }

  private scheduleHInt(): void {
    const timeout = this.frameStartTime + HPERIOD * (this.firstLine + ((this.regs[19] - this.regs[23]) & 0xff)) + this.leftBorder + this.displayArea;
    this.hIntTime = timeout;
    this.hIntTimer.setTimeout(timeout + 20);
  }

  private scheduleDrawAreaEnd(): void {
    const timeout = this.frameStartTime + HPERIOD * (this.firstLine + ((this.regs[9] & 0x80) ? 212 : 192));
    this.drawAreaEndTimer.setTimeout(timeout);
  }

  private scheduleDrawAreaStart(): void {
    const timeout = this.frameStartTime + HPERIOD * ((this.isDrawArea ? 3 + 13 : this.firstLine) - 1) + this.leftBorder +
      this.displayArea + 13;
    this.drawAreaStartTimer.setTimeout(timeout);
  }

  private isPalVideo(): boolean {
    return (this.regs[9] & 0x02) != 0;
  }

  private onFrameChange(): void {
    this.sync();

    const isPal = this.isPalVideo();

    this.scr0splitLine = 0;
    this.curLine = 0;
    this.frameOffset = 0;
    
    this.vAdjust = -(this.regs[18] & 0x80 ? (this.regs[18] - 256) >> 4 : this.regs[18] >> 4);

    this.scanLineCount = isPal ? 313 : 262;
    this.displayOffest = isPal ? 27 : 0;
    const has212Scanlines = (this.regs[9] & 0x80) != 0;
    this.firstLine = this.displayOffest + (has212Scanlines ? 14 : 24) + this.vAdjust;

    if (!(this.regs[0] & 0x10)) {
      this.board.clearInt(InterruptVector.VDP_IE1);
    }

    this.blink();

    this.status[2] ^= 0x02;
    this.frameStartTime = this.frameTimer.timeout;

    this.scheduleNextFrame();
    this.scheduleVStart();
    this.scheduleVInt();
    this.scheduleDrawAreaEnd();
    this.scheduleHInt();
    this.scheduleDrawAreaStart();

    this.frameBuffer = this.frameBuffers[this.frameBufferWriteIndex ^= 1];
  }

  private blink(): void {
    if (this.blinkCnt) {
      this.blinkCnt--;
    }
    else {
      this.blinkFlag = !this.blinkFlag;
      if (!this.regs[13]) {
        this.xfgColor = this.fgColor;
        this.xbgColor = this.bgColor;
      }
      else {
        this.blinkCnt = (this.blinkFlag ? this.regs[13] & 0x0f : this.regs[13] >> 4) * 10;
        if (this.blinkCnt) {
          if (this.blinkFlag) {
            this.xfgColor = this.fgColor;
            this.xbgColor = this.bgColor;
          }
          else {
            this.xfgColor = this.regs[12] >> 4;
            this.xbgColor = this.regs[12] & 0x0f;
          }
        }
      }
    }
  }

  private onVInt(): void {
    this.sync(this.vIntTimer.getTimeout());

    this.status[0] |= 0x80;
    this.status[2] |= 0x40;

    if (this.regs[1] & 0x20) {
      this.board.setInt(InterruptVector.VDP_IE0);
    }

    this.v9938Cmd.setTimingMode(this.regs[8] & 2);
  }

  private onHInt(): void {
    this.sync(this.hIntTimer.getTimeout());
    if (this.regs[0] & 0x10) {
      this.board.setInt(InterruptVector.VDP_IE1);
    }
  }

  private onVStart(): void {
    this.sync(this.vStartTimer.getTimeout());

    this.status[2] &= ~0x40;
  }

  private onDrawAreaStart(): void {
    this.sync(this.drawAreaStartTimer.getTimeout());

    this.isDrawArea = true;
    this.status[2] &= ~0x40;

    this.v9938Cmd.setTimingMode(((this.regs[1] >> 6) & (this.isDrawArea ? 1 : 0)) | (this.regs[8] & 2));
  }

  private onDrawAreaEnd(): void {
    this.sync(this.drawAreaEndTimer.getTimeout());

    this.isDrawArea = false;
  }

  private isSpritesOff(): boolean {
    return (this.regs[8] & 0x02) != 0;
  }

  private isSprites16x16(): boolean {
    return (this.regs[1] & 0x02) != 0;
  }

  private isSpritesBig(): boolean {
    return (this.regs[1] & 0x01) != 0;
  }

  private isColor0Solid(): boolean {
    return (this.regs[8] & 0x20) != 0;
  }

  private isModeYjk(): boolean {
    return (this.regs[25] & 0x08) != 0;
  }

  private isModeYae(): boolean {
    return (this.regs[25] & 0x10) != 0;
  }

  private isEdgeMasked(): boolean {
    return (this.regs[25] & 0x02) != 0;
  }

  private hScroll(): number {
    return ((this.regs[26] & 0x3f) << 3) - (this.regs[27] & 0x07) & ~(~this.hScroll512() << 8);
  }

  private hScroll512(): number {
    return (this.regs[25] & (this.regs[2] >> 5) & 0x01);
  }

  private vScroll(): number {
    return this.regs[23];
  }
  
  private updateScreenMode(): number {
    let screenMode = 0;

    switch (((this.regs[0] & 0x0e) >> 1) | (this.regs[1] & 0x18)) {
      case 0x10: screenMode = 0; break;
      case 0x00: screenMode = 1; break;
      case 0x01: screenMode = 2; break;
      case 0x08: screenMode = 3; break;
      case 0x02: screenMode = 4; break;
      case 0x03: screenMode = 5; break;
      case 0x04: screenMode = 6; break;
      case 0x05: screenMode = 7; break;
      case 0x07: screenMode = 8; break;
      case 0x12: screenMode = 13; break;
      case 0x11:  // Screen 0 + 2
        screenMode = 16;
        break;
      case 0x18: // Screen 0 + 3
      case 0x19: // Screen 0 + 2 + 3
        screenMode = 32;
        break;
      default: // Unknown screen mode
        screenMode = 64;
        break;
    }

    //console.log("Screen Mode: " + screenMode);

    switch (screenMode) {
      case 0: this.refreshLineCb = this.refreshLine0.bind(this); break;
      case 1: this.refreshLineCb = this.refreshLine1.bind(this); break;
      case 2: this.refreshLineCb = this.refreshLine2.bind(this); break;
      case 3: this.refreshLineCb = this.refreshLine3.bind(this); break;
      case 4: this.refreshLineCb = this.refreshLine4.bind(this); break;
      case 5: this.refreshLineCb = this.refreshLine5.bind(this); break;
      case 6: this.refreshLineCb = this.refreshLine6.bind(this); break;
      case 7:
        if (!this.isModeYjk()) {
          this.refreshLineCb = this.refreshLine7.bind(this);
          break;
        }
      case 8:
        this.refreshLineCb = this.refreshLine8.bind(this);
        if (this.isModeYjk()) {
          screenMode = this.isModeYae() ? 10 : 12;
        }
        break;
      case 16:
        screenMode = 0;
        if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
          this.refreshLineCb = this.refreshLine0plus.bind(this);
        }
        else {
          this.refreshLineCb = this.refreshLineBlank.bind(this);
        }
        break;
      case 32:
        screenMode = 0;
        if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
          this.refreshLineCb = this.refreshLine0mix.bind(this);
        }
        else {
          this.refreshLineCb = this.refreshLineBlank.bind(this);
        }
        break;
      case 13:
        this.refreshLineCb = this.refreshLineTx80.bind(this);
        screenMode = 13;
        break;
      default:
        screenMode = 1;
        this.refreshLineCb = this.refreshLineBlank.bind(this);
        break;
    }

    return screenMode;
  }

  private onScreenModeChange(): void {
    const time = this.screenModeChangeTimer.getTimeout();
    const scanLine = this.board.getTimeDelta(this.frameStartTime, time) / HPERIOD | 0;

    this.sync(time);

    const oldScreenMode = this.screenMode;

    this.screenMode = this.updateScreenMode();

    this.screenOn = (this.regs[1] & 0x40) != 0;

    this.v9938Cmd.setScreenMode(this.screenMode & 0x0f, (this.regs[25] & 0x40) != 0);

    if (oldScreenMode != this.screenMode) {
      this.scr0splitLine = (scanLine - this.firstLine) & ~7;
    }

    if (this.screenMode == 0 || this.screenMode == 13) {
      this.displayArea = 960;
      this.leftBorder = 102 + 92;
    }
    else {
      this.displayArea = 1024;
      this.leftBorder = 102 + 56;
    }

    const adjust = this.regs[18] & 0x0f;
    this.hAdjust = adjust > 7 ? 16 - adjust : -adjust;
    if (this.regs[25] & 0x08) {
      this.hAdjust += 4;
    }
    this.leftBorder += this.hAdjust;

    this.chrTabBase = (((this.regs[2] << 10) & ~((this.regs[25] & 1) << 15)) | ~(-1 << 10)) & this.vramMask;
    this.chrGenBase = ((this.regs[4] << 11) | ~(-1 << 11)) & this.vramMask;
    this.colTabBase = ((this.regs[10] << 14) | (this.regs[3] << 6) | ~(-1 << 6)) & this.vramMask;

    this.sprTabBase = ((this.regs[11] << 15) | (this.regs[5] << 7) | ~(-1 << 7)) & this.vramMask;
    this.sprGenBase = ((this.regs[6] << 11) | ~(-1 << 11)) & this.vramMask;
  }

  private writePaletteLatch(port: number, value: number): void {
    if (this.palKey) {
      const palEntry = this.regs[16];
      this.sync();

      this.paletteReg[palEntry] = 256 * (value & 0x07) | (this.vdpDataLatch & 0x77);
      this.updatePalette(palEntry, (this.vdpDataLatch >> 4 & 0x7) * 255 / 7 | 0,
        (value & 0x07) * 255 / 7 | 0,
        (this.vdpDataLatch & 0x07) * 255 / 7 | 0);

      this.regs[16] = (palEntry + 1) & 0x0f;
      this.palKey = 0;
    }
    else {
      this.vdpDataLatch = value;
      this.palKey = 1;
    }
  }

  private writeRegister(port: number, value: number): void {
    this.vdpDataLatch = value;
    const reg = this.regs[17];
    if ((reg & 0x3f) != 17) {
      this.updateRegisters(reg, value);
    }
    if (~reg & 0x80) {
      this.regs[17] = (reg + 1) & 0x3f;
    }
  }

  private videoGetColor(r: number, g: number, b: number): number {
    // Returns a 16 bit 565 RGB color.
    return (((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3));
  }

  private initPalette(): void {
    for (let y = 0; y < 32; y++) {
      this.yjkColor[y] = new Array<Uint16Array>(64);
      for (let J = 0; J < 64; J++) {
        this.yjkColor[y][J] = new Uint16Array(64);
        for (let K = 0; K < 64; K++) {
          let j = (J & 0x1f) - (J & 0x20);
          let k = (K & 0x1f) - (K & 0x20);
          let r = 255 * (y + j) / 31 | 0;
          let g = 255 * (y + k) / 31 | 0;
          let b = 255 * ((5 * y - 2 * j - k) >> 2) / 31 | 0;

          r = r > 255 ? 255 : r < 0 ? 0 : r | 0;
          g = g > 255 ? 255 : g < 0 ? 0 : g | 0;
          b = b > 255 ? 255 : b < 0 ? 0 : b | 0;
          this.yjkColor[y][J][K] = this.videoGetColor(r, g, b);
        }
      }
    }

    for (let i = 0; i < 256; i++) {
      this.paletteFixed[i] = this.videoGetColor(255 * ((i >> 2) & 7) / 7 | 0,
        255 * ((i >> 5) & 7) / 7 | 0,
        255 * ((i & 3) == 3 ? 7 : 2 * (i & 3)) / 7) | 0;
    }

    this.paletteSprite8[0] = this.videoGetColor(0 * 255 / 7 | 0, 0 * 255 / 7 | 0, 0 * 255 / 7 | 0);
    this.paletteSprite8[1] = this.videoGetColor(0 * 255 / 7 | 0, 0 * 255 / 7 | 0, 2 * 255 / 7 | 0);
    this.paletteSprite8[2] = this.videoGetColor(3 * 255 / 7 | 0, 0 * 255 / 7 | 0, 0 * 255 / 7 | 0);
    this.paletteSprite8[3] = this.videoGetColor(3 * 255 / 7 | 0, 0 * 255 / 7 | 0, 2 * 255 / 7 | 0);
    this.paletteSprite8[4] = this.videoGetColor(0 * 255 / 7 | 0, 3 * 255 / 7 | 0, 0 * 255 / 7 | 0);
    this.paletteSprite8[5] = this.videoGetColor(0 * 255 / 7 | 0, 3 * 255 / 7 | 0, 2 * 255 / 7 | 0);
    this.paletteSprite8[6] = this.videoGetColor(3 * 255 / 7 | 0, 3 * 255 / 7 | 0, 0 * 255 / 7 | 0);
    this.paletteSprite8[7] = this.videoGetColor(3 * 255 / 7 | 0, 3 * 255 / 7 | 0, 2 * 255 / 7 | 0);
    this.paletteSprite8[8] = this.videoGetColor(7 * 255 / 7 | 0, 4 * 255 / 7 | 0, 2 * 255 / 7 | 0);
    this.paletteSprite8[9] = this.videoGetColor(0 * 255 / 7 | 0, 0 * 255 / 7 | 0, 7 * 255 / 7 | 0);
    this.paletteSprite8[10] = this.videoGetColor(7 * 255 / 7 | 0, 0 * 255 / 7 | 0, 0 * 255 / 7 | 0);
    this.paletteSprite8[11] = this.videoGetColor(7 * 255 / 7 | 0, 0 * 255 / 7 | 0, 7 * 255 / 7 | 0);
    this.paletteSprite8[12] = this.videoGetColor(0 * 255 / 7 | 0, 7 * 255 / 7 | 0, 0 * 255 / 7 | 0);
    this.paletteSprite8[13] = this.videoGetColor(0 * 255 / 7 | 0, 7 * 255 / 7 | 0, 7 * 255 / 7 | 0);
    this.paletteSprite8[14] = this.videoGetColor(7 * 255 / 7 | 0, 7 * 255 / 7 | 0, 0 * 255 / 7 | 0);
    this.paletteSprite8[15] = this.videoGetColor(7 * 255 / 7 | 0, 7 * 255 / 7 | 0, 7 * 255 / 7 | 0);
  }

  private sync(time?: number): void {
    if (this.version == VdpVersion.V9938 || this.version == VdpVersion.V9958) {
      this.v9938Cmd.execute();
    }

    let frameTime = this.board.getTimeSince(this.frameStartTime);

    let scanLine = frameTime / HPERIOD | 0;
    let lineTime = frameTime % HPERIOD - (this.leftBorder - 20);

    if (this.curLine < scanLine) {
      if (this.lineOffset <= 32) {
        if (this.curLine >= this.displayOffest && this.curLine < this.displayOffest + SCREEN_HEIGHT) {
          this.refreshLineCb(this.curLine, this.lineOffset, 33);
        }
      }
      this.lineOffset = -1;
      this.curLine++;
      this.flipSpriteLine();
      this.frameOffset = (this.curLine - this.displayOffest) * this.getFrameBufferWidth();
      while (this.curLine < scanLine) {
        if (this.curLine >= this.displayOffest && this.curLine < this.displayOffest + SCREEN_HEIGHT) {
          this.refreshLineCb(this.curLine, -1, 33);
        }
        this.curLine++;
        this.flipSpriteLine();
        this.frameOffset = (this.curLine - this.displayOffest) * this.getFrameBufferWidth();
      }
    }

    if (this.lineOffset > 32 || lineTime < -1) {
      return;
    }

    let curLineOffset = (lineTime + 32 >> 5) - 1;
    if (curLineOffset > 33) {
      curLineOffset = 33;
    }

    if (this.lineOffset < curLineOffset) {
      if (this.curLine >= this.displayOffest && this.curLine < this.displayOffest + SCREEN_HEIGHT) {
        this.refreshLineCb(this.curLine, this.lineOffset, curLineOffset);
      }
      this.lineOffset = curLineOffset;
    }
  }

  private updateOutputMode(): void {
    const mode = (this.regs[9] >> 4) & 3;
    const transparency = (this.screenMode < 8 || this.screenMode > 12) && (this.regs[8] & 0x20) == 0;

    if (mode == 2 ||
      (!(this.regs[8] & 0x80) && (this.regs[8] & 0x10)) || (this.regs[0] & 0x40)) {
      if (this.screenMode >= 5 && this.screenMode <= 12) {
        //        videoManagerSetMode(vdp -> videoHandle, VIDEO_EXTERNAL, vdpDaDevice.videoModeMask);
      }
      else {
        //        videoManagerSetMode(vdp -> videoHandle, VIDEO_INTERNAL, vdpDaDevice.videoModeMask);
      }
    }
    else if (mode == 1 && transparency) {
      this.palette[0] = 0;
      //      this.palette[0] = videoGetTransparentColor();
      //      videoManagerSetMode(vdp -> videoHandle, VIDEO_MIX, vdpDaDevice.videoModeMask);
    }
    else {
      if (this.bgColor == 0 || !transparency) {
        this.palette[0] = this.palette0;
      }
      else {
        this.palette[0] = this.palette[this.bgColor];
      }
      //      videoManagerSetMode(vdp -> videoHandle, VIDEO_INTERNAL, vdpDaDevice.videoModeMask);
    }
  }

  private flipSpriteLine() {
    this.clearSpriteLine(this.spriteLines[this.spriteLineIndex]);
    this.spriteLine = this.spriteLines[this.spriteLineIndex ^= 1];
    this.spriteLineOffset = 32;
  }

  private clearSpriteLine(spriteLine: Uint8Array): void {
    for (let i = 0; i < 384; i++) {
      spriteLine[i] = 0;
    }
  }

  private updateSpritesLine(scanLine: number): void {
    const spriteLine = this.spriteLines[this.spriteLineIndex ^ 1];

    if (!this.screenOn || (this.status[2] & 0x40) || this.isSpritesOff()) {
      return;
    }

    const isColor0Solid = this.isColor0Solid();
    const isSprites16x16 = this.isSprites16x16();

    let attribOffset = this.sprTabBase & (~0 << 7);
    let size = this.isSprites16x16 ? 16 : 8;
    let scale = this.isSpritesBig() ? 1 : 0;
    let line = (scanLine - this.firstLine + this.vScroll()) & 0xff;

    let patternMask = this.isSprites16x16 ? 0xfc : 0xff;
    let visibleCnt = 0;
    let idx = 0;

    for (idx = 0; idx < 32; idx++ , attribOffset += 4) {
      if (this.vram[attribOffset] == 208) {
        break;
      }

      this.spriteCurrentLine[visibleCnt] = ((line - this.vram[attribOffset]) & 0xff) >> scale;
      if (this.spriteCurrentLine[visibleCnt] >= size) {
        continue;
      }

      if (visibleCnt == 4) {
        if ((this.status[0] & 0xc0) == 0) {
          this.status[0] = (this.status[0] & 0xe0) | 0x40 | idx;
        }
        break;
      }

      this.spriteAttribOffsets[visibleCnt++] = attribOffset;
    }

    if (visibleCnt == 0) {
      return;
    }

    if ((this.status[0] & 0xc0) == 0) {
      this.status[0] = (this.status[0] & 0xe0) | (idx < 32 ? idx : 31);
    }

    let collision = 0;
    for (let i = 0; i < 384; i++) {
      this.spriteCollision[i] = 0;
    }

    while (visibleCnt--) {
      const attribOffset = this.spriteAttribOffsets[visibleCnt];
      const color = this.vram[attribOffset + 3] & 0x0f;
      const patternOffset = (this.sprGenBase & (~0 << 11)) + ((this.vram[attribOffset + 2] & patternMask) << 3) +
        this.spriteCurrentLine[visibleCnt];

      let offset = (this.vram[attribOffset + 1] + 32 - ((this.vram[attribOffset + 3] >> 2) & 0x20));
      let pattern = this.vram[patternOffset] << 8;
      if (isSprites16x16) {
        pattern |= this.vram[patternOffset + 16];
      }
      while (pattern) {
        if (pattern >> 15 & 1) {
          spriteLine[offset] = color;
          collision |= this.spriteCollision[offset];
          this.spriteCollision[offset] = (offset - 32) >> 8 & 1 ^ 1;
          if (scale == 1) {
            spriteLine[offset + 1] = color;
            collision |= this.spriteCollision[offset];
            this.spriteCollision[offset] = (offset - 31) >> 8 & 1 ^ 1;
          }
        }
        offset += 1 + scale;
        pattern = (pattern << 1) & 0xffff;
      }

      if (collision && (this.status[0] & 0x20) == 0) {
        let xCol = 0;
        for (; xCol < 256 && this.spriteCollision[xCol + 32] == 0; xCol++);
        xCol += 12;
        const yCol = line + 8;
        this.status[0] |= 0x20;
        this.status[3] = xCol & 0xff;
        this.status[4] = xCol >> 8;
        this.status[5] = yCol & 0xff;
        this.status[6] = yCol >> 8;
      }
    }
  }

  private nonVisibleLine = 0;
  private ccColorMask = 0;
  private ccColorCheckMask = 0;

  invalidateSpriteLine(line: number): void {
    this.nonVisibleLine = line - this.firstLine;
  }

  private updateColorSpritesLine(scanLine: number): void {
    const spriteLine = this.spriteLines[this.spriteLineIndex ^ 1];

    scanLine -= this.firstLine;

    if (scanLine == -1) {
      this.nonVisibleLine = -1000;
      // This is an not 100% correct optimization. CC sprites should be shown only when
      // they collide with a non CC sprite. However very few games/demos uses this and
      // it is safe to disable the CC sprites if no non CC sprites are visible.
      this.ccColorMask = this.ccColorCheckMask;
      this.ccColorCheckMask = 0xf0;
    }

    if (scanLine == this.firstLine || this.nonVisibleLine == scanLine) {
      return;
    }

    if (!this.screenOn || (this.status[2] & 0x40) || this.isSpritesOff()) {
      return;
    }

    const solidColor = this.isColor0Solid() ? 1 : 0;
    const isSprites16x16 = this.isSprites16x16();
    let size = this.isSprites16x16 ? 16 : 8;
    let scale = this.isSpritesBig() ? 1 : 0;

    let attribOffset = this.sprTabBase & 0x1fe00;
    const patternMask = isSprites16x16 ? 0xfc : 0xff;
    let visibleCnt = 0;

    scanLine = (scanLine + this.vScroll()) & 0xff;

    let sprite = 0;
    // Find visible sprites on current scan line
    for (; sprite < 32; sprite++ , attribOffset += 4) {
      let spriteLine = this.mapVram(attribOffset);
      if (spriteLine == 216) {
        break;
      }

      spriteLine = ((scanLine - spriteLine) & 0xff) >> scale;
      if (spriteLine >= size) {
        continue;
      }

      if (visibleCnt == 8) {
        if ((this.status[0] & 0xc0) == 0) {
          this.status[0] = (this.status[0] & 0xe0) | 0x40 | sprite;
        }
        break;
      }

      const patternOffset = (this.sprGenBase & 0x1f800) + ((this.mapVram(attribOffset + 2) & patternMask) << 3) + spriteLine;
      let color = this.mapVram(this.sprTabBase & ((-1 << 10) | (sprite * 16 + spriteLine)));

      if (color & 0x40) {
        if (visibleCnt == 0) {
          continue;
        }

        color &= this.ccColorMask;
      }
      else if ((color & 0x0f) || solidColor) {
        this.ccColorCheckMask = 0xff;
      }

      this.spriteAttributes[visibleCnt++] =
        new SpriteAttribute(
          color,
          this.mapVram(attribOffset + 1) + 32 - ((color >> 2) & 0x20),
          this.mapVram(patternOffset) << 8 | (isSprites16x16 ? this.mapVram(patternOffset + 16) : 0)
        );
    }

    if (visibleCnt == 0) {
      return;
    }

    if ((this.status[0] & 0xc0) == 0) {
      this.status[0] = (this.status[0] & 0xe0) | (sprite < 32 ? sprite : 31);
    }

    let collision = 0;
    for (let i = 0; i < 384; i++) {
      this.spriteCollision[i] = 0;
    }

    // Draw the visible sprites
    for (let idx = visibleCnt; idx--;) {
      const attrib = this.spriteAttributes[idx];

      const color = this.screenMode == 6 ?
        ((attrib.color & 0x0c) << 2) | ((attrib.color & 0x03) << 1) | solidColor * 9 :
        ((attrib.color & 0x0f) << 1) | solidColor;

      if (color == 0) {
        continue;
      }

      let offset = attrib.offset;
      let pattern = attrib.pattern;

      while (pattern) {
        if (pattern >> 15 & 1) {
          spriteLine[offset] = color;
          if ((attrib.color & 0x60) == 0) {
            collision |= this.spriteCollision[offset];
            this.spriteCollision[offset] = (offset - 32) >> 8 & 1 ^ 1;
          }
          if (scale == 1) {
            spriteLine[offset + 1] = color;
            if ((attrib.color & 0x60) == 0) {
              collision |= this.spriteCollision[offset];
              this.spriteCollision[offset] = (offset - 31) >> 8 & 1 ^ 1;
            }
          }
        }
        offset += 1 + scale;
        pattern = (pattern << 1) & 0xffff;
      }

      if (collision && (this.status[0] & 0x20) == 0) {
        let xCol = 0;
        for (; xCol < 256 && this.spriteCollision[xCol + 32] == 0; xCol++);
        xCol += 12;
        const yCol = scanLine + 8;
        this.status[0] |= 0x20;
        this.status[3] = xCol & 0xff;
        this.status[4] = xCol >> 8;
        this.status[5] = yCol & 0xff;
        this.status[6] = yCol >> 8;
      }

      // Draw CC sprites
      for (let idx2 = idx + 1; idx2 < visibleCnt; idx2++) {
        const attrib = this.spriteAttributes[idx2];

        if (!(attrib.color & 0x40)) {
          break;
        }

        const color = this.screenMode == 6 ?
          ((attrib.color & 0x0c) << 2) | ((attrib.color & 0x03) << 1) | solidColor * 9 :
          ((attrib.color & 0x0f) << 1) | solidColor;

        let offset = attrib.offset;
        let pattern = attrib.pattern;

        while (pattern) {
          if (pattern >> 15 & 1) {
            spriteLine[offset] |= color;
            if (scale == 1) {
              spriteLine[offset + 1] |= color;
            }
          }
          offset += 1 + scale;
          pattern = (pattern << 1) & 0xffff;
        }
      }
    }
  }

  private refreshLeftBorder(color: number, borderExtra: number): void {
    for (let offset = BORDER_WIDTH + this.hAdjust + borderExtra; offset--;) {
      this.frameBuffer[this.frameOffset++] = color;
    }
  }

  private refreshRightBorder(color: number, borderExtra: number): void {
    for (let offset = BORDER_WIDTH - this.hAdjust + borderExtra; offset--;) {
      this.frameBuffer[this.frameOffset++] = color;
    }
  }

  private refreshLeftBorderWide(color: number, borderExtra: number): void {
    for (let offset = 2 * (BORDER_WIDTH + this.hAdjust + borderExtra); offset--;) {
      this.frameBuffer[this.frameOffset++] = color;
    }
  }

  private refreshRightBorderWide(color: number, borderExtra: number): void {
    for (let offset = 2 * (BORDER_WIDTH - this.hAdjust + borderExtra); offset--;) {
      this.frameBuffer[this.frameOffset++] = color;
    }
  }

  private refreshLeftBorder6(color1: number, color2: number): void {
    for (let offset = BORDER_WIDTH + this.hAdjust; offset--;) {
      this.frameBuffer[this.frameOffset++] = color1;
      this.frameBuffer[this.frameOffset++] = color2;
    }
  }

  private refreshRightBorder6(color1: number, color2: number): void {
    for (let offset = BORDER_WIDTH - this.hAdjust; offset--;) {
      this.frameBuffer[this.frameOffset++] = color1;
      this.frameBuffer[this.frameOffset++] = color2;
    }
  }

  private refreshLineBlank(scanLine: number, x: number, x2: number): void {
    let bgColor = this.palette[0];

    if (x == -1) {
      this.refreshLeftBorder(bgColor, 0);
      x++;
    }

    const rightBorder = x2 > 32;
    rightBorder && x2--;

    while (x < x2) {
      this.frameBuffer[this.frameOffset++] = bgColor;
      this.frameBuffer[this.frameOffset++] = bgColor;
      this.frameBuffer[this.frameOffset++] = bgColor;
      this.frameBuffer[this.frameOffset++] = bgColor;
      this.frameBuffer[this.frameOffset++] = bgColor;
      this.frameBuffer[this.frameOffset++] = bgColor;
      this.frameBuffer[this.frameOffset++] = bgColor;
      this.frameBuffer[this.frameOffset++] = bgColor;
      x++;
    }

    if (rightBorder) {
      this.refreshRightBorder(bgColor, 0);
    }
  }

  private refreshLineTx80(scanLine: number, x: number, x2: number): void {
    const bgColor = this.palette[this.bgColor];
    const fgColor = this.palette[this.fgColor];
    const xbgColor = this.palette[this.xbgColor];
    const xfgColor = this.palette[this.xfgColor];

    if (x == -1) {
      this.lineHScroll = this.hScroll() % 6;
      this.lineVScroll = this.vScroll();

      this.refreshLeftBorderWide(bgColor, this.hAdjustSc0);
      x++;

      for (let i = 0; i < this.lineHScroll; i++) {
        this.frameBuffer[this.frameOffset++] = bgColor;
      }

      let y = scanLine - this.firstLine + this.lineVScroll;
      this.renderCharOffset = 80 * (y >> 3);
      this.renderShift = 0;
      this.renderPattern = 0;
      this.renderColors = [bgColor, fgColor];
    }

    const y = scanLine - this.firstLine + this.lineVScroll;

    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 16; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const colors = [bgColor, this.palette[this.fgColor]];
      const patternBase = this.chrGenBase & ((~0 << 11) | (y & 7));

      while (x < x2) {
        if (x == 0 || x == 31) {
          for (let count = x == 0 ? 8 : 8 + this.lineHScroll; count--;) {
            this.frameBuffer[this.frameOffset++] = bgColor;
            this.frameBuffer[this.frameOffset++] = bgColor;
          }
          x++;
        }
        else {
          for (let j = 0; j < 8; j++) {
            if (this.renderShift <= 2) {
              const charTableOffset = this.chrTabBase & ((~0 << 12) | this.renderCharOffset);
              this.renderPattern = this.vram[patternBase | this.vram[charTableOffset] * 8];

              const colPattern = this.vram[this.colTabBase & ((~0 << 9) | (this.renderCharOffset >> 3))];
              if ((colPattern << (this.renderCharOffset & 7)) & 0x80) {
                this.renderColors = [xbgColor, xfgColor];
              }
              else {
                this.renderColors = [bgColor, fgColor];
              }

              this.renderCharOffset++;
              this.renderShift = 8;
            }

            this.frameBuffer[this.frameOffset++] = this.renderColors[(this.renderPattern >> --this.renderShift) & 1];
            this.frameBuffer[this.frameOffset++] = this.renderColors[(this.renderPattern >> --this.renderShift) & 1];
          }
          x++;
        }
      }
    }

    if (rightBorder) {
      this.refreshRightBorderWide(bgColor, -this.hAdjustSc0);
    }
  }

  private refreshLine0(scanLine: number, x: number, x2: number): void {
    const bgColor = this.palette[this.bgColor];

    if (x == -1) {
      this.refreshLeftBorder(bgColor, this.hAdjustSc0);

      this.lineHScroll = this.hScroll() % 6;
      this.lineVScroll = this.vScroll();

      x++;

      for (let i = 0; i < this.lineHScroll; i++) {
        this.frameBuffer[this.frameOffset++] = bgColor;
      }

      let y = scanLine - this.firstLine + this.lineVScroll;
      this.renderCharOffset = 0xc00 | 40 * (y >> 3);
      this.renderShift = 0;
      this.renderPattern = 0;
    }

    const y = scanLine - this.firstLine + this.lineVScroll;

    const patternBase = this.chrGenBase & ((~0 << 11) | (y & 7));

    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const colors = [bgColor, this.palette[this.fgColor]];
      const patternBase = this.chrGenBase & ((~0 << 11) | (y & 7));

      while (x < x2) {
        if (x == 0 || x == 31) {
          for (let count = x == 0 ? 8 : 8 + this.lineHScroll; count--;) {
            this.frameBuffer[this.frameOffset++] = bgColor;
          }
          x++;
        }
        else {
          for (let j = 0; j < 4; j++) {
            if (this.renderShift <= 2) {
              const charTableOffset = this.chrTabBase & ((~0 << 12) | this.renderCharOffset++);
              this.renderPattern = this.vram[patternBase | this.vram[charTableOffset] * 8];
              this.renderShift = 8;
            }

            this.frameBuffer[this.frameOffset++] = colors[(this.renderPattern >> --this.renderShift) & 1];
            this.frameBuffer[this.frameOffset++] = colors[(this.renderPattern >> --this.renderShift) & 1];
          }
          x++;
        }
      }
    }

    if (rightBorder) {
      this.refreshRightBorder(bgColor, -this.hAdjustSc0);
    }
  }

  private refreshLine0plus(scanLine: number, x: number, x2: number): void {
  }

  private refreshLine0mix(scanLine: number, x: number, x2: number): void {
  }

  private refreshLine1(scanLine: number, x: number, x2: number): void {
    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.refreshLeftBorder(bgColor, 0);

      this.lineHScroll = this.hScroll() & 7;
      this.lineVScroll = this.vScroll();
      this.scrollIndex = this.lineHScroll >> 3;
    }

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();
      const charTableBase2 = this.chrTabBase & ((~0 << 10) | (32 * (y >> 3)));
      let charTableOffset = (charTableBase2 | (this.scrollIndex & 0x1f));
      const patternBase = this.chrGenBase & ((~0 << 11) | (y & 7));

      // Handle horizontal scroll and set up for edge mask
      let maskOffset = 0;
      if (x2 > 0 && x < 1) {
        if (this.isEdgeMasked()) maskOffset = this.frameOffset;
        for (let count = -this.lineHScroll & 7; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
          this.spriteLineOffset++;
        }
        if (this.lineHScroll & 7) {
          charTableOffset = (charTableBase2 | (++this.scrollIndex & 0x1f));
        }
      }

      while (x < x2) {
        const charValue = this.vram[charTableOffset];
        const colPattern = this.vram[this.colTabBase & ((charValue >> 3) | (~0 << 6))];
        const colors = [this.palette[colPattern & 0x0f], this.palette[colPattern >> 4]];
        const charPattern = this.vram[patternBase | charValue * 8];

        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 7) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 6) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 5) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 4) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 3) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 2) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 1) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 0) & 1]; }
        charTableOffset = (charTableBase2 | (++this.scrollIndex & 0x1f));
        x++;
      }

      if (maskOffset) {
        for (let count = 8; count--;) {
          this.frameBuffer[maskOffset++] = bgColor;
        }
      }
    }

    if (rightBorder) {
      if (this.screenOn && this.isDrawArea && this.isEdgeMasked()) this.frameOffset -= -this.lineHScroll & 7;
      this.refreshRightBorder(bgColor, 0);
      this.updateSpritesLine(scanLine);
    }
  }

  private refreshLine2(scanLine: number, x: number, x2: number): void {
    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.refreshLeftBorder(bgColor, 0);

      this.lineHScroll = this.hScroll();
      this.lineVScroll = this.vScroll();
      this.scrollIndex = this.lineHScroll >> 3;
    }

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();
      const charTableBase = (~0 << 13) | ((y & 0xc0) << 5) | (y & 7);
      const charTableBase2 = this.chrTabBase & ((~0 << 10) | (32 * (y >> 3)));
      let charTableOffset = (charTableBase2 | (this.scrollIndex & 0x1f));

      // Handle horizontal scroll and set up for edge mask
      let maskOffset = 0;
      if (x2 > 0 && x < 1) {
        if (this.isEdgeMasked()) maskOffset = this.frameOffset;
        for (let count = -this.lineHScroll & 7; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
          this.spriteLineOffset++;
        }
        if (this.lineHScroll & 7) {
          charTableOffset = (charTableBase2 | (++this.scrollIndex & 0x1f));
        }
      }

      while (x < x2) {
        const index = charTableBase | this.vram[charTableOffset] * 8;
        const colPattern = this.vram[this.colTabBase & index];
        const colors = [this.palette[colPattern & 0x0f], this.palette[colPattern >> 4]];
        const charPattern = this.vram[this.chrGenBase & index];

        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 7) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 6) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 5) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 4) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 3) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 2) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 1) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 0) & 1]; }
        charTableOffset = (charTableBase2 | (++this.scrollIndex & 0x1f));
        x++;
      }

      if (maskOffset) {
        for (let count = 8; count--;) {
          this.frameBuffer[maskOffset++] = bgColor;
        }
      }
    }

    if (rightBorder) {
      if (this.screenOn && this.isDrawArea && this.isEdgeMasked()) this.frameOffset -= -this.lineHScroll & 7;
      this.refreshRightBorder(bgColor, 0);
      this.updateSpritesLine(scanLine);
    }
  }

  private refreshLine3(scanLine: number, x: number, x2: number): void {
    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.lineHScroll = this.hScroll();
      const extraBorder = -this.lineHScroll & 7;
      this.refreshLeftBorder(bgColor, extraBorder);
      this.spriteLineOffset += extraBorder;

      this.scrollIndex = this.lineHScroll + 7 & ~7;
    }

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();

      let charTableBase = (this.chrTabBase & ((~0 << 10) | (32 * (y >> 3))));
      let patternBase = this.chrGenBase & ((~0 << 11) | ((y >> 2) & 7));

      let maskCount = (x2 > 0 && x < 1) && this.isEdgeMasked() ? (this.lineHScroll & 7) || 8 : 0;

      while (x < x2) {
        let charTableOffset = (charTableBase | (this.scrollIndex & 0x1f));
        this.scrollIndex++;

        const colPattern = this.vram[patternBase | (this.vram[charTableOffset] * 8)];
        const fc = this.palette[colPattern >> 4];
        const bc = this.palette[colPattern & 0x0f];

        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : fc; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : fc; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : fc; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : fc; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : bc; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : bc; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : bc; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : bc; }
        x++;
      }
    }

    if (rightBorder) {
      this.frameOffset -= -this.lineHScroll & 7;
      this.refreshRightBorder(bgColor, 0);
      this.updateSpritesLine(scanLine);
    }
  }

  private lineHScroll512 = 0;

  private refreshLine4(scanLine: number, x: number, x2: number): void {
    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.refreshLeftBorder(bgColor, 0);

      this.lineHScroll = this.hScroll();
      this.scrollIndex = this.lineHScroll >> 3;
      this.lineHScroll512 = this.hScroll512() << 15;
    }

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();
      const charTableBase = (~0 << 13) | ((y & 0xc0) << 5) | (y & 7);
      const charTableBase2 = this.chrTabBase & ((~0 << 10) | (32 * (y >> 3)));
      let charTableOffset = (charTableBase2 | (this.scrollIndex & 0x1f)) ^ (this.lineHScroll512 & (this.scrollIndex << 10));
      
      // Handle horizontal scroll and set up for edge mask
      let maskOffset = 0;
      if (x2 > 0 && x < 1) {
        if (this.isEdgeMasked()) maskOffset = this.frameOffset;
        for (let count = -this.lineHScroll & 7; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
          this.spriteLineOffset++;
        }
        if (this.lineHScroll & 7) {
          charTableOffset = (charTableBase2 | (++this.scrollIndex & 0x1f)) ^ (this.lineHScroll512 & (this.scrollIndex << 10));
        }
      }

      while (x < x2) {
        const index = charTableBase | this.vram[charTableOffset] * 8;
        const colPattern = this.vram[this.colTabBase & index];
        const colors = [this.palette[colPattern & 0x0f], this.palette[colPattern >> 4]];
        const charPattern = this.vram[this.chrGenBase & index];

        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 7) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 6) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 5) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 4) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 3) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 2) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 1) & 1]; }
        { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col >> 1] : colors[(charPattern >> 0) & 1]; }
        charTableOffset = (charTableBase2 | (++this.scrollIndex & 0x1f)) ^ (this.lineHScroll512 & (this.scrollIndex << 10));
        x++;
      }

      if (maskOffset) {
        for (let count = 8; count--;) {
          this.frameBuffer[maskOffset++] = bgColor;
        }
      }
    }

    if (rightBorder) {
      if (this.screenOn && this.isDrawArea && this.isEdgeMasked()) this.frameOffset -= -this.lineHScroll & 7;
      this.refreshRightBorder(bgColor, 0);
      this.updateColorSpritesLine(scanLine);
    }
  }

  private refreshLine5(scanLine: number, x: number, x2: number): void {
    if (x < 24 && x2 >= 24) {
      this.updateColorSpritesLine(scanLine);
    }

    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.lineHScroll = this.hScroll();
      const extraBorder = -this.lineHScroll & 7;
      this.refreshLeftBorder(bgColor, extraBorder);
      this.spriteLineOffset += extraBorder;

      this.lineHScroll512 = this.hScroll512() << 15;
      this.scrollIndex = this.lineHScroll + 7 & ~7;
    }

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();
      const oddPage = ((~this.status[2] & 0x02) << 7) & ((this.regs[9] & 0x04) << 6);
      const charTableBase = (this.chrTabBase & (~oddPage << 7) & ((~0 << 15) | (y << 7)));
      let maskCount = (x2 > 0 && x < 1) && this.isEdgeMasked() ? (this.lineHScroll & 7) || 8 : 0;

      while (x < x2) {
        for (let i = 0; i < 8; i++) {
          let charTableOffset = (charTableBase | ((this.scrollIndex >> 1) & 0x7f)) ^ (this.lineHScroll512 & (this.scrollIndex << 7));
          this.scrollIndex++;
          let nibble = this.scrollIndex & 1;
          let col = this.spriteLine[this.spriteLineOffset];
          col = this.palette[col ? col >> 1 : this.vram[charTableOffset] >> 4 * nibble & 0x0f];
          this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
          this.spriteLineOffset++;
        }
        x++;
      }
    }

    if (rightBorder) {
      this.frameOffset -= -this.lineHScroll & 7;
      this.refreshRightBorder(bgColor, 0);
    }
  }

  private refreshLine6(scanLine: number, x: number, x2: number): void {
    if (x < 24 && x2 >= 24) {
      this.updateColorSpritesLine(scanLine);
    }

    const bgColor1 = this.palette[this.bgColor >> 2 & 3];
    const bgColor2 = this.palette[this.bgColor & 3];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.lineHScroll = this.hScroll();
      this.lineHScroll512 = this.hScroll512() <<  15;
      this.scrollIndex = this.lineHScroll;

      this.refreshLeftBorder6(bgColor1, bgColor2);

      const y = scanLine - this.firstLine + this.vScroll();
    }
    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor1;
          this.frameBuffer[this.frameOffset++] = bgColor2;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();
      const oddPage = ((~this.status[2] & 0x02) << 7) & ((this.regs[9] & 0x04) << 6);
      const charTableBase = (this.chrTabBase & (~oddPage << 7) & ((~0 << 15) | (y << 7)));
      let charTableOffset = (charTableBase | ((this.scrollIndex >> 1) & 0x7f)) ^ (this.lineHScroll512 & (this.scrollIndex << 7));
      let edgeMaskCount = (x2 > 0 && x < 1) ? this.isEdgeMasked() ? 8 : this.lineHScroll & 7 : 0;

      while (x < x2) {
        for (let i = 0; i < 8; i++) {
          const col1 = edgeMaskCount-- > 0 ? (this.bgColor >> 1) & 6 :this.spriteLine[this.spriteLineOffset] >> 3;
          this.frameBuffer[this.frameOffset++] = this.palette[col1 ? col1 >> 1 : this.vram[charTableOffset] >> (6 - 4 * (this.scrollIndex & 1)) & 3];
          const col2 = edgeMaskCount-- > 0 ? (this.bgColor << 1) & 6 : this.spriteLine[this.spriteLineOffset] >> 3; this.spriteLineOffset++;
          this.frameBuffer[this.frameOffset++] = this.palette[col2 ? col2 >> 1 : this.vram[charTableOffset] >> (4 - 4 * (this.scrollIndex & 1)) & 3];
          charTableOffset = (charTableBase | ((++this.scrollIndex >> 1) & 0x7f)) ^ (this.lineHScroll512 & (this.scrollIndex << 7));
        }
        x++;
      }
    }

    if (rightBorder) {
      if (this.screenOn && this.isDrawArea && this.isEdgeMasked()) this.frameOffset -= 2 * (-this.lineHScroll & 7);
      this.refreshRightBorder6(bgColor1, bgColor2);
    }
  }

  private refreshLine7(scanLine: number, x: number, x2: number): void {
    if (x < 24 && x2 >= 24) {
      this.updateColorSpritesLine(scanLine);
    }

    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.refreshLeftBorder6(bgColor, bgColor);

      this.lineHScroll = this.hScroll();
      this.lineHScroll512 = this.hScroll512() << 15;
      this.scrollIndex = this.lineHScroll;
    }

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 16; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();
      const oddPage = ((~this.status[2] & 0x02) << 7) & ((this.regs[9] & 0x04) << 6);
      const charTableBase = (this.chrTabBase & (~oddPage << 7) & ((~0 << 15) | (y << 7)));
      let edgeMaskCount = (x2 > 0 && x < 1) ? this.isEdgeMasked() ? 8 : this.lineHScroll & 7 : 0;

      while (x < x2) {
        for (let i = 0; i < 8; i++) {
          const charTableOffset = (charTableBase | ((this.scrollIndex >> 1) & 0x7f)) ^ (this.lineHScroll512 & (this.scrollIndex << 7));
          let col = edgeMaskCount-- > 0 ? this.bgColor << 1 : this.spriteLine[this.spriteLineOffset]; this.spriteLineOffset++;
          col ?
            (this.frameBuffer[this.frameOffset++] = col = this.palette[col >> 1],
              this.frameBuffer[this.frameOffset++] = col):
            (col = this.vram[charTableOffset + (this.scrollIndex & 1) * this.vram128],
              this.frameBuffer[this.frameOffset++] = this.palette[col >> 4],
              this.frameBuffer[this.frameOffset++] = this.palette[col & 0x0f]);
          this.scrollIndex++;
        }
        x++;
      }
    }

    if (rightBorder) {
      if (this.screenOn && this.isDrawArea && this.isEdgeMasked()) this.frameOffset -= 2 * (-this.lineHScroll & 7);
      this.refreshRightBorder6(bgColor, bgColor);
    }
  }

  private refreshLine8(scanLine: number, x: number, x2: number): void {
    const yjkMode = this.isModeYjk();
    const attribMask = this.isModeYae() ? 8 : 0;

    if (x < 24 && x2 >= 24) {
      this.updateColorSpritesLine(scanLine);
    }

    const bgColor = this.paletteFixed[this.regs[7]];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.lineHScroll = this.hScroll();
      const extraBorder = -this.lineHScroll & 7;
      this.refreshLeftBorder(bgColor, extraBorder);
      this.spriteLineOffset += extraBorder;

      this.lineHScroll512 = this.hScroll512() << 15;
      this.scrollIndex = this.lineHScroll + 7 & ~7;
    }

    if (!this.screenOn || !this.isDrawArea) {
      while (x < x2) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
      }
    }
    else {
      const y = scanLine - this.firstLine + this.vScroll();
      const oddPage = ((~this.status[2] & 0x02) << 7) & ((this.regs[9] & 0x04) << 6);
      const charTableBase = (this.chrTabBase & (~oddPage << 7) & ((~0 << 15) | (y << 7)));
      let maskCount = (x2 > 0 && x < 1) && this.isEdgeMasked() ? (this.lineHScroll & 7) || 8 : 0;
      let col = 0;

      while (x < x2) {
        for (let i = 0; i < 2; i++) {
          let charTableOffset = (charTableBase | ((this.scrollIndex >> 1) & 0x7f)) ^ (this.lineHScroll512 & (this.scrollIndex << 7));
          let t0 = this.vram[charTableOffset];
          let t1 = this.vram[charTableOffset + this.vram128];
          this.scrollIndex += 2;
          charTableOffset = (charTableBase | ((this.scrollIndex >> 1) & 0x7f)) ^ (this.lineHScroll512 & (this.scrollIndex << 7));
          let t2 = this.vram[charTableOffset];
          let t3 = this.vram[charTableOffset + this.vram128];
          this.scrollIndex += 2;

          if (yjkMode) {
            const k = (t0 & 0x07) | ((t1 & 0x07) << 3);
            const j = (t2 & 0x07) | ((t3 & 0x07) << 3);
            
            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : t0 & attribMask ? this.palette[t0 >> 4] : this.yjkColor[t0 >> 3][j][k];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;

            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : t1 & attribMask ? this.palette[t1 >> 4] : this.yjkColor[t1 >> 3][j][k];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;

            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : t2 & attribMask ? this.palette[t2 >> 4] : this.yjkColor[t2 >> 3][j][k];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;

            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : t3 & attribMask ? this.palette[t3 >> 4] : this.yjkColor[t3 >> 3][j][k];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;
          }
          else {
            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : this.paletteFixed[t0];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;

            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : this.paletteFixed[t1];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;

            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : this.paletteFixed[t2];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;

            col = this.spriteLine[this.spriteLineOffset];
            col = col ? this.palette[col >> 1] : this.paletteFixed[t3];
            this.frameBuffer[this.frameOffset++] = maskCount-- > 0 ? bgColor : col;
            this.spriteLineOffset++;
          }
        }
        x++;
      }
    }

    if (rightBorder) {
      this.frameOffset -= -this.lineHScroll & 7;
      this.refreshRightBorder(bgColor, 0);
    }
  }

  public getFrameBuffer(): Uint16Array {
    return this.frameBuffers[this.frameBufferWriteIndex ^ 1];;
  }

  public getFrameBufferWidth(): number {
    return this.screenMode == 6 || this.screenMode == 7 || this.screenMode == 13 ? 2 * SCREEN_WIDTH : SCREEN_WIDTH;
  }

  public getFrameBufferHeight(): number {
    return SCREEN_HEIGHT;
  }

  public getState(): any {
    const state: any = {};

    state.vramOffset = this.vramOffset;
    state.vramMask = this.vramMask;
    state.palMask = this.palMask;
    state.palValue = this.palValue;

    state.vdpKey = this.vdpKey;
    state.vdpData = this.vdpData
    state.vdpDataLatch = this.vdpDataLatch;
    state.vramAddress = this.vramAddress;
    state.screenMode = this.screenMode;
    state.regs = SaveState.getArrayState(this.regs);
    state.status = SaveState.getArrayState(this.status);
    state.paletteReg = SaveState.getArrayState(this.paletteReg);

    state.scanLineCount = this.scanLineCount;
    state.frameStartTime = this.frameStartTime;
    state.hIntTime = this.hIntTime;
    state.isDrawArea = this.isDrawArea;
    state.firstLine = this.firstLine;
    state.curLine = this.curLine;
    state.scr0splitLine = this.scr0splitLine;
    state.lineOffset = this.lineOffset;
    state.displayOffest = this.displayOffest;
    state.vAdjust = this.vAdjust;
    state.hAdjust = this.hAdjust;
    state.leftBorder = this.leftBorder;
    state.displayArea = this.displayArea;
    state.screenOn = this.screenOn;

    state.fgColor = this.fgColor;
    state.bgColor = this.bgColor;
    state.xfgColor = this.xfgColor;
    state.xbgColor = this.xbgColor;
    state.blinkFlag = this.blinkFlag;
    state.blinkCnt = this.blinkCnt;
    state.vramEnable = this.vramEnable;
    state.palKey = this.palKey;
    state.vramPage = this.vramPage;
    state.vramAccMask = this.vramAccMask;

    // Vram table offsets
    state.chrTabBase = this.chrTabBase;
    state.chrGenBase = this.chrGenBase;
    state.colTabBase = this.colTabBase;
    state.sprTabBase = this.sprTabBase;
    state.sprGenBase = this.sprGenBase;

    // Palettes
    state.palette0 = this.palette0;
    state.palette = SaveState.getArrayState(this.palette);

    // Video RAM
    state.vram = SaveState.getArrayState(this.vram);

    // Timers
    state.frameTimer = this.frameTimer.getState();
    state.vIntTimer = this.vIntTimer.getState();
    state.hIntTimer = this.hIntTimer.getState();
    state.vStartTimer = this.vStartTimer.getState();
    state.screenModeChangeTimer = this.screenModeChangeTimer.getState();
    state.drawAreaStartTimer = this.drawAreaStartTimer.getState();
    state.drawAreaEndTimer = this.drawAreaEndTimer.getState();

    state.v9938Cmd = this.v9938Cmd.getState();

    return state;
  }

  public setState(state: any): void {
    this.vramOffset = state.vramOffset;
    this.vramMask = state.vramMask;
    this.palMask = state.palMask;
    this.palValue = state.palValue;

    this.vdpKey = state.vdpKey;
    this.vdpData = state.vdpData
    this.vdpDataLatch = state.vdpDataLatch;
    this.vramAddress = state.vramAddress;
    this.screenMode = state.screenMode;
    SaveState.setArrayState(this.regs, state.regs);
    SaveState.setArrayState(this.status, state.status);
    SaveState.setArrayState(this.paletteReg, state.paletteReg);

    this.scanLineCount = state.scanLineCount;
    this.frameStartTime = state.frameStartTime;
    this.hIntTime = state.hIntTime;
    this.isDrawArea = state.isDrawArea;
    this.firstLine = state.firstLine;
    this.curLine = state.curLine;
    this.scr0splitLine = state.scr0splitLine;
    this.lineOffset = state.lineOffset;
    this.displayOffest = state.displayOffest;
    this.vAdjust = state.vAdjust;
    this.hAdjust = state.hAdjust;
    this.leftBorder = state.leftBorder;
    this.displayArea = state.displayArea;
    this.screenOn = state.screenOn;

    this.fgColor = state.fgColor;
    this.bgColor = state.bgColor;
    this.xfgColor = state.xfgColor;
    this.xbgColor = state.xbgColor;
    this.blinkFlag = state.blinkFlag;
    this.blinkCnt = state.blinkCnt;
    this.vramEnable = state.vramEnable;
    this.palKey = state.palKey;
    this.vramPage = state.vramPage;
    this.vramAccMask = state.vramAccMask;

    // Vram table offsets
    this.chrTabBase = state.chrTabBase;
    this.chrGenBase = state.chrGenBase;
    this.colTabBase = state.colTabBase;
    this.sprTabBase = state.sprTabBase;
    this.sprGenBase = state.sprGenBase;

    // Palettes
    state.palette0 = state.palette0;
    SaveState.setArrayState(this.palette, state.palette);

    // Video RAM
    SaveState.setArrayState(this.vram, state.vram);

    // Timers
    this.frameTimer.setState(state.frameTimer);
    this.vIntTimer.setState(state.vIntTimer);
    this.hIntTimer.setState(state.hIntTimer);
    this.vStartTimer.setState(state.vStartTimer);
    this.screenModeChangeTimer.setState(state.screenModeChangeTimer);
    this.drawAreaStartTimer.setState(state.drawAreaStartTimer);
    this.drawAreaEndTimer.setState(state.drawAreaEndTimer);

    this.v9938Cmd.setState(state.v9938Cmd);

    this.updateScreenMode();
  }


  private v9938Cmd: V9938Cmd;

  // Configuration
  private enable = true;
  private offsets = new Array<number>(2);
  private vramMasks = new Array<number>(4);
  private registerValueMask = [0];
  private registerMask = 0;
  private hAdjustSc0 = 0;
  private vramSize = 0;
  private vram192 = false;
  private vram16 = false;
  private vram128 = 0;

  // Static tables
  private paletteFixed = new Uint16Array(256);
  private paletteSprite8 = new Uint16Array(16);
  private yjkColor = new Array<Array<Uint16Array>>(32);

  // State variables
  private vramOffset = 0;
  private vramMask = 0;
  private palMask = 0;
  private palValue = 0;

  private vdpKey = 0;
  private vdpData = 0
  private vdpDataLatch = 0;
  private vramAddress = 0;
  private screenMode = 1;
  private regs = new Uint8Array(64);
  private status = new Uint8Array(16);
  private paletteReg = new Uint16Array(16);

  private scanLineCount = 0;
  private frameStartTime = 0;
  private hIntTime = 0;
  private isDrawArea = false;
  private firstLine = 0;
  private curLine = 0;
  private scr0splitLine = 0;
  private lineOffset = 0;
  private displayOffest = 0;
  private vAdjust = 0;
  private hAdjust = 0;
  private leftBorder = 0;
  private displayArea = 0;
  private screenOn = false;

  private fgColor = 0;
  private bgColor = 0;
  private xfgColor = 0;
  private xbgColor = 0;
  private blinkFlag = false;
  private blinkCnt = 0;
  private vramEnable = true;
  private palKey = 0;
  private vramPage = 0;
  private vramAccMask = 0;

  // Vram table offsets
  private chrTabBase = 0;
  private chrGenBase = 0;
  private colTabBase = 0;
  private sprTabBase = 0;
  private sprGenBase = 0;

  // Palettes
  private palette0 = 0;
  private palette = new Uint16Array(16);

  // Video RAM
  private vram: Uint8Array;

  // Timers
  private frameTimer: Timer;
  private vIntTimer: Timer;
  private hIntTimer: Timer;
  private vStartTimer: Timer;
  private screenModeChangeTimer: Timer;
  private drawAreaStartTimer: Timer;
  private drawAreaEndTimer: Timer;

  // Sprites temp variables (probably should be saved in save state)
  private spriteLineIndex = 0;
  private spriteLines = [new Uint8Array(384), new Uint8Array(384)];
  private spriteLine = this.spriteLines[0];
  private spriteCollision = new Uint8Array(384);
  private spriteCurrentLine = new Array<number>(33);
  private spriteAttribOffsets = new Array<number>(33);
  private spriteAttributes = new Array<SpriteAttribute>(33);
  private spriteLineOffset = 0;

  // Rendering temp variables
  private renderShift = 0;
  private renderPattern = 0;
  private renderCharOffset = 0;
  private renderColors = [0, 0];
  private lineHScroll = 0;
  private lineVScroll = 0;
  private scrollIndex = 0;

  private refreshLineCb: (y: number, x: number, x2: number) => void;

  // Frame buffers
  private frameOffset = 0;
  private frameBuffer = new Uint16Array(0);
  private frameBufferWriteIndex = 0;
  private frameBuffers = [
    new Uint16Array(2 * SCREEN_WIDTH * SCREEN_HEIGHT),
    new Uint16Array(2 * SCREEN_WIDTH * SCREEN_HEIGHT)];
}
