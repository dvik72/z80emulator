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

export class Vdp {
  constructor(
    private board: Board,
    private version: VdpVersion,
    private syncMode: VdpSyncMode,
    private connectorType: VdpConnectorType,
    private vramPages: number
  ) {

    this.onFrameChange = this.onFrameChange.bind(this);
    this.frameTimer = board.getTimeoutManager().createTimer('Frame Change', this.onFrameChange);

    this.onScreenModeChange = this.onScreenModeChange.bind(this);
    this.screenModeChangeTimer = board.getTimeoutManager().createTimer('Screen Mode Change', this.onScreenModeChange);

    this.onVStart = this.onVStart.bind(this);
    this.vStartTimer = board.getTimeoutManager().createTimer('VStart', this.onVStart);

    this.onVInt = this.onVInt.bind(this);
    this.vIntTimer = board.getTimeoutManager().createTimer('VInt', this.onVInt);

    this.onDrawAreaStart = this.onDrawAreaStart.bind(this);
    this.drawAreaStartTimer = board.getTimeoutManager().createTimer('Draw Area Start', this.onDrawAreaStart);

    this.onDrawAreaEnd = this.onDrawAreaEnd.bind(this);
    this.drawAreaEndTimer = board.getTimeoutManager().createTimer('Draw Area End', this.onDrawAreaEnd);
    
    this.vramSize       = this.vramPages << 14;
    this.vram192 = this.vramPages == 12;
    this.vram16 = this.vramPages == 1;

    this.offsets[0] = 0;
    this.offsets[1] = this.vramSize > 0x20000 ? 0x20000 : 0;
    this.masks[0] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
    this.masks[1] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
    this.masks[2] = this.vramSize > 0x20000 ? 0x1ffff : this.vramSize - 1;
    this.masks[3] = this.vramSize > 0x20000 ? 0xffff : this.vramSize - 1;
    this.accMask = this.masks[2];

    if (this.vramPages > 8) {
      this.vramPages = 8;
    }

    this.vram128 = this.vramPages >= 8 ? 0x10000 : 0;
    this.mask = (this.vramPages << 14) - 1;

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

  // Temp hacks to allow the nano driver to work.
  getStatus(): number { return this.status[0]; }
  setStatusBit(value: number): void { this.status[0] |= value; }
  getRegister(reg: number): number { return this.regs[reg]; }
  getVram(index: number): number { return this.vram[index & 0x3fff]; }

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

    this.isDrawArea = false;

    this.onScreenModeChange();
    this.onFrameChange();
  }

  private readVram(addr: number): number {
    const offset = this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
    return this.vram[this.vramOffset + offset & this.accMask];
  }

  private getVramIndex(addr: number): number {
    return this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
  }

  private read(port: number): number {
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
    // TODO: Sync the VDP once V9938 engine is added.

    this.vdpKey = 0;

    if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
      const status = this.status[0];
      this.status[0] &= 0x1f;
      this.board.getZ80().clearInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
//      console.log('RS: ' + ('0000' + status.toString(16)).slice(-2));
      return status;
    }
    
    const status = this.status[this.regs[15]];

    switch (this.regs[15]) {
      case 0:
        this.status[0] &= 0x1f;
        this.board.getZ80().clearInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
        break;
      default:
        break;
      // TODO: Add MSX2 statuses
    }

    return status;
  }

  private write(port: number, value: number): void {
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
    reg &= this.registerMask;
    value &= this.registerValueMask[reg];
    const change = this.regs[reg] ^ value;
    this.regs[reg] = value;

    switch (reg) {
      case 0:
        if (!(value & 0x10)) {
          // TODO: Clear INT_IE1 when MSX2 is supported
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
            this.board.getZ80().setInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
          }
          else {
            this.board.getZ80().clearInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
          }
        }

        if (change & 0x58) {
          this.scheduleScrModeChange();
        }

        // TODO: Also change timing mode on the 9938 once implemented.
        break;

      default:
        // Add handling later...
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
    const isPal = this.isPalVideo();

    const adjust = -(this.regs[18] >> 4);
    this.vAdjust = adjust < -8 ? adjust + 16 : adjust;
    this.scanLineCount = isPal ? 313 : 262;
    this.displayOffest = isPal ? 27 : 0;
    const has212Scanlines = (this.regs[9] & 0x80) != 0;
    this.firstLine = this.displayOffest + (has212Scanlines ? 14 : 24) + this.vAdjust;

    if (!(this.regs[0] & 0x10)) {
      //boardClearInt(INT_IE1);
    }

    this.status[2] ^= 0x02;
    this.frameStartTime = this.frameTimer.timeout;

    this.scheduleNextFrame();
    this.scheduleVStart();
    this.scheduleVInt();
    this.scheduleDrawAreaStart();
    this.scheduleDrawAreaEnd();
  }

  private onVInt(): void {
    this.status[0] |= 0x80;
    this.status[2] |= 0x40;

    if (this.regs[1] & 0x20) {
      this.board.getZ80().setInt();
    }
  }

  private onVStart(): void {
    this.status[2] &= ~0x40;
  }

  private onDrawAreaStart(): void {
    this.isDrawArea = true;
    this.status[2] &= ~0x40;
  }

  private onDrawAreaEnd(): void {
    this.isDrawArea = false;
  }
  
  private onScreenModeChange(): void {
    // TODO: Should schedule screen mode change at end of scanline. for now just switch right away.
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

  }

  private writePaletteLatch(port: number, value: number): void {
    // TODO: Implement when MSX2 support is added
  }

  private writeRegister(port: number, value: number): void {
    // TODO: Implement when MSX2 support is added
  }

  private vramSize = 0;
  private vram192 = false;
  private vram16 = false;
  private vram128 = 0;
  private enable = true;
  private vramOffset = 0;
  private offsets = new Array<number>(2);
  private masks = new Array<number>(4);
  private accMask = 0;
  private mask = 0;
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
  private lastLine = 0;
  private displayOffest = 0;
  private vAdjust = 0;
  private hAdjust = 0;
  private leftBorder = 0;
  private displayArea = 0;
  
  private frameTimer: Timer;
  private vIntTimer: Timer;
  private vStartTimer: Timer;
  private screenModeChangeTimer: Timer;
  private drawAreaStartTimer: Timer;
  private drawAreaEndTimer: Timer;

  private vram: number[];
}
