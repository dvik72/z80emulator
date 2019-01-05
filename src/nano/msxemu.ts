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

import { Machine } from '../machines/machine';
import { MachineManager } from '../machines/machinemanager';
import { MediaInfoFactory, MediaInfo, MediaType } from '../util/mediainfo';
import { WebGlRenderer } from '../video/webglrenderer';
import { WebAudio } from '../audio/webaudio';

import { DiskManager } from '../disk/diskmanager';

export class MsxEmu {
  constructor() {
    this.runStep = this.runStep.bind(this);
    this.refreshScreen = this.refreshScreen.bind(this);
  }

  public run(): void {
    document.addEventListener('setmachine', this.changeMachine.bind(this));
    document.addEventListener('reset', this.resetEmulation.bind(this));
    document.addEventListener('file', this.fileEvent.bind(this));
    document.addEventListener('keyup', this.keyUp.bind(this));
    document.addEventListener('drop', this.drop.bind(this));
    document.addEventListener('click', () => { this.webAudio.resume(); });
    document.addEventListener('dragover', (event) => { event.preventDefault(); });
    document.addEventListener('dragenter', (event) => { event.preventDefault(); });
    document.addEventListener('dragleave', (event) => { event.preventDefault(); });

    this.createMachineMenu();

    this.setMachine(this.machineManager.getDefaultMachineName());
    
    requestAnimationFrame(this.refreshScreen);
  }

  private createMachineMenu(): void {
    const machinesDiv = document.getElementById('machines')
    for (const machineName of this.machineManager.getMachineNames()) {
      const machineItem = '<a class="dropdown-item" href="#" id="machine-' + machineName + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'setmachine\', {detail: \'' + machineName + '\'}));">' + machineName + '</a>';
      machinesDiv!.innerHTML += machineItem;
    }
  }

  private changeMachine(event: CustomEvent): void {
    this.setMachine(event.detail);
  }

  private setMachine(machineName: string): void {
    console.log("Set Machine " + machineName);
    if (this.machine) {
      const oldMachineDiv = document.getElementById('machine-' + this.machine!.getName());
      oldMachineDiv!.classList.remove('active');
    }
    this.machine = this.machineManager.createMachine(machineName);
    const newMachineDiv = document.getElementById('machine-' + this.machine!.getName());
    newMachineDiv!.classList.add('active');

    this.stopEmulation();
    this.machine!.notifyWhenLoaded(this.startEmulation.bind(this));
  }

