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

import { Z80, CPU_VDP_IO_DELAY } from '../z80/z80';
import { IoManager, Port } from '../core/iomanager';
import { SlotManager } from '../core/slotmanager';
import { MsxPpi } from '../io/msxppi';
import { MapperRomBasic } from '../mappers/rombasic';
import { MapperRamNormal } from '../mappers/ramnormal';
import { NanoVdp } from '../video/nanovdp';
import { Vdp, VdpVersion, VdpSyncMode, VdpConnectorType } from '../video/vdp';
import { msxDosRom } from './msxDosRom';


// Minimal functional emulation of MSX. 
// The emulation is not complete, but it includes enough features
// to run dos programs and cartridges up to 64kB.
export class NanoMsx {
  constructor() {
    this.ioManager = new IoManager(true);
    this.slotManager = new SlotManager();
    
    this.msxPpi = new MsxPpi(this.ioManager, this.slotManager);
    
    this.timeout = this.timeout.bind(this);
    this.z80 = new Z80(CPU_VDP_IO_DELAY, this.slotManager.read, this.slotManager.write, this.ioManager.read, this.ioManager.write, this.timeout);
//    this.vdp = new NanoVdp(this.ioManager, this.z80);
    this.vdp = new Vdp(this.ioManager, this.z80, VdpVersion.TMS9929A, VdpSyncMode.SYNC_AUTO, VdpConnectorType.MSX, 1);
  }

  run(): void {
    // Initialize MSX 1 machine configuration
    this.msxRom = new MapperRomBasic(this.slotManager, 0, 0, 0, msxDosRom);
    this.ram = new MapperRamNormal(this.slotManager, 3, 0, 0, 0x10000);

    this.z80Timeout = this.z80Frequency / 50 | 0;
    this.emuTime = this.gettime();
    this.syncTime = this.emuTime + 20000;
    this.z80.setTimeoutAt(this.z80Timeout);

    this.msxPpi.reset();
    this.vdp.reset();

    this.z80.reset();
    this.z80.execute();
  }

  private ram?: MapperRamNormal;
  private msxRom?: MapperRomBasic;
//  private vdp: NanoVdp;
  private vdp: Vdp;

  private z80Timeout = 0;
  private z80Frequency = 3579545;
  private frameCounter = 0;
  private syncTime = 0;
  private emuTime = 0;
  private normalSpeed = 0;

  private ioManager: IoManager;
  private slotManager: SlotManager;
  private msxPpi: MsxPpi;
  private z80: Z80;

  private screenBuffer: string = '';

  private timeout(): void {
    this.vdp.setStatusBit(0x80);
    if (this.vdp.getRegister(1) & 0x20) {
      this.z80.setInt();
    }

    this.renderScreen();

    if (this.normalSpeed) {
      const diffTime = this.syncTime - this.gettime();
      if (diffTime > 0) {
        this.delay(diffTime / 1000);
      }
      this.syncTime += 20000;
    }

    if (++this.frameCounter == 50) {
      const diffTime = this.gettime() - this.emuTime;

      this.frameCounter = 0;

      if (!this.normalSpeed) {
//        this.z80Frequency = this.z80Frequency * 1000000 / diffTime;
      }
      this.emuTime += diffTime;
    }

    this.z80Timeout = this.z80Timeout + this.z80Frequency / 50 & 0xfffffff;
    this.z80.setTimeoutAt(this.z80Timeout);
  }

  private pollkbd(): number {
    return 0;
  }

  private gettime(): number {
    return new Date().getTime();
  }

  private delay(ms: number): void {
//    const wait = (ms) => new Promise(res => setTimeout(res, ms));
//    await wait(ms);
  }

  private renderScreen() {
    const width = (this.vdp.getRegister(1) & 0x10) ? 40 : 32;
    let offset = (this.vdp.getRegister(2) & 0x0f) << 10;
    let buf = '';

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < width; x++) {
        const val = this.vdp.getVram(offset++);
        buf += val >= 32 && val < 126 ? String.fromCharCode(val) : val == 0xff ? '_' : ' ';
      }
      if (width == 32) {
        buf += '        ';
      }
      buf += '#\n';
    }

    if (buf != this.screenBuffer) {
      this.screenBuffer = buf;
      document.body.innerHTML = '<PRE STYLE="font-family: Courier; font-size: 12pt;">' + this.screenBuffer + '</PRE>';
    }
  }
}
