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
import { PanasonicFsA1 } from '../machines/msx2/panasonic_fs_a1'; 
import { PhilipsVg8020 } from '../machines/msx/philips_vg_8020';
import { GenericMsx2 } from '../machines/msx2/genericmsx2';
import { PanasonicFsA1Wsx } from '../machines/msx2plus/panasonic_fs_a1wsx';

import { MediaInfoFactory, MediaInfo, MediaType } from '../util/mediainfo';
import { WebGlRenderer } from '../video/webglrenderer';
import { WebAudio } from '../audio/webaudio';

import { DiskManager } from '../disk/diskmanager';

import { gameRom } from './gamerom';

// Emulates MSX1 and MSX2 systems
export class MsxEmu {
  constructor() {
    this.runStep = this.runStep.bind(this);
    this.refreshScreen = this.refreshScreen.bind(this);
  }
  
  run(): void {
    document.addEventListener('keydown', this.keyDown.bind(this));
    document.addEventListener('keyup', this.keyUp.bind(this));
    document.addEventListener('drop', this.drop.bind(this));
    document.addEventListener('click', () => { this.webAudio.resume(); });
    document.addEventListener('dragover', (event) => { event.preventDefault(); });
    document.addEventListener('dragenter', (event) => { event.preventDefault(); });
    document.addEventListener('dragleave', (event) => { event.preventDefault(); });
   
    this.machine = new PanasonicFsA1Wsx(this.webAudio, this.diskManager);

    //this.romMedia = this.mediaInfoFactory.mediaInfoFromData(new Uint8Array(gameRom));

    this.machine.notifyWhenLoaded(this.startEmulation.bind(this));

    // Start emulation and renderer
    this.lastSyncTime = Date.now();
    this.runStep();
    requestAnimationFrame(this.refreshScreen);
  }

  private startEmulation() {
    if (!this.machine) {
      return;
    }

    this.diskManager.reset();
    this.machine.init();
    this.machine.reset();
    
    //this.diskMedia = new MediaInfo('Unknown Software', '', 1900, '', MediaType.FLOPPY, new Uint8Array(gameRom));
    //this.diskManager.insertFloppyImage(0, this.diskMedia.data);

    // Insert cartridge rom if present
    if (this.romMedia) {
      this.machine.insertRomMedia(this.romMedia);
    }

    // Display cartridge info
    let info = '<br>No cartridge inserted. Drag rom file onto page to insert...';
    if (this.romMedia) {
      info = '<br>';
      info += '<br>Game title: ' + this.romMedia.title;
      info += '<br>Company: ' + this.romMedia.company;
      info += '<br>Year: ' + this.romMedia.year;
      info += '<br>Country: ' + this.romMedia.country;
      info += '<br>Cartridge type: ' + this.romMedia.type;
    }
    const element = document.getElementById('info');
    if (element) {
      element.innerHTML = info;
    }
    
    this.isRunning = true;
  }

  private stopEmulation(): void {
    this.isRunning = false;
  }

  private runStep(): void {
    const elapsedTime = Date.now() - this.lastSyncTime;
    this.lastSyncTime += elapsedTime;
    if (elapsedTime) {
      if (this.isRunning && this.machine) {
        this.machine.runStep(elapsedTime);
      }
    }

    setTimeout(this.runStep, 1);
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
          let reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              if (reader.result instanceof ArrayBuffer) {
                this.fileLoaded(file.name, new Uint8Array(reader.result));
              }
              else {
                let data = new Uint8Array(reader.result.length);
                for (let i = 0; i < reader.result.length; i++) {
                  data[i] = reader.result.charCodeAt(i);
                }
                this.fileLoaded(file.name, data);
              }
            }
          }
          reader.readAsBinaryString(file);
        }
      }
    }
  }

  private fileLoaded(filename: string, data: Uint8Array): void {
    if (filename.slice(-3).toLowerCase() == 'dsk') {
      this.diskMedia = new MediaInfo('Unknown Software', '', 1900, '', MediaType.FLOPPY, data);
      this.diskManager.insertFloppyImage(0, this.diskMedia.data);
    }
    else {
      this.romMedia = this.mediaInfoFactory.mediaInfoFromData(data);
      this.stopEmulation();
      this.startEmulation();
    }
  }
  
  private keyDown(event: KeyboardEvent): void {
    event.preventDefault();
    this.machine && this.machine.keyDown(event.code);
  }

  private keyUp(event: KeyboardEvent): void {
    event.preventDefault();
    this.machine && this.machine.keyUp(event.code);
  }

  private machine?: Machine;
  private lastSyncTime = 0;
  private isRunning = false;

  private glRenderer = new WebGlRenderer();
  private webAudio = new WebAudio();
  private diskManager = new DiskManager();

  private diskMedia?: MediaInfo;
  private romMedia?: MediaInfo;
  private mediaInfoFactory = new MediaInfoFactory();


}
