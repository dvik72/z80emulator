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
import { Rtc } from '../../io/rtc';
import { Vdp, VdpVersion, VdpSyncMode, VdpConnectorType } from '../../video/vdp';
import { CPU_ENABLE_M1, MASTER_FREQUENCY, CPU_VDP_IO_DELAY } from '../../z80/z80';

import { Mapper } from '../../mappers/mapper';
import { mapperFromMediaInfo } from '../../mappers/mapperfactory';


export class MsxTrBase extends Machine {
  public constructor(
    name: string,
    private webAudio: WebAudio,
    private diskManager: DiskManager,
    private ledManager: LedManager,
    romNames: string[]
  ) {
    super(name, romNames);
  }

  public init(): void {
    this.mappers = [];

    // Initialize board components
    this.board = new Board(this.webAudio, this.ledManager, CPU_ENABLE_M1 | CPU_VDP_IO_DELAY, true, true, true);
    this.board.getSlotManager().setSubslotted(0, true);
    this.board.getSlotManager().setSubslotted(3, true);
    this.msxPpi = new MsxPpi(this.board);
    this.rtc = new Rtc(this.board);
    this.vdp = new Vdp(this.board, VdpVersion.V9958, VdpSyncMode.SYNC_AUTO, VdpConnectorType.MSX, 8);
    this.msxpsg = new MsxPsg(this.board, 2);

    this.diskManager.getFloppyDisk(0).enable(true);
    this.diskManager.getFloppyDisk(1).enable(true);
  }

  public reset(): void {
    this.msxPpi && this.msxPpi.reset();
    this.vdp && this.vdp.reset();
    this.msxpsg && this.msxpsg.reset();
    this.board!.reset();
  }

  public runStep(milliseconds: number): void {
    this.board!.run(MASTER_FREQUENCY * milliseconds / 1000 | 0);
  }

  public getFrameBuffer(): Uint16Array {
    return this.vdp!.getFrameBuffer();
  }

  public getFrameBufferWidth(): number {
    return this.vdp!.getFrameBufferWidth();
  }

  public getFrameBufferHeight(): number {
    return this.vdp!.getFrameBufferHeight();
  }

  public insertRomMedia(mediaInfo: MediaInfo, cartridgeSlot?: number): void {
    cartridgeSlot = cartridgeSlot || 0;

    if (cartridgeSlot >= this.cartrdigeSlots.length) {
      return;
    }

    let slotInfo = this.cartrdigeSlots[cartridgeSlot];
    if (slotInfo) {
      this.cartridgeRoms[cartridgeSlot] = mapperFromMediaInfo(this.board!, mediaInfo, slotInfo[0], slotInfo[1]);
    }
  }

  public dumpAsm(count: number): void {
    this.board!.dumpAsm(count);
  }

  protected addCartridgeSlot(slot: number, subslot: number = 0): void {
    this.cartrdigeSlots.push([slot, subslot]);
  }

  protected getBoard(): Board {
    return this.board!;
  }

  protected getDiskManager(): DiskManager {
    return this.diskManager;
  }

  public getState(): any {
    let state: any = {};

    state.board = this.board!.getState();
    state.vdp = this.vdp!.getState();
    state.msxpsg = this.msxpsg!.getState();
    state.msxPpi = this.msxPpi!.getState();
    state.rtc = this.rtc!.getState();

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
    this.board!.setState(state.board);
    this.vdp!.setState(state.vdp);
    this.msxpsg!.setState(state.msxpsg);
    this.msxPpi!.setState(state.msxPpi);
    this.rtc!.setState(state.rtc);

    for (let i = 0; i < this.mappers.length; i++) {
      this.mappers[i].setState(state.mappers[i]);
    }

    for (let i = 0; i < this.cartridgeRoms.length; i++) {
      const cartridgeRom = this.cartridgeRoms[i];
      cartridgeRom && state.cart[i] && cartridgeRom.setState(state.cart[i]);
    }

    this.board!.mapRamSlots();
  }

  protected addMapper(mapper: Mapper) {
    this.mappers.push(mapper);
  }

  private mappers = new Array<Mapper>();

  // MSX components
  private board?: Board;
  private vdp?: Vdp;
  private msxpsg?: MsxPsg;
  private msxPpi?: MsxPpi;
  private rtc?: Rtc;

  // Cartridge slot info
  private cartrdigeSlots = new Array<number[]>();
  private cartridgeRoms = new Array<Mapper | undefined>(4);
}
