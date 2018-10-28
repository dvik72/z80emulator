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
import { MsxPpi } from '../io/msxppi';
import { MsxPsg } from '../io/msxpsg';
import { MapperRomBasic } from '../mappers/rombasic';
import { MapperRamNormal } from '../mappers/ramnormal';
import { Vdp, VdpVersion, VdpSyncMode, VdpConnectorType } from '../video/vdp';
import { msxDosRom } from './msxDosRom';
import { CPU_VDP_IO_DELAY, MASTER_FREQUENCY } from '../z80/z80';


const REFRESH_FREQUENCY = MASTER_FREQUENCY / 50 | 0;


// Minimal functional emulation of MSX. 
// The emulation is not complete, but it includes enough features
// to run dos programs and cartridges up to 64kB.
export class NanoMsx {
  constructor() {
    this.renderScreen = this.renderScreen.bind(this);

    this.board = new Board(CPU_VDP_IO_DELAY, false);

    this.displayTimer = this.board.getTimeoutManager().createTimer('Render Screen', this.renderScreen);

    this.msxPpi = new MsxPpi(this.board.getIoManager(), this.board.getSlotManager());
    
    this.vdp = new Vdp(this.board, VdpVersion.TMS9929A, VdpSyncMode.SYNC_AUTO, VdpConnectorType.MSX, 1);
    this.msxpsg = new MsxPsg(this.board.getIoManager(), 2);
  }

  run(): void {
    // Initialize MSX 1 machine configuration
    this.msxRom = new MapperRomBasic(this.board.getSlotManager(), 0, 0, 0, msxDosRom);
    this.ram = new MapperRamNormal(this.board.getSlotManager(), 3, 0, 0, 0x10000);

    this.msxPpi.reset();
    this.vdp.reset();
    this.msxpsg.reset();

    this.displayTimer.setTimeout(REFRESH_FREQUENCY);

    this.board.run();
  }

  private board: Board;
  private displayTimer: Timer;
  private ram?: MapperRamNormal;
  private msxRom?: MapperRomBasic;
  private vdp: Vdp;
  private msxpsg: MsxPsg;
  private msxPpi: MsxPpi;

  private screenBuffer: string = '';

  private renderScreen() {
    this.displayTimer.addTimeout(REFRESH_FREQUENCY);

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