  private loadMedia(slot: number, type: MediaType, file: File): void {
    if (type == MediaType.UNKNOWN) {
      if (file.name.slice(-3).toLowerCase() == 'dsk') {
        type = MediaType.FLOPPY;
      }
      if (file.name.slice(-3).toLowerCase() == 'rom') {
        type = MediaType.ROM;
      }
    }

    let reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        if (reader.result instanceof ArrayBuffer) {
          this.mediaLoaded(file.name, type, slot, new Uint8Array(reader.result));
        }
        else {
          let data = new Uint8Array(reader.result.length);
          for (let i = 0; i < reader.result.length; i++) {
            data[i] = reader.result.charCodeAt(i);
          }
          this.mediaLoaded(file.name, type, slot, data);
        }
      }
    }
    reader.readAsBinaryString(file);
  }

  private mediaLoaded(filename: string, type: MediaType, slot: number, data: Uint8Array): void {
    if (type == MediaType.FLOPPY) {
      this.diskMedia = new MediaInfo('Unknown Software', '', 1900, '', MediaType.FLOPPY, data);
      this.diskManager.insertFloppyImage(slot, this.diskMedia.data);
    }
    if (type == MediaType.ROM) {
      this.romMedia[slot] = this.mediaInfoFactory.mediaInfoFromData(data);
      this.stopEmulation();
      this.startEmulation();
    }
  }

  private fileEvent(event: CustomEvent): void {
    let slot = 0;
    let type = MediaType.FLOPPY;

    switch (event.detail) {
      case 'insert-carta': {
        slot = 0;
        type = MediaType.ROM;
        break;
      }
      case 'insert-cartb': {
        slot = 1;
        type = MediaType.ROM;
        break;
      }
      case 'insert-diska': {
        slot = 0;
        type = MediaType.FLOPPY;
        break;
      }
      case 'insert-diskb': {
        slot = 1;
        type = MediaType.FLOPPY;
        break;
      }
    }

    const element = document.getElementById('fileLoader');
    element!.onchange = (event) => {
      if (event.target instanceof HTMLInputElement) {
        const file = (<any>event.target.files)[0];
        if (file instanceof File) {
          this.loadMedia(slot, type, file);
        }
      }
    };

    element!.click();
  }

  private startEmulation() {
    if (!this.machine) {
      return;
    }

    this.diskManager.reset();
    this.machine.init();
    this.machine.reset();
    
    // Insert cartridge rom if present
    if (this.romMedia[0]) {
      this.machine.insertRomMedia(this.romMedia[0], 0);
    }
    if (this.romMedia[1]) {
      this.machine.insertRomMedia(this.romMedia[1], 1);
    }

    // Display cartridge info
    let info = '<br>No cartridge inserted. Drag rom file onto page to insert...';
    if (this.romMedia[0]) {
      const romMedia = this.romMedia[0];
      info = '<br>';
      info += '<br>Game title: ' + romMedia.title;
      info += '<br>Company: ' + romMedia.company;
      info += '<br>Year: ' + romMedia.year;
      info += '<br>Country: ' + romMedia.country;
      info += '<br>Cartridge type: ' + romMedia.type;
    }
    const element = document.getElementById('info');
    if (element) {
      element.innerHTML = info;
    }

    // Start emulation and renderer    
    this.isRunning = true;

    this.runCount = 0;
    this.emulationTime = 0;
    this.wallTime = window.performance.now();
    this.lastSyncTime = window.performance.now();
    this.runStep();
  }

  private stopEmulation(): void {
    this.isRunning = false;
  }
  
  private resetEmulation(): void {
    this.stopEmulation();
    this.startEmulation();
  }

  private runStep(): void {
    const timeNow = window.performance.now();
    const elapsedTime = timeNow - this.lastSyncTime;
    this.wallTime += elapsedTime;
    if (this.wallTime > 1000) {
      const cpuUsage = ((1000 * this.emulationTime / this.wallTime | 0) / 10);
      const element = document.getElementById('cpuusage');
      if (element) {
        element.innerHTML = 'CPU usage: ' + cpuUsage;
      }
      this.wallTime = 0;
      this.emulationTime = 0;
    }

    this.lastSyncTime += elapsedTime;
    if (this.isRunning && this.machine) {
      this.runCount += elapsedTime;
      if (this.runCount > 10) {
        this.machine.runStep(10);
        this.runCount -= 10;
        setTimeout(this.runStep, 0);
      }
      else {
        if (this.runCount > 0) {
          this.machine.runStep(this.runCount);
        }
        this.runCount = 0;
        setTimeout(this.runStep, 1);
      }
      this.emulationTime += window.performance.now() - timeNow;
    }
  }
  
  private refreshScreen(): void {
    if (this.isRunning && this.machine) {
      const frameBuffer = this.machine.getFrameBuffer();
      const width = this.machine.getFrameBufferWidth();
      const height = this.machine.getFrameBufferHeight();
      
      frameBuffer && this.glRenderer.render(width, height, frameBuffer);
    }
    requestAnimationFrame(this.refreshScreen);
  }

  private drop(event: DragEvent) {
    event.preventDefault();

    this.webAudio.resume(); 
    
    if (event.dataTransfer && event.dataTransfer.items) {
      if (event.dataTransfer.items.length == 1 && event.dataTransfer.items[0].kind === 'file') {
        const file = event.dataTransfer.items[0].getAsFile();
        if (file instanceof File) {
          this.loadMedia(0, MediaType.UNKNOWN, file);
        }
      }
    }
  }

  private keyDown(event: KeyboardEvent): void {
    event.preventDefault();
    this.machine && this.machine.keyDown(event.code);
    //if (event.code == 'KeyD') {
    //  console.log('Trigger ASM dump');
    //  this.machine!.dumpAsm();
    //}
  }

  private keyUp(event: KeyboardEvent): void {
    event.preventDefault();
    this.machine && this.machine.keyUp(event.code);
  }

  private machine?: Machine;
  private lastSyncTime = 0;
  private runCount = 0;
  private wallTime = 0;
  private emulationTime = 0;
  private isRunning = false;

  private glRenderer = new WebGlRenderer();
  private webAudio = new WebAudio();
  private diskManager = new DiskManager();
  private machineManager = new MachineManager(this.webAudio, this.diskManager);

  private diskMedia?: MediaInfo;
  private romMedia = new Array<MediaInfo>(2);
  private mediaInfoFactory = new MediaInfoFactory();
}
