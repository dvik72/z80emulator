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

import { Board, InterruptVector } from '../core/board';
import { Timer } from '../core/timeoutmanager';
import { Port } from '../core/iomanager';


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
  [ 0, 0, 0 ],
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
  [ 0x00, 0x00, 0x00 ],
  [ 0x00, 0x00, 0x00 ],
  [ 0x24, 0xda, 0x24 ],
  [ 0x68, 0xff, 0x68 ],
  [ 0x24, 0x24, 0xff ],
  [ 0x48, 0x68, 0xff ],
  [ 0xb6, 0x24, 0x24 ],
  [ 0x48, 0xda, 0xff ],
  [ 0xff, 0x24, 0x24 ],
  [ 0xff, 0x68, 0x68 ],
  [ 0xda, 0xda, 0x24 ],
  [ 0xda, 0xda, 0x91 ],
  [ 0x24, 0x91, 0x24 ],
  [ 0xda, 0x48, 0xb6 ],
  [ 0xb6, 0xb6, 0xb6 ],
  [ 0xff, 0xff, 0xff ]
];

const DEFAULT_PALETTE_REGS = [
  0x0000, 0x0000, 0x0611, 0x0733, 0x0117, 0x0327, 0x0151, 0x0627,
  0x0171, 0x0373, 0x0661, 0x0664, 0x0411, 0x0265, 0x0555, 0x0777
];

const JUMP_TABLE = [-128, -128, -0x8080, 0x7f80];
const JUMP_TABLE4 = [- 32, -32, -0x8020, 0x7fe0];


