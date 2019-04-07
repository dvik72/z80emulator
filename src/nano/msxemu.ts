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

import { InputConfig } from './inputconfig';
import { Machine } from '../machines/machine';
import { MachineManager } from '../machines/machinemanager';
import { MediaInfoFactory, MediaInfo, MediaType } from '../util/mediainfo';
import { LedManager, LedType } from '../core/ledmanager';
import { WebGlRenderer } from '../video/webglrenderer';
import { WebAudio } from '../audio/webaudio';
import { getSupportedCartridgeTypes, getSupportedCartridgeTypeNames } from '../mappers/mapperfactory';

import { DiskManager } from '../disk/diskmanager';

import { UserPrefs } from './userprefs';
import { PngSaveState } from '../util/pngsavestate';
import { Fullscreen } from '../util/fullscreen';
import { Input } from '../input/input';
import { JoystickPortManager } from '../input/joystickportmanager';
import { MsxJoystick } from '../input/msxjoystick';

/// <reference path="../../js/filesaver.d.ts" />


class SpecialRom {
  constructor(
    public mediaInfo: MediaInfo,
    public filename?: string
  ) {}
}

let SPECIAL_ROMS: { [romType: string]: SpecialRom ; } = { };

const WINDOW_SIZES = [
  [0, 'Auto'],
  [0.75, '0.75x'],
  [1, '1x'],
  [1.5, '1.5x'],
  [2, '2x']
]

