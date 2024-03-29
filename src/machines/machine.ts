﻿//////////////////////////////////////////////////////////////////////////////
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

import { MediaInfo } from '../util/mediainfo';
import { SaveState } from '../core/savestate';

export abstract class Machine {

  public constructor(
    private machineName: string,
    private romNames: string[]
  ) { }

  public loadSystemRoms(romState?: any) {
    this.romsPending = 0;
    if (romState) {
      this.setRomState(romState);
    }
    else {
      for (let romName of this.romNames) {
        this.loadSystemRom(romName);
      }
    }
  }

  public getName(): string {
    return this.machineName;
  }

  public notifyWhenLoaded(callback: () => void) {
    this.loadedCb = callback;
    if (this.romsPending == 0) {
      this.loadedCb();
    }
  }

  public abstract init(): void;

  public abstract reset(): void;

  public abstract runStep(milliseconds: number): void;

  public abstract getFrameBuffer(): Uint16Array | null;

  public abstract getFrameBufferWidth(): number;

  public abstract getFrameBufferHeight(): number;

  public abstract insertRomMedia(mediaInfo: MediaInfo, cartridgeSlot?: number): void;

  public getState(): any {
    return {};
  }

  public setState(state: any): void { }

  public dumpAsm(count: number): void { }

  protected getSystemRom(romName: string): Uint8Array {
    return this.romData[romName] || new Uint8Array(0);
  }

  private loadSystemRom(romName: string): void {
    this.romsPending++;

    let httpReq = new XMLHttpRequest();
    httpReq.open('GET', './systemroms/' + romName + '.bin', true);
    httpReq.responseType = 'arraybuffer';

    const loadComplete = this.loadComplete.bind(this);

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
        loadComplete(romName, romData);
      }
    };

    httpReq.send(null);
  }

  private loadComplete(romName: string, romData: Uint8Array | null): void {
    this.romData[romName] = romData;

    if (--this.romsPending == 0 && this.loadedCb) {
      this.loadedCb();
    }
  }

  public getRomState(): any {
    let state: any = {};

    state.romData = {};
    for (const romName of Object.keys(this.romData)) {
      const data = this.romData[romName];
      if (data) {
        state.romData[romName] = SaveState.getArrayState(data);
      }
    }

    return state;
  }

  public setRomState(state: any): void {
    for (const romName of Object.keys(state.romData)) {
      const stateData = state.romData[romName];
      const data = new Uint8Array(stateData.length);
      SaveState.setArrayState(data, stateData);
      this.romData[romName] = data;
    }
  }

  private romData: { [romName: string]: Uint8Array | null; } = {};
  private romsPending = 0;
  private loadedCb?: () => void;
}