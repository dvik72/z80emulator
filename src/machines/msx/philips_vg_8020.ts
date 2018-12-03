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
import { WebGlRenderer } from '../../video/webglrenderer';
import { WebAudio } from '../../audio/webaudio';
import { Board } from '../../core/board';
import { MsxPpi } from '../../io/msxppi';
import { MsxPsg } from '../../io/msxpsg';
import { Vdp, VdpVersion, VdpSyncMode, VdpConnectorType } from '../../video/vdp';
import { CPU_ENABLE_M1, MASTER_FREQUENCY } from '../../z80/z80';

import { Mapper } from '../../mappers/mapper';
import { MapperRamNormal } from '../../mappers/ramnormal';
import { MapperRomNormal } from '../../mappers/romnormal';

import { msxDosRom } from '../../nano/msxdosrom';


export class PanasonicFsA1 extends Machine {
  public constructor(
    private glRenderer: WebGlRenderer,
    private webAudio: WebAudio
  ) {
    super('Philips VG-8020');
  }

  public init(): void {
    // Initialize board components
    this.board = new Board(this.webAudio, CPU_ENABLE_M1, true);
    this.board.getSlotManager().setSubslotted(3, true);
    this.msxPpi = new MsxPpi(this.board);
    this.vdp = new Vdp(this.board, VdpVersion.TMS9929A, VdpSyncMode.SYNC_AUTO, VdpConnectorType.MSX, 1);
    this.msxpsg = new MsxPsg(this.board, 2);

    this.msxRom = new MapperRomNormal(this.board, 0, 0, 0, msxDosRom);
    this.ram = new MapperRamNormal(this.board, 3, 0, 0, 0x10000);
  }

  public reset(): void {
    this.msxPpi && this.msxPpi.reset();
    this.vdp && this.vdp.reset();
    this.msxpsg && this.msxpsg.reset();
    this.board && this.board.reset();
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
    this.msxPpi && this.msxPpi.keyDown(keyCode);
  }

  // MSX components
  private board?: Board;
  private vdp?: Vdp;
  private msxpsg?: MsxPsg;
  private msxPpi?: MsxPpi;
  private ram?: Mapper;
  private msxRom?: Mapper;
}
