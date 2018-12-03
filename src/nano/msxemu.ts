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
import { PanasonicFsA1 } from '../machines/msx2/panasonic_fs_a1' 

import { mapperFromMediaInfo } from '../mappers/mapperfactory';
import { MediaInfoFactory } from '../util/mediainfo';
import { WebGlRenderer } from '../video/webglrenderer';
import { WebAudio } from '../audio/webaudio';

import { DiskManager } from './diskmanager';

// Emulates MSX1 with cartridge ROMs. No disk drive or casette emulation yet...
export class MsxEmu {
  constructor() {
    this.runStep = this.runStep.bind(this);
    this.refreshScreen = this.refreshScreen.bind(this);
    this.keyDown = this.keyDown.bind(this);
    this.keyUp = this.keyUp.bind(this);
    this.dragover = this.dragover.bind(this);
    this.drop = this.drop.bind(this);

    this.diskManager.getFloppyDisk(0).enable(true);

    //this.diskManager.insertFloppyImage(0, new Uint8Array(gameRom));
  }
  
  run(): void {
    document.addEventListener('keydown', this.keyDown);
    document.addEventListener('keyup', this.keyUp);
    document.addEventListener('dragover', this.dragover);
    document.addEventListener('drop', this.drop);

    this.startEmulation();

    // Start emulation and renderer
    this.lastSyncTime = Date.now();
    this.runStep();
    requestAnimationFrame(this.refreshScreen);
  }

  private isRunning = false;
  private gameRomData?: Uint8Array;
  private mediaInfoFactory = new MediaInfoFactory();

  private startEmulation() {
    this.machine = new PanasonicFsA1(this.webAudio);

    this.machine.reset();

    // Insert disk rom into cartridge slot 2
//    this.diskRom = new MapperRomTc8566af(this.diskManager, this.board, 2, 0, new Uint8Array(panasonicDiskRom));

    // Initialize cartridge
    let info = '<br>No cartridge inserted. Drag rom file onto page to insert...';
    if (this.gameRomData) {
      const mediaInfo = this.mediaInfoFactory.mediaInfoFromData(this.gameRomData);
      if (mediaInfo) {
        info = '<br>';
        info += '<br>Game title: ' + mediaInfo.title;
        info += '<br>Company: ' + mediaInfo.company;
        info += '<br>Year: ' + mediaInfo.year;
        info += '<br>Country: ' + mediaInfo.country;
        info += '<br>Cartridge type: ' + mediaInfo.type;
      }
//      this.gameRom = mapperFromMediaInfo(this.board, mediaInfo, 1, 0);
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
    
    if (event.dataTransfer && event.dataTransfer.items) {
      if (event.dataTransfer.items.length == 1 && event.dataTransfer.items[0].kind === 'file') {
        const file = event.dataTransfer.items[0].getAsFile();
        if (file instanceof File) {
          this.stopEmulation();
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

  private fileLoaded(filename: string, data: Uint8Array) {
    this.gameRomData = data;

    this.startEmulation();
  }

  private dragover(event: DragEvent) {
    event.preventDefault();
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
  private glRenderer = new WebGlRenderer();

  private webAudio = new WebAudio();

  private diskManager = new DiskManager();
}
