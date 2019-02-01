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

import { Board, InterruptVector } from '../core/board';
import { Port } from '../core/iomanager';
import { I8251 } from './i8251';
import { I8254 } from './i8254';
import { Mapper } from '../mappers/mapper';
import { SaveState } from '../core/savestate';


export class MsxMidi extends Mapper {
  constructor(
    private board: Board,
    private isExternal = false
  ) {
    super(' MSX Midi');

    this.readIo = this.readIo.bind(this);
    this.writeIo = this.writeIo.bind(this);

    this.i8254 = new I8254(board, 4000000, undefined, undefined, this.pitOut2.bind(this));
    this.i8251 = new I8251(
      board, 4000000,
      this.transmit.bind(this),
      undefined, // signal
      undefined, // setDataBits
      undefined, // setStopBits
      undefined, // setParity
      this.setRxRdyIrq.bind(this),
      this.enableTimerIrq.bind(this),
      this.enableRxRdyIrq.bind(this),
      this.getDtr.bind(this),
      this.getRts.bind(this));

    if (this.isExternal) {
      this.board.getIoManager().registerPort(0xe2, new Port(undefined, this.writeIoE2.bind(this)));
    }
    else {
      this.registerIoPorts(0xe8);
    }

    this.reset();
  }

  public reset() {
    this.board.clearInt(InterruptVector.MIDI_TMR);
    this.board.clearInt(InterruptVector.MIDI_RXRDY);

    this.timerIrqLatch = false;
    this.timerIrqEnabled = false;
    this.rxRdyIrqLatch = false;
    this.rxRdyIrqEnabled = false;

    if (this.isExternal) {
      this.unregisterIoPorts();
    }

    this.i8251.reset();
    this.i8254.reset();
  }

  private unregisterIoPorts() {
    if (this.ioStart == 0) {
      return;
    }

    for (let i = 0; i < (this.ioStart == 0xe0 ? 2 : 8); i++) {
      this.board.getIoManager().unregisterPort(this.ioStart + i);
    }

    this.ioStart = 0;
  }

  private registerIoPorts(ioStart: number): void {
    if (this.ioStart == ioStart) {
      return;
    }

    if (this.ioStart != 0) {
      this.unregisterIoPorts();
    }

    this.ioStart = ioStart;

    let i = this.ioStart == 0xe0 ? 2 : 8;
    while (i--) {
      this.board.getIoManager().registerPort(ioStart + i, new Port(this.readIo, this.writeIo));
    }
  }

  private readIo(ioPort: number): number {
    switch (ioPort & 7) {
      case 0: // UART data register
      case 1: // UART status register
        return this.i8251.read(ioPort & 3);
        break;
      case 2: // timer interrupt flag off
      case 3: // no function
        return 0xff;
      case 4: // counter 0 data port
      case 5: // counter 1 data port
      case 6: // counter 2 data port
      case 7: // timer command register
        return this.i8254.read(ioPort & 3);
    }
    return 0xff;
  }

  private writeIoE2(ioPort: number, value: number): void {
    if ((ioPort & 0xff) == 0xe2) {
      const ioStart = (value & 1) ? 0xe0 : 0xe8;
      if (value & 0x80) {
        this.unregisterIoPorts();
      }
      else {
        this.registerIoPorts(ioStart);
      }
    }
  }

  private writeIo(ioPort: number, value: number): void {
    switch (ioPort & 7) {
      case 0: // UART data register
      case 1: // UART command register
        this.i8251.write(ioPort & 3, value);
        break;
      case 2: // timer interrupt flag off
        this.setTimerIrq(false);
        break;
      case 3: // no function
        break;
      case 4: // counter 0 data port
      case 5: // counter 1 data port
      case 6: // counter 2 data port
      case 7: // timer command register
        this.i8254.write(ioPort & 3, value);
        break;
    }
  }


  private setTimerIrq(status: boolean): void {
    if (this.timerIrqLatch != status) {
      this.timerIrqLatch = status;
      if (this.timerIrqEnabled) {
        if (this.timerIrqLatch) {
          this.board.setInt(InterruptVector.MIDI_TMR);
        }
        else {
          this.board.clearInt(InterruptVector.MIDI_TMR);
        }
      }

      this.i8254.setGate(2, this.timerIrqEnabled && !this.timerIrqLatch);
    }
  }

  private enableTimerIrq(enabled: boolean) {
    if (this.timerIrqEnabled != enabled) {
      this.timerIrqEnabled = enabled;
      if (this.timerIrqLatch) {
        if (this.timerIrqEnabled) {
          this.board.setInt(InterruptVector.MIDI_TMR);
        }
        else {
          this.board.clearInt(InterruptVector.MIDI_TMR);
        }
      }
      this.i8254.setGate(2, this.timerIrqEnabled && !this.timerIrqLatch);
    }
  }

  private setRxRdyIrq(status: boolean): void {
    if (this.rxRdyIrqLatch != status) {
      this.rxRdyIrqLatch = status;
      if (this.rxRdyIrqEnabled) {
        if (this.rxRdyIrqLatch) {
          this.board.setInt(InterruptVector.MIDI_RXRDY);
        }
        else {
          this.board.clearInt(InterruptVector.MIDI_RXRDY);
        }
      }
    }
  }

  private enableRxRdyIrq(enabled: boolean): void {
    if (this.rxRdyIrqEnabled != enabled) {
      this.rxRdyIrqEnabled = enabled;
      if (!this.rxRdyIrqEnabled && this.rxRdyIrqLatch) {
        this.board.clearInt(InterruptVector.MIDI_RXRDY);
      }
    }
  }

  private transmit(value: number): void {
    //midiIoTransmit(value);
  }

  private getDtr(): boolean {
    return this.board.getInt(InterruptVector.MIDI_TMR);
  }

  private getRts() {
    return true;
  }

  private pitOut2(state: boolean): void {
    this.setTimerIrq(true); // Q: should it be state??
  }

  public getState(): any {
    let state: any = {};

    state.timerIrqLatch = this.timerIrqLatch;
    state.timerIrqEnabled = this.timerIrqEnabled;
    state.rxRdyIrqLatch = this.rxRdyIrqLatch;
    state.rxRdyIrqEnabled = this.rxRdyIrqEnabled;

    state.i8251 = this.i8251.getState();
    state.i8254 = this.i8254.getState();

    state.ioStart = this.ioStart;

    return state;
  }

  public setState(state: any): void {
    this.timerIrqLatch = state.timerIrqLatch;
    this.timerIrqEnabled = state.timerIrqEnabled;
    this.rxRdyIrqLatch = state.rxRdyIrqLatch;
    this.rxRdyIrqEnabled = state.rxRdyIrqEnabled;

    this.i8251.setState(state.i8251);
    this.i8254.setState(state.i8254);

    this.registerIoPorts(+state.ioStart);
  }

  private ioStart = 0;
  private timerIrqLatch = false;
  private timerIrqEnabled = false;
  private rxRdyIrqLatch = false;
  private rxRdyIrqEnabled = false;

  private i8251: I8251;
  private i8254: I8254;
}