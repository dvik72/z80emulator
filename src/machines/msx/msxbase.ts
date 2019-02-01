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

import { Machine } from '../machine';
import { WebAudio } from '../../audio/webaudio';
import { DiskManager } from '../../disk/diskmanager';
import { LedManager } from '../../core/ledmanager';
import { MediaInfo } from '../../util/mediainfo';
import { SaveState } from '../../core/savestate';

import { Board } from '../../core/board';
import { MsxPpi } from '../../io/msxppi';
import { MsxPsg } from '../../io/msxpsg';
import { Vdp, VdpVersion, VdpSyncMode, VdpConnectorType } from '../../video/vdp';
import { CPU_ENABLE_M1, MASTER_FREQUENCY } from '../../z80/z80';

import { Mapper } from '../../mappers/mapper';
import { mapperFromMediaInfo } from '../../mappers/mapperfactory';

export abstract class MsxBase extends Machine {
  public constructor(
    name: string,
    private webAudio: WebAudio,
    private diskManager: DiskManager,
    private ledManager: LedManager,
    romNames: string[]
  ) {
    super(name, romNames);

    this.board = new Board(this.webAudio, this.ledManager, CPU_ENABLE_M1, true);
  }

  public init(): void {
    this.mappers = [];

    // Clear cartridge slots
    this.cartrdigeSlots = new Array<number[]>();

    // Initialize board components
    this.board = new Board(this.webAudio, this.ledManager, CPU_ENABLE_M1, true);
    this.msxPpi = new MsxPpi(this.board);
    this.vdp = new Vdp(this.board, VdpVersion.TMS9929A, VdpSyncMode.SYNC_AUTO, VdpConnectorType.MSX, 1);
    this.msxpsg = new MsxPsg(this.board, 2);
    
    this.diskManager.getFloppyDisk(0).enable(true);
    this.diskManager.getFloppyDisk(1).enable(true);
  }

  public reset(): void {
    this.msxPpi && this.msxPpi.reset();
    this.vdp && this.vdp.reset();
    this.msxpsg && this.msxpsg.reset();
    this.board && this.board.reset();
  }

  public dumpAsm(): void {
    this.board.dumpAsm();
  }

  public runStep(milliseconds: number): void {
    this.board && this.board.run(MASTER_FREQUENCY * milliseconds / 1000 | 0);
  }

  public getFrameBuffer(): Uint16Array | null {
    return this.vdp ? this.vdp.getFrameBuffer() : null;
  }

  public getFrameBufferWidth(): number {
    return this.vdp ? this.vdp.getFrameBufferWidth() : 0;
  }

  public getFrameBufferHeight(): number {
    return this.vdp ? this.vdp.getFrameBufferHeight() : 0;
  }

  public keyDown(keyCode: string): void {
    this.msxPpi && this.msxPpi.keyDown(keyCode);
  }

  public keyUp(keyCode: string): void {
    this.msxPpi && this.msxPpi.keyUp(keyCode);
  }

  public insertRomMedia(mediaInfo: MediaInfo, cartridgeSlot?: number): void {
    cartridgeSlot = cartridgeSlot || 0;

    if (!this.board || cartridgeSlot >= this.cartrdigeSlots.length) {
      return;
    }

    let slotInfo = this.cartrdigeSlots[cartridgeSlot];
    if (slotInfo) {
      this.cartridgeRoms[cartridgeSlot] = mapperFromMediaInfo(this.board, mediaInfo, slotInfo[0], slotInfo[1]);
    }
  }

  protected getBoard(): Board {
    return this.board;
  }

  protected addCartridgeSlot(slot: number, subslot: number = 0): void {
    this.cartrdigeSlots.push([slot, subslot]);
  }

  public getState(): any {
    let state: any = {};

    state.board = this.board.getState();
    state.vdp = this.vdp!.getState();
    state.msxpsg = this.msxpsg!.getState();
    state.msxPpi = this.msxPpi!.getState();

    state.mappers = [];
    for (let i = 0; i < this.mappers.length; i++) {
      state.mappers[i] = this.mappers[i].getState();
    }

    state.cart = []
    for (let i = 0; i < this.cartridgeRoms.length; i++) {
      const cartridgeRom = this.cartridgeRoms[i];
      state.cart[i] = cartridgeRom ? cartridgeRom.getState() : undefined;
    }

    return state;
  }

  public setState(state: any): void {
    this.board.setState(state.board);
    this.vdp!.setState(state.vdp);
    this.msxpsg!.setState(state.msxpsg);
    this.msxPpi!.setState(state.msxPpi);

    for (let i = 0; i < this.mappers.length; i++) {
      this.mappers[i].setState(state.mappers[i]);
    }

    for (let i = 0; i < this.cartridgeRoms.length; i++) {
      const cartridgeRom = this.cartridgeRoms[i];
      cartridgeRom && state.cart[i] && cartridgeRom.setState(state.cart[i]);
    }
  }

  protected addMapper(mapper: Mapper) {
    this.mappers.push(mapper);
  }

  private mappers = new Array<Mapper>();

  // Board components
  private board: Board;
  private vdp?: Vdp;
  private msxpsg?: MsxPsg;
  private msxPpi?: MsxPpi;

  // Cartridge slot info
  private cartrdigeSlots = new Array<number[]>();
  private cartridgeRoms = new Array<Mapper | undefined>(4);
}