export class Vdp {
  constructor(
    private board: Board,
    private version: VdpVersion,
    private syncMode: VdpSyncMode,
    private connectorType: VdpConnectorType,
    private vramPages: number
  ) {
    this.refreshLineCb = this.refreshLineBlank.bind(this); 

    this.initPalette();

    this.onFrameChange = this.onFrameChange.bind(this);
    this.frameTimer = board.getTimeoutManager().createTimer('Frame Change', this.onFrameChange);

    this.onScreenModeChange = this.onScreenModeChange.bind(this);
    this.screenModeChangeTimer = board.getTimeoutManager().createTimer('Screen Mode Change', this.onScreenModeChange);

    this.onVStart = this.onVStart.bind(this);
    this.vStartTimer = board.getTimeoutManager().createTimer('VStart', this.onVStart);

    this.onVInt = this.onVInt.bind(this);
    this.vIntTimer = board.getTimeoutManager().createTimer('VInt', this.onVInt);

    this.onHInt = this.onHInt.bind(this);
    this.hIntTimer = board.getTimeoutManager().createTimer('hInt', this.onHInt);

    this.onDrawAreaStart = this.onDrawAreaStart.bind(this);
    this.drawAreaStartTimer = board.getTimeoutManager().createTimer('Draw Area Start', this.onDrawAreaStart);

    this.onDrawAreaEnd = this.onDrawAreaEnd.bind(this);
    this.drawAreaEndTimer = board.getTimeoutManager().createTimer('Draw Area End', this.onDrawAreaEnd);
    
    this.vramSize       = this.vramPages << 14;
    this.vram192 = this.vramPages == 12;
    this.vram16 = this.vramPages == 1;

    this.offsets[0] = 0;
    this.offsets[1] = this.vramSize > 0x20000 ? 0x20000 : 0;
    this.vramMasks[0] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
    this.vramMasks[1] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
    this.vramMasks[2] = this.vramSize > 0x20000 ? 0x1ffff : this.vramSize - 1;
    this.vramMasks[3] = this.vramSize > 0x20000 ? 0xffff : this.vramSize - 1;
    this.accMask = this.vramMasks[2];

    if (this.vramPages > 8) {
      this.vramPages = 8;
    }

    this.vram128 = this.vramPages >= 8 ? 0x10000 : 0;
    this.vramMask = (this.vramPages << 14) - 1;

    if (this.syncMode == VdpSyncMode.SYNC_AUTO) {
      this.palMask  = ~0;
      this.palValue = 0;
    }
    else if (this.syncMode == VdpSyncMode.SYNC_50HZ) {
      this.palMask  = ~0x02;
      this.palValue = 0x02;
    }
    else if (this.syncMode == VdpSyncMode.SYNC_60HZ) {
      this.palMask  = ~0x02;
      this.palValue = 0x00;
    }

    this.vram = new Array<number>(this.vramSize);
    for (let i = 0; i < 0x4000; i++) {
      this.vram[i] = 0;
    }

    switch (this.version) {
      case VdpVersion.TMS9929A:
        this.registerValueMask = registerValueMaskMSX1;
        this.registerMask      = 0x07;
        this.hAdjustSc0        = -2; // 6
        break;
      case VdpVersion.TMS99x8A:
        this.registerValueMask = registerValueMaskMSX1;
        this.registerMask      = 0x07;
        this.regs[9]          &= ~0x02;
        this.hAdjustSc0        = -2; // 6
        break;
      case VdpVersion.V9938:
        this.registerValueMask = registerValueMaskMSX2;
        this.registerMask      = 0x3f;
        this.hAdjustSc0        = 1; // 9
        break;
      case VdpVersion.V9958:
        this.registerValueMask = registerValueMaskMSX2p;
        this.registerMask      = 0x3f;
        this.hAdjustSc0        = 1; // 9
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
    for (let i = 0; i < 64; i++) this.regs[i] = 0;
    for (let i = 0; i < 16; i++) this.status[i] = 0;

    this.status[0] = 0x9f;
    this.status[1] = this.version == VdpVersion.V9958 ? 0x04 : 0;
    this.status[2] = 0x6c;

    this.regs[1]  = 0x10;
    this.regs[2]  = 0xff;
    this.regs[3]  = 0xff;
    this.regs[4]  = 0xff;
    this.regs[5]  = 0xff;
    this.regs[8]  = 0x08;
    this.regs[9] = (0x02 & this.palMask) | this.palValue;
    this.regs[21] = 0x3b;
    this.regs[22] = 0x05;
    
    this.vdpKey = 0;
    this.vdpData = 0;
    this.vdpDataLatch = 0;
    this.vramAddress = 0;
    this.screenMode = 0;
    this.vramOffset = this.offsets[0];

    this.scr0splitLine = 0;
    this.lineOffset = 0;
    this.curLine = 0;

    this.isDrawArea = false;


    const palette = this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A ? MSX1_PALETTE : MSX2_PALETTE;
    for (let i = 0; i < 16; i++) {
      this.updatePalette(i, palette[i][0], palette[i][1], palette[i][2]);
    }

    this.onScreenModeChange();
    this.onFrameChange();
  }

  private updatePalette(index: number, r: number, g: number, b: number) {
    const color = this.videoGetColor(r, g, b);
    this.palette[index] = color;
    if (index == 0) {
      this.palette0 = color;
      //updateOutputMode(vdp);
    }
    else {
      if (index == this.bgColor) {
        //updateOutputMode(vdp);
      }
    }
  }

  private readVram(addr: number): number {
    const offset = this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
    return this.vram[this.vramOffset + offset & this.accMask];
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

//    console.log('R: ' + ('0000' + this.vramAddress.toString(16)).slice(-4) + ': "' + (value >= 32 && value < 126 ? String.fromCharCode(value) : value == 0xff ? '_' : ' ') + '"');

    return value;
  }

  private readStatus(port: number): number {
    this.sync();

    // TODO: Sync the VDP once V9938 engine is added.

    this.vdpKey = 0;

    if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
      const status = this.status[0];
      this.status[0] &= 0x1f;
      this.board.clearInt(InterruptVector.VDP_IE0);
      return status;
    }
    
    const status = this.status[this.regs[15]];

    switch (this.regs[15]) {
      case 0:
        this.status[0] &= 0x1f;
        this.board.clearInt(InterruptVector.VDP_IE0);
        break;
      default:
        break;
      // TODO: Add MSX2 statuses
    }

    return status;
  }

