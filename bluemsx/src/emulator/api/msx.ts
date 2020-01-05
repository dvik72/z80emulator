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


import { WebAudio } from './webaudio';

import { Machine } from '../machines/machine';
import { MachineManager } from '../machines/machinemanager';
import { MediaInfoFactory, MediaInfo, MediaType } from '../util/mediainfo';
import { LedManager, LedType } from '../core/ledmanager';
import { DiskManager } from '../disk/diskmanager';
import { Input } from '../input/input';
import { JoystickPortManager } from '../input/joystickportmanager';
import { MsxJoystick } from '../input/msxjoystick';

export class MsxEmu {
  constructor(
    private performance: Performance,
    private webAudio: WebAudio,
    private inputConfig: any = {})
  {
    Input.init(inputConfig);

    JoystickPortManager.registerJoystick(0, new MsxJoystick());
    JoystickPortManager.registerJoystick(1, new MsxJoystick());
  }

  public isRunning(): boolean {
    return this.running;
  }

  private emptyFrameBuffer = new Uint16Array([0]);

  public getFrameBufferData(): Uint16Array {
    return this.machine && this.machine.getFrameBuffer() || this.emptyFrameBuffer;
  }

  public getFrameBufferWidth(): number {
    return this.machine && this.machine.getFrameBufferWidth() || 1;
  }

  public getFrameBufferHeight(): number {
    return this.machine && this.machine.getFrameBufferHeight() || 1;
  }

  public setMachine(machineName: string = '', machineRomState?: any): void {
    console.log("Set Machine " + machineName);

    this.machine = this.machineManager.createMachine(machineName, machineRomState);
    if (!this.machine) {
      machineName = this.machineManager.getDefaultMachineName();
      this.machine = this.machineManager.createMachine(machineName);
    }

    this.pauseEmulation();
    this.machine!.notifyWhenLoaded(this.startEmulation.bind(this));
  }

  public startEmulation() {
    if (!this.machine) {
      return;
    }

    this.diskManager.reset();
    this.machine.init();
    this.machine.reset();

    // Insert cartridge rom if present
    const romMedia0 = this.romMedia[0];
    romMedia0 && this.machine.insertRomMedia(romMedia0, 0);

    const romMedia1 = this.romMedia[1];
    romMedia1 && this.machine.insertRomMedia(romMedia1, 1);

    // Start emulation and renderer    
    this.resumeEmulation();
  }

  public pauseEmulation(): void {
    this.running = false;
  }

  public resumeEmulation(): void {
    this.running = true;
    this.runCount = 0;
    this.emulationTime = 0;
    this.wallTime = this.performance.now();
    this.lastSyncTime = this.performance.now();
    this.runStep();
  }

  public resetEmulation(): void {
    this.pauseEmulation();
    this.startEmulation();
  }

  public runStep(): number {
    let timeout = 10;
    const timeNow = this.performance.now();
    const elapsedTime = timeNow - this.lastSyncTime;
    this.wallTime += elapsedTime;
    if (this.wallTime > 1000) {
      const cpuUsage = ((1000 * this.emulationTime / this.wallTime | 0) / 10);
      this.wallTime = 0;
      this.emulationTime = 0;
    }

    this.lastSyncTime += elapsedTime;
    if (this.running && this.machine) {
      this.runCount += elapsedTime;
      if (this.runCount > 200) {
        this.runCount = 0;
      }
      if (this.runCount > 10) {
        this.machine.runStep(10);
        this.runCount -= 10;
        timeout = 0;
      }
      else {
        if (this.runCount > 0) {
          this.machine.runStep(this.runCount);
        }
        this.runCount = 0;
        timeout = 1;
      }
      this.emulationTime += this.performance.now() - timeNow;
    }

    return timeout;
  }


  private romMedia = new Array<MediaInfo | undefined>(2);
  private diskMedia = new Array<MediaInfo | undefined>(2);

  private machine?: Machine;
  private diskManager = new DiskManager();
  private ledManager = new LedManager();
  private machineManager = new MachineManager(this.webAudio, this.diskManager, this.ledManager);

  private lastSyncTime = 0;
  private runCount = 0;
  private wallTime = 0;
  private emulationTime = 0;
  private running = false;
}
