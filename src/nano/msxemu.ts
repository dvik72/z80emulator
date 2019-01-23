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
import { LedManager, LedType } from '../core/ledmanager';
import { WebGlRenderer } from '../video/webglrenderer';
import { WebAudio } from '../audio/webaudio';
import { getSupportedCartridgeTypes, getSupportedCartridgeTypeNames } from '../mappers/mapperfactory';

import { DiskManager } from '../disk/diskmanager';

import { UserPrefs } from './userprefs';

class SpecialRom {
  constructor(
    public mediaInfo: MediaInfo,
    public filename?: string
  ) {}
}

let SPECIAL_ROMS: { [romType: string]: SpecialRom ; } = { };

function initSpecialRoms() {
  SPECIAL_ROMS[MediaType.MSXAUDIO] = new SpecialRom(new MediaInfo('Msx Audio', 'Yamaha', 1988, 'JP', MediaType.MSXAUDIO, new Uint8Array(0)));
  SPECIAL_ROMS[MediaType.MOONSOUND] = new SpecialRom(new MediaInfo('MoonSound', 'Yamaha - Sunrise', 1995, 'NL', MediaType.MOONSOUND, new Uint8Array(0)), 'moonsound');
}

export class MsxEmu {
  constructor() {
    this.runStep = this.runStep.bind(this);
    this.refreshScreen = this.refreshScreen.bind(this);

    initSpecialRoms();
  }

  public run(): void {
    document.addEventListener('setmachine', this.changeMachine.bind(this));
    document.addEventListener('reset', this.resetEmulation.bind(this));
    document.addEventListener('file', this.fileEvent.bind(this));
    document.addEventListener('eject', this.ejectEvent.bind(this));
    document.addEventListener('insertspecial', this.insertSpecialCart.bind(this));
    document.addEventListener('setcarttype', this.setCartType.bind(this));
    document.addEventListener('keydown', this.keyDown.bind(this));
    document.addEventListener('keyup', this.keyUp.bind(this));
    document.addEventListener('drop', this.drop.bind(this));
    document.addEventListener('click', () => { this.webAudio.resume(); });
    document.addEventListener('dragover', (event) => { event.preventDefault(); });
    document.addEventListener('dragenter', (event) => { event.preventDefault(); });
    document.addEventListener('dragleave', (event) => { event.preventDefault(); });

    this.userPrefs.load();

    this.createMachineMenu();
    this.createCartSpecialMenu();
    this.createCartTypeMenu();

    this.setMachine(this.userPrefs.get().machineName);

    requestAnimationFrame(this.refreshScreen);
  }

  private createMachineMenu(): void {
    const machinesDiv = document.getElementById('machines-menu');
    for (const machineName of this.machineManager.getMachineNames()) {
      const machineItem = '<button class="dropdown-item btn-sm" type="button" id="machine-' + machineName + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'setmachine\', {detail: \'' + machineName + '\'}));">' + machineName + '</button>';
      machinesDiv!.innerHTML += machineItem;
    }
  }

  private createCartSpecialMenu(): void {
    const cartADiv = document.getElementById('type-special0');
    const cartBDiv = document.getElementById('type-special1');
    for (const cartType in SPECIAL_ROMS) {
      const cartItemA = '<button class="dropdown-item btn-sm" type="button" id="special0-' + cartType + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'insertspecial\', {detail: [0, \'' + cartType + '\']}));">' + cartType + '</button>';
      const cartItemB = '<button class="dropdown-item btn-sm" type="button" id="special1-' + cartType + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'insertspecial\', {detail: [1, \'' + cartType + '\']}));">' + cartType + '</button>';
      cartADiv!.innerHTML += cartItemA;
      cartBDiv!.innerHTML += cartItemB;
    }
  }