const AUDIO_BUFFER_SIZES = [
  [0, 'Auto'],
  [0.01, '10ms'],
  [0.02, '20ms'],
  [0.035, '35ms'],
  [0.05, '50ms'],
  [0.075, '75ms'],
  [0.1, '100ms'],
  [0.2, '200ms'],
]

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
    document.addEventListener('setwindowsize', this.setWindowSize.bind(this));
    document.addEventListener('setaudiobuffersize', this.setAudioBufferSize.bind(this));
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
    window.addEventListener('resize', this.resize.bind(this));
    document.addEventListener('fullscreen', this.toggleFullscreen.bind(this));
    document.addEventListener('power', this.onPower.bind(this));
    document.addEventListener('savestate', this.onSaveState.bind(this));
    document.addEventListener('inputconfig', this.onInputConfig.bind(this));

    this.userPrefs.load();

    Input.init(this.userPrefs.get().inputConfig);
    this.userPrefs.get().inputConfig = Input.serialize();

    JoystickPortManager.registerJoystick(0, new MsxJoystick());
    JoystickPortManager.registerJoystick(1, new MsxJoystick());

    this.createMachineMenu();
    this.createCartSpecialMenu();
    this.createCartTypeMenu();
    this.createWindowSizeMenu();
    this.createAudioBufferSizeMenu();

    this.updateWindowSize(this.userPrefs.get().windowSize);
    this.updateAudioBufferSize(this.userPrefs.get().audioBufferSize);

    this.setMachine(this.userPrefs.get().machineName);

    requestAnimationFrame(this.refreshScreen);

    this.inputConfig = new InputConfig(this.userPrefs);    
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

  private createWindowSizeMenu(): void {
    const windowSizeDiv = document.getElementById('windowsize-menu');

    for (let i in WINDOW_SIZES) {
      const menuItem = '<button class="dropdown-item btn-sm" type="button" id="windowsize-' + i + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'setwindowsize\', {detail: \'' + i + '\'}));">' + WINDOW_SIZES[i][1] + '</button>';
      windowSizeDiv!.innerHTML += menuItem;
    }
  }

  private createAudioBufferSizeMenu(): void {
    const audioBufferSizeDiv = document.getElementById('audiobuffersize-menu');

    for (let i in AUDIO_BUFFER_SIZES) {
      const menuItem = '<button class="dropdown-item btn-sm" type="button" id="audiobuffersize-' + i + '" onclick="javascript: document.dispatchEvent(new CustomEvent(\'setaudiobuffersize\', {detail: \'' + i + '\'}));">' + AUDIO_BUFFER_SIZES[i][1] + '</button>';
      audioBufferSizeDiv!.innerHTML += menuItem;
    }
  }

  private onPower(event: CustomEvent): void {
    if (event.detail == 'reset') {
      this.resetEmulation();
    } else if (event.detail == 'pause') {
      if (this.isRunning) {
        this.pauseEmulation();
      }
      else {
        this.resumeEmulation();
      }
    }
  }

  private onInputConfig(event: CustomEvent): void {
    this.inputConfig!.show();
  }

  private onSaveState(event: CustomEvent): void {
    if (event.detail == 'quickload') {
      this.quickLoadState();
    } else if (event.detail == 'quicksave') {
      this.quickSaveState();
    } else if (event.detail == 'load') {
      this.loadState();
    } else if (event.detail == 'save') {
      this.saveState();
    }
  }

  private changeMachine(event: CustomEvent): void {
    this.setMachine(event.detail);
  }

  private resize(event?: Event): void {
    event && event.preventDefault();

    this.updateWindowSize(this.windowSize);
  }

  private setWindowSize(event: CustomEvent): void {
    this.updateWindowSize(event.detail);
    this.userPrefs.save();
  }

  private updateWindowSize(windowSize: number): void {
    let height = Fullscreen.fullscreenElement() ? 0 : +WINDOW_SIZES[windowSize][0] * 480;

    const leftBarDiv = document.getElementById('emuLeftBar');
    const leftBarWidth = leftBarDiv!.clientWidth;
    const rightBarDiv = document.getElementById('emuRightBar');
    const rightBarWidth = rightBarDiv!.clientWidth;

    if (height == 0) {
      let width = window.innerWidth || document.documentElement!.clientWidth;
      height = window.innerHeight || document.documentElement!.clientHeight;

      height = Math.max(240, Math.min(height, (width - leftBarWidth - rightBarWidth) * 3 / 4) - 20);
    }

    let width = (height + 30) * 4 / 3 + leftBarWidth + rightBarWidth - 30;

    const emulatorDiv = document.getElementById('emuContainer');
    emulatorDiv!.style.width = width + 'px';
    emulatorDiv!.style.height = height + 'px';

    if (windowSize != this.windowSize) {
      let sizeMenuId = 'windowsize-' + this.windowSize;
      let sizeItemDiv = document.getElementById(sizeMenuId);
      sizeItemDiv && (<HTMLButtonElement>sizeItemDiv!).classList.remove('active');

      this.windowSize = windowSize;
      this.userPrefs.get().windowSize = windowSize;

      sizeMenuId = 'windowsize-' + this.windowSize;
      sizeItemDiv = document.getElementById(sizeMenuId);
      sizeItemDiv && (<HTMLButtonElement>sizeItemDiv!).classList.add('active');
    }
  }

  private toggleFullscreen(event?: Event): void {
    const emuDiv = document.getElementById('windowContainer');
    if (Fullscreen.fullscreenElement()) {
      Fullscreen.exitFullscreen();
    }
    else {
      Fullscreen.requestFullscreen(emuDiv!);
    }
  }

  private setAudioBufferSize(event: CustomEvent): void {
    this.updateAudioBufferSize(event.detail);
    this.userPrefs.save();
  }

  private updateAudioBufferSize(audioBufferSize: number): void {
    this.webAudio.setBufferSize(+AUDIO_BUFFER_SIZES[audioBufferSize][0]);
    if (audioBufferSize != this.audioBufferSize) {
      let sizeMenuId = 'audiobuffersize-' + this.audioBufferSize;
      let sizeItemDiv = document.getElementById(sizeMenuId);
      sizeItemDiv && (<HTMLButtonElement>sizeItemDiv!).classList.remove('active');

      this.audioBufferSize = audioBufferSize;
      this.userPrefs.get().audioBufferSize = audioBufferSize;

      sizeMenuId = 'audiobuffersize-' + this.audioBufferSize;
      sizeItemDiv = document.getElementById(sizeMenuId);
      sizeItemDiv && (<HTMLButtonElement>sizeItemDiv!).classList.add('active');
    }
  }

  private setMachine(machineName: string, machineRomState?: any): void {
    console.log("Set Machine " + machineName);

    if (this.machine) {
      const oldMachineDiv = document.getElementById('machine-' + this.machine!.getName());
      oldMachineDiv!.classList.remove('active');
    }
    this.machine = this.machineManager.createMachine(machineName, machineRomState);
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

    this.pauseEmulation();
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
      if (file.name.slice(-3).toLowerCase() == 'png') {
        type = MediaType.SAVESTATE;
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
    if (type == MediaType.SAVESTATE) {
      let state = PngSaveState.decode(data);
      if (state) {
        this.setState(state);
      }
    }
    if (type == MediaType.FLOPPY) {
      if (!mediaInfo) {
        mediaInfo = new MediaInfo(filename, '', 1900, '', MediaType.FLOPPY, data);
      }
      this.diskMedia[slot] = mediaInfo;
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
    this.ejectMedia(event.detail);
  }

  private ejectMedia(menuId: string): void {
    let romTypeMenuId = '';

    switch (menuId) {
      case 'eject-disk0': {
        this.diskMedia[0] = undefined;
        this.diskManager.ejectFloppyImage(0);
        break;
      }
      case 'eject-disk1': {
        this.diskMedia[1] = undefined;
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

    const menuItemDiv = document.getElementById(menuId);
    (<HTMLButtonElement>menuItemDiv!).disabled = true;

    if (romTypeMenuId.length > 0) {
      const menuItemDiv = document.getElementById(romTypeMenuId);
      (<HTMLButtonElement>menuItemDiv!).disabled = true;
    }
  }

  private fileEvent(event: CustomEvent): void {
    let slot = 0;
    let type = MediaType.UNKNOWN;

    switch (event.detail) {
      case 'load-state': {
        slot = 0;
        type = MediaType.SAVESTATE;
        break;
      }
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
      event.preventDefault();
      if (event.target instanceof HTMLInputElement) {
        const file = (<any>event.target.files)[0];
        if (file instanceof File) {
          this.loadMedia(slot, type, file);
        }
      };
    };

    (element! as HTMLInputElement).value = '';
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
    this.resumeEmulation();
  }

  private pauseEmulation(): void {
    const element = document.getElementById('emu-pause');
    if (element) {
      element.innerHTML = 'Resume';
    }
    this.isRunning = false;
  }

  private resumeEmulation(): void {
    const element = document.getElementById('emu-pause');
    if (element) {
      element.innerHTML = 'Pause';
    }

    this.isRunning = true;
    this.runCount = 0;
    this.emulationTime = 0;
    this.wallTime = window.performance.now();
    this.lastSyncTime = window.performance.now();
    this.runStep();
  }

  private resetEmulation(): void {
    this.pauseEmulation();
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
    Input.pollGamepads();

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
    Input.keyDown(event.code);
    //if (event.code == 'KeyD') {
    //  console.log('Trigger ASM dump');
    //  this.machine!.dumpAsm(1000);
    //}

    if (0) {
      if (event.code == 'KeyQ') {
        this.quickSaveState();
      }
      if (event.code == 'KeyW') {
        this.quickLoadState();
      }
    }
  }

  private loadState(): void {
  }

  private saveState(): void {
    if (!this.machine) {
      return;
    }

    let state = this.getState();

//    var blob = new Blob([JSON.stringify(state)], { type: "text/plain;charset=utf-8" });
//    saveAs(blob, 'savestate.sta');

    const frameBuffer = this.machine.getFrameBuffer();
    const width = this.machine.getFrameBufferWidth();
    const height = this.machine.getFrameBufferHeight();

    if (frameBuffer) {
      const date = new Date();
      const dateString =
        date.getFullYear() + '-' +
        ('00' + date.getMonth()).slice(-2) + '-' +
        ('00' + date.getDate()).slice(-2) + '_' +
        ('00' + date.getHours()).slice(-2) + '-' +
        ('00' + date.getMinutes()).slice(-2) + '-' +
        ('00' + date.getSeconds()).slice(-2);


      var blob = new Blob([PngSaveState.encode(state, frameBuffer, width, height)], { type: 'image/png' });
      saveAs(blob, 'bluemsx-savestate_' + dateString + '.png');
    }
  }

  private quickLoadState(): void {
    if (this.savedState) {
      this.setState(this.savedState);
    }
  }

  private quickSaveState(): void {
    this.savedState = this.getState();
  }

  private getState(): any {
    let state: any = {};

    state.machineName = this.machine!.getName();
    state.machine = this.machine!.getState();
    state.machineRomState = this.machine!.getRomState();

    state.romMedia = [];
    for (let i = 0; i < this.romMedia.length; i++) {
      const romMedia = this.romMedia[i];
      state.romMedia[i] = romMedia ? romMedia.getState() : undefined;
    }

    state.diskMedia = [];
    for (let i = 0; i < this.diskMedia.length; i++) {
      const diskMedia = this.diskMedia[i];
      state.diskMedia[i] = diskMedia ? diskMedia.getState() : undefined;
    }

    state.diskManager = this.diskManager.getState();

    return state;
  }

  private setState(state: any): void {
    for (let i = 0; i < this.romMedia.length; i++) {
      const romMedia = state.romMedia[i];
      if (romMedia) {
        const mediaInfo = new MediaInfo('', '', 0, '', MediaType.UNKNOWN, new Uint8Array(0));
        mediaInfo.setState(romMedia);
        this.mediaLoaded('', MediaType.ROM, i, new Uint8Array(0), mediaInfo);
      }
      else {
        this.ejectMedia('eject-cart' + i);
      }
    }
    for (let i = 0; i < this.diskMedia.length; i++) {
      const diskMedia = state.diskMedia[i];
      if (diskMedia) {
        const mediaInfo = new MediaInfo('', '', 0, '', MediaType.UNKNOWN, new Uint8Array(0));
        mediaInfo.setState(diskMedia);
        this.mediaLoaded('', MediaType.FLOPPY, i, new Uint8Array(0), mediaInfo);
      }
      else {
        this.ejectMedia('eject-disk' + i);
      }
    }

    this.diskManager.setState(state.diskManager);

    this.setMachine(state.machineName, state.machineRomState);
    this.machine!.setState(state.machine);
  }
  
  private keyUp(event: KeyboardEvent): void {
    event.preventDefault();
    Input.keyUp(event.code);
  }

  private inputConfig?: InputConfig;
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
  private diskMedia = new Array<MediaInfo | undefined>(2);
  private mediaInfoFactory = new MediaInfoFactory();

  private userPrefs = new UserPrefs();

  private windowSize = -1;
  private audioBufferSize = -1;

  private savedState: any;
}