  private write(port: number, value: number): void {
    this.sync();

    // TODO: Sync the VDP once V9938 engine is added.

    if (this.enable) {
      const index = this.getVramIndex((this.regs[14] << 14) | this.vramAddress);
      if (!(index & ~this.accMask)) {
//        console.log('W: ' + ('0000' + index.toString(16)).slice(-4) + ': "' + (value >= 32 && value < 126 ? String.fromCharCode(value) : value == 0xff ? '_' : ' ') + '"');
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
//        console.log('Addr HI ' + ('0000' + this.vramAddress.toString(16)).slice(-4));
        if (!(value & 0x40)) {
          if (value & 0x80) this.updateRegisters(value, this.vdpDataLatch);
          else this.read(port);
        }
        this.vdpKey = 0;
      }
      else {
        this.vramAddress = (this.vramAddress & 0x3f00) | value;
//        console.log('Addr LO ' + ('0000' + this.vramAddress.toString(16)).slice(-4));
        this.vdpDataLatch = value;
        this.vdpKey = 1;
      }
    } else {
      if (this.vdpKey) {
        if (value & 0x80) {
          if (!(value & 0x40)) this.updateRegisters(value, this.vdpDataLatch);
        }
        else {
          this.vramAddress = (value << 8 | (this.vramAddress & 0xff)) & 0x3fff;
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
        //this.vramAccMask = this.vramMasks[((this.regs[8] & 0x08) >> 2) | (((this.regs[0x2d] >> 6) & 1))];
        //this.vramEnable = this.vram192 || !((value >> 6) & 1);
      }
      //vdpCmdWrite(vdp -> cmdEngine, reg - 0x20, value, boardSystemTime());
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
          // At some point perhaps support video overlays, then output mode should be handled.
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

        // TODO: Also change timing mode on the 9938 once implemented.
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
        //updateOutputMode(vdp);
        break;

      case 8:
        this.vramAccMask = this.vramMasks[((this.regs[8] & 0x08) >> 2) | (((this.regs[0x2d] >> 6) & 1))];
        //vdpSetTimingMode(vdp -> cmdEngine, ((vdp -> vdpRegs[1] >> 6) & vdp -> drawArea) | (value & 2));
        if (change & 0xb0) {
          //updateOutputMode(vdp);
        }
        break;

      case 9:
        value = (value & this.palMask) | this.palValue;
        if (change & 0x80) {
          //scheduleVint(vdp);
        }
        if (change & 0x30) {
          //updateOutputMode(vdp);
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
          //spriteLineInvalidate(vdp, (boardSystemTime() - vdp -> frameStartTime) / HPERIOD);
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
    const timeout = this.frameStartTime + HPERIOD * (this.firstLine + ((this.regs[9] & 80) ? 212 : 192)) + this.leftBorder - 10;
    this.vIntTimer.setTimeout(timeout);
  }

  private scheduleHInt(): void {
    const timeout = this.frameStartTime + HPERIOD * (this.firstLine + ((this.regs[19] - this.regs[23]) & 0xff)) + this.leftBorder + this.displayArea;
    this.hIntTimer.setTimeout(timeout);
  }

  private scheduleDrawAreaEnd(): void {
    const timeout = this.frameStartTime + HPERIOD * (this.firstLine + ((this.regs[9] & 80) ? 212 : 192));
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

    const adjust = -(this.regs[18] >> 4);
    this.vAdjust = adjust < -8 ? adjust + 16 : adjust;
    this.scanLineCount = isPal ? 313 : 262;
    this.displayOffest = isPal ? 27 : 0;
    const has212Scanlines = (this.regs[9] & 0x80) != 0;
    this.firstLine = this.displayOffest + (has212Scanlines ? 14 : 24) + this.vAdjust;

    if (!(this.regs[0] & 0x10)) {
      this.board.clearInt(InterruptVector.VDP_IE1);
    }
    
    this.status[2] ^= 0x02;
    this.frameStartTime = this.frameTimer.timeout;

    this.scheduleNextFrame();
    this.scheduleVStart();
    this.scheduleVInt();
    this.scheduleHInt();
    this.scheduleDrawAreaStart();
    this.scheduleDrawAreaEnd();
  }

  private onVInt(): void {
    this.sync();

    this.status[0] |= 0x80;
    this.status[2] |= 0x40;

    if (this.regs[1] & 0x20) {
      this.board.setInt(InterruptVector.VDP_IE0);
    }
  }

  private onHInt(): void {
    this.sync();

    if (this.regs[0] & 0x10) {
      this.board.setInt(InterruptVector.VDP_IE1);
    }
  }

  private onVStart(): void {
    this.sync();

    this.status[2] &= ~0x40;
  }

  private onDrawAreaStart(): void {
    this.sync();

    this.isDrawArea = true;
    this.status[2] &= ~0x40;
  }

  private onDrawAreaEnd(): void {
    this.sync();

    this.isDrawArea = false;
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
    return ((((this.regs[26] & 0x3F) << 3) - (this.regs[27] & 0x07)) & ~(~this.hScroll512() << 8));
  }

  private hScroll512(): number {
    return (this.regs[25] & (this.regs[2] >> 5) & 0x1);
  }

  private vScroll(): number {
    return this.regs[23];
  }
  
  private onScreenModeChange(): void {
    const scanLine = this.board.getTimeSince(this.frameStartTime) / HPERIOD | 0;

    this.sync();

    const oldScreenMode = this.screenMode;

    switch (((this.regs[0] & 0x0e) >> 1) | (this.regs[1] & 0x18)) {
      case 0x10: this.screenMode = 0; break;
      case 0x00: this.screenMode = 1; break;
      case 0x01: this.screenMode = 2; break;
      case 0x08: this.screenMode = 3; break;
      case 0x02: this.screenMode = 4; break;
      case 0x03: this.screenMode = 5; break;
      case 0x04: this.screenMode = 6; break;
      case 0x05: this.screenMode = 7; break;
      case 0x07: this.screenMode = 8; break;
      case 0x12: this.screenMode = 13; break;
      case 0x11:  // Screen 0 + 2
        this.screenMode = 16;
        break;
      case 0x18: // Screen 0 + 3
      case 0x19: // Screen 0 + 2 + 3
        this.screenMode = 32;
        break;
      default: // Unknown screen mode
        this.screenMode = 64;
        break;
    }

    switch (this.screenMode) {
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
        if (this.screenMode == 8 && !this.isModeYjk()) {
          this.refreshLineCb = this.refreshLine8.bind(this); 
        }
        else if (this.isModeYae()) {
          this.refreshLineCb = this.refreshLine0.bind(this); 
          this.screenMode = 10;
        }
        else {
          this.refreshLineCb = this.refreshLine12.bind(this); 
          this.screenMode = 12;
        }
        break;
      case 16:
        this.screenMode = 0;
        if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
          this.refreshLineCb = this.refreshLine0plus.bind(this); 
        }
        else {
          this.refreshLineCb = this.refreshLineBlank.bind(this); 
        }
        break;
      case 32:
        this.screenMode = 0;
        if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
          this.refreshLineCb = this.refreshLine0mix.bind(this);
        }
        else {
          this.refreshLineCb = this.refreshLineBlank.bind(this);
        }
        break;
      case 13:
        this.refreshLineCb = this.refreshLineTx80.bind(this);
        this.screenMode = 13;
        break;
      default:
        this.screenMode = 1;
        this.refreshLineCb = this.refreshLineBlank.bind(this);
        break;
    }

    this.screenOn = (this.regs[1] & 0x40) != 0;

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
    
    const adjust = -(this.regs[18] &0x0f);
    this.hAdjust = adjust < -8 ? adjust + 16 : adjust;
    this.leftBorder += this.hAdjust;

    this.chrTabBase = (((this.regs[2] << 10) & ~((this.regs[25] & 1) << 15)) | ~(-1 << 10)) & this.vramMask;
    this.chrGenBase = ((this.regs[4] << 11) | ~(-1 << 11)) & this.vramMask;
    this.colTabBase = ((this.regs[10] << 14) | (this.regs[3] << 6) | ~(-1 << 6)) & this.vramMask;

    this.sprTabBase = ((this.regs[11] << 15) | (this.regs[5] << 7) | ~(-1 << 7)) & this.vramMask;
    this.sprGenBase = ((this.regs[6] << 11) | ~(-1 << 11)) & this.vramMask;
  }

  private writePaletteLatch(port: number, value: number): void {
    // TODO: Implement when MSX2 support is added
  }

  private writeRegister(port: number, value: number): void {
    // TODO: Implement when MSX2 support is added
  }

  private videoGetColor(r: number, g: number, b: number): number {
    // Returns a 16 bit 565 RGB color.
    return (((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3));
  }

  private initPalette(): void {
    for (let y = 0; y < 32; y++) {
      this.yjkColor[y] = new Array<Array<number>>(64);
      for (let J = 0; J < 64; J++) {
        this.yjkColor[y][J] = new Array<number>(64);
        for (let K = 0; K < 64; K++) {
          let j = (J & 0x1f) - (J & 0x20);
          let k = (K & 0x1f) - (K & 0x20);
          let r = 255 * (y + j) / 31;
          let g = 255 * (y + k) / 31;
          let b = 255 * ((5 * y - 2 * j - k) / 4) / 31;

          r = r > 255 ? 255 : r < 0 ? 0 : r | 0;
          g = g > 255 ? 255 : g < 0 ? 0 : g | 0;
          b = b > 255 ? 255 : b < 0 ? 0 : b | 0;
          this.yjkColor[y][J][K] = this.videoGetColor(r, g, b);
        }
      }
    }

    for (let i = 0; i < 256; i++) {
      this.paletteFixed[i] = this.videoGetColor(255 * ((i >> 2) & 7) / 7,
        255 * ((i >> 5) & 7) / 7,
        255 * ((i & 3) == 3 ? 7 : 2 * (i & 3)) / 7);
    }

    this.paletteSprite8[0] = this.videoGetColor(0 * 255 / 7, 0 * 255 / 7, 0 * 255 / 7);
    this.paletteSprite8[1] = this.videoGetColor(0 * 255 / 7, 0 * 255 / 7, 2 * 255 / 7);
    this.paletteSprite8[2] = this.videoGetColor(3 * 255 / 7, 0 * 255 / 7, 0 * 255 / 7);
    this.paletteSprite8[3] = this.videoGetColor(3 * 255 / 7, 0 * 255 / 7, 2 * 255 / 7);
    this.paletteSprite8[4] = this.videoGetColor(0 * 255 / 7, 3 * 255 / 7, 0 * 255 / 7);
    this.paletteSprite8[5] = this.videoGetColor(0 * 255 / 7, 3 * 255 / 7, 2 * 255 / 7);
    this.paletteSprite8[6] = this.videoGetColor(3 * 255 / 7, 3 * 255 / 7, 0 * 255 / 7);
    this.paletteSprite8[7] = this.videoGetColor(3 * 255 / 7, 3 * 255 / 7, 2 * 255 / 7);
    this.paletteSprite8[8] = this.videoGetColor(7 * 255 / 7, 4 * 255 / 7, 2 * 255 / 7);
    this.paletteSprite8[9] = this.videoGetColor(0 * 255 / 7, 0 * 255 / 7, 7 * 255 / 7);
    this.paletteSprite8[10] = this.videoGetColor(7 * 255 / 7, 0 * 255 / 7, 0 * 255 / 7);
    this.paletteSprite8[11] = this.videoGetColor(7 * 255 / 7, 0 * 255 / 7, 7 * 255 / 7);
    this.paletteSprite8[12] = this.videoGetColor(0 * 255 / 7, 7 * 255 / 7, 0 * 255 / 7);
    this.paletteSprite8[13] = this.videoGetColor(0 * 255 / 7, 7 * 255 / 7, 7 * 255 / 7);
    this.paletteSprite8[14] = this.videoGetColor(7 * 255 / 7, 7 * 255 / 7, 0 * 255 / 7);
    this.paletteSprite8[15] = this.videoGetColor(7 * 255 / 7, 7 * 255 / 7, 7 * 255 / 7);
  }

  private sync(): void {
    let frameTime = this.board.getTimeSince(this.frameStartTime);
    let scanLine = frameTime / HPERIOD | 0;
    let lineTime = frameTime % HPERIOD - (this.leftBorder - 20);

    if (this.version == VdpVersion.V9938 || this.version == VdpVersion.V9958) {
      // Run the V99x8 command engine.
    }
    
    if (this.curLine < scanLine) {
      if (this.lineOffset <= 32) {
        if (this.curLine >= this.displayOffest && this.curLine < this.displayOffest + SCREEN_HEIGHT) {
          this.refreshLineCb(this.curLine, this.lineOffset, 33);
        }
      }
      this.lineOffset = -1;
      this.curLine++;
      while (this.curLine < scanLine) {
        if (this.curLine >= this.displayOffest && this.curLine < this.displayOffest + SCREEN_HEIGHT) {
          this.refreshLineCb(this.curLine, -1, 33);
        }
        this.curLine++;
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

  private spriteLine = new Array<number>(256);
  private spriteLineOffset = 0;

  private updateSpritesLine(): void {
    for (let i = 0; i < 256; i++) {
      this.spriteLine[i] = 0;
    }
    this.spriteLineOffset = 0;
  }

  private refreshLeftBorder(y: number, color: number, borderExtra: number): void {
    for (let offset = BORDER_WIDTH + this.hAdjust + borderExtra; offset--;) {
      this.frameBuffer[this.frameOffset++] = color;
    }
  }

  private refreshRightBorder(y: number, color: number, borderExtra: number): void {
    for (let offset = BORDER_WIDTH - this.hAdjust + borderExtra; offset--;) {
      this.frameBuffer[this.frameOffset++] = color;
    }
  }

  private refreshLineBlank(y: number, x: number, x2: number): void {
    let bgColor = this.palette[0];

    if (x == -1) {
      this.refreshLeftBorder(y, bgColor, 0);
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
      this.refreshRightBorder(y, bgColor, 0);
    }
  }

  private refreshLineTx80(y: number, x: number, x2: number): void {
  }

  private refreshLine0(y: number, x: number, x2: number): void {
    y = y - this.firstLine + this.lineVScroll;

    const bgColor = this.palette[this.bgColor];

    if (x == -1) {
      this.lineHScroll = this.hScroll();
      this.lineVScroll = this.vScroll();

      this.refreshLeftBorder(y, bgColor, this.hAdjustSc0);
      x++;

      for (let i = 0; i < this.lineHScroll; i++) {
        this.frameBuffer[this.frameOffset++] = bgColor;
      }

      this.renderCharOffset = 0xc00 | 40 * (y >> 3);
      this.renderShift = 0;
      this.renderPattern = 0;
    }

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
      this.refreshRightBorder(y, bgColor, -this.hAdjustSc0);
    }
  }

  private refreshLine0plus(y: number, x: number, x2: number): void {
  }

  private refreshLine0mix(y: number, x: number, x2: number): void {
  }

  private refreshLine1(y: number, x: number, x2: number): void {
    y = y - this.firstLine + this.lineVScroll;

    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.updateSpritesLine();

      this.lineHScroll = this.hScroll();
      this.lineVScroll = this.vScroll();

      this.refreshLeftBorder(y, bgColor, 0);

      this.renderPage = this.chrTabBase / 0x8000 & 1;

      for (let i = 0; i < (this.lineHScroll & 7); i++) {
        this.frameBuffer[this.frameOffset++] = bgColor;
      }
      
      if (this.isEdgeMasked()) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
        this.spriteLineOffset += 8;
      }
    }
    
    const page = (this.chrTabBase >> 15) & 1;
    let charTableOffset = (this.chrTabBase & ((~0 << 10) | (32 * (y >> 3)))) + (this.lineHScroll & 7) + x;
    const patternBase = this.chrGenBase & ((~0 << 11) | (y & 7));
    
    if (leftBorder && (this.lineHScroll & 7) != 0) {
      x++;

      if (!this.screenOn || !this.isDrawArea) {
        switch (this.lineHScroll & 7) {
          case 1: this.frameBuffer[this.frameOffset++] = bgColor;
          case 2: this.frameBuffer[this.frameOffset++] = bgColor;
          case 3: this.frameBuffer[this.frameOffset++] = bgColor;
          case 4: this.frameBuffer[this.frameOffset++] = bgColor;
          case 5: this.frameBuffer[this.frameOffset++] = bgColor;
          case 6: this.frameBuffer[this.frameOffset++] = bgColor;
          case 7: this.frameBuffer[this.frameOffset++] = bgColor;
            charTableOffset++;
            if ((((this.lineHScroll += 8) >> 3) & 0x1f) == 0) charTableOffset += JUMP_TABLE4[this.renderPage ^= 1];
        }
      }
      else {
        if (this.isEdgeMasked()) {
          const charValue = this.vram[charTableOffset];
          const colPattern = this.vram[this.colTabBase & ((charValue >> 3) | (~0 << 6))];
          const colors = [this.palette[colPattern & 0x0f], this.palette[colPattern >> 4]];
          const charPattern = this.vram[patternBase | charValue * 8];

          switch (this.lineHScroll & 7) {
            case 1: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 6) & 1]; }
            case 2: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 5) & 1]; }
            case 3: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 4) & 1]; }
            case 4: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 3) & 1]; }
            case 5: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 2) & 1]; }
            case 6: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 1) & 1]; }
            case 7: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 0) & 1]; };
              charTableOffset++;
              if ((((this.lineHScroll += 8) >> 3) & 0x1f) == 0) charTableOffset += JUMP_TABLE4[this.renderPage ^= 1];
          }
        }
        else {
          switch (this.lineHScroll & 7) {
            case 1: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 2: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 3: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 4: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 5: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 6: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 7: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
          }
        }
      }
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
        charTableOffset++;
        x++;
      }
    }
    
    if (rightBorder) {
//      this.spritesLine();
      this.refreshRightBorder(y, bgColor, 0);
    }
  }

  private refreshLine2(y: number, x: number, x2: number): void {
    y = y - this.firstLine + this.lineVScroll;

    const bgColor = this.palette[this.bgColor];

    const leftBorder = x < 0;
    leftBorder && x++;
    const rightBorder = x2 > 32;
    rightBorder && x2--;

    if (leftBorder) {
      this.updateSpritesLine();

      this.lineHScroll = this.hScroll();
      this.lineVScroll = this.vScroll();

      this.refreshLeftBorder(y, bgColor, 0);

      this.renderPage = this.chrTabBase / 0x8000 & 1;

      for (let i = 0; i < (this.lineHScroll & 7); i++) {
        this.frameBuffer[this.frameOffset++] = bgColor;
      }

      if (this.isEdgeMasked()) {
        for (let count = 8; count--;) {
          this.frameBuffer[this.frameOffset++] = bgColor;
        }
        x++;
        this.spriteLineOffset += 8;
      }
    }

    const page = (this.chrTabBase >> 15) & 1;
    let charTableOffset = (this.chrTabBase & ((~0 << 10) | (32 * (y >> 3)))) + (this.lineHScroll & 7) + x;
    let charTableBase = (~0 << 13) | ((y & 0xc0) << 5) | (y & 7);

    if (leftBorder && (this.lineHScroll & 7) != 0) {
      x++;

      if (!this.screenOn || !this.isDrawArea) {
        switch (this.lineHScroll & 7) {
          case 1: this.frameBuffer[this.frameOffset++] = bgColor;
          case 2: this.frameBuffer[this.frameOffset++] = bgColor;
          case 3: this.frameBuffer[this.frameOffset++] = bgColor;
          case 4: this.frameBuffer[this.frameOffset++] = bgColor;
          case 5: this.frameBuffer[this.frameOffset++] = bgColor;
          case 6: this.frameBuffer[this.frameOffset++] = bgColor;
          case 7: this.frameBuffer[this.frameOffset++] = bgColor;
            charTableOffset++;
            if ((((this.lineHScroll += 8) >> 3) & 0x1f) == 0) charTableOffset += JUMP_TABLE4[this.renderPage ^= 1];
        }
      }
      else {
        if (this.isEdgeMasked()) {
          const index = charTableBase | this.vram[charTableOffset] * 8;
          const colPattern = this.vram[this.colTabBase & index];
          const colors = [this.palette[colPattern & 0x0f], this.palette[colPattern >> 4]];
          const charPattern = this.vram[this.chrGenBase & index];

          switch (this.lineHScroll & 7) {
            case 1: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 6) & 1]; }
            case 2: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 5) & 1]; }
            case 3: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 4) & 1]; }
            case 4: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 3) & 1]; }
            case 5: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 2) & 1]; }
            case 6: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 1) & 1]; }
            case 7: { const col = this.spriteLine[this.spriteLineOffset++]; this.frameBuffer[this.frameOffset++] = col ? this.palette[col] : colors[(charPattern >> 0) & 1]; };
              charTableOffset++;
              if ((((this.lineHScroll += 8) >> 3) & 0x1f) == 0) charTableOffset += JUMP_TABLE4[this.renderPage ^= 1];
          }
        }
        else {
          switch (this.lineHScroll & 7) {
            case 1: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 2: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 3: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 4: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 5: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 6: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
            case 7: this.spriteLineOffset++; this.frameBuffer[this.frameOffset++] = bgColor;
          }
        }
      }
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
        charTableOffset++;
        x++;
      }
    }

    if (rightBorder) {
      //      this.spritesLine();
      this.refreshRightBorder(y, bgColor, 0);
    }
  }

  private refreshLine3(y: number, x: number, x2: number): void {
  }

  private refreshLine4(y: number, x: number, x2: number): void {
  }

  private refreshLine5(y: number, x: number, x2: number): void {
  }

  private refreshLine6(y: number, x: number, x2: number): void {
  }

  private refreshLine7(y: number, x: number, x2: number): void {
  }

  private refreshLine8(y: number, x: number, x2: number): void {
  }

  private refreshLine10(y: number, x: number, x2: number): void {
  }

  private refreshLine12(y: number, x: number, x2: number): void {
  }

  public getFrameBuffer(): Uint16Array {
    return this.frameBuffer;
  }

  public getFrameBufferWidth(): number {
    return SCREEN_WIDTH;
  }

  public getFrameBufferHeight(): number {
    return SCREEN_HEIGHT;
  }

  private refreshLineCb: (y: number, x: number, x2: number) => void;

  private vramSize = 0;
  private vram192 = false;
  private vram16 = false;
  private vram128 = 0;
  private enable = true;
  private vramOffset = 0;
  private offsets = new Array<number>(2);
  private vramMasks = new Array<number>(4);
  private accMask = 0;
  private vramMask = 0;
  private palMask = 0;
  private palValue = 0;
  private registerValueMask = [0];
  private registerMask = 0;
  private hAdjustSc0 = 0;
  private vdpKey = 0;
  private vdpData = 0
  private vdpDataLatch = 0;
  private vramAddress = 0;
  private screenMode = 1;
  private regs = new Array<number>(64);
  private status = new Array<number>(16);

  private scanLineCount = 0;
  private frameStartTime = 0;
  private isDrawArea = false;
  private firstLine = 0;
  private curLine = 0;
  private scr0splitLine = 0;
  private lastLine = 0;
  private lineOffset = 0;
  private displayOffest = 0;
  private vAdjust = 0;
  private hAdjust = 0;
  private leftBorder = 0;
  private displayArea = 0;
  private screenOn = false;

  private fgColor = 0;
  private bgColor = 0;
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

  // Timers
  private frameTimer: Timer;
  private vIntTimer: Timer;
  private hIntTimer: Timer;
  private vStartTimer: Timer;
  private screenModeChangeTimer: Timer;
  private drawAreaStartTimer: Timer;
  private drawAreaEndTimer: Timer;

  // Palettes
  private paletteFixed = new Array<number>(256);
  private paletteSprite8 = new Array<number>(16);
  private palette0 = 0;
  private palette = new Array<number>(16);
  private yjkColor = new Array<Array<Array<number>>>(32);

  // Rendering state variables
  private renderShift = 0;
  private renderPattern = 0;
  private renderCharOffset = 0;
  private renderPage = 0;
  private lineHScroll = 0;
  private lineVScroll = 0;

  // Video RAM
  private vram: number[];

  // Frame buffers
  private frameOffset = 0;
  private frameBuffer = new Uint16Array(SCREEN_WIDTH * SCREEN_HEIGHT);
}