  private createCartTypeMenu(): void {
    const cartADiv = document.getElementById('type-cart0');
    const cartBDiv = document.getElementById('type-cart1');
    for (const cartType of getSupportedCartridgeTypeNames()) {
      const cartItemA = '<button class="dropdown-item btn-sm" type="button" id="type0-' + cartType + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'setcarttype\', {detail: [0, \'' + cartType + '\']}));">' + cartType + '</button>';
      const cartItemB = '<button class="dropdown-item btn-sm" type="button" id="type1-' + cartType + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'setcarttype\', {detail: [1, \'' + cartType + '\']}));">' + cartType + '</button>';
      cartADiv!.innerHTML += cartItemA;
      cartBDiv!.innerHTML += cartItemB;
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
    if (!this.machine) {
      machineName = this.machineManager.getDefaultMachineName();
      this.machine = this.machineManager.createMachine(machineName);
    }

    if (this.userPrefs.get().machineName != machineName) {
      this.userPrefs.get().machineName = machineName;
      this.userPrefs.save();
    }

    const newMachineDiv = document.getElementById('machine-' + this.machine!.getName());
    newMachineDiv!.classList.add('active');

    this.stopEmulation();
    this.machine!.notifyWhenLoaded(this.startEmulation.bind(this));
  }

  private updateLed(ledType: LedType, ledName: string): void {
    const led = this.ledManager.getLed(ledType);
    if (led.hasChanged()) {
      const newMachineDiv = document.getElementById('emu-led-' + ledName);
      if (newMachineDiv) {
        if (led.get()) {
          newMachineDiv && newMachineDiv.classList.add('emu-led-on');
        }
        else {
          newMachineDiv && newMachineDiv.classList.remove('emu-led-on');
        }
      }
    }
  }

  private updateLeds(): void {
    this.updateLed(LedType.FDD1, 'fdd1');
    this.updateLed(LedType.FDD2, 'fdd2');
    this.updateLed(LedType.CAS, 'cas');
    this.updateLed(LedType.HDD, 'hdd');
    this.updateLed(LedType.KANA, 'kana');
    this.updateLed(LedType.CAPS_LOCK, 'caps');
    this.updateLed(LedType.TURBOR, 'r800');
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

  private mediaLoaded(filename: string, type: MediaType, slot: number, data: Uint8Array, mediaInfo?: MediaInfo): void {
    let ejectMenuId = '';
    let romTypeMenuId = '';
    if (type == MediaType.FLOPPY) {
      if (!mediaInfo) {
        mediaInfo = new MediaInfo(filename, '', 1900, '', MediaType.FLOPPY, data);
      }
      this.diskManager.insertFloppyImage(slot, mediaInfo.data);
      ejectMenuId = 'eject-disk' + slot;
    }
    if (type == MediaType.ROM) {
      const oldMediaInfo = this.romMedia[slot];
      if (!mediaInfo) {
        mediaInfo = this.mediaInfoFactory.mediaInfoFromData(data);
      }
      this.romMedia[slot] = mediaInfo;
      ejectMenuId = 'eject-cart' + slot;
      romTypeMenuId = 'romtype-cart' + slot;

      if (oldMediaInfo) {
        let typeName = oldMediaInfo.type.toString();
        if (getSupportedCartridgeTypeNames().indexOf(typeName) < 0) {
          typeName = MediaType.UNKNOWN.toString();
        }
        const typeMenuId = 'type' + slot + '-' + typeName;
        const typeItemDiv = document.getElementById(typeMenuId);
        typeItemDiv && (<HTMLButtonElement>typeItemDiv!).classList.remove('active');
      }

      let typeName = mediaInfo.type.toString();
      if (getSupportedCartridgeTypeNames().indexOf(typeName) < 0) {
        typeName = MediaType.UNKNOWN.toString();
      }
      const typeMenuId = 'type' + slot + '-' + typeName;
      const typeItemDiv = document.getElementById(typeMenuId);
      typeItemDiv && (<HTMLButtonElement>typeItemDiv!).classList.add('active');

      this.resetEmulation();
    }

    if (ejectMenuId.length > 0) {
      const menuItemDiv = document.getElementById(ejectMenuId);
      (<HTMLButtonElement>menuItemDiv!).disabled = false;
    }

    if (romTypeMenuId.length > 0) {
      const menuItemDiv = document.getElementById(romTypeMenuId);
      (<HTMLButtonElement>menuItemDiv!).disabled = false;
    }
  }

  private insertSpecialCart(event: CustomEvent): void {
    const slot = event.detail[0];
    const typeName = event.detail[1];
    const type = this.typeStringToMediaType(typeName);

    const specialRom = SPECIAL_ROMS[type];
    if (specialRom.filename == null) {
      this.mediaLoaded(type.toString(), MediaType.ROM, slot, new Uint8Array(0), specialRom.mediaInfo);
    }
    else {
      this.loadSpecialRom(slot, specialRom, specialRom.filename);
    }
  }

  private typeStringToMediaType(typeName: string): MediaType {
    for (const type of getSupportedCartridgeTypes()) {
      if (type.toString() == typeName) {
        return type;
      }
    }
    return MediaType.UNKNOWN;
  }

  private loadSpecialRom(slot: number, specialRom: SpecialRom, romName: string): void {
    let httpReq = new XMLHttpRequest();
    httpReq.open('GET', '../../systemroms/' + romName + '.bin', true);
    httpReq.responseType = 'arraybuffer';

    const loadSpecialRomComplete = this.loadSpecialRomComplete.bind(this);

    httpReq.onreadystatechange = function () {
      if (httpReq.readyState === XMLHttpRequest.DONE) {
        let romData: Uint8Array | null = null;
        if (httpReq.status == 200) {
          const arrayBuffer = httpReq.response;
          if (arrayBuffer instanceof ArrayBuffer) {
            romData = new Uint8Array(arrayBuffer);
          }
        }
        if (!romData) {
          console.log('Failed loading system rom: ' + romName);
        }
        loadSpecialRomComplete(romName, specialRom, slot, romData);
      }
    };

    httpReq.send(null);
  }

  private loadSpecialRomComplete(romName: string, specialRom: SpecialRom, slot: number, romData: Uint8Array | null): void {
    if (romData) {
      specialRom.mediaInfo.data = romData;
      this.mediaLoaded(romName, MediaType.ROM, slot, romData, specialRom.mediaInfo);
    }
  }

  private setCartType(event: CustomEvent): void {
    const slot = event.detail[0];
    const newTypeName = event.detail[1];
    const mediaInfo = this.romMedia[+slot];
    if (mediaInfo) {
      let typeName = mediaInfo.type.toString();
      mediaInfo.type = MediaType.UNKNOWN;
      for (const validType of getSupportedCartridgeTypes()) {
        if (validType.toString() == newTypeName) {
          mediaInfo.type = validType;
        }
      }
      this.resetEmulation();
      
      if (getSupportedCartridgeTypeNames().indexOf(typeName) < 0) {
        typeName = MediaType.UNKNOWN.toString();
      }
      let typeMenuId = 'type' + slot + '-' + typeName;
      let typeItemDiv = document.getElementById(typeMenuId);
      typeItemDiv && (<HTMLButtonElement>typeItemDiv!).classList.remove('active');

      typeName = mediaInfo.type.toString();
      if (getSupportedCartridgeTypeNames().indexOf(typeName) < 0) {
        typeName = MediaType.UNKNOWN.toString();
      }
      typeMenuId = 'type' + slot + '-' + typeName;
      typeItemDiv = document.getElementById(typeMenuId);
      typeItemDiv && (<HTMLButtonElement>typeItemDiv!).classList.add('active');

    }
  }

  private ejectEvent(event: CustomEvent): void {
    let romTypeMenuId = '';

    switch (event.detail) {
      case 'eject-disk0': {
        this.diskManager.ejectFloppyImage(0);
        break;
      }
      case 'eject-disk1': {
        this.diskManager.ejectFloppyImage(1);
        break;
      }
      case 'eject-cart0': {
        this.romMedia[0] = undefined;
        this.resetEmulation();
        romTypeMenuId = 'romtype-cart0';
        break;
      }
      case 'eject-cart1': {
        this.romMedia[1] = undefined;
        this.resetEmulation();
        romTypeMenuId = 'romtype-cart1';
        break;
      }
    }

    const menuItemDiv = document.getElementById(event.detail);
    (<HTMLButtonElement>menuItemDiv!).disabled = true;

    if (romTypeMenuId.length > 0) {
      const menuItemDiv = document.getElementById(romTypeMenuId);
      (<HTMLButtonElement>menuItemDiv!).disabled = true;
    }
  }

  private fileEvent(event: CustomEvent): void {
    let slot = 0;
    let type = MediaType.FLOPPY;

    switch (event.detail) {
      case 'insert-cart0': {
        slot = 0;
        type = MediaType.ROM;
        break;
      }
      case 'insert-cart1': {
        slot = 1;
        type = MediaType.ROM;
        break;
      }
      case 'insert-disk0': {
        slot = 0;
        type = MediaType.FLOPPY;
        break;
      }
      case 'insert-disk1': {
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
    const romMedia0 = this.romMedia[0];
    romMedia0 && this.machine.insertRomMedia(romMedia0, 0);

    const romMedia1 = this.romMedia[1];
    romMedia1 && this.machine.insertRomMedia(romMedia1, 1);

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
      const element = document.getElementById('emu-cpu-usage');
      if (element) {
        element.innerHTML = 'CPU: ' + cpuUsage;
      }
      this.wallTime = 0;
      this.emulationTime = 0;
    }

    this.lastSyncTime += elapsedTime;
    if (this.isRunning && this.machine) {
      this.runCount += elapsedTime;
      if (this.runCount > 200) {
        this.runCount = 0;
      }
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
    this.updateLeds();
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
  private ledManager = new LedManager();
  private machineManager = new MachineManager(this.webAudio, this.diskManager, this.ledManager);

  private romMedia = new Array<MediaInfo | undefined>(2);
  private mediaInfoFactory = new MediaInfoFactory();

  private userPrefs = new UserPrefs();
}
