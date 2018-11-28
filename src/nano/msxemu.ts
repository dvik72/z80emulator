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
import { MsxPpi, Key } from '../io/msxppi';
import { MsxPsg } from '../io/msxpsg';
import { Mapper } from '../mappers/mapper';
import { MapperRomNormal } from '../mappers/romnormal';
import { MapperRamNormal } from '../mappers/ramnormal';
import { Vdp, VdpVersion, VdpSyncMode, VdpConnectorType } from '../video/vdp';
import { msxDosRom } from './msxdosrom';
import { CPU_ENABLE_M1, MASTER_FREQUENCY } from '../z80/z80';
import { mapperFromMediaInfo } from '../mappers/mapperfactory';
import { MediaInfoFactory } from '../util/mediainfo';
import { WebGlRenderer } from '../video/webglrenderer';
import { WebAudio } from '../audio/webaudio';
import { gameRom } from './gamerom';

import { MapperRomTc8566af } from '../mappers/romTc8566af';
import { DiskManager } from './diskmanager';
import { panasonicDiskRom } from './panasonicdiskrom';


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

//    this.diskManager.insertFloppyImage(0, new Uint8Array(gameRom));
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
    // Initialize board components
    this.board = new Board(this.webAudio, CPU_ENABLE_M1, false);
    this.msxPpi = new MsxPpi(this.board);
    this.vdp = new Vdp(this.board, VdpVersion.TMS9929A, VdpSyncMode.SYNC_AUTO, VdpConnectorType.MSX, 1);
    this.msxpsg = new MsxPsg(this.board, 2);

    // Initialize MSX 1 ram and roms
    this.msxRom = new MapperRomNormal(this.board, 0, 0, 0, msxDosRom);
    this.ram = new MapperRamNormal(this.board, 3, 0, 0, 0x10000);

    // Insert disk rom into cartridge slot 2
    this.diskRom = new MapperRomTc8566af(this.diskManager, this.board, 2, 0, new Uint8Array(panasonicDiskRom));

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
      this.gameRom = mapperFromMediaInfo(this.board, mediaInfo, 1, 0);
    }
    else {
      this.gameRom = undefined;
    }
    const element = document.getElementById('info');
    if (element) {
      element.innerHTML = info;
    }

    // Reset all devices
    this.msxPpi.reset();
    this.vdp.reset();
    this.msxpsg.reset();
    this.board.reset();

    this.isRunning = true;
  }

  private stopEmulation(): void {
    this.isRunning = false;
  }

  private runStep(): void {
    const elapsedTime = Date.now() - this.lastSyncTime;
    this.lastSyncTime += elapsedTime;
    if (elapsedTime) {
      if (this.isRunning && this.board) {
        this.board.run(MASTER_FREQUENCY * elapsedTime / 1000 | 0);
      }
    }

    setTimeout(this.runStep, 1);
  }

  private refreshScreen(): void {
    if (this.isRunning && this.vdp) {
      const frameBuffer = this.vdp.getFrameBuffer();
      const width = this.vdp.getFrameBufferWidth();
      const height = this.vdp.getFrameBufferHeight();

      this.glRenderer.render(width, height, frameBuffer);
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
    if (this.msxPpi) {
      this.msxPpi.keyDown(this.keyEventToKeyEnum(event));
    }
  }

  private keyUp(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.msxPpi) {
      this.msxPpi.keyUp(this.keyEventToKeyEnum(event));
    }
  }

  private keyEventToKeyEnum(event: KeyboardEvent): Key {
    switch (event.code) {
      case 'Digit0': return Key.EC_0;
      case 'Digit1': return Key.EC_1;
      case 'Digit2': return Key.EC_2;
      case 'Digit3': return Key.EC_3;
      case 'Digit4': return Key.EC_4;
      case 'Digit5': return Key.EC_5;
      case 'Digit6': return Key.EC_6;
      case 'Digit7': return Key.EC_7;
      case 'Digit8': return Key.EC_8;
      case 'Digit9': return Key.EC_9;

      case 'KeyA': return Key.EC_A;
      case 'KeyB': return Key.EC_B;
      case 'KeyC': return Key.EC_C;
      case 'KeyD': return Key.EC_D;
      case 'KeyE': return Key.EC_E;
      case 'KeyF': return Key.EC_F;
      case 'KeyG': return Key.EC_G;
      case 'KeyH': return Key.EC_H;
      case 'KeyI': return Key.EC_I;
      case 'KeyJ': return Key.EC_J;
      case 'KeyK': return Key.EC_K;
      case 'KeyL': return Key.EC_L;
      case 'KeyM': return Key.EC_M;
      case 'KeyN': return Key.EC_N;
      case 'KeyO': return Key.EC_O;
      case 'KeyP': return Key.EC_P;
      case 'KeyQ': return Key.EC_Q;
      case 'KeyR': return Key.EC_R;
      case 'KeyS': return Key.EC_S;
      case 'KeyT': return Key.EC_T;
      case 'KeyU': return Key.EC_U;
      case 'KeyV': return Key.EC_V;
      case 'KeyW': return Key.EC_W;
      case 'KeyX': return Key.EC_X;
      case 'KeyY': return Key.EC_Y;
      case 'KeyZ': return Key.EC_Z;
    
      case 'Comma': return Key.EC_COMMA;
      case 'Period': return Key.EC_PERIOD;
      case 'Semicolon': return Key.EC_SEMICOL;
      case 'Quote': return Key.EC_COLON;
      case 'BracketLeft': return Key.EC_LBRACK;
      case 'BracketRight': return Key.EC_RBRACK;
      case 'Backquote': return Key.EC_NONE;
      case 'Backslash': return Key.EC_BKSLASH;
      case 'Minus': return Key.EC_NEG;
      case 'Equal': return Key.EC_CIRCFLX;
      case 'IntlRo': return Key.EC_NONE;
      case 'IntlYen': return Key.EC_NONE;
      case 'Backspace': return Key.EC_BKSPACE;

      case 'AltLeft': return Key.EC_TORIKE;
      case 'AltRight': return Key.EC_JIKKOU;
      case 'CapsLock': return Key.EC_CAPS;
      case 'ControlLeft': return Key.EC_CTRL;
      case 'ControlRight': return Key.EC_UNDSCRE;
      case 'OSLeft': return Key.EC_GRAPH;
      case 'OSRight': return Key.EC_NONE;
      case 'ShiftLeft': return Key.EC_LSHIFT;
      case 'ShiftRight': return Key.EC_RSHIFT;
      case 'ContextMenu': return Key.EC_NONE;
      case 'Enter': return Key.EC_RETURN;
      case 'Space': return Key.EC_SPACE;
      case 'Tab': return Key.EC_TAB;
      case 'Delete': return Key.EC_NONE;
      case 'End': return Key.EC_NONE;
      case 'Help': return Key.EC_NONE;
      case 'Home': return Key.EC_NONE;
      case 'Insert': return Key.EC_NONE;
      case 'PageDown': return Key.EC_NONE;
      case 'PageUp': return Key.EC_NONE;
      case 'ArrowDown': return Key.EC_DOWN;
      case 'ArrowLeft': return Key.EC_LEFT;
      case 'ArrowRight': return Key.EC_RIGHT;
      case 'ArrowUp': return Key.EC_UP;
      case 'Escape': return Key.EC_NONE;
      case 'PrintScreen': return Key.EC_NONE;
      case 'ScrollLock': return Key.EC_NONE;
      case 'Pause': return Key.EC_PAUSE;

      case 'F1': return Key.EC_F1;
      case 'F2': return Key.EC_F2;
      case 'F3': return Key.EC_F3;
      case 'F4': return Key.EC_F4;
      case 'F5': return Key.EC_F5;

      case 'NumLock': return Key.EC_NONE;
      case 'Numpad0': return Key.EC_NUM0;
      case 'Numpad1': return Key.EC_NUM1;
      case 'Numpad2': return Key.EC_NUM2;
      case 'Numpad3': return Key.EC_NUM3;
      case 'Numpad4': return Key.EC_NUM4;
      case 'Numpad5': return Key.EC_NUM5;
      case 'Numpad6': return Key.EC_NUM6;
      case 'Numpad7': return Key.EC_NUM7;
      case 'Numpad8': return Key.EC_NUM8;
      case 'Numpad9': return Key.EC_NUM9;
      case 'NumpadAdd': return Key.EC_NUMADD;
      case 'NumpadComma': return Key.EC_NUMCOM;
      case 'NumpadDecimal': return Key.EC_NUMPER;
      case 'NumpadSubtract': return Key.EC_NUMSUB;
      case '"NumpadDivide': return Key.EC_NUMDIV;
      case 'NumpadMultiply': return Key.EC_NUMMUL;
    }
    return Key.EC_NONE;
  }

  private lastSyncTime = 0;
  private glRenderer = new WebGlRenderer();

  private webAudio = new WebAudio();

  private diskManager = new DiskManager();

  // MSX components
  private board?: Board;
  private vdp?: Vdp;
  private msxpsg?: MsxPsg;
  private msxPpi?: MsxPpi;
  private ram?: Mapper;
  private msxRom?: Mapper;
  private gameRom?: Mapper;
  private diskRom?: Mapper;
}