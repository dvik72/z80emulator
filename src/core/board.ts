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

import { Z80, TIMER_RANGE } from '../z80/z80';
import { IoManager, Port } from './iomanager';
import { SlotManager } from './slotmanager';
import { TimeoutManager } from './timeoutmanager';


// This class emulates a generic board with a Z80 processor with modular
// interfaces to plug in IO devices and memory devices. The class also provides
// a timeout service for emulated devices to register callbacks at some given
// time (in the emulated time space).
export class Board {
  constructor(cpuFlags: number, enableSubslots: boolean) {
    this.ioManager = new IoManager(enableSubslots);
    this.slotManager = new SlotManager();
    this.timeoutManager = new TimeoutManager();

    this.z80 = new Z80(cpuFlags, this.slotManager.read, this.slotManager.write, this.ioManager.read, this.ioManager.write, this.timeoutManager.timeout);
    this.timeoutManager.initialize(this.z80);
  }

  public getIoManager(): IoManager {
    return this.ioManager;
  }

  public getSlotManager(): SlotManager {
    return this.slotManager;
  }

  public getZ80(): Z80 {
    return this.z80;
  }

  public getTimeoutManager(): TimeoutManager {
    return this.timeoutManager;
  }

  public getSystemTime(): number {
    return this.z80.getSystemTime();
  }

  public getTimeSince(time: number): number {
    return this.z80.getSystemTime() - time & TIMER_RANGE;
  }

  public run(): void {
    this.z80.reset();
    this.z80.execute();
  }

  private ioManager: IoManager;
  private slotManager: SlotManager;
  private timeoutManager: TimeoutManager;
  private z80: Z80;
}
