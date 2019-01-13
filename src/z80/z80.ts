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


// This code emulates the Z80 / R800 processor.The emulation starts in
// Z80 mode which makes it useful for any Z80 based emulator.
//
// The code has been verified with the 'zexall' test suite.
//
// An internal clock that runs at 21.477270 MHz is being used.However,
// the frequency is scaled down to:
// Z80    3.579545 MHz
// R800   7.159090 MHz
//
// It is possible to chance the clock speed to any frequency in the
// series 21477270 / n where n is an integer greater or equal to 1.
//
// The emulation is driven by subsequent calls to 'r800execute' which
// runs the emulation until the time given as an argument has passed.
// The time used as argument should come from a timer running at
// 2.1477270 MHz(= 6 * normal MSX frequency).
//
//
// References:
// - blueMSX R800 emulation
// - Z80 Family CPU Users Manual, UM008001 - 1000, ZiLOG 2001
// - The Undocumented Z80 Documented version 0.6, Sean Young 2003
// - R800 vs Z80 timing sheet, Tobias Keizer 2004


import { Z80Dasm } from "./z80dasm";

// CPU modes
export enum Z80Mode { UNKNOWN, Z80, R800 }

export const TIMER_RANGE = 0xfffffff;

// Interrupt states
const INT_LOW = 0;
const INT_EDGE = 1;
const INT_HIGH = 2;

// CPU flags
export const CPU_VDP_IO_DELAY = 1;
export const CPU_ENABLE_M1 = 2;

// Status flags.
const C_FLAG = 0x01;
const N_FLAG = 0x02;
const P_FLAG = 0x04;
const V_FLAG = 0x04;
const X_FLAG = 0x08;
const H_FLAG = 0x10;
const Y_FLAG = 0x20;
const Z_FLAG = 0x40;
const S_FLAG = 0x80;

// Frequency of the system clock.
export const MASTER_FREQUENCY = 21477270;

class Register {
  get(): number { return this.v; }
  set(v: number): void { this.v = v & 0xff; }
  inc(): number { ++this.v; return this.v &= 0xff; }
  dec(): number { --this.v; return this.v &= 0xff; }
  add(v: number): number { this.v += v; return this.v &= 0xff; }
  sub(v: number): number { this.v -= v; return this.v &= 0xff; }

  private v: number = 0xff;
}

class RegisterPair {
  get(): number { return this.regH.get() << 8 | this.regL.get(); }
  set(v: number): void { this.regH.set(v >> 8); this.regL.set(v); }
  setLH(l: number, h: number): void { this.regL.set(l); this.regH.set(h); }
  inc(): number { this.regL.inc() || this.regH.inc(); return this.get(); }
  dec(): number { this.regL.get() || this.regH.dec(); this.regL.dec(); return this.get(); }

  postInc(): number { const r = this.get(); this.inc(); return r; }
  postDec(): number { const r = this.get(); this.dec(); return r; }

  get h(): Register { return this.regH; }
  get l(): Register { return this.regL; }

  private regH: Register = new Register();
  private regL: Register = new Register();
}

class RegisterBank {
  constructor() {
    this.reset();
  }

  reset(): void {
    this.af.set(0xffff);
    this.bc.set(0xffff);
    this.de.set(0xffff);
    this.hl.set(0xffff);
    this.ix.set(0xffff);
    this.iy.set(0xffff);
    this.af1.set(0xffff);
    this.bc1.set(0xffff);
    this.de1.set(0xffff);
    this.hl1.set(0xffff);
    this.sh.set(0xffff);
    this.sp.set(0xffff);
    this.pc.set(0x0000);
    this.i.set(0);
    this.r.set(0);
    this.r2.set(0);
  }

  get AF(): RegisterPair { return this.af; }
  get BC(): RegisterPair { return this.bc; }
  get DE(): RegisterPair { return this.de; }
  get HL(): RegisterPair { return this.hl; }
  get IX(): RegisterPair { return this.ix; }
  get IY(): RegisterPair { return this.iy; }
  get PC(): RegisterPair { return this.pc; }
  get SP(): RegisterPair { return this.sp; }
  get AF1(): RegisterPair { return this.af1; }
  get BC1(): RegisterPair { return this.bc1; }
  get DE1(): RegisterPair { return this.de1; }
  get HL1(): RegisterPair { return this.hl1; }
  get SH(): RegisterPair { return this.sh; }
  get I(): Register { return this.i; }
  get R(): Register { return this.r; }
  get R2(): Register { return this.r2; }

  private af = new RegisterPair();
  private bc = new RegisterPair();
  private de = new RegisterPair();
  private hl = new RegisterPair();
  private ix = new RegisterPair();
  private iy = new RegisterPair();
  private pc = new RegisterPair();
  private sp = new RegisterPair();
  private af1 = new RegisterPair();
  private bc1 = new RegisterPair();
  private de1 = new RegisterPair();
  private hl1 = new RegisterPair();
  private sh = new RegisterPair();
  private i = new Register();
  private r = new Register();
  private r2 = new Register();

  iff1 = 0;
  iff2 = 0;
  im = 0;
  halt = false;
  interruptsEnabled = false;
}

// Instruction delay constants. 
class Z80Delay {
  MEM: number = 0;
  MEMOP: number = 0;
  MEMPAGE: number = 0;
  PREIO: number = 0;
  POSTIO: number = 0;
  M1: number = 0;
  XD: number = 0;
  IM: number = 0;
  IM2: number = 0;
  NMI: number = 0;
  PARALLEL: number = 0;
  BLOCK: number = 0;
  ADD8: number = 0;
  ADD16: number = 0;
  BIT: number = 0;
  CALL: number = 0;
  DJNZ: number = 0;
  EXSPHL: number = 0;
  LD: number = 0;
  LDI: number = 0;
  INC: number = 0;
  INC16: number = 0;
  INOUT: number = 0;
  MUL8: number = 0;
  MUL16: number = 0;
  PUSH: number = 0;
  RET: number = 0;
  RLD: number = 0;
  S1990VDP: number = 0;
  T9769VDP: number = 0;
  LDSPHL: number = 0;
  BITIX: number = 0;

  reset(cpuMode: Z80Mode, cpuFrequency: number, cpuFlags: number): void {
    switch (cpuMode) {
      case Z80Mode.Z80:
      default: {
        const freqAdjust = MASTER_FREQUENCY / (cpuFrequency - 1) | 0;

        this.MEM = freqAdjust * 3;
        this.MEMOP = freqAdjust * 3;
        this.MEMPAGE = freqAdjust * 0;
        this.PREIO = freqAdjust * 1;
        this.POSTIO = freqAdjust * 3;
        this.M1 = freqAdjust * ((cpuFlags & CPU_ENABLE_M1) ? 2 : 0);
        this.XD = freqAdjust * 1;
        this.IM = freqAdjust * 2; // should be 4, but currently will break vdp timing
        this.IM2 = freqAdjust * 19;
        this.NMI = freqAdjust * 11;
        this.PARALLEL = freqAdjust * 2;
        this.BLOCK = freqAdjust * 5;
        this.ADD8 = freqAdjust * 5;
        this.ADD16 = freqAdjust * 7;
        this.BIT = freqAdjust * 1;
        this.CALL = freqAdjust * 1;
        this.DJNZ = freqAdjust * 1;
        this.EXSPHL = freqAdjust * 3;
        this.LD = freqAdjust * 1;
        this.LDI = freqAdjust * 2;
        this.INC = freqAdjust * 1;
        this.INC16 = freqAdjust * 2;
        this.INOUT = freqAdjust * 1;
        this.MUL8 = freqAdjust * 0;
        this.MUL16 = freqAdjust * 0;
        this.PUSH = freqAdjust * 1;
        this.RET = freqAdjust * 1;
        this.RLD = freqAdjust * 4;
        this.S1990VDP = freqAdjust * 0;
        this.T9769VDP = freqAdjust * ((cpuFlags & CPU_VDP_IO_DELAY) ? 1 : 0);
        this.LDSPHL = freqAdjust * 2;
        this.BITIX = freqAdjust * 2;
        break;
      }
      case Z80Mode.R800: {
        const freqAdjust = MASTER_FREQUENCY / (cpuFrequency * 2 - 1) | 0;

        this.MEM = freqAdjust * 2;
        this.MEMOP = freqAdjust * 1;
        this.MEMPAGE = freqAdjust * 1;
        this.PREIO = freqAdjust * 0;
        this.POSTIO = freqAdjust * 3;
        this.M1 = freqAdjust * 0;
        this.XD = freqAdjust * 0;
        this.IM = freqAdjust * 0;
        this.IM2 = freqAdjust * 3;
        this.NMI = freqAdjust * 0;
        this.PARALLEL = freqAdjust * 0;
        this.BLOCK = freqAdjust * 1;
        this.ADD8 = freqAdjust * 1;
        this.ADD16 = freqAdjust * 0;
        this.BIT = freqAdjust * 0;
        this.CALL = freqAdjust * 0;
        this.DJNZ = freqAdjust * 0;
        this.EXSPHL = freqAdjust * 0;
        this.LD = freqAdjust * 0;
        this.LDI = freqAdjust * 0;
        this.INC = freqAdjust * 1;
        this.INC16 = freqAdjust * 0;
        this.INOUT = freqAdjust * 0;
        this.MUL8 = freqAdjust * 12;
        this.MUL16 = freqAdjust * 34;
        this.PUSH = freqAdjust * 1;
        this.RET = freqAdjust * 0;
        this.RLD = freqAdjust * 1;
        this.S1990VDP = freqAdjust * 57;
        this.T9769VDP = freqAdjust * ((cpuFlags & CPU_VDP_IO_DELAY) ? 1 : 0);
        this.LDSPHL = freqAdjust * 0;
        this.BITIX = freqAdjust * 0;
        break;
      }
    }
  }
}

export class Z80 {
  public constructor(
    cpuFlags: number,
    readMemCb: (a: number) => number,
    writeMemCb: (a: number, v: number) => void,
    readIoCb: (a: number) => number,
    writeIoCb: (a: number, v: number) => void,
    timeoutCb: () => void
  ) {
    this.cpuFlags = cpuFlags;

    this.readMemCb = readMemCb;
    this.writeMemCb = writeMemCb;
    this.readIoCb = readIoCb;
    this.writeIoCb = writeIoCb;
    this.timeoutCb = timeoutCb;

    this.initTables();
    this.reset();
  }

  // Returns the current system time.
  public getSystemTime(): number {
    return this.systemTime;
  }

  // Returns the system frequency.
  public getSystemFrequency(): number {
    return MASTER_FREQUENCY;
  }

  // Sets the frequency of the CPU mode specified by the cpuMode argument.
  // The selected frequency must be an integer fraction of the master
  // frequency, e.g.R800_MASTER_FREQUENCY / 6. If a non integer fraction
  // is selected the timing tables will become invalid. 
  public setFrequency(frequency: number): void {
    this.frequencyZ80 = frequency;
  }

  // Resets the Z80.
  public reset(): void {
    this.cpuMode = Z80Mode.UNKNOWN;
    this.oldCpuMode = Z80Mode.UNKNOWN;

    this.regBankZ80.reset();
    this.regBankR800.reset();

    this.setMode(Z80Mode.Z80);
    this.switchCpu();

    this.dataBus = 0xff;
    this.defaultDataBus = 0xff;
    this.intState = INT_HIGH;
    this.nmiState = INT_HIGH;
    this.nmiEdge = false;
    this.interruptsEnabled = false;
  }

  // Sets the CPU mode to either Z80 or R800
  public setMode(mode: Z80Mode): void {
    if (this.cpuMode === mode) {
      return;
    }

    this.oldCpuMode = this.cpuMode;
    this.cpuMode = mode;
  }

  // Gets the current CPU mode
  public getMode(): Z80Mode {
    return this.cpuMode;
  }

  // Raises the interrupt line.
  public setInt(): void {
    this.intState = INT_LOW;
  }

  // Clears the interrupt line.
  public clearInt(): void {
    this.intState = INT_HIGH;
  }

  // Raises the non maskable interrupt line.
  public setNmi(): void {
    if (this.nmiState === INT_HIGH) {
      this.nmiEdge = true;
    }
    this.nmiState = INT_LOW;
  }

  // Clears the non maskable interrupt line.
  public clearNmi(): void {
    this.nmiState = INT_HIGH;
  }

  // Sets a timeout at the given time. When CPU execution reaches
  // the time, the timer callback method will be called.
  public setTimeoutAt(time: number): void {
    this.timeout = time;
  }

  public dumpAsm() {
    this.yyyyEnable = 1;
  }

  yyyyEnable = 0;
  yyyy = 0; // TODO: Debug support
  qqqq = 0;

  // Executes CPU instructions until the stopExecution method is called.
  public execute(cpuCycles?: number): void {
    let startingSystemTime = this.systemTime;

    while (!this.terminateFlag) {
      if (cpuCycles && (this.systemTime - startingSystemTime & TIMER_RANGE) >= cpuCycles) {
        break;
      }

      if (((this.timeout - this.systemTime & TIMER_RANGE) >> 25) > 0) {
        this.timeoutCb();
      }

      if (this.oldCpuMode != Z80Mode.UNKNOWN) {
        this.switchCpu();
      }

      if (this.cpuMode === Z80Mode.R800) {
        if ((this.systemTime - this.lastRefreshTime & TIMER_RANGE) > 222 * 3) {
          this.lastRefreshTime = this.systemTime;
          this.addSystemTime(20 * 3);
        }
      }

      if (0) {
        const dasm = new Z80Dasm(this.readMemCb);
        const asm = dasm.dasm(this.regs.PC.get());
        if (asm.slice(0, 3) == 'mul') console.log('Found @ ' + this.yyyy);
        this.yyyy++;
      }
      // TODO: This is just debug support. Remove when done.
      if (0) {
        let start = 100 * 50000;//84990000 - 300000 + 200000 * (64 + 5);
        start = 6334000;
        if (this.yyyy < start + 1000) {
          if (this.yyyy >= start) {// && this.yyyy % 10000 == 0) {
            //console.log(this.yyyy);
            const dasm = new Z80Dasm(this.readMemCb);
            const asm = dasm.dasm(this.regs.PC.get());
            const regs =
              ' AF:' + ('0000' + this.regs.AF.get().toString(16)).slice(-4) + ' BC:' + ('0000' + this.regs.BC.get().toString(16)).slice(-4) +
              ' DE:' + ('0000' + this.regs.DE.get().toString(16)).slice(-4) + ' HL:' + ('0000' + this.regs.HL.get().toString(16)).slice(-4) +
              ' IX:' + ('0000' + this.regs.IX.get().toString(16)).slice(-4) + ' IY:' + ('0000' + this.regs.IY.get().toString(16)).slice(-4) +
              ' PC:' + ('0000' + this.regs.PC.get().toString(16)).slice(-4) + ' SH:' + ('0000' + this.regs.SH.get().toString(16)).slice(-4) +
              ' R:' + ('0000' + this.regs.R.get().toString(16)).slice(-2) + ' I:' + ('0000' + this.regs.I.get().toString(16)).slice(-2) +
              ' T:' + ('00000000' + this.systemTime.toString(16)).slice(-6);
            console.log(asm + ' ' + regs);
          }
          this.yyyy += 1||this.yyyyEnable;
        }
      }

      if (0) {
        if (this.regs.PC.get() == 0xbde0 ||
          this.regs.PC.get() == 0xbe9b
          || this.regs.PC.get() == 0xbee5
        ) {
          const dasm = new Z80Dasm(this.readMemCb);
          const asm = dasm.dasm(this.regs.PC.get());
          const regs =
            ' AF:' + ('0000' + this.regs.AF.get().toString(16)).slice(-4) + ' BC:' + ('0000' + this.regs.BC.get().toString(16)).slice(-4) +
            ' DE:' + ('0000' + this.regs.DE.get().toString(16)).slice(-4) + ' HL:' + ('0000' + this.regs.HL.get().toString(16)).slice(-4) +
            ' IX:' + ('0000' + this.regs.IX.get().toString(16)).slice(-4) + ' IY:' + ('0000' + this.regs.IY.get().toString(16)).slice(-4) +
            ' PC:' + ('0000' + this.regs.PC.get().toString(16)).slice(-4) + ' SH:' + ('0000' + this.regs.SH.get().toString(16)).slice(-4) +
            ' R:' + ('0000' + this.regs.R.get().toString(16)).slice(-2) + ' I:' + ('0000' + this.regs.I.get().toString(16)).slice(-2) +
            ' T:' + ('00000000' + this.systemTime.toString(16)).slice(-6) +
            ' v:' + ('0000' + this.qqqq.toString(16)).slice(-2);
          console.log(asm + ' ' + regs);

        }
      }
      this.executeInstruction(this.readOpcode());

      if (this.regs.halt) {
        continue;
      }

      if (this.regs.interruptsEnabled) {
        this.regs.interruptsEnabled = false;
        continue;
      }

      if (!((this.intState === INT_LOW && this.regs.iff1) || this.nmiEdge)) {
        continue;
      }

      if (this.nmiEdge) {
        this.nmiEdge = false;
        this.writeMemCb(this.regs.SP.dec(), this.regs.PC.h.get());
        this.writeMemCb(this.regs.SP.dec(), this.regs.PC.l.get());
        this.regs.iff1 = 0;
        this.regs.PC.set(0x0066);
        this.M1();
        this.addSystemTime(this.delay.NMI);
        continue;
      }

      this.regs.iff1 = 0;
      this.regs.iff2 = 0;

      switch (this.regs.im) {
        case 0: {
          this.addSystemTime(this.delay.IM);
          const address = this.dataBus;
          this.dataBus = this.defaultDataBus;
          this.executeInstruction(address & 0xff);
          break;
        }
        case 1: {
          this.addSystemTime(this.delay.IM);
          this.executeInstruction(0xff);
          break;
        }
        case 2: {
          const address = this.dataBus | (this.regs.I.get() << 8);
          this.dataBus = this.defaultDataBus;
          this.writeMemCb(this.regs.SP.dec(), this.regs.PC.h.get());
          this.writeMemCb(this.regs.SP.dec(), this.regs.PC.l.get());
          this.regs.PC.setLH(this.readMemCb(address), this.readMemCb(address + 1 & 0xffff));
          this.M1_nodelay();
          this.addSystemTime(this.delay.IM2);
          break;
        }
      }
    }
  }

  // Stops the execution of the z80 emulation.
  public stopExecution(): void {
    this.terminateFlag = true;
  }

  private regs = new RegisterBank();
  private regBankZ80 = new RegisterBank();
  private regBankR800 = new RegisterBank();
  private systemTime = 0;
  private lastRefreshTime = 0;
  private lastVdpAccessTime = 0;
  private cachePage = 0;
  private dataBus = 0;
  private defaultDataBus = 0;
  private cpuFlags = 0;
  private intState = 0;
  private nmiState = 0;
  private nmiEdge = false;
  private interruptsEnabled = false;
  private frequencyZ80 = 3579545;
  private cpuMode = Z80Mode.Z80;
  private oldCpuMode = Z80Mode.UNKNOWN;
  private terminateFlag = false;
  private timeout = 0;

  private delay: Z80Delay = new Z80Delay();

  private ZSXYTable = new Uint8Array(256);
  private ZSPXYTable = new Uint8Array(256);
  private ZSPHTable = new Uint8Array(256);
  private DAATable = new Uint16Array(0x800);

  // Callback functions for reading and writing memory and IO
  private readMemCb: (a: number) => number;
  private writeMemCb: (a: number, v: number) => void;
  private readIoCb: (a: number) => number;
  private writeIoCb: (a: number, v: number) => void;
  private timeoutCb: () => void;

  private addSystemTime(delta: number): void {
    this.systemTime = this.systemTime + delta & TIMER_RANGE;
  }

  private initTables(): void {
    for (let i = 0; i < 256; ++i) {
      let flags = i ^ 1;
      flags = flags ^ (flags >> 4);
      flags = (flags ^ (flags << 2)) & 0xff;
      flags = flags ^ (flags >> 1);
      flags = (flags & V_FLAG) | H_FLAG | (i & (S_FLAG | X_FLAG | Y_FLAG)) |
        (i ? 0 : Z_FLAG);

      this.ZSXYTable[i] = flags & (Z_FLAG | S_FLAG | X_FLAG | Y_FLAG);
      this.ZSPXYTable[i] = flags & (Z_FLAG | S_FLAG | X_FLAG | Y_FLAG | V_FLAG);
      this.ZSPHTable[i] = flags & (Z_FLAG | S_FLAG | V_FLAG | H_FLAG);
    }

    for (let i = 0; i < 0x800; ++i) {
      const flagC = i & 0x100;
      const flagN = i & 0x200;
      const flagH = i & 0x400;
      const a = i & 0xff;
      const hi = a >> 4;
      const lo = a & 15;
      let diff = 0;
      let regA = 0;

      if (flagC) {
        diff = ((lo <= 9) && !flagH) ? 0x60 : 0x66;
      }
      else {
        if (lo >= 10) {
          diff = (hi <= 8) ? 0x06 : 0x66;
        }
        else {
          if (hi >= 10) {
            diff = flagH ? 0x66 : 0x60;
          }
          else {
            diff = flagH ? 0x06 : 0x00;
          }
        }
      }
      regA = (flagN ? a - diff : a + diff) & 0xff;
      this.DAATable[i] = (regA << 8) |
        this.ZSPXYTable[regA] |
        (flagN ? N_FLAG : 0) |
        (flagC || (lo <= 9 ? hi >= 10 : hi >= 9) ? C_FLAG : 0) |
        ((flagN ? (flagH && lo <= 5) : lo >= 10) ? H_FLAG : 0);
    }
  }

  switchCpu(): void {
    switch (this.oldCpuMode) {
      case Z80Mode.Z80:
        this.regBankZ80 = this.regs;
        break;
      case Z80Mode.R800:
        this.regBankR800 = this.regs;
        break;
    }

    switch (this.cpuMode) {
      case Z80Mode.Z80:
        this.regs = this.regBankZ80;
        break;
      case Z80Mode.R800:
        this.regs = this.regBankR800;
        break;
    }

    this.oldCpuMode = Z80Mode.UNKNOWN;

    this.delay.reset(this.cpuMode, this.frequencyZ80, this.cpuFlags);
  }

  private byteToSignedInt(v: number): number {
    if (v > 127) v -= 256;
    return v;
  }

  private wordToSignedInt(v: number): number {
    if (v > 32767) v -= 65536;
    return v;
  }

  private readOpcode(): number {
    const address = this.regs.PC.postInc();
    this.addSystemTime(this.delay.MEMOP);
    if ((address >> 8) ^ this.cachePage) {
      this.cachePage = address >> 8;
      this.addSystemTime(this.delay.MEMPAGE);
    }
    return this.readMemCb(address);
  }

  private readMem(address: number): number {
    this.addSystemTime(this.delay.MEM);
    this.cachePage = 0xffff;
    return this.readMemCb(address);
  }

  private writeMem(address: number, value: number): void {
    this.addSystemTime(this.delay.MEM);
    this.cachePage = 0xffff;
    this.writeMemCb(address, value);
  }

  private readPort(port: number): number {
    this.regs.SH.set(port + 1);
    this.addSystemTime(this.delay.PREIO);
    this.delayVdpIO(port);
    const value = this.readIoCb(port);
    this.addSystemTime(this.delay.POSTIO);

    return value;
  }

  private writePort(port: number, value: number): void {
    this.regs.SH.set(port + 1);
    this.addSystemTime(this.delay.PREIO);
    this.delayVdpIO(port);
    this.writeIoCb(port, value);
    this.addSystemTime(this.delay.POSTIO);
  }

  private delayVdpIO(port: number): void {
    if ((port & 0xfc) == 0x98) {
      this.addSystemTime(this.delay.T9769VDP);
    }
    if (this.cpuMode === Z80Mode.R800) {
      this.systemTime = 6 * ((this.systemTime + 5) / 6 | 0) & TIMER_RANGE;
      if ((port & 0xf8) == 0x98) {
        if ((this.systemTime - this.lastVdpAccessTime & TIMER_RANGE) < this.delay.S1990VDP)
          this.systemTime = this.lastVdpAccessTime + this.delay.S1990VDP;
        this.lastVdpAccessTime = this.systemTime;
      }
    }
  }

  private JR(): void {
    this.regs.SH.set(this.regs.PC.get() + 1 + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.regs.PC.set(this.regs.SH.get());
    this.addSystemTime(this.delay.ADD8);
  }

  private COND_JR(flag: number, isset: boolean): void {
    if (((this.regs.AF.l.get() & flag) == flag) == isset) this.JR();
    else this.readOpcode();
  }

  private DJNZ(): void {
    this.addSystemTime(this.delay.DJNZ);
    this.regs.BC.h.dec() != 0 ? this.JR() : this.readOpcode();
  }

  private JP(): void {
    this.regs.SH.setLH(this.readOpcode(), this.readOpcode());
    this.regs.PC.set(this.regs.SH.get());
  }

  private COND_JP(flag: number, isset: boolean): void {
    if (((this.regs.AF.l.get() & flag) == flag) == isset) this.JP();
    else this.regs.SH.setLH(this.readOpcode(), this.readOpcode());
  }

  private CALL(): void {
    this.regs.SH.setLH(this.readOpcode(), this.readOpcode());
    this.writeMem(this.regs.SP.dec(), this.regs.PC.h.get());
    this.writeMem(this.regs.SP.dec(), this.regs.PC.l.get());
    this.regs.PC.set(this.regs.SH.get());
    this.addSystemTime(this.delay.CALL);
  }

  private COND_CALL(flag: number, isset: boolean): void {
    if (((this.regs.AF.l.get() & flag) == flag) == isset) this.CALL();
    else this.regs.SH.setLH(this.readOpcode(), this.readOpcode());
  }

  private RET(): void {
    this.regs.SH.setLH(this.readMem(this.regs.SP.postInc()), this.readMem(this.regs.SP.postInc()));
    this.regs.PC.set(this.regs.SH.get());
  }

  private COND_RET(flag: number, isset: boolean): void {
    this.addSystemTime(this.delay.RET);
    if (((this.regs.AF.l.get() & flag) == flag) == isset) this.RET();
  }

  private RETI(): void {
    this.regs.iff1 = this.regs.iff2;
    this.RET();
  }

  private RETN(): void {
    this.regs.iff1 = this.regs.iff2;
    this.RET();
  }

  private M1(): void {
    const value = this.regs.R.get();
    this.regs.R.set((value & 0x80) | ((value + 1) & 0x7f));
    this.addSystemTime(this.delay.M1);
  }

  private M1_nodelay(): void {
    const value = this.regs.R.get();
    this.regs.R.set((value & 0x80) | ((value + 1) & 0x7f));
  }

  private LD_XBYTE_R(r: Register): void {
    const addr = new RegisterPair();
    addr.setLH(this.readOpcode(), this.readOpcode());
    this.regs.SH.set(r.get() << 8);
    this.writeMem(addr.get(), r.get());
  }

  private LD_R_XBYTE(r: Register): void {
    const addr = new RegisterPair();
    addr.setLH(this.readOpcode(), this.readOpcode());
    r.set(this.readMem(addr.get()));
    this.regs.SH.set(addr.inc());
  }

  private LD_XWORD_R(r: RegisterPair): void {
    const addr = new RegisterPair();
    addr.setLH(this.readOpcode(), this.readOpcode());
    this.writeMem(addr.postInc(), r.l.get());
    this.writeMem(addr.get(), r.h.get());
    this.regs.SH.set(addr.get());
  }

  private LD_R_XWORD(r: RegisterPair): void {
    const addr = new RegisterPair();
    addr.setLH(this.readOpcode(), this.readOpcode());
    r.setLH(this.readMem(addr.postInc()), this.readMem(addr.get()));
    this.regs.SH.set(addr.get());
  }

  private LD_R_XIn(r: Register, ar: RegisterPair) {
    const addr = ar.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff;
    this.addSystemTime(this.delay.ADD8);
    this.regs.SH.set(addr);
    r.set(this.readMem(addr));
  }

  private LD_XIn_R(r: Register, ar: RegisterPair) {
    const addr = ar.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff;
    this.addSystemTime(this.delay.ADD8);
    this.regs.SH.set(addr);
    this.writeMem(addr, r.get());
  }

  private INC(r: Register): void {
    const v = r.inc();
    this.regs.AF.l.set(this.ZSXYTable[v] | (this.regs.AF.l.get() & C_FLAG) | (v == 0x80 ? V_FLAG : 0) | (!(v & 0x0f) ? H_FLAG : 0));
  }

  private DEC(r: Register): void {
    const v = r.dec();
    this.regs.AF.l.set(this.ZSXYTable[v] | (this.regs.AF.l.get() & C_FLAG) | (v == 0x7f ? V_FLAG : 0) | ((v & 0x0f) == 0x0f ? H_FLAG : 0) | N_FLAG);
  }

  private ADD(r: number): void {
    const a = this.regs.AF.h.get();
    const v = a + r;
    this.regs.AF.l.set(this.ZSXYTable[v & 0xff] | ((v >> 8) & C_FLAG) |
      ((a ^ r ^ v) & H_FLAG) | ((((a ^ r ^ 0x80) & (r ^ v)) >> 5) & V_FLAG));
    this.regs.AF.h.set(v & 0xff);
  }

  private ADD_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.ADD(this.readMem(this.regs.SH.get()));
  }

  private ADC(r: number): void {
    const a = this.regs.AF.h.get();
    const v = a + r + (this.regs.AF.l.get() & C_FLAG);
    this.regs.AF.l.set(this.ZSXYTable[v & 0xff] | ((v >> 8) & C_FLAG) |
      ((a ^ r ^ v) & H_FLAG) | ((((a ^ r ^ 0x80) & (r ^ v)) >> 5) & V_FLAG));
    this.regs.AF.h.set(v & 0xff);
  }

  private ADC_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.ADC(this.readMem(this.regs.SH.get()));
  }

  private SUB(r: number): void {
    const a = this.regs.AF.h.get();
    const v = a - r;
    this.regs.AF.l.set(this.ZSXYTable[v & 0xff] | ((v >> 8) & C_FLAG) |
      ((a ^ r ^ v) & H_FLAG) | N_FLAG | ((((a ^ r) & (a ^ v)) >> 5) & V_FLAG));
    this.regs.AF.h.set(v & 0xff);
  }

  private SUB_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.SUB(this.readMem(this.regs.SH.get()));
  }

  private SBC(r: number): void {
    const a = this.regs.AF.h.get();
    const v = a - r - (this.regs.AF.l.get() & C_FLAG);
    this.regs.AF.l.set(this.ZSXYTable[v & 0xff] | ((v >> 8) & C_FLAG) |
      ((a ^ r ^ v) & H_FLAG) | N_FLAG | ((((a ^ r) & (a ^ v)) >> 5) & V_FLAG));
    this.regs.AF.h.set(v & 0xff);
  }

  private SBC_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.SBC(this.readMem(this.regs.SH.get()));
  }

  private AND(r: number): void {
    this.regs.AF.h.set(this.regs.AF.h.get() & r);
    this.regs.AF.l.set(this.ZSPXYTable[this.regs.AF.h.get()] | H_FLAG);
  }

  private AND_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.AND(this.readMem(this.regs.SH.get()));
  }

  private OR(r: number): void {
    this.regs.AF.h.set(this.regs.AF.h.get() | r);
    this.regs.AF.l.set(this.ZSPXYTable[this.regs.AF.h.get()]);
  }

  private OR_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.OR(this.readMem(this.regs.SH.get()));
  }

  private XOR(r: number): void {
    this.regs.AF.h.set(this.regs.AF.h.get() ^ r);
    this.regs.AF.l.set(this.ZSPXYTable[this.regs.AF.h.get()]);
  }

  private XOR_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.XOR(this.readMem(this.regs.SH.get()));
  }

  private CP(r: number): void {
    const a = this.regs.AF.h.get();
    const v = a - r;
    this.regs.AF.l.set((this.ZSPXYTable[v & 0xff] & (Z_FLAG | S_FLAG)) |
      ((v >> 8) & C_FLAG) | ((a ^ r ^ v) & H_FLAG) | N_FLAG |
      ((((a ^ r) & (a ^ v)) >> 5) & V_FLAG) | (r & (X_FLAG | Y_FLAG)));
  }

  private CP_XIn(r: RegisterPair): void {
    this.regs.SH.set(r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff);
    this.addSystemTime(this.delay.ADD8);
    this.CP(this.readMem(this.regs.SH.get()));
  }

  private INCW(r: RegisterPair): void {
    r.inc();
    this.addSystemTime(this.delay.INC16);
  }

  private DECW(r: RegisterPair): void {
    r.dec();
    this.addSystemTime(this.delay.INC16);
  }

  private INCW_X(r: RegisterPair): void {
    const v = this.readMem(r.get()) + 1 & 0xff;
    this.regs.AF.l.set(this.ZSXYTable[v] | (this.regs.AF.l.get() & C_FLAG) | (v == 0x80 ? V_FLAG : 0) | (!(v & 0x0f) ? H_FLAG : 0));
    this.addSystemTime(this.delay.INC);
    this.writeMem(r.get(), v);
  }

  private DECW_X(r: RegisterPair): void {
    const v = this.readMem(r.get()) - 1 & 0xff;
    this.regs.AF.l.set(this.ZSXYTable[v] | (this.regs.AF.l.get() & C_FLAG) | (v == 0x7f ? V_FLAG : 0) | ((v & 0x0f) == 0x0f ? H_FLAG : 0) | N_FLAG);
    this.addSystemTime(this.delay.INC);
    this.writeMem(r.get(), v);
  }

  private INC_XIn(r: RegisterPair): void {
    const addr = r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff;
    this.addSystemTime(this.delay.ADD8);
    const v = this.readMem(addr) + 1 & 0xff;
    this.regs.AF.l.set(this.ZSXYTable[v] | (this.regs.AF.l.get() & C_FLAG) | (v == 0x80 ? V_FLAG : 0) | (!(v & 0x0f) ? H_FLAG : 0));
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, v);
    this.regs.SH.set(addr);
  }

  private DEC_XIn(r: RegisterPair): void {
    const addr = r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff;
    this.addSystemTime(this.delay.ADD8);
    const v = this.readMem(addr) - 1 & 0xff;
    this.regs.AF.l.set(this.ZSXYTable[v] | (this.regs.AF.l.get() & C_FLAG) | (v == 0x7f ? V_FLAG : 0) | ((v & 0x0f) == 0x0f ? H_FLAG : 0) | N_FLAG);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, v);
    this.regs.SH.set(addr);
  }

  private NEG(): void {
    const v = this.regs.AF.h.get();
    this.regs.AF.h.set(0);
    this.SUB(v);
  }

  private LD_XIn_BYTE(r: RegisterPair): void {
    const addr = r.get() + this.byteToSignedInt(this.readOpcode()) & 0xffff;
    const v = this.readOpcode();
    this.addSystemTime(this.delay.PARALLEL);
    this.regs.SH.set(addr);
    this.writeMem(addr, v);
  }

  private LD_I_A(): void {
    this.addSystemTime(this.delay.LD);
    this.regs.I.set(this.regs.AF.h.get());
  }

  private LD_A_I(): void {
    this.addSystemTime(this.delay.LD);
    this.regs.AF.h.set(this.regs.I.get());
    this.regs.AF.l.set((this.regs.AF.l.get() & C_FLAG) | this.ZSXYTable[this.regs.AF.h.get()] | (this.regs.iff2 << 2));

    if (this.cpuMode == Z80Mode.Z80 && ((this.intState == INT_LOW && this.regs.iff1) || this.nmiEdge)) this.regs.AF.l.set(this.regs.AF.l.get() & 0xfb);
  }

  private LD_R_A(): void {
    this.addSystemTime(this.delay.LD);
    this.regs.R.set(this.regs.AF.h.get());
  }

  private LD_A_R(): void {
    this.addSystemTime(this.delay.LD);
    this.regs.AF.h.set((this.regs.R.get() & 0x7f) | (this.regs.R2.get() & 0x80));
    this.regs.AF.l.set((this.regs.AF.l.get() & C_FLAG) | this.ZSXYTable[this.regs.AF.h.get()] | (this.regs.iff2 << 2));

    if (this.cpuMode == Z80Mode.Z80 && ((this.intState == INT_LOW && this.regs.iff1) || this.nmiEdge)) this.regs.AF.l.set(this.regs.AF.l.get() & 0xfb);
  }

  private ADDW(a: RegisterPair, b: RegisterPair): void {
    const v = a.get() + b.get();
    this.regs.SH.set(a.get() + 1 & 0xffff);
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | V_FLAG)) | (((a.get() ^ b.get() ^ v) >> 8) & H_FLAG) |
      ((v >> 16) & C_FLAG) | ((v >> 8) & (X_FLAG | Y_FLAG)));
    a.set(v & 0xffff);
    this.addSystemTime(this.delay.ADD16);
  }

  private ADCW(r: RegisterPair): void {
    const v = this.regs.HL.get() + r.get() + (this.regs.AF.l.get() & C_FLAG);
    this.regs.SH.set(this.regs.HL.get() + 1 & 0xffff);
    this.regs.AF.l.set((((this.regs.HL.get() ^ r.get() ^ v) >> 8) & H_FLAG) |
      ((v >> 16) & C_FLAG) | ((v & 0xffff) ? 0 : Z_FLAG) |
      ((((this.regs.HL.get() ^ r.get() ^ 0x8000) & (r.get() ^ v)) >> 13) & V_FLAG) |
      ((v >> 8) & (S_FLAG | X_FLAG | Y_FLAG)));
    this.regs.HL.set(v & 0xffff);
    this.addSystemTime(this.delay.ADD16);
  }

  private SBCW(r: RegisterPair): void {
    const v = this.regs.HL.get() - r.get() - (this.regs.AF.l.get() & C_FLAG);
    this.regs.SH.set(this.regs.HL.get() + 1 & 0xffff);
    this.regs.AF.l.set((((this.regs.HL.get() ^ r.get() ^ v) >> 8) & H_FLAG) | N_FLAG |
      ((v >> 16) & C_FLAG) | ((v & 0xffff) ? 0 : Z_FLAG) |
      ((((this.regs.HL.get() ^ r.get()) & (this.regs.HL.get() ^ v)) >> 13) & V_FLAG) |
      ((v >> 8) & (S_FLAG | X_FLAG | Y_FLAG)));
    this.regs.HL.set(v & 0xffff);
    this.addSystemTime(this.delay.ADD16);
  }

  private RRA(): void {
    const v = this.regs.AF.h.get();
    this.regs.AF.h.set((v >> 1) | ((this.regs.AF.l.get() & C_FLAG) << 7));
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | P_FLAG)) | (v & C_FLAG) | (this.regs.AF.h.get() & (X_FLAG | Y_FLAG)));
  }

  private RLA(): void {
    const v = this.regs.AF.h.get();
    this.regs.AF.h.set((v << 1) & 0xff | (this.regs.AF.l.get() & C_FLAG));
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | P_FLAG)) | ((v >> 7) & C_FLAG) | (this.regs.AF.h.get() & (X_FLAG | Y_FLAG)));
  }

  private RRCA(): void {
    const v = this.regs.AF.h.get();
    this.regs.AF.h.set((v >> 1) | ((v & 1) << 7));
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | P_FLAG)) | (v & C_FLAG) | (this.regs.AF.h.get() & (X_FLAG | Y_FLAG)));
  }

  private RLCA(): void {
    const v = this.regs.AF.h.get();
    this.regs.AF.h.set((v << 1) & 0xff | (v >> 7));
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | P_FLAG)) | (this.regs.AF.h.get() & (Y_FLAG | X_FLAG | C_FLAG)));
  }

  private SLA(r: Register): void {
    const v = (r.get() << 1) & 0xff;
    this.regs.AF.l.set(this.ZSPXYTable[v] | ((r.get() >> 7) & C_FLAG));
    r.set(v);
  }

  private SLA_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.SLA(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private SLA_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.SLA(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private SLL(r: Register): void {
    const v = (r.get() << 1) & 0xff | 1;
    this.regs.AF.l.set(this.ZSPXYTable[v] | ((r.get() >> 7) & C_FLAG));
    r.set(v);
  }

  private SLL_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.SLL(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private SLL_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.SLL(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private SRA(r: Register): void {
    const v = (r.get() >> 1) | (r.get() & 0x80);
    this.regs.AF.l.set(this.ZSPXYTable[v] | (r.get() & C_FLAG));
    r.set(v);
  }

  private SRA_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.SRA(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private SRA_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.SRA(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private SRL(r: Register): void {
    const v = r.get() >> 1;
    this.regs.AF.l.set(this.ZSPXYTable[v] | (r.get() & C_FLAG));
    r.set(v);
  }

  private SRL_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.SRL(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private SRL_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.SRL(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private RL(r: Register): void {
    const v = (r.get() << 1) & 0xff | (this.regs.AF.l.get() & 0x01);
    this.regs.AF.l.set(this.ZSPXYTable[v] | ((r.get() >> 7) & C_FLAG));
    r.set(v);
  }

  private RL_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.RL(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private RL_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.RL(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private RLC(r: Register): void {
    const v = (r.get() << 1) & 0xff | (r.get() >> 7);
    this.regs.AF.l.set(this.ZSPXYTable[v] | (v & C_FLAG));
    r.set(v);
  }

  private RLC_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.RLC(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private RLC_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.RLC(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private RR(r: Register): void {
    const v = (r.get() >> 1) | ((this.regs.AF.l.get() & 1) << 7);
    this.regs.AF.l.set(this.ZSPXYTable[v] | (r.get() & C_FLAG));
    r.set(v);
  }

  private RR_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.RR(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private RR_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.RR(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private RRC(r: Register): void {
    const v = (r.get() >> 1) | ((r.get() & 1) << 7);
    this.regs.AF.l.set(this.ZSPXYTable[v] | ((v >> 7) & C_FLAG));
    r.set(v);
  }

  private RRC_XHL(): void {
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.RRC(r);
    this.addSystemTime(this.delay.INC);
    this.writeMem(this.regs.HL.get(), r.get());
  }

  private RRC_XNN(addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.RRC(r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private BIT(bit: number, r: Register): void {
    this.regs.AF.l.set(this.ZSPHTable[r.get() & (1 << bit)] | (this.regs.AF.l.get() & C_FLAG) | (r.get() & (X_FLAG | Y_FLAG)));
  }

  private BIT_XHL(bit: number): void {
    this.addSystemTime(this.delay.BIT);
    const v = this.readMem(this.regs.HL.get()) & (1 << bit);
    this.regs.AF.l.set(this.ZSPHTable[v] | (this.regs.AF.l.get() & C_FLAG) | (this.regs.SH.h.get() & (X_FLAG | Y_FLAG)));
  }

  private BIT_XNN(bit: number, addr: number): void {
    this.regs.SH.set(addr);
    this.addSystemTime(this.delay.BITIX);
    this.regs.AF.l.set((this.regs.AF.l.get() & C_FLAG) |
      (this.regs.SH.h.get() & (X_FLAG | Y_FLAG)) |
      this.ZSPHTable[this.readMem(addr) & (1 << bit)]);
  }

  private RES(bit: number, r: Register): void {
    r.set(r.get() & ~(1 << bit));
  }

  private RES_XHL(bit: number): void {
    this.addSystemTime(this.delay.INC);
    const v = this.readMem(this.regs.HL.get()) & ~(1 << bit);
    this.writeMem(this.regs.HL.get(), v);
  }

  private RES_XNN(bit: number, addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.RES(bit, r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private SET(bit: number, r: Register): void {
    r.set(r.get() | (1 << bit));
  }

  private SET_XHL(bit: number): void {
    this.addSystemTime(this.delay.INC);
    const v = this.readMem(this.regs.HL.get()) | (1 << bit);
    this.writeMem(this.regs.HL.get(), v);
  }

  private SET_XNN(bit: number, addr: number, r: Register): void {
    r.set(this.readMem(addr));
    this.regs.SH.set(addr);
    this.SET(bit, r);
    this.addSystemTime(this.delay.BIT);
    this.addSystemTime(this.delay.INC);
    this.writeMem(addr, r.get());
  }

  private MULU(r: Register): void {
    if (this.cpuMode != Z80Mode.R800) {
      return;
    }
    this.regs.HL.set(this.regs.AF.h.get() * r.get() & 0xffff);
    this.regs.AF.l.set((this.regs.AF.l.get() & (N_FLAG | H_FLAG | X_FLAG | Y_FLAG)) |
      (this.regs.HL.get() ? 0 : Z_FLAG) | ((this.regs.HL.get() & 0xff00) ? C_FLAG : 0));
    this.addSystemTime(this.delay.MUL8);
  }

  private MULUW(r: RegisterPair): void {
    if (this.cpuMode != Z80Mode.R800) {
      return;
    }
    let v = this.regs.HL.get() * r.get();
    this.regs.DE.set(v / 65536  & 0xffff);
    this.regs.HL.set(v & 0xffff);
    this.regs.AF.l.set((this.regs.AF.l.get() & (N_FLAG | H_FLAG | X_FLAG | Y_FLAG)) |
      (v ? 0 : Z_FLAG) | (this.regs.DE.get() ? C_FLAG : 0));
    this.addSystemTime(this.delay.MUL16);
  }

  private MULU_XHL(): void {
    if (this.cpuMode != Z80Mode.R800) {
      return;
    }
    const r = new Register();
    r.set(this.readMem(this.regs.HL.get()));
    this.MULU(r);
  }

  private DAA(): void {
    const val = this.regs.AF.l.get();
    this.regs.AF.set(this.DAATable[this.regs.AF.h.get() | ((val & 3) << 8) | ((val & 0x10) << 6)]);
  }

  private CPL(): void {
    this.regs.AF.h.set(this.regs.AF.h.get() ^ 0xff);
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | P_FLAG | C_FLAG)) | H_FLAG | N_FLAG | (this.regs.AF.h.get() & (X_FLAG | Y_FLAG)));
  }

  private SCF(): void {
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | P_FLAG)) |
      C_FLAG | ((this.regs.AF.l.get() | this.regs.AF.h.get()) & (X_FLAG | Y_FLAG)));
  }

  private CCF(): void {
    this.regs.AF.l.set(((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | P_FLAG | C_FLAG)) |
      ((this.regs.AF.l.get() & C_FLAG) << 4) |
      ((this.regs.AF.l.get() | this.regs.AF.h.get()) & (X_FLAG | Y_FLAG))) ^ C_FLAG);
  }

  private HALT(): void {
    this.regs.halt = !((this.intState == INT_LOW && this.regs.iff1) || this.nmiEdge);
    if (this.regs.halt) this.regs.PC.dec();
  }

  private OUT_BYTE_A(): void {
    const port = new RegisterPair();
    port.setLH(this.readOpcode(), this.regs.AF.h.get());
    this.writePort(port.get(), this.regs.AF.h.get());
  }

  private IN_BYTE_A(): void {
    const port = new RegisterPair();
    port.setLH(this.readOpcode(), this.regs.AF.h.get());
    this.regs.AF.h.set(this.readPort(port.get()));
  }

  private PUSH(r: RegisterPair): void {
    this.addSystemTime(this.delay.PUSH);
    this.writeMem(this.regs.SP.dec(), r.h.get());
    this.writeMem(this.regs.SP.dec(), r.l.get());
  }

  private POP(r: RegisterPair): void {
    r.setLH(this.readMem(this.regs.SP.postInc()), this.readMem(this.regs.SP.postInc()));
  }

  private RST(v: number): void {
    this.PUSH(this.regs.PC);
    this.regs.PC.set(v);
    this.regs.SH.set(v);
  }

  private EX(a: RegisterPair, b: RegisterPair): void {
    const v = a.get();
    a.set(b.get());
    b.set(v);
  }

  private EXX(): void {
    this.EX(this.regs.BC, this.regs.BC1);
    this.EX(this.regs.DE, this.regs.DE1);
    this.EX(this.regs.HL, this.regs.HL1);
  }

  private EX_SP(r: RegisterPair): void {
    const addr = new RegisterPair();
    addr.setLH(this.readMem(this.regs.SP.postInc()), this.readMem(this.regs.SP.postInc()));
    this.writeMem(this.regs.SP.dec(), r.h.get());
    this.writeMem(this.regs.SP.dec(), r.l.get());
    r.set(addr.get());
    this.regs.SH.set(addr.get());
    this.addSystemTime(this.delay.EXSPHL);
  }

  private DI(): void {
    this.regs.iff1 = 0;
    this.regs.iff2 = 0;
  }

  private EI(): void {
    this.regs.iff2 = 1;
    this.regs.iff1 = 1;
    this.regs.interruptsEnabled = true;
  }

  private RLD(): void {
    const v = this.readMem(this.regs.HL.get());
    this.regs.SH.set(this.regs.HL.get() + 1 & 0xffff);
    this.addSystemTime(this.delay.RLD);
    this.writeMem(this.regs.HL.get(), (v << 4) & 0xff | (this.regs.AF.h.get() & 0x0f));
    this.regs.AF.h.set((this.regs.AF.h.get() & 0xf0) | (v >> 4));
    this.regs.AF.l.set(this.ZSPXYTable[this.regs.AF.h.get()] | (this.regs.AF.l.get() & C_FLAG));
  }

  private RRD(): void {
    const v = this.readMem(this.regs.HL.get());
    this.regs.SH.set(this.regs.HL.get() + 1 & 0xffff);
    this.addSystemTime(this.delay.RLD);
    this.writeMem(this.regs.HL.get(), (v >> 4) | (this.regs.AF.h.get() << 4) & 0xff);
    this.regs.AF.h.set((this.regs.AF.h.get() & 0xf0) | (v & 0x0f));
    this.regs.AF.l.set(this.ZSPXYTable[this.regs.AF.h.get()] | (this.regs.AF.l.get() & C_FLAG));
  }

  private IN_C(r: Register): void {
    r.set(this.readPort(this.regs.BC.get()));
    this.regs.AF.l.set(this.ZSPXYTable[r.get()] | (this.regs.AF.l.get() & C_FLAG));
  }

  private OUT_C(r: Register): void {
    this.writePort(this.regs.BC.get(), r.get());
  }

  private CPI(): void {
    const val = this.readMem(this.regs.HL.postInc());
    let rv = this.regs.AF.h.get() - val & 0xff;
    this.addSystemTime(this.delay.BLOCK);
    this.regs.BC.dec();
    this.regs.AF.l.set((this.regs.AF.l.get() & C_FLAG) |
      ((this.regs.AF.h.get() ^ val ^ rv) & H_FLAG) |
      (this.ZSPXYTable[rv & 0xff] & (Z_FLAG | S_FLAG)) | N_FLAG);
    rv = rv - ((this.regs.AF.l.get() & H_FLAG) >> 4) & 0xff;
    this.regs.AF.l.set(this.regs.AF.l.get() | ((rv << 4) & Y_FLAG) | (rv & X_FLAG) |
      (this.regs.BC.get() != 0 ? P_FLAG : 0));
  }

  private CPIR(): void {
    this.CPI();
    if (this.regs.BC.get() != 0 && !(this.regs.AF.l.get() & Z_FLAG)) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private CPD(): void {
    const val = this.readMem(this.regs.HL.postDec());
    let rv = this.regs.AF.h.get() - val & 0xff;
    this.addSystemTime(this.delay.BLOCK);
    this.regs.BC.dec();
    this.regs.AF.l.set((this.regs.AF.l.get() & C_FLAG) |
      ((this.regs.AF.h.get() ^ val ^ rv) & H_FLAG) |
      (this.ZSPXYTable[rv & 0xff] & (Z_FLAG | S_FLAG)) | N_FLAG);
    rv = rv - ((this.regs.AF.l.get() & H_FLAG) >> 4) & 0xff;
    this.regs.AF.l.set(this.regs.AF.l.get() | ((rv << 4) & Y_FLAG) | (rv & X_FLAG) |
      (this.regs.BC.get() != 0 ? P_FLAG : 0));
  }

  private CPDR(): void {
    this.CPD();
    if (this.regs.BC.get() != 0 && !(this.regs.AF.l.get() & Z_FLAG)) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private LDI(): void {
    const val = this.readMem(this.regs.HL.postInc());
    this.writeMem(this.regs.DE.postInc(), val);
    this.addSystemTime(this.delay.LDI);
    this.regs.BC.dec();
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | C_FLAG)) |
      (((this.regs.AF.h.get() + val) << 4) & Y_FLAG) |
      ((this.regs.AF.h.get() + val) & X_FLAG) | (this.regs.BC.get() ? P_FLAG : 0));
  }

  private LDIR(): void {
    this.LDI();
    if (this.regs.BC.get() != 0) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private LDD(): void {
    const val = this.readMem(this.regs.HL.postDec());
    this.writeMem(this.regs.DE.postDec(), val);
    this.addSystemTime(this.delay.LDI);
    this.regs.BC.dec();
    this.regs.AF.l.set((this.regs.AF.l.get() & (S_FLAG | Z_FLAG | C_FLAG)) |
      (((this.regs.AF.h.get() + val) << 4) & Y_FLAG) |
      ((this.regs.AF.h.get() + val) & X_FLAG) | (this.regs.BC.get() ? P_FLAG : 0));
  }

  private LDDR(): void {
    this.LDD();
    if (this.regs.BC.get() != 0) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private INI(): void {
    this.addSystemTime(this.delay.INOUT);
    this.regs.BC.h.dec();
    const val = this.readPort(this.regs.BC.get());
    this.writeMem(this.regs.HL.postInc(), val);
    this.regs.AF.l.set((this.ZSXYTable[this.regs.BC.h.get()]) | ((val >> 6) & N_FLAG));
    const tmp = val + ((this.regs.BC.l.get() + 1) & 0xff);
    this.regs.AF.l.set(this.regs.AF.l.get() | (tmp >> 8) * (H_FLAG | C_FLAG) |
      (this.ZSPXYTable[(tmp & 0x07) ^ this.regs.BC.h.get()] & P_FLAG));
  }

  private INIR(): void {
    this.INI();
    if (this.regs.BC.h.get() != 0) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private IND(): void {
    this.addSystemTime(this.delay.INOUT);
    this.regs.BC.h.dec();
    const val = this.readPort(this.regs.BC.get());
    this.writeMem(this.regs.HL.postDec(), val);
    this.regs.AF.l.set((this.ZSXYTable[this.regs.BC.h.get()]) | ((val >> 6) & N_FLAG));
    const tmp = val + ((this.regs.BC.l.get() - 1) & 0xff);
    this.regs.AF.l.set(this.regs.AF.l.get() | (tmp >> 8) * (H_FLAG | C_FLAG) |
      (this.ZSPXYTable[(tmp & 0x07) ^ this.regs.BC.h.get()] & P_FLAG));
  }

  private INDR(): void {
    this.IND();
    if (this.regs.BC.h.get() != 0) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private OUTI(): void {
    this.addSystemTime(this.delay.INOUT);
    const val = this.readMem(this.regs.HL.postInc());
    this.writePort(this.regs.BC.get(), this.qqqq=val);
    this.regs.BC.h.dec();
    this.regs.AF.l.set((this.ZSXYTable[this.regs.BC.h.get()]) | ((val >> 6) & N_FLAG));
    const tmp = val + this.regs.HL.l.get();
    this.regs.AF.l.set(this.regs.AF.l.get() | (tmp >> 8) * (H_FLAG | C_FLAG) |
      (this.ZSPXYTable[(tmp & 0x07) ^ this.regs.BC.h.get()] & P_FLAG));
  }

  private OTIR(): void {
    this.OUTI();
    if (this.regs.BC.h.get() != 0) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private OUTD(): void {
    this.addSystemTime(this.delay.INOUT);
    const val = this.readMem(this.regs.HL.postDec());
    this.writePort(this.regs.BC.get(), val);
    this.regs.BC.h.dec();
    this.regs.AF.l.set((this.ZSXYTable[this.regs.BC.h.get()]) | ((val >> 6) & N_FLAG));
    const tmp = val + this.regs.HL.l.get();
    this.regs.AF.l.set(this.regs.AF.l.get() | (tmp >> 8) * (H_FLAG | C_FLAG) |
      (this.ZSPXYTable[(tmp & 0x07) ^ this.regs.BC.h.get()] & P_FLAG));
  }

  private OTDR(): void {
    this.OUTD();
    if (this.regs.BC.h.get() != 0) {
      this.addSystemTime(this.delay.BLOCK);
      this.regs.PC.set(this.regs.PC.get() - 2 & 0xffff);
    }
  }

  private executeInstruction(opcode: number): void {
    this.M1();
    switch (opcode & 0xff) {
      case 0x00: /* nop */ break;
      case 0x01: /* ld_bc_word */ this.regs.BC.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x02: /* ld_xbc_a */ this.writeMem(this.regs.BC.get(), this.regs.AF.h.get()); break;
      case 0x03: /* inc_bc */ this.INCW(this.regs.BC); break;
      case 0x04: /* inc_b */ this.INC(this.regs.BC.h); break;
      case 0x05: /* dec_b */ this.DEC(this.regs.BC.h); break;
      case 0x06: /* ld_b_byte */ this.regs.BC.h.set(this.readOpcode()); break;
      case 0x07: /* rlca */ this.RLCA(); break;
      case 0x08: /* ex_af_af */ this.EX(this.regs.AF, this.regs.AF1); break;
      case 0x09: /* add_hl_bc */ this.ADDW(this.regs.HL, this.regs.BC); break;
      case 0x0a: /* ld_a_xbc */ this.regs.AF.h.set(this.readMem(this.regs.BC.get())); break;
      case 0x0b: /* dec_bc */ this.DECW(this.regs.BC); break;
      case 0x0c: /* inc_c */ this.INC(this.regs.BC.l); break;
      case 0x0d: /* dec_c */ this.DEC(this.regs.BC.l); break;
      case 0x0e: /* ld_c_byte */ this.regs.BC.l.set(this.readOpcode()); break;
      case 0x0f: /* rrca */ this.RRCA(); break;
      case 0x10: /* djnz */ this.DJNZ(); break;
      case 0x11: /* ld_de_word */ this.regs.DE.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x12: /* ld_xde_a */ this.writeMem(this.regs.DE.get(), this.regs.AF.h.get()); break;
      case 0x13: /* inc_de */ this.INCW(this.regs.DE); break;
      case 0x14: /* inc_d */ this.INC(this.regs.DE.h); break;
      case 0x15: /* dec_d */ this.DEC(this.regs.DE.h); break;
      case 0x16: /* ld_d_byte */ this.regs.DE.h.set(this.readOpcode()); break;
      case 0x17: /* rla */ this.RLA(); break;
      case 0x18: /* jr */ this.JR(); break;
      case 0x19: /* add_hl_de */ this.ADDW(this.regs.HL, this.regs.DE); break;
      case 0x1a: /* ld_a_xde */ this.regs.AF.h.set(this.readMem(this.regs.DE.get())); break;
      case 0x1b: /* dec_de */ this.DECW(this.regs.DE); break;
      case 0x1c: /* inc_e */ this.INC(this.regs.DE.l); break;
      case 0x1d: /* dec_e */ this.DEC(this.regs.DE.l); break;
      case 0x1e: /* ld_e_byte */ this.regs.DE.l.set(this.readOpcode()); break;
      case 0x1f: /* rra */ this.RRA(); break;
      case 0x20: /* jr_nz */ this.COND_JR(Z_FLAG, false); break;
      case 0x21: /* ld_hl_word */ this.regs.HL.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x22: /* ld_xword_hl */ this.LD_XWORD_R(this.regs.HL); break;
      case 0x23: /* inc_hl */ this.INCW(this.regs.HL); break;
      case 0x24: /* inc_h */ this.INC(this.regs.HL.h); break;
      case 0x25: /* dec_h */ this.DEC(this.regs.HL.h); break;
      case 0x26: /* ld_h_byte */ this.regs.HL.h.set(this.readOpcode()); break;
      case 0x27: /* daa */ this.DAA(); break;
      case 0x28: /* jr_z */ this.COND_JR(Z_FLAG, true); break;
      case 0x29: /* add_hl_hl */ this.ADDW(this.regs.HL, this.regs.HL); break;
      case 0x2a: /* ld_hl_xword */ this.LD_R_XWORD(this.regs.HL); break;
      case 0x2b: /* dec_hl */ this.DECW(this.regs.HL); break;
      case 0x2c: /* inc_l */ this.INC(this.regs.HL.l); break;
      case 0x2d: /* dec_l */ this.DEC(this.regs.HL.l); break;
      case 0x2e: /* ld_l_byte */ this.regs.HL.l.set(this.readOpcode()); break;
      case 0x2f: /* cpl */ this.CPL(); break;
      case 0x30: /* jr_nc */ this.COND_JR(C_FLAG, false); break;
      case 0x31: /* ld_sp_word */ this.regs.SP.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x32: /* ld_xbyte_a */ this.LD_XBYTE_R(this.regs.AF.h); break;
      case 0x33: /* inc_sp */ this.INCW(this.regs.SP); break;
      case 0x34: /* inc_xhl */ this.INCW_X(this.regs.HL); break;
      case 0x35: /* dec_xhl */ this.DECW_X(this.regs.HL); break;
      case 0x36: /* ld_xhl_byte */ this.writeMem(this.regs.HL.get(), this.readOpcode()); break;
      case 0x37: /* scf */ this.SCF(); break;
      case 0x38: /* jr_c */ this.COND_JR(C_FLAG, true); break;
      case 0x39: /* add_hl_sp */ this.ADDW(this.regs.HL, this.regs.SP); break;
      case 0x3a: /* ld_a_xbyte */ this.LD_R_XBYTE(this.regs.AF.h); break;
      case 0x3b: /* dec_sp */ this.DECW(this.regs.SP); break;
      case 0x3c: /* inc_a */ this.INC(this.regs.AF.h); break;
      case 0x3d: /* dec_a */ this.DEC(this.regs.AF.h); break;
      case 0x3e: /* ld_a_byte */ this.regs.AF.h.set(this.readOpcode()); break;
      case 0x3f: /* ccf */ this.CCF(); break;
      case 0x40: /* ld_b_b */ this.regs.BC.h.set(this.regs.BC.h.get()); break;
      case 0x41: /* ld_b_c */ this.regs.BC.h.set(this.regs.BC.l.get()); break;
      case 0x42: /* ld_b_d */ this.regs.BC.h.set(this.regs.DE.h.get()); break;
      case 0x43: /* ld_b_e */ this.regs.BC.h.set(this.regs.DE.l.get()); break;
      case 0x44: /* ld_b_h */ this.regs.BC.h.set(this.regs.HL.h.get()); break;
      case 0x45: /* ld_b_l */ this.regs.BC.h.set(this.regs.HL.l.get()); break;
      case 0x46: /* ld_b_xhl */ this.regs.BC.h.set(this.readMem(this.regs.HL.get())); break;
      case 0x47: /* ld_b_a */ this.regs.BC.h.set(this.regs.AF.h.get()); break;
      case 0x48: /* ld_c_b */ this.regs.BC.l.set(this.regs.BC.h.get()); break;
      case 0x49: /* ld_c_c */ this.regs.BC.l.set(this.regs.BC.l.get()); break;
      case 0x4a: /* ld_c_d */ this.regs.BC.l.set(this.regs.DE.h.get()); break;
      case 0x4b: /* ld_c_e */ this.regs.BC.l.set(this.regs.DE.l.get()); break;
      case 0x4c: /* ld_c_h */ this.regs.BC.l.set(this.regs.HL.h.get()); break;
      case 0x4d: /* ld_c_l */ this.regs.BC.l.set(this.regs.HL.l.get()); break;
      case 0x4e: /* ld_c_xhl */ this.regs.BC.l.set(this.readMem(this.regs.HL.get())); break;
      case 0x4f: /* ld_c_a */ this.regs.BC.l.set(this.regs.AF.h.get()); break;
      case 0x50: /* ld_d_b */ this.regs.DE.h.set(this.regs.BC.h.get()); break;
      case 0x51: /* ld_d_c */ this.regs.DE.h.set(this.regs.BC.l.get()); break;
      case 0x52: /* ld_d_d */ this.regs.DE.h.set(this.regs.DE.h.get()); break;
      case 0x53: /* ld_d_e */ this.regs.DE.h.set(this.regs.DE.l.get()); break;
      case 0x54: /* ld_d_h */ this.regs.DE.h.set(this.regs.HL.h.get()); break;
      case 0x55: /* ld_d_l */ this.regs.DE.h.set(this.regs.HL.l.get()); break;
      case 0x56: /* ld_d_xhl */ this.regs.DE.h.set(this.readMem(this.regs.HL.get())); break;
      case 0x57: /* ld_d_a */ this.regs.DE.h.set(this.regs.AF.h.get()); break;
      case 0x58: /* ld_e_b */ this.regs.DE.l.set(this.regs.BC.h.get()); break;
      case 0x59: /* ld_e_c */ this.regs.DE.l.set(this.regs.BC.l.get()); break;
      case 0x5a: /* ld_e_d */ this.regs.DE.l.set(this.regs.DE.h.get()); break;
      case 0x5b: /* ld_e_e */ this.regs.DE.l.set(this.regs.DE.l.get()); break;
      case 0x5c: /* ld_e_h */ this.regs.DE.l.set(this.regs.HL.h.get()); break;
      case 0x5d: /* ld_e_l */ this.regs.DE.l.set(this.regs.HL.l.get()); break;
      case 0x5e: /* ld_e_xhl */ this.regs.DE.l.set(this.readMem(this.regs.HL.get())); break;
      case 0x5f: /* ld_e_a */ this.regs.DE.l.set(this.regs.AF.h.get()); break;
      case 0x60: /* ld_h_b */ this.regs.HL.h.set(this.regs.BC.h.get()); break;
      case 0x61: /* ld_h_c */ this.regs.HL.h.set(this.regs.BC.l.get()); break;
      case 0x62: /* ld_h_d */ this.regs.HL.h.set(this.regs.DE.h.get()); break;
      case 0x63: /* ld_h_e */ this.regs.HL.h.set(this.regs.DE.l.get()); break;
      case 0x64: /* ld_h_h */ this.regs.HL.h.set(this.regs.HL.h.get()); break;
      case 0x65: /* ld_h_l */ this.regs.HL.h.set(this.regs.HL.l.get()); break;
      case 0x66: /* ld_h_xhl */ this.regs.HL.h.set(this.readMem(this.regs.HL.get())); break;
      case 0x67: /* ld_h_a */ this.regs.HL.h.set(this.regs.AF.h.get()); break;
      case 0x68: /* ld_l_b */ this.regs.HL.l.set(this.regs.BC.h.get()); break;
      case 0x69: /* ld_l_c */ this.regs.HL.l.set(this.regs.BC.l.get()); break;
      case 0x6a: /* ld_l_d */ this.regs.HL.l.set(this.regs.DE.h.get()); break;
      case 0x6b: /* ld_l_e */ this.regs.HL.l.set(this.regs.DE.l.get()); break;
      case 0x6c: /* ld_l_h */ this.regs.HL.l.set(this.regs.HL.h.get()); break;
      case 0x6d: /* ld_l_l */ this.regs.HL.l.set(this.regs.HL.l.get()); break;
      case 0x6e: /* ld_l_xhl */ this.regs.HL.l.set(this.readMem(this.regs.HL.get())); break;
      case 0x6f: /* ld_l_a */ this.regs.HL.l.set(this.regs.AF.h.get()); break;
      case 0x70: /* ld_xhl_b */ this.writeMem(this.regs.HL.get(), this.regs.BC.h.get()); break;
      case 0x71: /* ld_xhl_c */ this.writeMem(this.regs.HL.get(), this.regs.BC.l.get()); break;
      case 0x72: /* ld_xhl_d */ this.writeMem(this.regs.HL.get(), this.regs.DE.h.get()); break;
      case 0x73: /* ld_xhl_e */ this.writeMem(this.regs.HL.get(), this.regs.DE.l.get()); break;
      case 0x74: /* ld_xhl_h */ this.writeMem(this.regs.HL.get(), this.regs.HL.h.get()); break;
      case 0x75: /* ld_xhl_l */ this.writeMem(this.regs.HL.get(), this.regs.HL.l.get()); break;
      case 0x76: /* halt */ this.HALT(); break;
      case 0x77: /* ld_xhl_a */ this.writeMem(this.regs.HL.get(), this.regs.AF.h.get()); break;
      case 0x78: /* ld_a_b */ this.regs.AF.h.set(this.regs.BC.h.get()); break;
      case 0x79: /* ld_a_c */ this.regs.AF.h.set(this.regs.BC.l.get()); break;
      case 0x7a: /* ld_a_d */ this.regs.AF.h.set(this.regs.DE.h.get()); break;
      case 0x7b: /* ld_a_e */ this.regs.AF.h.set(this.regs.DE.l.get()); break;
      case 0x7c: /* ld_a_h */ this.regs.AF.h.set(this.regs.HL.h.get()); break;
      case 0x7d: /* ld_a_l */ this.regs.AF.h.set(this.regs.HL.l.get()); break;
      case 0x7e: /* ld_a_xhl */ this.regs.AF.h.set(this.readMem(this.regs.HL.get())); break;
      case 0x7f: /* ld_a_a */ this.regs.AF.h.set(this.regs.AF.h.get()); break;
      case 0x80: /* add_a_b */ this.ADD(this.regs.BC.h.get()); break;
      case 0x81: /* add_a_c */ this.ADD(this.regs.BC.l.get()); break;
      case 0x82: /* add_a_d */ this.ADD(this.regs.DE.h.get()); break;
      case 0x83: /* add_a_e */ this.ADD(this.regs.DE.l.get()); break;
      case 0x84: /* add_a_h */ this.ADD(this.regs.HL.h.get()); break;
      case 0x85: /* add_a_l */ this.ADD(this.regs.HL.l.get()); break;
      case 0x86: /* add_a_xhl */ this.ADD(this.readMem(this.regs.HL.get())); break;
      case 0x87: /* add_a_a */ this.ADD(this.regs.AF.h.get()); break;
      case 0x88: /* adc_a_b */ this.ADC(this.regs.BC.h.get()); break;
      case 0x89: /* adc_a_c */ this.ADC(this.regs.BC.l.get()); break;
      case 0x8a: /* adc_a_d */ this.ADC(this.regs.DE.h.get()); break;
      case 0x8b: /* adc_a_e */ this.ADC(this.regs.DE.l.get()); break;
      case 0x8c: /* adc_a_h */ this.ADC(this.regs.HL.h.get()); break;
      case 0x8d: /* adc_a_l */ this.ADC(this.regs.HL.l.get()); break;
      case 0x8e: /* adc_a_xhl */ this.ADC(this.readMem(this.regs.HL.get())); break;
      case 0x8f: /* adc_a_a */ this.ADC(this.regs.AF.h.get()); break;
      case 0x90: /* sub_b */ this.SUB(this.regs.BC.h.get()); break;
      case 0x91: /* sub_c */ this.SUB(this.regs.BC.l.get()); break;
      case 0x92: /* sub_d */ this.SUB(this.regs.DE.h.get()); break;
      case 0x93: /* sub_e */ this.SUB(this.regs.DE.l.get()); break;
      case 0x94: /* sub_h */ this.SUB(this.regs.HL.h.get()); break;
      case 0x95: /* sub_l */ this.SUB(this.regs.HL.l.get()); break;
      case 0x96: /* sub_xhl */ this.SUB(this.readMem(this.regs.HL.get())); break;
      case 0x97: /* sub_a */ this.SUB(this.regs.AF.h.get()); break;
      case 0x98: /* sbc_b */ this.SBC(this.regs.BC.h.get()); break;
      case 0x99: /* sbc_c */ this.SBC(this.regs.BC.l.get()); break;
      case 0x9a: /* sbc_d */ this.SBC(this.regs.DE.h.get()); break;
      case 0x9b: /* sbc_e */ this.SBC(this.regs.DE.l.get()); break;
      case 0x9c: /* sbc_h */ this.SBC(this.regs.HL.h.get()); break;
      case 0x9d: /* sbc_l */ this.SBC(this.regs.HL.l.get()); break;
      case 0x9e: /* sbc_xhl */ this.SBC(this.readMem(this.regs.HL.get())); break;
      case 0x9f: /* sbc_a */ this.SBC(this.regs.AF.h.get()); break;
      case 0xa0: /* and_b */ this.AND(this.regs.BC.h.get()); break;
      case 0xa1: /* and_c */ this.AND(this.regs.BC.l.get()); break;
      case 0xa2: /* and_d */ this.AND(this.regs.DE.h.get()); break;
      case 0xa3: /* and_e */ this.AND(this.regs.DE.l.get()); break;
      case 0xa4: /* and_h */ this.AND(this.regs.HL.h.get()); break;
      case 0xa5: /* and_l */ this.AND(this.regs.HL.l.get()); break;
      case 0xa6: /* and_xhl */ this.AND(this.readMem(this.regs.HL.get())); break;
      case 0xa7: /* and_a */ this.AND(this.regs.AF.h.get()); break;
      case 0xa8: /* xor_b */ this.XOR(this.regs.BC.h.get()); break;
      case 0xa9: /* xor_c */ this.XOR(this.regs.BC.l.get()); break;
      case 0xaa: /* xor_d */ this.XOR(this.regs.DE.h.get()); break;
      case 0xab: /* xor_e */ this.XOR(this.regs.DE.l.get()); break;
      case 0xac: /* xor_h */ this.XOR(this.regs.HL.h.get()); break;
      case 0xad: /* xor_l */ this.XOR(this.regs.HL.l.get()); break;
      case 0xae: /* xor_xhl */ this.XOR(this.readMem(this.regs.HL.get())); break;
      case 0xaf: /* xor_a */ this.XOR(this.regs.AF.h.get()); break;
      case 0xb0: /* or_b */ this.OR(this.regs.BC.h.get()); break;
      case 0xb1: /* or_c */ this.OR(this.regs.BC.l.get()); break;
      case 0xb2: /* or_d */ this.OR(this.regs.DE.h.get()); break;
      case 0xb3: /* or_e */ this.OR(this.regs.DE.l.get()); break;
      case 0xb4: /* or_h */ this.OR(this.regs.HL.h.get()); break;
      case 0xb5: /* or_l */ this.OR(this.regs.HL.l.get()); break;
      case 0xb6: /* or_xhl */ this.OR(this.readMem(this.regs.HL.get())); break;
      case 0xb7: /* or_a */ this.OR(this.regs.AF.h.get()); break;
      case 0xb8: /* cp_b */ this.CP(this.regs.BC.h.get()); break;
      case 0xb9: /* cp_c */ this.CP(this.regs.BC.l.get()); break;
      case 0xba: /* cp_d */ this.CP(this.regs.DE.h.get()); break;
      case 0xbb: /* cp_e */ this.CP(this.regs.DE.l.get()); break;
      case 0xbc: /* cp_h */ this.CP(this.regs.HL.h.get()); break;
      case 0xbd: /* cp_l */ this.CP(this.regs.HL.l.get()); break;
      case 0xbe: /* cp_xhl */ this.CP(this.readMem(this.regs.HL.get())); break;
      case 0xbf: /* cp_a */ this.CP(this.regs.AF.h.get()); break;
      case 0xc0: /* ret_nz */ this.COND_RET(Z_FLAG, false); break;
      case 0xc1: /* pop_bc */ this.POP(this.regs.BC); break;
      case 0xc2: /* jp_nz */ this.COND_JP(Z_FLAG, false); break;
      case 0xc3: /* jp */ this.JP(); break;
      case 0xc4: /* call_nz */ this.COND_CALL(Z_FLAG, false); break;
      case 0xc5: /* push_bc */ this.PUSH(this.regs.BC); break;
      case 0xc6: /* add_a_byte */ this.ADD(this.readOpcode()); break;
      case 0xc7: /* rst_00 */ this.RST(0x00); break;
      case 0xc8: /* ret_z */ this.COND_RET(Z_FLAG, true); break;
      case 0xc9: /* ret */ this.RET(); break;
      case 0xca: /* jp_z */ this.COND_JP(Z_FLAG, true); break;
      case 0xcb: /* cb */ this.executeCbInstruction(this.readOpcode()); break;
      case 0xcc: /* call_z */ this.COND_CALL(Z_FLAG, true); break;
      case 0xcd: /* call */ this.CALL(); break;
      case 0xce: /* adc_a_byte */ this.ADC(this.readOpcode()); break;
      case 0xcf: /* rst_08 */ this.RST(0x08); break;
      case 0xd0: /* ret_nc */this.COND_RET(C_FLAG, false); break;
      case 0xd1: /* pop_de */ this.POP(this.regs.DE); break;
      case 0xd2: /* jp_nc */ this.COND_JP(C_FLAG, false); break;
      case 0xd3: /* out_byte_a */ this.OUT_BYTE_A(); break;
      case 0xd4: /* call_nc */ this.COND_CALL(C_FLAG, false); break;
      case 0xd5: /* push_de */ this.PUSH(this.regs.DE); break;
      case 0xd6: /* sub_byte */ this.SUB(this.readOpcode()); break;
      case 0xd7: /* rst_10 */ this.RST(0x10); break;
      case 0xd8: /* ret_c */ this.COND_RET(C_FLAG, true); break;
      case 0xd9: /* exx */ this.EXX(); break;
      case 0xda: /* jp_c */ this.COND_JP(C_FLAG, true); break;
      case 0xdb: /* in_byte_a */ this.IN_BYTE_A(); break;
      case 0xdc: /* call_c */ this.COND_CALL(C_FLAG, true); break;
      case 0xdd: /* dd */ this.executeDdInstruction(this.readOpcode()); break;
      case 0xde: /* sbc_byte */ this.SBC(this.readOpcode()); break;
      case 0xdf: /* rst_18 */ this.RST(0x18); break;
      case 0xe0: /* ret_po */ this.COND_RET(V_FLAG, false); break;
      case 0xe1: /* pop_hl */ this.POP(this.regs.HL); break;
      case 0xe2: /* jp_po */ this.COND_JP(V_FLAG, false); break;
      case 0xe3: /* ex_xsp_hl */ this.EX_SP(this.regs.HL); break;
      case 0xe4: /* call_po */ this.COND_CALL(V_FLAG, false); break;
      case 0xe5: /* push_hl */ this.PUSH(this.regs.HL); break;
      case 0xe6: /* and_byte */ this.AND(this.readOpcode()); break;
      case 0xe7: /* rst_20 */ this.RST(0x20); break;
      case 0xe8: /* ret_pe */ this.COND_RET(V_FLAG, true); break;
      case 0xe9: /* jp_hl */ this.regs.PC.set(this.regs.HL.get()); break;
      case 0xea: /* jp_pe */ this.COND_JP(V_FLAG, true); break;
      case 0xeb: /* ex_de_hl */ this.EX(this.regs.DE, this.regs.HL); break;
      case 0xec: /* call_pe */ this.COND_CALL(V_FLAG, true); break;
      case 0xed: /* ed */ this.executeEdInstruction(this.readOpcode()); break;
      case 0xee: /* xor_byte */ this.XOR(this.readOpcode()); break;
      case 0xef: /* rst_28 */ this.RST(0x28); break;
      case 0xf0: /* ret_p */ this.COND_RET(S_FLAG, false); break;
      case 0xf1: /* pop_af */ this.POP(this.regs.AF); break;
      case 0xf2: /* jp_p */ this.COND_JP(S_FLAG, false); break;
      case 0xf3: /* di */ this.DI(); break;
      case 0xf4: /* call_p */ this.COND_CALL(S_FLAG, false); break;
      case 0xf5: /* push_af */ this.PUSH(this.regs.AF); break;
      case 0xf6: /* or_byte */ this.OR(this.readOpcode()); break;
      case 0xf7: /* rst_30 */ this.RST(0x30); break;
      case 0xf8: /* ret_m */ this.COND_RET(S_FLAG, true); break;
      case 0xf9: /* ld_sp_hl */ this.addSystemTime(this.delay.LDSPHL); this.regs.SP.set(this.regs.HL.get()); break;
      case 0xfa: /* jp_m */ this.COND_JP(S_FLAG, true); break;
      case 0xfb: /* ei */ this.EI(); break;
      case 0xfc: /* call_m */ this.COND_CALL(S_FLAG, true); break;
      case 0xfd: /* fd */ this.executeFdInstruction(this.readOpcode()); break;
      case 0xfe: /* cp_byte */ this.CP(this.readOpcode()); break;
      case 0xff: /* rst_38 */ this.RST(0x38); break;
      default:
        throw new Error('Invalid opcode: ' + (opcode & 0xff));
    }
  }

  private executeCbInstruction(opcode: number): void {
    this.M1();
    switch (opcode & 0xff) {
      case 0x00: /* rlc_b */ this.RLC(this.regs.BC.h); break;
      case 0x01: /* rlc_c */ this.RLC(this.regs.BC.l); break;
      case 0x02: /* rlc_d */ this.RLC(this.regs.DE.h); break;
      case 0x03: /* rlc_e */ this.RLC(this.regs.DE.l); break;
      case 0x04: /* rlc_h */ this.RLC(this.regs.HL.h); break;
      case 0x05: /* rlc_l */ this.RLC(this.regs.HL.l); break;
      case 0x06: /* rlc_xhl */ this.RLC_XHL(); break;
      case 0x07: /* rlc_a */ this.RLC(this.regs.AF.h); break;
      case 0x08: /* rrc_b */ this.RRC(this.regs.BC.h); break;
      case 0x09: /* rrc_c */ this.RRC(this.regs.BC.l); break;
      case 0x0a: /* rrc_d */ this.RRC(this.regs.DE.h); break;
      case 0x0b: /* rrc_e */ this.RRC(this.regs.DE.l); break;
      case 0x0c: /* rrc_h */ this.RRC(this.regs.HL.h); break;
      case 0x0d: /* rrc_l */ this.RRC(this.regs.HL.l); break;
      case 0x0e: /* rrc_xhl */ this.RRC_XHL(); break;
      case 0x0f: /* rrc_a */ this.RRC(this.regs.AF.h); break;
      case 0x10: /* rl_b */ this.RL(this.regs.BC.h); break;
      case 0x11: /* rl_c */ this.RL(this.regs.BC.l); break;
      case 0x12: /* rl_d */ this.RL(this.regs.DE.h); break;
      case 0x13: /* rl_e */ this.RL(this.regs.DE.l); break;
      case 0x14: /* rl_h */ this.RL(this.regs.HL.h); break;
      case 0x15: /* rl_l */ this.RL(this.regs.HL.l); break;
      case 0x16: /* rl_xhl */ this.RL_XHL(); break;
      case 0x17: /* rl_a */ this.RL(this.regs.AF.h); break;
      case 0x18: /* rr_b */ this.RR(this.regs.BC.h); break;
      case 0x19: /* rr_c */ this.RR(this.regs.BC.l); break;
      case 0x1a: /* rr_d */ this.RR(this.regs.DE.h); break;
      case 0x1b: /* rr_e */ this.RR(this.regs.DE.l); break;
      case 0x1c: /* rr_h */ this.RR(this.regs.HL.h); break;
      case 0x1d: /* rr_l */ this.RR(this.regs.HL.l); break;
      case 0x1e: /* rr_xhl */ this.RR_XHL(); break;
      case 0x1f: /* rr_a */ this.RR(this.regs.AF.h); break;
      case 0x20: /* sla_b */ this.SLA(this.regs.BC.h); break;
      case 0x21: /* sla_c */ this.SLA(this.regs.BC.l); break;
      case 0x22: /* sla_d */ this.SLA(this.regs.DE.h); break;
      case 0x23: /* sla_e */ this.SLA(this.regs.DE.l); break;
      case 0x24: /* sla_h */ this.SLA(this.regs.HL.h); break;
      case 0x25: /* sla_l */ this.SLA(this.regs.HL.l); break;
      case 0x26: /* sla_xhl */ this.SLA_XHL(); break;
      case 0x27: /* sla_a */ this.SLA(this.regs.AF.h); break;
      case 0x28: /* sra_b */ this.SRA(this.regs.BC.h); break;
      case 0x29: /* sra_c */ this.SRA(this.regs.BC.l); break;
      case 0x2a: /* sra_d */ this.SRA(this.regs.DE.h); break;
      case 0x2b: /* sra_e */ this.SRA(this.regs.DE.l); break;
      case 0x2c: /* sra_h */ this.SRA(this.regs.HL.h); break;
      case 0x2d: /* sra_l */ this.SRA(this.regs.HL.l); break;
      case 0x2e: /* sra_xhl */ this.SRA_XHL(); break;
      case 0x2f: /* sra_a */ this.SRA(this.regs.AF.h); break;
      case 0x30: /* sll_b */ this.SLL(this.regs.BC.h); break;
      case 0x31: /* sll_c */ this.SLL(this.regs.BC.l); break;
      case 0x32: /* sll_d */ this.SLL(this.regs.DE.h); break;
      case 0x33: /* sll_e */ this.SLL(this.regs.DE.l); break;
      case 0x34: /* sll_h */ this.SLL(this.regs.HL.h); break;
      case 0x35: /* sll_l */ this.SLL(this.regs.HL.l); break;
      case 0x36: /* sll_xhl */ this.SLL_XHL(); break;
      case 0x37: /* sll_a */ this.SLL(this.regs.AF.h); break;
      case 0x38: /* srl_b */ this.SRL(this.regs.BC.h); break;
      case 0x39: /* srl_c */ this.SRL(this.regs.BC.l); break;
      case 0x3a: /* srl_d */ this.SRL(this.regs.DE.h); break;
      case 0x3b: /* srl_e */ this.SRL(this.regs.DE.l); break;
      case 0x3c: /* srl_h */ this.SRL(this.regs.HL.h); break;
      case 0x3d: /* srl_l */ this.SRL(this.regs.HL.l); break;
      case 0x3e: /* srl_xhl */ this.SRL_XHL(); break;
      case 0x3f: /* srl_a */ this.SRL(this.regs.AF.h); break;
      case 0x40: /* bit_0_b */ this.BIT(0, this.regs.BC.h); break;
      case 0x41: /* bit_0_c */ this.BIT(0, this.regs.BC.l); break;
      case 0x42: /* bit_0_d */ this.BIT(0, this.regs.DE.h); break;
      case 0x43: /* bit_0_e */ this.BIT(0, this.regs.DE.l); break;
      case 0x44: /* bit_0_h */ this.BIT(0, this.regs.HL.h); break;
      case 0x45: /* bit_0_l */ this.BIT(0, this.regs.HL.l); break;
      case 0x46: /* bit_0_xhl */ this.BIT_XHL(0); break;
      case 0x47: /* bit_0_a */ this.BIT(0, this.regs.AF.h); break;
      case 0x48: /* bit_1_b */ this.BIT(1, this.regs.BC.h); break;
      case 0x49: /* bit_1_c */ this.BIT(1, this.regs.BC.l); break;
      case 0x4a: /* bit_1_d */ this.BIT(1, this.regs.DE.h); break;
      case 0x4b: /* bit_1_e */ this.BIT(1, this.regs.DE.l); break;
      case 0x4c: /* bit_1_h */ this.BIT(1, this.regs.HL.h); break;
      case 0x4d: /* bit_1_l */ this.BIT(1, this.regs.HL.l); break;
      case 0x4e: /* bit_1_xhl */ this.BIT_XHL(1); break;
      case 0x4f: /* bit_1_a */ this.BIT(1, this.regs.AF.h); break;
      case 0x50: /* bit_2_b */ this.BIT(2, this.regs.BC.h); break;
      case 0x51: /* bit_2_c */ this.BIT(2, this.regs.BC.l); break;
      case 0x52: /* bit_2_d */ this.BIT(2, this.regs.DE.h); break;
      case 0x53: /* bit_2_e */ this.BIT(2, this.regs.DE.l); break;
      case 0x54: /* bit_2_h */ this.BIT(2, this.regs.HL.h); break;
      case 0x55: /* bit_2_l */ this.BIT(2, this.regs.HL.l); break;
      case 0x56: /* bit_2_xhl */ this.BIT_XHL(2); break;
      case 0x57: /* bit_2_a */ this.BIT(2, this.regs.AF.h); break;
      case 0x58: /* bit_3_b */ this.BIT(3, this.regs.BC.h); break;
      case 0x59: /* bit_3_c */ this.BIT(3, this.regs.BC.l); break;
      case 0x5a: /* bit_3_d */ this.BIT(3, this.regs.DE.h); break;
      case 0x5b: /* bit_3_e */ this.BIT(3, this.regs.DE.l); break;
      case 0x5c: /* bit_3_h */ this.BIT(3, this.regs.HL.h); break;
      case 0x5d: /* bit_3_l */ this.BIT(3, this.regs.HL.l); break;
      case 0x5e: /* bit_3_xhl */ this.BIT_XHL(3); break;
      case 0x5f: /* bit_3_a */ this.BIT(3, this.regs.AF.h); break;
      case 0x60: /* bit_4_b */ this.BIT(4, this.regs.BC.h); break;
      case 0x61: /* bit_4_c */ this.BIT(4, this.regs.BC.l); break;
      case 0x62: /* bit_4_d */ this.BIT(4, this.regs.DE.h); break;
      case 0x63: /* bit_4_e */ this.BIT(4, this.regs.DE.l); break;
      case 0x64: /* bit_4_h */ this.BIT(4, this.regs.HL.h); break;
      case 0x65: /* bit_4_l */ this.BIT(4, this.regs.HL.l); break;
      case 0x66: /* bit_4_xhl */ this.BIT_XHL(4); break;
      case 0x67: /* bit_4_a */ this.BIT(4, this.regs.AF.h); break;
      case 0x68: /* bit_5_b */ this.BIT(5, this.regs.BC.h); break;
      case 0x69: /* bit_5_c */ this.BIT(5, this.regs.BC.l); break;
      case 0x6a: /* bit_5_d */ this.BIT(5, this.regs.DE.h); break;
      case 0x6b: /* bit_5_e */ this.BIT(5, this.regs.DE.l); break;
      case 0x6c: /* bit_5_h */ this.BIT(5, this.regs.HL.h); break;
      case 0x6d: /* bit_5_l */ this.BIT(5, this.regs.HL.l); break;
      case 0x6e: /* bit_5_xhl */ this.BIT_XHL(5); break;
      case 0x6f: /* bit_5_a */ this.BIT(5, this.regs.AF.h); break;
      case 0x70: /* bit_6_b */ this.BIT(6, this.regs.BC.h); break;
      case 0x71: /* bit_6_c */ this.BIT(6, this.regs.BC.l); break;
      case 0x72: /* bit_6_d */ this.BIT(6, this.regs.DE.h); break;
      case 0x73: /* bit_6_e */ this.BIT(6, this.regs.DE.l); break;
      case 0x74: /* bit_6_h */ this.BIT(6, this.regs.HL.h); break;
      case 0x75: /* bit_6_l */ this.BIT(6, this.regs.HL.l); break;
      case 0x76: /* bit_6_xhl */ this.BIT_XHL(6); break;
      case 0x77: /* bit_6_a */ this.BIT(6, this.regs.AF.h); break;
      case 0x78: /* bit_7_b */ this.BIT(7, this.regs.BC.h); break;
      case 0x79: /* bit_7_c */ this.BIT(7, this.regs.BC.l); break;
      case 0x7a: /* bit_7_d */ this.BIT(7, this.regs.DE.h); break;
      case 0x7b: /* bit_7_e */ this.BIT(7, this.regs.DE.l); break;
      case 0x7c: /* bit_7_h */ this.BIT(7, this.regs.HL.h); break;
      case 0x7d: /* bit_7_l */ this.BIT(7, this.regs.HL.l); break;
      case 0x7e: /* bit_7_xhl */ this.BIT_XHL(7); break;
      case 0x7f: /* bit_7_a */ this.BIT(7, this.regs.AF.h); break;
      case 0x80: /* res_0_b */ this.RES(0, this.regs.BC.h); break;
      case 0x81: /* res_0_c */ this.RES(0, this.regs.BC.l); break;
      case 0x82: /* res_0_d */ this.RES(0, this.regs.DE.h); break;
      case 0x83: /* res_0_e */ this.RES(0, this.regs.DE.l); break;
      case 0x84: /* res_0_h */ this.RES(0, this.regs.HL.h); break;
      case 0x85: /* res_0_l */ this.RES(0, this.regs.HL.l); break;
      case 0x86: /* res_0_xhl */ this.RES_XHL(0); break;
      case 0x87: /* res_0_a */ this.RES(0, this.regs.AF.h); break;
      case 0x88: /* res_1_b */ this.RES(1, this.regs.BC.h); break;
      case 0x89: /* res_1_c */ this.RES(1, this.regs.BC.l); break;
      case 0x8a: /* res_1_d */ this.RES(1, this.regs.DE.h); break;
      case 0x8b: /* res_1_e */ this.RES(1, this.regs.DE.l); break;
      case 0x8c: /* res_1_h */ this.RES(1, this.regs.HL.h); break;
      case 0x8d: /* res_1_l */ this.RES(1, this.regs.HL.l); break;
      case 0x8e: /* res_1_xhl */ this.RES_XHL(1); break;
      case 0x8f: /* res_1_a */ this.RES(1, this.regs.AF.h); break;
      case 0x90: /* res_2_b */ this.RES(2, this.regs.BC.h); break;
      case 0x91: /* res_2_c */ this.RES(2, this.regs.BC.l); break;
      case 0x92: /* res_2_d */ this.RES(2, this.regs.DE.h); break;
      case 0x93: /* res_2_e */ this.RES(2, this.regs.DE.l); break;
      case 0x94: /* res_2_h */ this.RES(2, this.regs.HL.h); break;
      case 0x95: /* res_2_l */ this.RES(2, this.regs.HL.l); break;
      case 0x96: /* res_2_xhl */ this.RES_XHL(2); break;
      case 0x97: /* res_2_a */ this.RES(2, this.regs.AF.h); break;
      case 0x98: /* res_3_b */ this.RES(3, this.regs.BC.h); break;
      case 0x99: /* res_3_c */ this.RES(3, this.regs.BC.l); break;
      case 0x9a: /* res_3_d */ this.RES(3, this.regs.DE.h); break;
      case 0x9b: /* res_3_e */ this.RES(3, this.regs.DE.l); break;
      case 0x9c: /* res_3_h */ this.RES(3, this.regs.HL.h); break;
      case 0x9d: /* res_3_l */ this.RES(3, this.regs.HL.l); break;
      case 0x9e: /* res_3_xhl */ this.RES_XHL(3); break;
      case 0x9f: /* res_3_a */ this.RES(3, this.regs.AF.h); break;
      case 0xa0: /* res_4_b */ this.RES(4, this.regs.BC.h); break;
      case 0xa1: /* res_4_c */ this.RES(4, this.regs.BC.l); break;
      case 0xa2: /* res_4_d */ this.RES(4, this.regs.DE.h); break;
      case 0xa3: /* res_4_e */ this.RES(4, this.regs.DE.l); break;
      case 0xa4: /* res_4_h */ this.RES(4, this.regs.HL.h); break;
      case 0xa5: /* res_4_l */ this.RES(4, this.regs.HL.l); break;
      case 0xa6: /* res_4_xhl */ this.RES_XHL(4); break;
      case 0xa7: /* res_4_a */ this.RES(4, this.regs.AF.h); break;
      case 0xa8: /* res_5_b */ this.RES(5, this.regs.BC.h); break;
      case 0xa9: /* res_5_c */ this.RES(5, this.regs.BC.l); break;
      case 0xaa: /* res_5_d */ this.RES(5, this.regs.DE.h); break;
      case 0xab: /* res_5_e */ this.RES(5, this.regs.DE.l); break;
      case 0xac: /* res_5_h */ this.RES(5, this.regs.HL.h); break;
      case 0xad: /* res_5_l */ this.RES(5, this.regs.HL.l); break;
      case 0xae: /* res_5_xhl */ this.RES_XHL(5); break;
      case 0xaf: /* res_5_a */ this.RES(5, this.regs.AF.h); break;
      case 0xb0: /* res_6_b */ this.RES(6, this.regs.BC.h); break;
      case 0xb1: /* res_6_c */ this.RES(6, this.regs.BC.l); break;
      case 0xb2: /* res_6_d */ this.RES(6, this.regs.DE.h); break;
      case 0xb3: /* res_6_e */ this.RES(6, this.regs.DE.l); break;
      case 0xb4: /* res_6_h */ this.RES(6, this.regs.HL.h); break;
      case 0xb5: /* res_6_l */ this.RES(6, this.regs.HL.l); break;
      case 0xb6: /* res_6_xhl */ this.RES_XHL(6); break;
      case 0xb7: /* res_6_a */ this.RES(6, this.regs.AF.h); break;
      case 0xb8: /* res_7_b */ this.RES(7, this.regs.BC.h); break;
      case 0xb9: /* res_7_c */ this.RES(7, this.regs.BC.l); break;
      case 0xba: /* res_7_d */ this.RES(7, this.regs.DE.h); break;
      case 0xbb: /* res_7_e */ this.RES(7, this.regs.DE.l); break;
      case 0xbc: /* res_7_h */ this.RES(7, this.regs.HL.h); break;
      case 0xbd: /* res_7_l */ this.RES(7, this.regs.HL.l); break;
      case 0xbe: /* res_7_xhl */ this.RES_XHL(7); break;
      case 0xbf: /* res_7_a */ this.RES(7, this.regs.AF.h); break;
      case 0xc0: /* set_0_b */ this.SET(0, this.regs.BC.h); break;
      case 0xc1: /* set_0_c */ this.SET(0, this.regs.BC.l); break;
      case 0xc2: /* set_0_d */ this.SET(0, this.regs.DE.h); break;
      case 0xc3: /* set_0_e */ this.SET(0, this.regs.DE.l); break;
      case 0xc4: /* set_0_h */ this.SET(0, this.regs.HL.h); break;
      case 0xc5: /* set_0_l */ this.SET(0, this.regs.HL.l); break;
      case 0xc6: /* set_0_xhl */ this.SET_XHL(0); break;
      case 0xc7: /* set_0_a */ this.SET(0, this.regs.AF.h); break;
      case 0xc8: /* set_1_b */ this.SET(1, this.regs.BC.h); break;
      case 0xc9: /* set_1_c */ this.SET(1, this.regs.BC.l); break;
      case 0xca: /* set_1_d */ this.SET(1, this.regs.DE.h); break;
      case 0xcb: /* set_1_e */ this.SET(1, this.regs.DE.l); break;
      case 0xcc: /* set_1_h */ this.SET(1, this.regs.HL.h); break;
      case 0xcd: /* set_1_l */ this.SET(1, this.regs.HL.l); break;
      case 0xce: /* set_1_xhl */ this.SET_XHL(1); break;
      case 0xcf: /* set_1_a */ this.SET(1, this.regs.AF.h); break;
      case 0xd0: /* set_2_b */ this.SET(2, this.regs.BC.h); break;
      case 0xd1: /* set_2_c */ this.SET(2, this.regs.BC.l); break;
      case 0xd2: /* set_2_d */ this.SET(2, this.regs.DE.h); break;
      case 0xd3: /* set_2_e */ this.SET(2, this.regs.DE.l); break;
      case 0xd4: /* set_2_h */ this.SET(2, this.regs.HL.h); break;
      case 0xd5: /* set_2_l */ this.SET(2, this.regs.HL.l); break;
      case 0xd6: /* set_2_xhl */ this.SET_XHL(2); break;
      case 0xd7: /* set_2_a */ this.SET(2, this.regs.AF.h); break;
      case 0xd8: /* set_3_b */ this.SET(3, this.regs.BC.h); break;
      case 0xd9: /* set_3_c */ this.SET(3, this.regs.BC.l); break;
      case 0xda: /* set_3_d */ this.SET(3, this.regs.DE.h); break;
      case 0xdb: /* set_3_e */ this.SET(3, this.regs.DE.l); break;
      case 0xdc: /* set_3_h */ this.SET(3, this.regs.HL.h); break;
      case 0xdd: /* set_3_l */ this.SET(3, this.regs.HL.l); break;
      case 0xde: /* set_3_xhl */ this.SET_XHL(3); break;
      case 0xdf: /* set_3_a */ this.SET(3, this.regs.AF.h); break;
      case 0xe0: /* set_4_b */ this.SET(4, this.regs.BC.h); break;
      case 0xe1: /* set_4_c */ this.SET(4, this.regs.BC.l); break;
      case 0xe2: /* set_4_d */ this.SET(4, this.regs.DE.h); break;
      case 0xe3: /* set_4_e */ this.SET(4, this.regs.DE.l); break;
      case 0xe4: /* set_4_h */ this.SET(4, this.regs.HL.h); break;
      case 0xe5: /* set_4_l */ this.SET(4, this.regs.HL.l); break;
      case 0xe6: /* set_4_xhl */ this.SET_XHL(4); break;
      case 0xe7: /* set_4_a */ this.SET(4, this.regs.AF.h); break;
      case 0xe8: /* set_5_b */ this.SET(5, this.regs.BC.h); break;
      case 0xe9: /* set_5_c */ this.SET(5, this.regs.BC.l); break;
      case 0xea: /* set_5_d */ this.SET(5, this.regs.DE.h); break;
      case 0xeb: /* set_5_e */ this.SET(5, this.regs.DE.l); break;
      case 0xec: /* set_5_h */ this.SET(5, this.regs.HL.h); break;
      case 0xed: /* set_5_l */ this.SET(5, this.regs.HL.l); break;
      case 0xee: /* set_5_xhl */ this.SET_XHL(5); break;
      case 0xef: /* set_5_a */ this.SET(5, this.regs.AF.h); break;
      case 0xf0: /* set_6_b */ this.SET(6, this.regs.BC.h); break;
      case 0xf1: /* set_6_c */ this.SET(6, this.regs.BC.l); break;
      case 0xf2: /* set_6_d */ this.SET(6, this.regs.DE.h); break;
      case 0xf3: /* set_6_e */ this.SET(6, this.regs.DE.l); break;
      case 0xf4: /* set_6_h */ this.SET(6, this.regs.HL.h); break;
      case 0xf5: /* set_6_l */ this.SET(6, this.regs.HL.l); break;
      case 0xf6: /* set_6_xhl */ this.SET_XHL(6); break;
      case 0xf7: /* set_6_a */ this.SET(6, this.regs.AF.h); break;
      case 0xf8: /* set_7_b */ this.SET(7, this.regs.BC.h); break;
      case 0xf9: /* set_7_c */ this.SET(7, this.regs.BC.l); break;
      case 0xfa: /* set_7_d */ this.SET(7, this.regs.DE.h); break;
      case 0xfb: /* set_7_e */ this.SET(7, this.regs.DE.l); break;
      case 0xfc: /* set_7_h */ this.SET(7, this.regs.HL.h); break;
      case 0xfd: /* set_7_l */ this.SET(7, this.regs.HL.l); break;
      case 0xfe: /* set_7_xhl */ this.SET_XHL(7); break;
      case 0xff: /* set_7_a */ this.SET(7, this.regs.AF.h); break;
      default:
        throw new Error('Invalid opcode: CB-' + (opcode & 0xff));
    }
  }

  private executeDdInstruction(opcode: number): void {
    this.M1();
    switch (opcode & 0xff) {
      case 0x00: /* nop */ break;
      case 0x01: /* ld_bc_word */ this.regs.BC.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x02: /* ld_xbc_a */ this.writeMem(this.regs.BC.get(), this.regs.AF.h.get()); break;
      case 0x03: /* inc_bc */ this.INCW(this.regs.BC); break;
      case 0x04: /* inc_b */ this.INC(this.regs.BC.h); break;
      case 0x05: /* dec_b */ this.DEC(this.regs.BC.h); break;
      case 0x06: /* ld_b_byte */ this.regs.BC.h.set(this.readOpcode()); break;
      case 0x07: /* rlca */ this.RLCA(); break;
      case 0x08: /* ex_af_af */ this.EX(this.regs.AF, this.regs.AF1); break;
      case 0x09: /* add_ix_bc */ this.ADDW(this.regs.IX, this.regs.BC); break;
      case 0x0a: /* ld_a_xbc */ this.regs.AF.h.set(this.readMem(this.regs.BC.get())); break;
      case 0x0b: /* dec_bc */ this.DECW(this.regs.BC); break;
      case 0x0c: /* inc_c */ this.INC(this.regs.BC.l); break;
      case 0x0d: /* dec_c */ this.DEC(this.regs.BC.l); break;
      case 0x0e: /* ld_c_byte */ this.regs.BC.l.set(this.readOpcode()); break;
      case 0x0f: /* rrca */ this.RRCA(); break;
      case 0x10: /* djnz */ this.DJNZ(); break;
      case 0x11: /* ld_de_word */ this.regs.DE.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x12: /* ld_xde_a */ this.writeMem(this.regs.DE.get(), this.regs.AF.h.get()); break;
      case 0x13: /* inc_de */ this.INCW(this.regs.DE); break;
      case 0x14: /* inc_d */ this.INC(this.regs.DE.h); break;
      case 0x15: /* dec_d */ this.DEC(this.regs.DE.h); break;
      case 0x16: /* ld_d_byte */ this.regs.DE.h.set(this.readOpcode()); break;
      case 0x17: /* rla */ this.RLA(); break;
      case 0x18: /* jr */ this.JR(); break;
      case 0x19: /* add_ix_de */ this.ADDW(this.regs.IX, this.regs.DE); break;
      case 0x1a: /* ld_a_xde */ this.regs.AF.h.set(this.readMem(this.regs.DE.get())); break;
      case 0x1b: /* dec_de */ this.DECW(this.regs.DE); break;
      case 0x1c: /* inc_e */ this.INC(this.regs.DE.l); break;
      case 0x1d: /* dec_e */ this.DEC(this.regs.DE.l); break;
      case 0x1e: /* ld_e_byte */ this.regs.DE.l.set(this.readOpcode()); break;
      case 0x1f: /* rra */ this.RRA(); break;
      case 0x20: /* jr_nz */ this.COND_JR(Z_FLAG, false); break;
      case 0x21: /* ld_ix_word */ this.regs.IX.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x22: /* ld_xword_ix */ this.LD_XWORD_R(this.regs.IX); break;
      case 0x23: /* inc_ix */ this.INCW(this.regs.IX); break;
      case 0x24: /* inc_ixh */ this.INC(this.regs.IX.h); break;
      case 0x25: /* dec_ixh */ this.DEC(this.regs.IX.h); break;
      case 0x26: /* ld_ixh_byte */ this.regs.IX.h.set(this.readOpcode()); break;
      case 0x27: /* daa */ this.DAA(); break;
      case 0x28: /* jr_z */ this.COND_JR(Z_FLAG, true); break;
      case 0x29: /* add_ix_ix */ this.ADDW(this.regs.IX, this.regs.IX); break;
      case 0x2a: /* ld_ix_xword */ this.LD_R_XWORD(this.regs.IX); break;
      case 0x2b: /* dec_ix */ this.DECW(this.regs.IX); break;
      case 0x2c: /* inc_ixl */ this.INC(this.regs.IX.l); break;
      case 0x2d: /* dec_ixl */ this.DEC(this.regs.IX.l); break;
      case 0x2e: /* ld_ixl_byte */ this.regs.IX.l.set(this.readOpcode()); break;
      case 0x2f: /* cpl */ this.CPL(); break;
      case 0x30: /* jr_nc */ this.COND_JR(C_FLAG, false); break;
      case 0x31: /* ld_sp_word */ this.regs.SP.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x32: /* ld_xbyte_a */ this.LD_XBYTE_R(this.regs.AF.h); break;
      case 0x33: /* inc_sp */ this.INCW(this.regs.SP); break;
      case 0x34: /* inc_xix */ this.INC_XIn(this.regs.IX); break;
      case 0x35: /* dec_xix */ this.DEC_XIn(this.regs.IX); break;
      case 0x36: /* ld_xix_byte */ this.LD_XIn_BYTE(this.regs.IX); break;
      case 0x37: /* scf */ this.SCF(); break;
      case 0x38: /* jr_c */ this.COND_JR(C_FLAG, true); break;
      case 0x39: /* add_ix_sp */ this.ADDW(this.regs.IX, this.regs.SP); break;
      case 0x3a: /* ld_a_xbyte */ this.LD_R_XBYTE(this.regs.AF.h); break;
      case 0x3b: /* dec_sp */ this.DECW(this.regs.SP); break;
      case 0x3c: /* inc_a */ this.INC(this.regs.AF.h); break;
      case 0x3d: /* dec_a */ this.DEC(this.regs.AF.h); break;
      case 0x3e: /* ld_a_byte */ this.regs.AF.h.set(this.readOpcode()); break;
      case 0x3f: /* ccf */ this.CCF(); break;
      case 0x40: /* ld_b_b */ this.regs.BC.h.set(this.regs.BC.h.get()); break;
      case 0x41: /* ld_b_c */ this.regs.BC.h.set(this.regs.BC.l.get()); break;
      case 0x42: /* ld_b_d */ this.regs.BC.h.set(this.regs.DE.h.get()); break;
      case 0x43:  /* ld_b_e */ this.regs.BC.h.set(this.regs.DE.l.get()); break;
      case 0x44:  /* ld_b_ixh */ this.regs.BC.h.set(this.regs.IX.h.get()); break;
      case 0x45: /* ld_b_ixl */ this.regs.BC.h.set(this.regs.IX.l.get()); break;
      case 0x46: /* ld_b_xix */ this.LD_R_XIn(this.regs.BC.h, this.regs.IX); break;
      case 0x47: /* ld_b_a */ this.regs.BC.h.set(this.regs.AF.h.get()); break;
      case 0x48: /* ld_c_b */ this.regs.BC.l.set(this.regs.BC.h.get()); break;
      case 0x49: /* ld_c_c */ this.regs.BC.l.set(this.regs.BC.l.get()); break;
      case 0x4a: /* ld_c_d */ this.regs.BC.l.set(this.regs.DE.h.get()); break;
      case 0x4b: /* ld_c_e */ this.regs.BC.l.set(this.regs.DE.l.get()); break;
      case 0x4c: /* ld_c_ixh */ this.regs.BC.l.set(this.regs.IX.h.get()); break;
      case 0x4d: /* ld_c_ixl */ this.regs.BC.l.set(this.regs.IX.l.get()); break;
      case 0x4e: /* ld_c_xix */ this.LD_R_XIn(this.regs.BC.l, this.regs.IX); break;
      case 0x4f: /* ld_c_a */ this.regs.BC.l.set(this.regs.AF.h.get()); break;
      case 0x50: /* ld_d_b */ this.regs.DE.h.set(this.regs.BC.h.get()); break;
      case 0x51: /* ld_d_c */ this.regs.DE.h.set(this.regs.BC.l.get()); break;
      case 0x52: /* ld_d_d */ this.regs.DE.h.set(this.regs.DE.h.get()); break;
      case 0x53: /* ld_d_e */ this.regs.DE.h.set(this.regs.DE.l.get()); break;
      case 0x54: /* ld_d_ixh */ this.regs.DE.h.set(this.regs.IX.h.get()); break;
      case 0x55: /* ld_d_ixl */ this.regs.DE.h.set(this.regs.IX.l.get()); break;
      case 0x56: /* ld_d_xix */ this.LD_R_XIn(this.regs.DE.h, this.regs.IX); break;
      case 0x57: /* ld_d_a */ this.regs.DE.h.set(this.regs.AF.h.get()); break;
      case 0x58: /* ld_e_b */ this.regs.DE.l.set(this.regs.BC.h.get()); break;
      case 0x59: /* ld_e_c */ this.regs.DE.l.set(this.regs.BC.l.get()); break;
      case 0x5a: /* ld_e_d */ this.regs.DE.l.set(this.regs.DE.h.get()); break;
      case 0x5b: /* ld_e_e */ this.regs.DE.l.set(this.regs.DE.l.get()); break;
      case 0x5c: /* ld_e_ixh */ this.regs.DE.l.set(this.regs.IX.h.get()); break;
      case 0x5d: /* ld_e_ixl */ this.regs.DE.l.set(this.regs.IX.l.get()); break;
      case 0x5e: /* ld_e_xix */ this.LD_R_XIn(this.regs.DE.l, this.regs.IX); break;
      case 0x5f: /* ld_e_a */ this.regs.DE.l.set(this.regs.AF.h.get()); break;
      case 0x60: /* ld_ixh_b */ this.regs.IX.h.set(this.regs.BC.h.get()); break;
      case 0x61: /* ld_ixh_c */ this.regs.IX.h.set(this.regs.BC.l.get()); break;
      case 0x62: /* ld_ixh_d */ this.regs.IX.h.set(this.regs.DE.h.get()); break;
      case 0x63: /* ld_ixh_e */ this.regs.IX.h.set(this.regs.DE.l.get()); break;
      case 0x64: /* ld_ixh_ixh */ this.regs.IX.h.set(this.regs.IX.h.get()); break;
      case 0x65: /* ld_ixh_ixl */ this.regs.IX.h.set(this.regs.IX.l.get()); break;
      case 0x66: /* ld_h_xix */ this.LD_R_XIn(this.regs.HL.h, this.regs.IX); break;
      case 0x67: /* ld_ixh_a */ this.regs.IX.h.set(this.regs.AF.h.get()); break;
      case 0x68: /* ld_ixl_b */ this.regs.IX.l.set(this.regs.BC.h.get()); break;
      case 0x69: /* ld_ixl_c */ this.regs.IX.l.set(this.regs.BC.l.get()); break;
      case 0x6a: /* ld_ixl_d */ this.regs.IX.l.set(this.regs.DE.h.get()); break;
      case 0x6b: /* ld_ixl_e */ this.regs.IX.l.set(this.regs.DE.l.get()); break;
      case 0x6c: /* ld_ixl_ixh */ this.regs.IX.l.set(this.regs.IX.h.get()); break;
      case 0x6d: /* ld_ixl_ixl */ this.regs.IX.l.set(this.regs.IX.l.get()); break;
      case 0x6e: /* ld_l_xix */ this.LD_R_XIn(this.regs.HL.l, this.regs.IX); break;
      case 0x6f: /* ld_ixl_a */ this.regs.IX.l.set(this.regs.AF.h.get()); break;
      case 0x70: /* ld_xix_b */ this.LD_XIn_R(this.regs.BC.h, this.regs.IX); break;
      case 0x71: /* ld_xix_c */ this.LD_XIn_R(this.regs.BC.l, this.regs.IX); break;
      case 0x72: /* ld_xix_d */ this.LD_XIn_R(this.regs.DE.h, this.regs.IX); break;
      case 0x73: /* ld_xix_e */ this.LD_XIn_R(this.regs.DE.l, this.regs.IX); break;
      case 0x74: /* ld_xix_h */ this.LD_XIn_R(this.regs.HL.h, this.regs.IX); break;
      case 0x75: /* ld_xix_l */ this.LD_XIn_R(this.regs.HL.l, this.regs.IX); break;
      case 0x76: /* halt */ this.HALT(); break;
      case 0x77: /* ld_xix_a */ this.LD_XIn_R(this.regs.AF.h, this.regs.IX); break;
      case 0x78: /* ld_a_b */ this.regs.AF.h.set(this.regs.BC.h.get()); break;
      case 0x79: /* ld_a_c */ this.regs.AF.h.set(this.regs.BC.l.get()); break;
      case 0x7a: /* ld_a_d */ this.regs.AF.h.set(this.regs.DE.h.get()); break;
      case 0x7b: /* ld_a_e */ this.regs.AF.h.set(this.regs.DE.l.get()); break;
      case 0x7c: /* ld_a_ixh */ this.regs.AF.h.set(this.regs.IX.h.get()); break;
      case 0x7d: /* ld_a_ixl */ this.regs.AF.h.set(this.regs.IX.l.get()); break;
      case 0x7e: /* ld_a_xix */ this.LD_R_XIn(this.regs.AF.h, this.regs.IX); break;
      case 0x7f: /* ld_a_a */ this.regs.AF.h.set(this.regs.AF.h.get()); break;
      case 0x80: /* add_a_b */ this.ADD(this.regs.BC.h.get()); break;
      case 0x81: /* add_a_c */ this.ADD(this.regs.BC.l.get()); break;
      case 0x82: /* add_a_d */ this.ADD(this.regs.DE.h.get()); break;
      case 0x83: /* add_a_e */ this.ADD(this.regs.DE.l.get()); break;
      case 0x84: /* add_a_ixh */ this.ADD(this.regs.IX.h.get()); break;
      case 0x85: /* add_a_ixl */ this.ADD(this.regs.IX.l.get()); break;
      case 0x86: /* add_a_xix */ this.ADD_XIn(this.regs.IX); break;
      case 0x87: /* add_a_a */ this.ADD(this.regs.AF.h.get()); break;
      case 0x88: /* adc_a_b */ this.ADC(this.regs.BC.h.get()); break;
      case 0x89: /* adc_a_c */ this.ADC(this.regs.BC.l.get()); break;
      case 0x8a: /* adc_a_d */ this.ADC(this.regs.DE.h.get()); break;
      case 0x8b: /* adc_a_e */ this.ADC(this.regs.DE.l.get()); break;
      case 0x8c: /* adc_a_ixh */ this.ADC(this.regs.IX.h.get()); break;
      case 0x8d: /* adc_a_ixl */ this.ADC(this.regs.IX.l.get()); break;
      case 0x8e: /* adc_a_xix */ this.ADC_XIn(this.regs.IX); break;
      case 0x8f: /* adc_a_a */ this.ADC(this.regs.AF.h.get()); break;
      case 0x90: /* sub_a_b */ this.SUB(this.regs.BC.h.get()); break;
      case 0x91: /* sub_a_c */ this.SUB(this.regs.BC.l.get()); break;
      case 0x92: /* sub_a_d */ this.SUB(this.regs.DE.h.get()); break;
      case 0x93: /* sub_a_e */ this.SUB(this.regs.DE.l.get()); break;
      case 0x94: /* sub_a_ixh */ this.SUB(this.regs.IX.h.get()); break;
      case 0x95: /* sub_a_ixl */ this.SUB(this.regs.IX.l.get()); break;
      case 0x96: /* sub_a_xix */ this.SUB_XIn(this.regs.IX); break;
      case 0x97: /* sub_a_a */ this.SUB(this.regs.AF.h.get()); break;
      case 0x98: /* sbc_a_b */ this.SBC(this.regs.BC.h.get()); break;
      case 0x99: /* sbc_a_c */ this.SBC(this.regs.BC.l.get()); break;
      case 0x9a: /* sbc_a_d */ this.SBC(this.regs.DE.h.get()); break;
      case 0x9b: /* sbc_a_e */ this.SBC(this.regs.DE.l.get()); break;
      case 0x9c: /* sbc_a_ixh */ this.SBC(this.regs.IX.h.get()); break;
      case 0x9d: /* sbc_a_ixl */ this.SBC(this.regs.IX.l.get()); break;
      case 0x9e: /* sbc_a_xix */ this.SBC_XIn(this.regs.IX); break;
      case 0x9f: /* sbc_a_a */ this.SBC(this.regs.AF.h.get()); break;
      case 0xa0: /* and_b */ this.AND(this.regs.BC.h.get()); break;
      case 0xa1: /* and_c */ this.AND(this.regs.BC.l.get()); break;
      case 0xa2: /* and_d */ this.AND(this.regs.DE.h.get()); break;
      case 0xa3: /* and_e */ this.AND(this.regs.DE.l.get()); break;
      case 0xa4: /* and_ixh */ this.AND(this.regs.IX.h.get()); break;
      case 0xa5: /* and_ixl */ this.AND(this.regs.IX.l.get()); break;
      case 0xa6: /* and_xix */ this.AND_XIn(this.regs.IX); break;
      case 0xa7: /* and_a */ this.AND(this.regs.AF.h.get()); break;
      case 0xa8: /* xor_b */ this.XOR(this.regs.BC.h.get()); break;
      case 0xa9: /* xor_c */ this.XOR(this.regs.BC.l.get()); break;
      case 0xaa: /* xor_d */ this.XOR(this.regs.DE.h.get()); break;
      case 0xab: /* xor_e */ this.XOR(this.regs.DE.l.get()); break;
      case 0xac: /* xor_ixh */ this.XOR(this.regs.IX.h.get()); break;
      case 0xad: /* xor_ixl */ this.XOR(this.regs.IX.l.get()); break;
      case 0xae: /* xor_xix */ this.XOR_XIn(this.regs.IX); break;
      case 0xaf: /* xor_a */ this.XOR(this.regs.AF.h.get()); break;
      case 0xb0: /* or_b */ this.OR(this.regs.BC.h.get()); break;
      case 0xb1: /* or_c */ this.OR(this.regs.BC.l.get()); break;
      case 0xb2: /* or_d */ this.OR(this.regs.DE.h.get()); break;
      case 0xb3: /* or_e */ this.OR(this.regs.DE.l.get()); break;
      case 0xb4: /* or_ixh */ this.OR(this.regs.IX.h.get()); break;
      case 0xb5: /* or_ixl */ this.OR(this.regs.IX.l.get()); break;
      case 0xb6: /* or_xix */ this.OR_XIn(this.regs.IX); break;
      case 0xb7: /* or_a */ this.OR(this.regs.AF.h.get()); break;
      case 0xb8: /* cp_b */ this.CP(this.regs.BC.h.get()); break;
      case 0xb9: /* cp_c */ this.CP(this.regs.BC.l.get()); break;
      case 0xba: /* cp_d */ this.CP(this.regs.DE.h.get()); break;
      case 0xbb: /* cp_e */ this.CP(this.regs.DE.l.get()); break;
      case 0xbc: /* cp_ixh */ this.CP(this.regs.IX.h.get()); break;
      case 0xbd: /* cp_ixl */ this.CP(this.regs.IX.l.get()); break;
      case 0xbe: /* cp_xix */ this.CP_XIn(this.regs.IX); break;
      case 0xbf: /* cp_a */ this.CP(this.regs.AF.h.get()); break;
      case 0xc0: /* ret_nz */ this.COND_RET(Z_FLAG, false); break;
      case 0xc1: /* pop_bc */ this.POP(this.regs.BC); break;
      case 0xc2: /* jp_nz */ this.COND_JP(Z_FLAG, false); break;
      case 0xc3: /* jp */ this.JP(); break;
      case 0xc4: /* call_nz */ this.COND_CALL(Z_FLAG, false); break;
      case 0xc5: /* push_bc */ this.PUSH(this.regs.BC); break;
      case 0xc6: /* add_a_byte */ this.ADD(this.readOpcode()); break;
      case 0xc7: /* rst_00 */ this.RST(0x00); break;
      case 0xc8: /* ret_z */ this.COND_RET(Z_FLAG, true); break;
      case 0xc9: /* ret */ this.RET(); break;
      case 0xca: /* jp_z */ this.COND_JP(Z_FLAG, true); break;
      case 0xcb: /* dd_cb */ this.executeNnCbInstruction(this.regs.IX); break;
      case 0xcc: /* call_z */ this.COND_CALL(Z_FLAG, true); break;
      case 0xcd: /* call */ this.CALL(); break;
      case 0xce: /* adc_a_byte */ this.ADC(this.readOpcode()); break;
      case 0xcf: /* rst_08 */ this.RST(0x08); break;
      case 0xd0: /* ret_nc */this.COND_RET(C_FLAG, false); break;
      case 0xd1: /* pop_de */ this.POP(this.regs.DE); break;
      case 0xd2: /* jp_nc */ this.COND_JP(C_FLAG, false); break;
      case 0xd3: /* out_byte_a */ this.OUT_BYTE_A(); break;
      case 0xd4: /* call_nc */ this.COND_CALL(C_FLAG, false); break;
      case 0xd5: /* push_de */ this.PUSH(this.regs.DE); break;
      case 0xd6: /* sub_byte */ this.SUB(this.readOpcode()); break;
      case 0xd7: /* rst_10 */ this.RST(0x10); break;
      case 0xd8: /* ret_c */ this.COND_RET(C_FLAG, true); break;
      case 0xd9: /* exx */ this.EXX(); break;
      case 0xda: /* jp_c */ this.COND_JP(C_FLAG, true); break;
      case 0xdb: /* in_byte_a */ this.IN_BYTE_A(); break;
      case 0xdc: /* call_c */ this.COND_CALL(C_FLAG, true); break;
      case 0xdd: /* dd */ this.executeDdInstruction(this.readOpcode()); break;
      case 0xde: /* sbc_byte */ this.SBC(this.readOpcode()); break;
      case 0xdf: /* rst_18 */ this.RST(0x18); break;
      case 0xe0: /* ret_po */ this.COND_RET(V_FLAG, false); break;
      case 0xe1: /* pop_ix */ this.POP(this.regs.IX); break;
      case 0xe2: /* jp_po */ this.COND_JP(V_FLAG, false); break;
      case 0xe3: /* ex_xsp_ix */ this.EX_SP(this.regs.IX); break;
      case 0xe4: /* call_po */ this.COND_CALL(V_FLAG, false); break;
      case 0xe5: /* push_ix */ this.PUSH(this.regs.IX); break;
      case 0xe6: /* and_byte */ this.AND(this.readOpcode()); break;
      case 0xe7: /* rst_20 */ this.RST(0x20); break;
      case 0xe8: /* ret_pe */ this.COND_RET(V_FLAG, true); break;
      case 0xe9: /* jp_ix */ this.regs.PC.set(this.regs.IX.get()); break;
      case 0xea: /* jp_pe */ this.COND_JP(V_FLAG, true); break;
      case 0xeb: /* ex_de_hl */ this.EX(this.regs.DE, this.regs.HL); break;
      case 0xec: /* call_pe */ this.COND_CALL(V_FLAG, true); break;
      case 0xed: /* ed */ this.executeEdInstruction(this.readOpcode()); break;
      case 0xee: /* xor_byte */ this.XOR(this.readOpcode()); break;
      case 0xef: /* rst_28 */ this.RST(0x28); break;
      case 0xf0: /* ret_p */ this.COND_RET(S_FLAG, false); break;
      case 0xf1: /* pop_af */ this.POP(this.regs.AF); break;
      case 0xf2: /* jp_p */ this.COND_JP(S_FLAG, false); break;
      case 0xf3: /* di */ this.DI(); break;
      case 0xf4: /* call_p */ this.COND_CALL(S_FLAG, false); break;
      case 0xf5: /* push_af */ this.PUSH(this.regs.AF); break;
      case 0xf6: /* or_byte */ this.OR(this.readOpcode()); break;
      case 0xf7: /* rst_30 */ this.RST(0x30); break;
      case 0xf8: /* ret_m */ this.COND_RET(S_FLAG, true); break;
      case 0xf9: /* ld_sp_ix */ this.addSystemTime(this.delay.LDSPHL); this.regs.SP.set(this.regs.IX.get()); break;
      case 0xfa: /* jp_m */ this.COND_JP(S_FLAG, true); break;
      case 0xfb: /* ei */ this.EI(); break;
      case 0xfc: /* call_m */ this.COND_CALL(S_FLAG, true); break;
      case 0xfd: /* fd */ this.executeFdInstruction(this.readOpcode()); break;
      case 0xfe: /* cp_byte */ this.CP(this.readOpcode()); break;
      case 0xff: /* rst_38 */ this.RST(0x38); break;
      default:
        throw new Error('Invalid opcode: DD-' + (opcode & 0xff));
    }
  }

  private executeEdInstruction(opcode: number): void {
    this.M1();
    switch (opcode & 0xff) {
      case 0x00: /* nop */ break;
      case 0x01: /* nop */ break;
      case 0x02: /* nop */ break;
      case 0x03: /* nop */ break;
      case 0x04: /* nop */ break;
      case 0x05: /* nop */ break;
      case 0x06: /* nop */ break;
      case 0x07: /* nop */ break;
      case 0x08: /* nop */ break;
      case 0x09: /* nop */ break;
      case 0x0a: /* nop */ break;
      case 0x0b: /* nop */ break;
      case 0x0c: /* nop */ break;
      case 0x0d: /* nop */ break;
      case 0x0e: /* nop */ break;
      case 0x0f: /* nop */ break;
      case 0x10: /* nop */ break;
      case 0x11: /* nop */ break;
      case 0x12: /* nop */ break;
      case 0x13: /* nop */ break;
      case 0x14: /* nop */ break;
      case 0x15: /* nop */ break;
      case 0x16: /* nop */ break;
      case 0x17: /* nop */ break;
      case 0x18: /* nop */ break;
      case 0x19: /* nop */ break;
      case 0x1a: /* nop */ break;
      case 0x1b: /* nop */ break;
      case 0x1c: /* nop */ break;
      case 0x1d: /* nop */ break;
      case 0x1e: /* nop */ break;
      case 0x1f: /* nop */ break;
      case 0x20: /* nop */ break;
      case 0x21: /* nop */ break;
      case 0x22: /* nop */ break;
      case 0x23: /* nop */ break;
      case 0x24: /* nop */ break;
      case 0x25: /* nop */ break;
      case 0x26: /* nop */ break;
      case 0x27: /* nop */ break;
      case 0x28: /* nop */ break;
      case 0x29: /* nop */ break;
      case 0x2a: /* nop */ break;
      case 0x2b: /* nop */ break;
      case 0x2c: /* nop */ break;
      case 0x2d: /* nop */ break;
      case 0x2e: /* nop */ break;
      case 0x2f: /* nop */ break;
      case 0x30: /* nop */ break;
      case 0x31: /* nop */ break;
      case 0x32: /* nop */ break;
      case 0x33: /* nop */ break;
      case 0x34: /* nop */ break;
      case 0x35: /* nop */ break;
      case 0x36: /* nop */ break;
      case 0x37: /* nop */ break;
      case 0x38: /* nop */ break;
      case 0x39: /* nop */ break;
      case 0x3a: /* nop */ break;
      case 0x3b: /* nop */ break;
      case 0x3c: /* nop */ break;
      case 0x3d: /* nop */ break;
      case 0x3e: /* nop */ break;
      case 0x3f: /* nop */ break;
      case 0x40: /* in_b_c */ this.IN_C(this.regs.BC.h); break;
      case 0x41: /* out_c_b */ this.OUT_C(this.regs.BC.h); break;
      case 0x42: /* sbc_hl_bc */ this.SBCW(this.regs.BC); break;
      case 0x43: /* ld_xword_bc */ this.LD_XWORD_R(this.regs.BC); break;
      case 0x44: /* neg */ this.NEG(); break;
      case 0x45: /* retn */ this.RETN(); break;
      case 0x46: /* im_0 */ this.regs.im = 0; break;
      case 0x47: /* ld_i_a */ this.LD_I_A(); break;
      case 0x48: /* in_c_c */ this.IN_C(this.regs.BC.l); break;
      case 0x49: /* out_c_c */ this.OUT_C(this.regs.BC.l); break;
      case 0x4a: /* adc_hl_bc */ this.ADCW(this.regs.BC); break;
      case 0x4b: /* ld_bc_xword */ this.LD_R_XWORD(this.regs.BC); break;
      case 0x4c: /* neg */ this.NEG(); break;
      case 0x4d: /* reti */ this.RETI(); break;
      case 0x4e: /* im_0 */ this.regs.im = 0; break;
      case 0x4f: /* ld_r_a */ this.LD_R_A(); break;
      case 0x50: /* in_d_c */ this.IN_C(this.regs.DE.h); break;
      case 0x51: /* out_c_d */ this.OUT_C(this.regs.DE.h); break;
      case 0x52: /* sbc_hl_de */ this.SBCW(this.regs.DE); break;
      case 0x53: /* ld_xword_de */ this.LD_XWORD_R(this.regs.DE); break;
      case 0x54: /* neg */ this.NEG(); break;
      case 0x55: /* retn */ this.RETN(); break;
      case 0x56: /* im_1 */ this.regs.im = 1; break;
      case 0x57: /* ld_a_i */ this.LD_A_I(); break;
      case 0x58: /* in_e_c */ this.IN_C(this.regs.DE.l); break;
      case 0x59: /* out_c_e */ this.OUT_C(this.regs.DE.l); break;
      case 0x5a: /* adc_hl_de */ this.ADCW(this.regs.DE); break;
      case 0x5b: /* ld_de_xword */ this.LD_R_XWORD(this.regs.DE); break;
      case 0x5c: /* neg */ this.NEG(); break;
      case 0x5d: /* retn */ this.RETN(); break;
      case 0x5e: /* im_2 */ this.regs.im = 2; break;
      case 0x5f: /* ld_a_r */ this.LD_A_R(); break;
      case 0x60: /* in_h_c */ this.IN_C(this.regs.HL.h); break;
      case 0x61: /* out_c_h */ this.OUT_C(this.regs.HL.h); break;
      case 0x62: /* sbc_hl_hl */ this.SBCW(this.regs.HL); break;
      case 0x63:  /* ld_xword_hl */ this.LD_XWORD_R(this.regs.HL); break;
      case 0x64: /* neg */ this.NEG(); break;
      case 0x65: /* retn */ this.RETN(); break;
      case 0x66: /* im_0 */ this.regs.im = 0; break;
      case 0x67: /* rrd */ this.RRD(); break;
      case 0x68: /* in_l_c */ this.IN_C(this.regs.HL.l); break;
      case 0x69: /* out_c_l */ this.OUT_C(this.regs.HL.l); break;
      case 0x6a: /* adc_hl_hl */ this.ADCW(this.regs.HL); break;
      case 0x6b: /* ld_hl_xword */ this.LD_R_XWORD(this.regs.HL); break;
      case 0x6c: /* neg */ this.NEG(); break;
      case 0x6d: /* retn */ this.RETN(); break;
      case 0x6e: /* im_0 */ this.regs.im = 0; break;
      case 0x6f: /* rld */ this.RLD(); break;
      case 0x70: /* in_0_c */ { let r = new Register(); this.IN_C(r); } break;
      case 0x71: /* out_c_0 */ { let r = new Register(); this.OUT_C(r); } break;
      case 0x72: /* sbc_hl_sp */ this.SBCW(this.regs.SP); break;
      case 0x73:  /* ld_xword_sp */ this.LD_XWORD_R(this.regs.SP); break;
      case 0x74: /* neg */ this.NEG(); break;
      case 0x75: /* retn */ this.RETN(); break;
      case 0x76: /* im_1 */ this.regs.im = 1; break;
      case 0x77: /* nop */ break;
      case 0x78: /* in_a_c */ this.IN_C(this.regs.AF.h); break;
      case 0x79: /* out_c_a */ this.OUT_C(this.regs.AF.h); break;
      case 0x7a: /* adc_hl_sp */ this.ADCW(this.regs.SP); break;
      case 0x7b: /* ld_sp_xword */ this.LD_R_XWORD(this.regs.SP); break;
      case 0x7c: /* neg */ this.NEG(); break;
      case 0x7d: /* retn */ this.RETN(); break;
      case 0x7e: /* im_2 */ this.regs.im = 2; break;
      case 0x7f: /* nop */ break;
      case 0x80: /* nop */ break;
      case 0x81: /* nop */ break;
      case 0x82: /* nop */ break;
      case 0x83: /* nop */ break;
      case 0x84: /* nop */ break;
      case 0x85: /* nop */ break;
      case 0x86: /* nop */ break;
      case 0x87: /* nop */ break;
      case 0x88: /* nop */ break;
      case 0x89: /* nop */ break;
      case 0x8a: /* nop */ break;
      case 0x8b: /* nop */ break;
      case 0x8c: /* nop */ break;
      case 0x8d: /* nop */ break;
      case 0x8e: /* nop */ break;
      case 0x8f: /* nop */ break;
      case 0x90: /* nop */ break;
      case 0x91: /* nop */ break;
      case 0x92: /* nop */ break;
      case 0x93: /* nop */ break;
      case 0x94: /* nop */ break;
      case 0x95: /* nop */ break;
      case 0x96: /* nop */ break;
      case 0x97: /* nop */ break;
      case 0x98: /* nop */ break;
      case 0x99: /* nop */ break;
      case 0x9a: /* nop */ break;
      case 0x9b: /* nop */ break;
      case 0x9c: /* nop */ break;
      case 0x9d: /* nop */ break;
      case 0x9e: /* nop */ break;
      case 0x9f: /* nop */ break;
      case 0xa0: /* ldi */ this.LDI(); break;
      case 0xa1: /* cpi */ this.CPI(); break;
      case 0xa2: /* ini */ this.INI(); break;
      case 0xa3: /* outi */ this.OUTI(); break;
      case 0xa4: /* nop */ break;
      case 0xa5: /* nop */ break;
      case 0xa6: /* nop */ break;
      case 0xa7: /* nop */ break;
      case 0xa8: /* ldd */ this.LDD(); break;
      case 0xa9: /* cpd */ this.CPD(); break;
      case 0xaa: /* ind */ this.IND(); break;
      case 0xab: /* outd */ this.OUTD(); break;
      case 0xac: /* nop */ break;
      case 0xad: /* nop */ break;
      case 0xae: /* nop */ break;
      case 0xaf: /* nop */ break;
      case 0xb0: /* ldir */ this.LDIR(); break;
      case 0xb1: /* cpir */ this.CPIR(); break;
      case 0xb2: /* inir */ this.INIR(); break;
      case 0xb3: /* otir */ this.OTIR(); break;
      case 0xb4: /* nop */ break;
      case 0xb5: /* nop */ break;
      case 0xb6: /* nop */ break;
      case 0xb7: /* nop */ break;
      case 0xb8: /* lddr */ this.LDDR(); break;
      case 0xb9: /* cpdr */ this.CPDR(); break;
      case 0xba: /* indr */ this.INDR(); break;
      case 0xbb: /* otdr */ this.OTDR(); break;
      case 0xbc: /* nop */ break;
      case 0xbd: /* nop */ break;
      case 0xbe: /* nop */ break;
      case 0xbf: /* nop */ break;
      case 0xc0: /* nop */ break;
      case 0xc1: /* mulu_b */ this.MULU(this.regs.BC.h); break;
      case 0xc2: /* nop */ break;
      case 0xc3: /* muluw_bc */ this.MULUW(this.regs.BC); break;
      case 0xc4: /* nop */ break;
      case 0xc5: /* nop */ break;
      case 0xc6: /* nop */ break;
      case 0xc7: /* nop */ break;
      case 0xc8: /* nop */ break;
      case 0xc9: /* mulu_c */ this.MULU(this.regs.BC.l); break;
      case 0xca: /* nop */ break;
      case 0xcb: /* nop */ break;
      case 0xcc: /* nop */ break;
      case 0xcd: /* nop */ break;
      case 0xce: /* nop */ break;
      case 0xcf: /* nop */ break;
      case 0xd0: /* nop */ break;
      case 0xd1:  /* mulu_d */ this.MULU(this.regs.DE.h); break;
      case 0xd2: /* nop */ break;
      case 0xd3: /* muluw_de */ this.MULUW(this.regs.DE); break;
      case 0xd4: /* nop */ break;
      case 0xd5: /* nop */ break;
      case 0xd6: /* nop */ break;
      case 0xd7: /* nop */ break;
      case 0xd8: /* nop */ break;
      case 0xd9: /* mulu_e */ this.MULU(this.regs.DE.l); break;
      case 0xda: /* nop */ break;
      case 0xdb: /* nop */ break;
      case 0xdc: /* nop */ break;
      case 0xdd: /* nop */ break;
      case 0xde: /* nop */ break;
      case 0xdf: /* nop */ break;
      case 0xe0: /* nop */ break;
      case 0xe1: /* mulu_h */ this.MULU(this.regs.HL.h); break;
      case 0xe2: /* nop */ break;
      case 0xe3: /* muluw_hl */ this.MULUW(this.regs.HL); break;
      case 0xe4: /* nop */ break;
      case 0xe5: /* nop */ break;
      case 0xe6: /* nop */ break;
      case 0xe7: /* nop */ break;
      case 0xe8: /* nop */ break;
      case 0xe9: /* mulu_l */ this.MULU(this.regs.HL.l); break;
      case 0xea: /* nop */ break;
      case 0xeb: /* nop */ break;
      case 0xec: /* nop */ break;
      case 0xed: /* nop */ break;
      case 0xee: /* nop */ break;
      case 0xef: /* nop */ break;
      case 0xf0: /* nop */ break;
      case 0xf1:/* mulu_xhl */ this.MULU_XHL(); break;
      case 0xf2: /* nop */ break;
      case 0xf3: /* mulu_sp */ this.MULU(this.regs.SP.h); break;
      case 0xf4: /* nop */ break;
      case 0xf5: /* nop */ break;
      case 0xf6: /* nop */ break;
      case 0xf7: /* nop */ break;
      case 0xf8: /* nop */ break;
      case 0xf9: /* mulu_a */ this.MULU(this.regs.AF.h); break;
      case 0xfa: /* nop */ break;
      case 0xfb: /* nop */ break;
      case 0xfc: /* nop */ break;
      case 0xfd: /* nop */ break;
      case 0xfe: /* patch */ break;
      case 0xff: /* nop */ break;
      default:
        throw new Error('Invalid opcode: ED-' + (opcode & 0xff));
    }
  }

  private executeFdInstruction(opcode: number): void {
    this.M1();
    switch (opcode & 0xff) {
      case 0x00: /* nop */ break;
      case 0x01: /* ld_bc_word */ this.regs.BC.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x02: /* ld_xbc_a */ this.writeMem(this.regs.BC.get(), this.regs.AF.h.get()); break;
      case 0x03: /* inc_bc */ this.INCW(this.regs.BC); break;
      case 0x04: /* inc_b */ this.INC(this.regs.BC.h); break;
      case 0x05: /* dec_b */ this.DEC(this.regs.BC.h); break;
      case 0x06: /* ld_b_byte */ this.regs.BC.h.set(this.readOpcode()); break;
      case 0x07: /* rlca */ this.RLCA(); break;
      case 0x08: /* ex_af_af */ this.EX(this.regs.AF, this.regs.AF1); break;
      case 0x09: /* add_iy_bc */ this.ADDW(this.regs.IY, this.regs.BC); break;
      case 0x0a: /* ld_a_xbc */ this.regs.AF.h.set(this.readMem(this.regs.BC.get())); break;
      case 0x0b: /* dec_bc */ this.DECW(this.regs.BC); break;
      case 0x0c: /* inc_c */ this.INC(this.regs.BC.l); break;
      case 0x0d: /* dec_c */ this.DEC(this.regs.BC.l); break;
      case 0x0e: /* ld_c_byte */ this.regs.BC.l.set(this.readOpcode()); break;
      case 0x0f: /* rrca */ this.RRCA(); break;
      case 0x10: /* djnz */ this.DJNZ(); break;
      case 0x11: /* ld_de_word */ this.regs.DE.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x12: /* ld_xde_a */ this.writeMem(this.regs.DE.get(), this.regs.AF.h.get()); break;
      case 0x13: /* inc_de */ this.INCW(this.regs.DE); break;
      case 0x14: /* inc_d */ this.INC(this.regs.DE.h); break;
      case 0x15: /* dec_d */ this.DEC(this.regs.DE.h); break;
      case 0x16: /* ld_d_byte */ this.regs.DE.h.set(this.readOpcode()); break;
      case 0x17: /* rla */ this.RLA(); break;
      case 0x18: /* jr */ this.JR(); break;
      case 0x19: /* add_iy_de */ this.ADDW(this.regs.IY, this.regs.DE); break;
      case 0x1a: /* ld_a_xde */ this.regs.AF.h.set(this.readMem(this.regs.DE.get())); break;
      case 0x1b: /* dec_de */ this.DECW(this.regs.DE); break;
      case 0x1c: /* inc_e */ this.INC(this.regs.DE.l); break;
      case 0x1d: /* dec_e */ this.DEC(this.regs.DE.l); break;
      case 0x1e: /* ld_e_byte */ this.regs.DE.l.set(this.readOpcode()); break;
      case 0x1f: /* rra */ this.RRA(); break;
      case 0x20: /* jr_nz */ this.COND_JR(Z_FLAG, false); break;
      case 0x21: /* ld_iy_word */ this.regs.IY.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x22: /* ld_xword_iy */ this.LD_XWORD_R(this.regs.IY); break;
      case 0x23: /* inc_iy */ this.INCW(this.regs.IY); break;
      case 0x24: /* inc_iyh */ this.INC(this.regs.IY.h); break;
      case 0x25: /* dec_iyh */ this.DEC(this.regs.IY.h); break;
      case 0x26: /* ld_iyh_byte */ this.regs.IY.h.set(this.readOpcode()); break;
      case 0x27: /* daa */ this.DAA(); break;
      case 0x28: /* jr_z */ this.COND_JR(Z_FLAG, true); break;
      case 0x29: /* add_iy_iy */ this.ADDW(this.regs.IY, this.regs.IY); break;
      case 0x2a: /* ld_iy_xword */ this.LD_R_XWORD(this.regs.IY); break;
      case 0x2b: /* dec_iy */ this.DECW(this.regs.IY); break;
      case 0x2c: /* inc_iyl */ this.INC(this.regs.IY.l); break;
      case 0x2d: /* dec_iyl */ this.DEC(this.regs.IY.l); break;
      case 0x2e: /* ld_iyl_byte */ this.regs.IY.l.set(this.readOpcode()); break;
      case 0x2f: /* cpl */ this.CPL(); break;
      case 0x30: /* jr_nc */ this.COND_JR(C_FLAG, false); break;
      case 0x31: /* ld_sp_word */ this.regs.SP.setLH(this.readOpcode(), this.readOpcode()); break;
      case 0x32: /* ld_xbyte_a */ this.LD_XBYTE_R(this.regs.AF.h); break;
      case 0x33: /* inc_sp */ this.INCW(this.regs.SP); break;
      case 0x34: /* inc_xiy */ this.INC_XIn(this.regs.IY); break;
      case 0x35: /* dec_xiy */ this.DEC_XIn(this.regs.IY); break;
      case 0x36: /* ld_xiy_byte */ this.LD_XIn_BYTE(this.regs.IY); break;
      case 0x37: /* scf */ this.SCF(); break;
      case 0x38: /* jr_c */ this.COND_JR(C_FLAG, true); break;
      case 0x39: /* add_iy_sp */ this.ADDW(this.regs.IY, this.regs.SP); break;
      case 0x3a: /* ld_a_xbyte */ this.LD_R_XBYTE(this.regs.AF.h); break;
      case 0x3b: /* dec_sp */ this.DECW(this.regs.SP); break;
      case 0x3c: /* inc_a */ this.INC(this.regs.AF.h); break;
      case 0x3d: /* dec_a */ this.DEC(this.regs.AF.h); break;
      case 0x3e: /* ld_a_byte */ this.regs.AF.h.set(this.readOpcode()); break;
      case 0x3f: /* ccf */ this.CCF(); break;
      case 0x40: /* ld_b_b */ this.regs.BC.h.set(this.regs.BC.h.get()); break;
      case 0x41: /* ld_b_c */ this.regs.BC.h.set(this.regs.BC.l.get()); break;
      case 0x42: /* ld_b_d */ this.regs.BC.h.set(this.regs.DE.h.get()); break;
      case 0x43:  /* ld_b_e */ this.regs.BC.h.set(this.regs.DE.l.get()); break;
      case 0x44:  /* ld_b_iyh */ this.regs.BC.h.set(this.regs.IY.h.get()); break;
      case 0x45: /* ld_b_iyl */ this.regs.BC.h.set(this.regs.IY.l.get()); break;
      case 0x46: /* ld_b_xiy */ this.LD_R_XIn(this.regs.BC.h, this.regs.IY); break;
      case 0x47: /* ld_b_a */ this.regs.BC.h.set(this.regs.AF.h.get()); break;
      case 0x48: /* ld_c_b */ this.regs.BC.l.set(this.regs.BC.h.get()); break;
      case 0x49: /* ld_c_c */ this.regs.BC.l.set(this.regs.BC.l.get()); break;
      case 0x4a: /* ld_c_d */ this.regs.BC.l.set(this.regs.DE.h.get()); break;
      case 0x4b: /* ld_c_e */ this.regs.BC.l.set(this.regs.DE.l.get()); break;
      case 0x4c: /* ld_c_iyh */ this.regs.BC.l.set(this.regs.IY.h.get()); break;
      case 0x4d: /* ld_c_iyl */ this.regs.BC.l.set(this.regs.IY.l.get()); break;
      case 0x4e: /* ld_c_xiy */ this.LD_R_XIn(this.regs.BC.l, this.regs.IY); break;
      case 0x4f: /* ld_c_a */ this.regs.BC.l.set(this.regs.AF.h.get()); break;
      case 0x50: /* ld_d_b */ this.regs.DE.h.set(this.regs.BC.h.get()); break;
      case 0x51: /* ld_d_c */ this.regs.DE.h.set(this.regs.BC.l.get()); break;
      case 0x52: /* ld_d_d */ this.regs.DE.h.set(this.regs.DE.h.get()); break;
      case 0x53: /* ld_d_e */ this.regs.DE.h.set(this.regs.DE.l.get()); break;
      case 0x54: /* ld_d_iyh */ this.regs.DE.h.set(this.regs.IY.h.get()); break;
      case 0x55: /* ld_d_iyl */ this.regs.DE.h.set(this.regs.IY.l.get()); break;
      case 0x56: /* ld_d_xiy */ this.LD_R_XIn(this.regs.DE.h, this.regs.IY); break;
      case 0x57: /* ld_d_a */ this.regs.DE.h.set(this.regs.AF.h.get()); break;
      case 0x58: /* ld_e_b */ this.regs.DE.l.set(this.regs.BC.h.get()); break;
      case 0x59: /* ld_e_c */ this.regs.DE.l.set(this.regs.BC.l.get()); break;
      case 0x5a: /* ld_e_d */ this.regs.DE.l.set(this.regs.DE.h.get()); break;
      case 0x5b: /* ld_e_e */ this.regs.DE.l.set(this.regs.DE.l.get()); break;
      case 0x5c: /* ld_e_iyh */ this.regs.DE.l.set(this.regs.IY.h.get()); break;
      case 0x5d: /* ld_e_iyl */ this.regs.DE.l.set(this.regs.IY.l.get()); break;
      case 0x5e: /* ld_e_xiy */ this.LD_R_XIn(this.regs.DE.l, this.regs.IY); break;
      case 0x5f: /* ld_e_a */ this.regs.DE.l.set(this.regs.AF.h.get()); break;
      case 0x60: /* ld_iyh_b */ this.regs.IY.h.set(this.regs.BC.h.get()); break;
      case 0x61: /* ld_iyh_c */ this.regs.IY.h.set(this.regs.BC.l.get()); break;
      case 0x62: /* ld_iyh_d */ this.regs.IY.h.set(this.regs.DE.h.get()); break;
      case 0x63: /* ld_iyh_e */ this.regs.IY.h.set(this.regs.DE.l.get()); break;
      case 0x64: /* ld_iyh_iyh */ this.regs.IY.h.set(this.regs.IY.h.get()); break;
      case 0x65: /* ld_iyh_iyl */ this.regs.IY.h.set(this.regs.IY.l.get()); break;
      case 0x66: /* ld_h_xiy */ this.LD_R_XIn(this.regs.HL.h, this.regs.IY); break;
      case 0x67: /* ld_iyh_a */ this.regs.IY.h.set(this.regs.AF.h.get()); break;
      case 0x68: /* ld_iyl_b */ this.regs.IY.l.set(this.regs.BC.h.get()); break;
      case 0x69: /* ld_iyl_c */ this.regs.IY.l.set(this.regs.BC.l.get()); break;
      case 0x6a: /* ld_iyl_d */ this.regs.IY.l.set(this.regs.DE.h.get()); break;
      case 0x6b: /* ld_iyl_e */ this.regs.IY.l.set(this.regs.DE.l.get()); break;
      case 0x6c: /* ld_iyl_iyh */ this.regs.IY.l.set(this.regs.IY.h.get()); break;
      case 0x6d: /* ld_iyl_iyl */ this.regs.IY.l.set(this.regs.IY.l.get()); break;
      case 0x6e: /* ld_l_xiy */ this.LD_R_XIn(this.regs.HL.l, this.regs.IY); break;
      case 0x6f: /* ld_iyl_a */ this.regs.IY.l.set(this.regs.AF.h.get()); break;
      case 0x70: /* ld_xiy_b */ this.LD_XIn_R(this.regs.BC.h, this.regs.IY); break;
      case 0x71: /* ld_xiy_c */ this.LD_XIn_R(this.regs.BC.l, this.regs.IY); break;
      case 0x72: /* ld_xiy_d */ this.LD_XIn_R(this.regs.DE.h, this.regs.IY); break;
      case 0x73: /* ld_xiy_e */ this.LD_XIn_R(this.regs.DE.l, this.regs.IY); break;
      case 0x74: /* ld_xiy_h */ this.LD_XIn_R(this.regs.HL.h, this.regs.IY); break;
      case 0x75: /* ld_xiy_l */ this.LD_XIn_R(this.regs.HL.l, this.regs.IY); break;
      case 0x76: /* halt */ this.HALT(); break;
      case 0x77: /* ld_xiy_a */ this.LD_XIn_R(this.regs.AF.h, this.regs.IY); break;
      case 0x78: /* ld_a_b */ this.regs.AF.h.set(this.regs.BC.h.get()); break;
      case 0x79: /* ld_a_c */ this.regs.AF.h.set(this.regs.BC.l.get()); break;
      case 0x7a: /* ld_a_d */ this.regs.AF.h.set(this.regs.DE.h.get()); break;
      case 0x7b: /* ld_a_e */ this.regs.AF.h.set(this.regs.DE.l.get()); break;
      case 0x7c: /* ld_a_iyh */ this.regs.AF.h.set(this.regs.IY.h.get()); break;
      case 0x7d: /* ld_a_iyl */ this.regs.AF.h.set(this.regs.IY.l.get()); break;
      case 0x7e: /* ld_a_xiy */ this.LD_R_XIn(this.regs.AF.h, this.regs.IY); break;
      case 0x7f: /* ld_a_a */ this.regs.AF.h.set(this.regs.AF.h.get()); break;
      case 0x80: /* add_a_b */ this.ADD(this.regs.BC.h.get()); break;
      case 0x81: /* add_a_c */ this.ADD(this.regs.BC.l.get()); break;
      case 0x82: /* add_a_d */ this.ADD(this.regs.DE.h.get()); break;
      case 0x83: /* add_a_e */ this.ADD(this.regs.DE.l.get()); break;
      case 0x84: /* add_a_iyh */ this.ADD(this.regs.IY.h.get()); break;
      case 0x85: /* add_a_iyl */ this.ADD(this.regs.IY.l.get()); break;
      case 0x86: /* add_a_xiy */ this.ADD_XIn(this.regs.IY); break;
      case 0x87: /* add_a_a */ this.ADD(this.regs.AF.h.get()); break;
      case 0x88: /* adc_a_b */ this.ADC(this.regs.BC.h.get()); break;
      case 0x89: /* adc_a_c */ this.ADC(this.regs.BC.l.get()); break;
      case 0x8a: /* adc_a_d */ this.ADC(this.regs.DE.h.get()); break;
      case 0x8b: /* adc_a_e */ this.ADC(this.regs.DE.l.get()); break;
      case 0x8c: /* adc_a_iyh */ this.ADC(this.regs.IY.h.get()); break;
      case 0x8d: /* adc_a_iyl */ this.ADC(this.regs.IY.l.get()); break;
      case 0x8e: /* adc_a_xiy */ this.ADC_XIn(this.regs.IY); break;
      case 0x8f: /* adc_a_a */ this.ADC(this.regs.AF.h.get()); break;
      case 0x90: /* sub_a_b */ this.SUB(this.regs.BC.h.get()); break;
      case 0x91: /* sub_a_c */ this.SUB(this.regs.BC.l.get()); break;
      case 0x92: /* sub_a_d */ this.SUB(this.regs.DE.h.get()); break;
      case 0x93: /* sub_a_e */ this.SUB(this.regs.DE.l.get()); break;
      case 0x94: /* sub_a_iyh */ this.SUB(this.regs.IY.h.get()); break;
      case 0x95: /* sub_a_iyl */ this.SUB(this.regs.IY.l.get()); break;
      case 0x96: /* sub_a_xiy */ this.SUB_XIn(this.regs.IY); break;
      case 0x97: /* sub_a_a */ this.SUB(this.regs.AF.h.get()); break;
      case 0x98: /* sbc_a_b */ this.SBC(this.regs.BC.h.get()); break;
      case 0x99: /* sbc_a_c */ this.SBC(this.regs.BC.l.get()); break;
      case 0x9a: /* sbc_a_d */ this.SBC(this.regs.DE.h.get()); break;
      case 0x9b: /* sbc_a_e */ this.SBC(this.regs.DE.l.get()); break;
      case 0x9c: /* sbc_a_iyh */ this.SBC(this.regs.IY.h.get()); break;
      case 0x9d: /* sbc_a_iyl */ this.SBC(this.regs.IY.l.get()); break;
      case 0x9e: /* sbc_a_xiy */ this.SBC_XIn(this.regs.IY); break;
      case 0x9f: /* sbc_a_a */ this.SBC(this.regs.AF.h.get()); break;
      case 0xa0: /* and_b */ this.AND(this.regs.BC.h.get()); break;
      case 0xa1: /* and_c */ this.AND(this.regs.BC.l.get()); break;
      case 0xa2: /* and_d */ this.AND(this.regs.DE.h.get()); break;
      case 0xa3: /* and_e */ this.AND(this.regs.DE.l.get()); break;
      case 0xa4: /* and_iyh */ this.AND(this.regs.IY.h.get()); break;
      case 0xa5: /* and_iyl */ this.AND(this.regs.IY.l.get()); break;
      case 0xa6: /* and_xiy */ this.AND_XIn(this.regs.IY); break;
      case 0xa7: /* and_a */ this.AND(this.regs.AF.h.get()); break;
      case 0xa8: /* xor_b */ this.XOR(this.regs.BC.h.get()); break;
      case 0xa9: /* xor_c */ this.XOR(this.regs.BC.l.get()); break;
      case 0xaa: /* xor_d */ this.XOR(this.regs.DE.h.get()); break;
      case 0xab: /* xor_e */ this.XOR(this.regs.DE.l.get()); break;
      case 0xac: /* xor_iyh */ this.XOR(this.regs.IY.h.get()); break;
      case 0xad: /* xor_iyl */ this.XOR(this.regs.IY.l.get()); break;
      case 0xae: /* xor_xiy */ this.XOR_XIn(this.regs.IY); break;
      case 0xaf: /* xor_a */ this.XOR(this.regs.AF.h.get()); break;
      case 0xb0: /* or_b */ this.OR(this.regs.BC.h.get()); break;
      case 0xb1: /* or_c */ this.OR(this.regs.BC.l.get()); break;
      case 0xb2: /* or_d */ this.OR(this.regs.DE.h.get()); break;
      case 0xb3: /* or_e */ this.OR(this.regs.DE.l.get()); break;
      case 0xb4: /* or_iyh */ this.OR(this.regs.IY.h.get()); break;
      case 0xb5: /* or_iyl */ this.OR(this.regs.IY.l.get()); break;
      case 0xb6: /* or_xiy */ this.OR_XIn(this.regs.IY); break;
      case 0xb7: /* or_a */ this.OR(this.regs.AF.h.get()); break;
      case 0xb8: /* cp_b */ this.CP(this.regs.BC.h.get()); break;
      case 0xb9: /* cp_c */ this.CP(this.regs.BC.l.get()); break;
      case 0xba: /* cp_d */ this.CP(this.regs.DE.h.get()); break;
      case 0xbb: /* cp_e */ this.CP(this.regs.DE.l.get()); break;
      case 0xbc: /* cp_iyh */ this.CP(this.regs.IY.h.get()); break;
      case 0xbd: /* cp_iyl */ this.CP(this.regs.IY.l.get()); break;
      case 0xbe: /* cp_xiy */ this.CP_XIn(this.regs.IY); break;
      case 0xbf: /* cp_a */ this.CP(this.regs.AF.h.get()); break;
      case 0xc0: /* ret_nz */ this.COND_RET(Z_FLAG, false); break;
      case 0xc1: /* pop_bc */ this.POP(this.regs.BC); break;
      case 0xc2: /* jp_nz */ this.COND_JP(Z_FLAG, false); break;
      case 0xc3: /* jp */ this.JP(); break;
      case 0xc4: /* call_nz */ this.COND_CALL(Z_FLAG, false); break;
      case 0xc5: /* push_bc */ this.PUSH(this.regs.BC); break;
      case 0xc6: /* add_a_byte */ this.ADD(this.readOpcode()); break;
      case 0xc7: /* rst_00 */ this.RST(0x00); break;
      case 0xc8: /* ret_z */ this.COND_RET(Z_FLAG, true); break;
      case 0xc9: /* ret */ this.RET(); break;
      case 0xca: /* jp_z */ this.COND_JP(Z_FLAG, true); break;
      case 0xcb: /* fd_cb */ this.executeNnCbInstruction(this.regs.IY); break;
      case 0xcc: /* call_z */ this.COND_CALL(Z_FLAG, true); break;
      case 0xcd: /* call */ this.CALL(); break;
      case 0xce: /* adc_a_byte */ this.ADC(this.readOpcode()); break;
      case 0xcf: /* rst_08 */ this.RST(0x08); break;
      case 0xd0: /* ret_nc */this.COND_RET(C_FLAG, false); break;
      case 0xd1: /* pop_de */ this.POP(this.regs.DE); break;
      case 0xd2: /* jp_nc */ this.COND_JP(C_FLAG, false); break;
      case 0xd3: /* out_byte_a */ this.OUT_BYTE_A(); break;
      case 0xd4: /* call_nc */ this.COND_CALL(C_FLAG, false); break;
      case 0xd5: /* push_de */ this.PUSH(this.regs.DE); break;
      case 0xd6: /* sub_byte */ this.SUB(this.readOpcode()); break;
      case 0xd7: /* rst_10 */ this.RST(0x10); break;
      case 0xd8: /* ret_c */ this.COND_RET(C_FLAG, true); break;
      case 0xd9: /* exx */ this.EXX(); break;
      case 0xda: /* jp_c */ this.COND_JP(C_FLAG, true); break;
      case 0xdb: /* in_byte_a */ this.IN_BYTE_A(); break;
      case 0xdc: /* call_c */ this.COND_CALL(C_FLAG, true); break;
      case 0xdd: /* dd */ this.executeDdInstruction(this.readOpcode()); break;
      case 0xde: /* sbc_byte */ this.SBC(this.readOpcode()); break;
      case 0xdf: /* rst_18 */ this.RST(0x18); break;
      case 0xe0: /* ret_po */ this.COND_RET(V_FLAG, false); break;
      case 0xe1: /* pop_iy */ this.POP(this.regs.IY); break;
      case 0xe2: /* jp_po */ this.COND_JP(V_FLAG, false); break;
      case 0xe3: /* ex_xsp_iy */ this.EX_SP(this.regs.IY); break;
      case 0xe4: /* call_po */ this.COND_CALL(V_FLAG, false); break;
      case 0xe5: /* push_iy */ this.PUSH(this.regs.IY); break;
      case 0xe6: /* and_byte */ this.AND(this.readOpcode()); break;
      case 0xe7: /* rst_20 */ this.RST(0x20); break;
      case 0xe8: /* ret_pe */ this.COND_RET(V_FLAG, true); break;
      case 0xe9: /* jp_iy */ this.regs.PC.set(this.regs.IY.get()); break;
      case 0xea: /* jp_pe */ this.COND_JP(V_FLAG, true); break;
      case 0xeb: /* ex_de_hl */ this.EX(this.regs.DE, this.regs.HL); break;
      case 0xec: /* call_pe */ this.COND_CALL(V_FLAG, true); break;
      case 0xed: /* ed */ this.executeEdInstruction(this.readOpcode()); break;
      case 0xee: /* xor_byte */ this.XOR(this.readOpcode()); break;
      case 0xef: /* rst_28 */ this.RST(0x28); break;
      case 0xf0: /* ret_p */ this.COND_RET(S_FLAG, false); break;
      case 0xf1: /* pop_af */ this.POP(this.regs.AF); break;
      case 0xf2: /* jp_p */ this.COND_JP(S_FLAG, false); break;
      case 0xf3: /* di */ this.DI(); break;
      case 0xf4: /* call_p */ this.COND_CALL(S_FLAG, false); break;
      case 0xf5: /* push_af */ this.PUSH(this.regs.AF); break;
      case 0xf6: /* or_byte */ this.OR(this.readOpcode()); break;
      case 0xf7: /* rst_30 */ this.RST(0x30); break;
      case 0xf8: /* ret_m */ this.COND_RET(S_FLAG, true); break;
      case 0xf9: /* ld_sp_iy */ this.addSystemTime(this.delay.LDSPHL); this.regs.SP.set(this.regs.IY.get()); break;
      case 0xfa: /* jp_m */ this.COND_JP(S_FLAG, true); break;
      case 0xfb: /* ei */ this.EI(); break;
      case 0xfc: /* call_m */ this.COND_CALL(S_FLAG, true); break;
      case 0xfd: /* fd */ this.executeFdInstruction(this.readOpcode()); break;
      case 0xfe: /* cp_byte */ this.CP(this.readOpcode()); break;
      case 0xff: /* rst_38 */ this.RST(0x38); break;
      default:
        throw new Error('Invalid opcode: FD-' + (opcode & 0xff));
    }
  }

  private executeNnCbInstruction(reg: RegisterPair): void {
    let addr = reg.get() + this.byteToSignedInt(this.readOpcode());
    let opcode = this.readOpcode();
    this.addSystemTime(this.delay.M1);
    switch (opcode & 0xff) {
      case 0x00: /* rlc_xnn_b */ this.RLC_XNN(addr, this.regs.BC.h); break;
      case 0x01: /* rlc_xnn_c */ this.RLC_XNN(addr, this.regs.BC.l); break;
      case 0x02: /* rlc_xnn_d */ this.RLC_XNN(addr, this.regs.DE.h); break;
      case 0x03: /* rlc_xnn_e */ this.RLC_XNN(addr, this.regs.DE.l); break;
      case 0x04: /* rlc_xnn_h */ this.RLC_XNN(addr, this.regs.HL.h); break;
      case 0x05: /* rlc_xnn_l */ this.RLC_XNN(addr, this.regs.HL.l); break;
      case 0x06: /* rlc_xnn */ { let r = new Register(); this.RLC_XNN(addr, r); } break;
      case 0x07: /* rlc_xnn_a */ this.RLC_XNN(addr, this.regs.AF.h); break;
      case 0x08: /* rrc_xnn_b */ this.RRC_XNN(addr, this.regs.BC.h); break;
      case 0x09: /* rrc_xnn_c */ this.RRC_XNN(addr, this.regs.BC.l); break;
      case 0x0a: /* rrc_xnn_d */ this.RRC_XNN(addr, this.regs.DE.h); break;
      case 0x0b: /* rrc_xnn_e */ this.RRC_XNN(addr, this.regs.DE.l); break;
      case 0x0c: /* rrc_xnn_h */ this.RRC_XNN(addr, this.regs.HL.h); break;
      case 0x0d: /* rrc_xnn_l */ this.RRC_XNN(addr, this.regs.HL.l); break;
      case 0x0e: /* rrc_xnn */ { let r = new Register(); this.RRC_XNN(addr, r); } break;
      case 0x0f: /* rrc_xnn_a */ this.RRC_XNN(addr, this.regs.AF.h); break;
      case 0x10: /* rl_xnn_b */ this.RL_XNN(addr, this.regs.BC.h); break;
      case 0x11: /* rl_xnn_c */ this.RL_XNN(addr, this.regs.BC.l); break;
      case 0x12: /* rl_xnn_d */ this.RL_XNN(addr, this.regs.DE.h); break;
      case 0x13: /* rl_xnn_e */ this.RL_XNN(addr, this.regs.DE.l); break;
      case 0x14: /* rl_xnn_h */ this.RL_XNN(addr, this.regs.HL.h); break;
      case 0x15: /* rl_xnn_l */ this.RL_XNN(addr, this.regs.HL.l); break;
      case 0x16: /* rl_xnn */ { let r = new Register(); this.RL_XNN(addr, r); } break;
      case 0x17: /* rl_xnn_a */ this.RL_XNN(addr, this.regs.AF.h); break;
      case 0x18: /* rr_xnn_b */ this.RR_XNN(addr, this.regs.BC.h); break;
      case 0x19: /* rr_xnn_c */ this.RR_XNN(addr, this.regs.BC.l); break;
      case 0x1a: /* rr_xnn_d */ this.RR_XNN(addr, this.regs.DE.h); break;
      case 0x1b: /* rr_xnn_e */ this.RR_XNN(addr, this.regs.DE.l); break;
      case 0x1c: /* rr_xnn_h */ this.RR_XNN(addr, this.regs.HL.h); break;
      case 0x1d: /* rr_xnn_l */ this.RR_XNN(addr, this.regs.HL.l); break;
      case 0x1e: /* rr_xnn */ { let r = new Register(); this.RR_XNN(addr, r); } break;
      case 0x1f: /* rr_xnn_a */ this.RR_XNN(addr, this.regs.AF.h); break;
      case 0x20: /* sla_xnn_b */ this.SLA_XNN(addr, this.regs.BC.h); break;
      case 0x21: /* sla_xnn_c */ this.SLA_XNN(addr, this.regs.BC.l); break;
      case 0x22: /* sla_xnn_d */ this.SLA_XNN(addr, this.regs.DE.h); break;
      case 0x23: /* sla_xnn_e */ this.SLA_XNN(addr, this.regs.DE.l); break;
      case 0x24: /* sla_xnn_h */ this.SLA_XNN(addr, this.regs.HL.h); break;
      case 0x25: /* sla_xnn_l */ this.SLA_XNN(addr, this.regs.HL.l); break;
      case 0x26: /* sla_xnn */ { let r = new Register(); this.SLA_XNN(addr, r); } break;
      case 0x27: /* sla_xnn_a */ this.SLA_XNN(addr, this.regs.AF.h); break;
      case 0x28: /* sra_xnn_b */ this.SRA_XNN(addr, this.regs.BC.h); break;
      case 0x29: /* sra_xnn_c */ this.SRA_XNN(addr, this.regs.BC.l); break;
      case 0x2a: /* sra_xnn_d */ this.SRA_XNN(addr, this.regs.DE.h); break;
      case 0x2b: /* sra_xnn_e */ this.SRA_XNN(addr, this.regs.DE.l); break;
      case 0x2c: /* sra_xnn_h */ this.SRA_XNN(addr, this.regs.HL.h); break;
      case 0x2d: /* sra_xnn_l */ this.SRA_XNN(addr, this.regs.HL.l); break;
      case 0x2e: /* sra_xnn */ { let r = new Register(); this.SRA_XNN(addr, r); } break;
      case 0x2f: /* sra_xnn_a */ this.SRA_XNN(addr, this.regs.AF.h); break;
      case 0x30: /* sll_xnn_b */ this.SLL_XNN(addr, this.regs.BC.h); break;
      case 0x31: /* sll_xnn_c */ this.SLL_XNN(addr, this.regs.BC.l); break;
      case 0x32: /* sll_xnn_d */ this.SLL_XNN(addr, this.regs.DE.h); break;
      case 0x33: /* sll_xnn_e */ this.SLL_XNN(addr, this.regs.DE.l); break;
      case 0x34: /* sll_xnn_h */ this.SLL_XNN(addr, this.regs.HL.h); break;
      case 0x35: /* sll_xnn_l */ this.SLL_XNN(addr, this.regs.HL.l); break;
      case 0x36: /* sll_xnn */ { let r = new Register(); this.SLL_XNN(addr, r); } break;
      case 0x37: /* sll_xnn_a */ this.SLL_XNN(addr, this.regs.AF.h); break;
      case 0x38: /* srl_xnn_b */ this.SRL_XNN(addr, this.regs.BC.h); break;
      case 0x39: /* srl_xnn_c */ this.SRL_XNN(addr, this.regs.BC.l); break;
      case 0x3a: /* srl_xnn_d */ this.SRL_XNN(addr, this.regs.DE.h); break;
      case 0x3b: /* srl_xnn_e */ this.SRL_XNN(addr, this.regs.DE.l); break;
      case 0x3c: /* srl_xnn_h */ this.SRL_XNN(addr, this.regs.HL.h); break;
      case 0x3d: /* srl_xnn_l */ this.SRL_XNN(addr, this.regs.HL.l); break;
      case 0x3e: /* srl_xnn */ { let r = new Register(); this.SRL_XNN(addr, r); } break;
      case 0x3f: /* srl_xnn_a */ this.SRL_XNN(addr, this.regs.AF.h); break;
      case 0x40: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x41: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x42: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x43: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x44: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x45: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x46: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x47: /* bit_0_xnn */ this.BIT_XNN(0, addr); break;
      case 0x48: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x49: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x4a: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x4b: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x4c: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x4d: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x4e: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x4f: /* bit_1_xnn */ this.BIT_XNN(1, addr); break;
      case 0x50: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x51: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x52: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x53: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x54: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x55: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x56: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x57: /* bit_2_xnn */ this.BIT_XNN(2, addr); break;
      case 0x58: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x59: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x5a: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x5b: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x5c: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x5d: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x5e: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x5f: /* bit_3_xnn */ this.BIT_XNN(3, addr); break;
      case 0x60: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x61: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x62: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x63: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x64: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x65: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x66: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x67: /* bit_4_xnn */ this.BIT_XNN(4, addr); break;
      case 0x68: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x69: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x6a: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x6b: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x6c: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x6d: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x6e: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x6f: /* bit_5_xnn */ this.BIT_XNN(5, addr); break;
      case 0x70: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x71: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x72: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x73: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x74: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x75: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x76: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x77: /* bit_6_xnn */ this.BIT_XNN(6, addr); break;
      case 0x78: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x79: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x7a: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x7b: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x7c: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x7d: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x7e: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x7f: /* bit_7_xnn */ this.BIT_XNN(7, addr); break;
      case 0x80: /* res_0_xnn_b */ this.RES_XNN(0, addr, this.regs.BC.h); break;
      case 0x81: /* res_0_xnn_c */ this.RES_XNN(0, addr, this.regs.BC.l); break;
      case 0x82: /* res_0_xnn_d */ this.RES_XNN(0, addr, this.regs.DE.h); break;
      case 0x83: /* res_0_xnn_e */ this.RES_XNN(0, addr, this.regs.DE.l); break;
      case 0x84: /* res_0_xnn_h */ this.RES_XNN(0, addr, this.regs.HL.h); break;
      case 0x85: /* res_0_xnn_l */ this.RES_XNN(0, addr, this.regs.HL.l); break;
      case 0x86: /* res_0_xnn */ { let r = new Register(); this.RES_XNN(0, addr, r); } break;
      case 0x87: /* res_0_xnn_a */ this.RES_XNN(0, addr, this.regs.AF.h); break;
      case 0x88: /* res_1_xnn_b */ this.RES_XNN(1, addr, this.regs.BC.h); break;
      case 0x89: /* res_1_xnn_c */ this.RES_XNN(1, addr, this.regs.BC.l); break;
      case 0x8a: /* res_1_xnn_d */ this.RES_XNN(1, addr, this.regs.DE.h); break;
      case 0x8b: /* res_1_xnn_e */ this.RES_XNN(1, addr, this.regs.DE.l); break;
      case 0x8c: /* res_1_xnn_h */ this.RES_XNN(1, addr, this.regs.HL.h); break;
      case 0x8d: /* res_1_xnn_l */ this.RES_XNN(1, addr, this.regs.HL.l); break;
      case 0x8e: /* res_1_xnn */ { let r = new Register(); this.RES_XNN(1, addr, r); } break;
      case 0x8f: /* res_1_xnn_a */ this.RES_XNN(1, addr, this.regs.AF.h); break;
      case 0x90: /* res_2_xnn_b */ this.RES_XNN(2, addr, this.regs.BC.h); break;
      case 0x91: /* res_2_xnn_c */ this.RES_XNN(2, addr, this.regs.BC.l); break;
      case 0x92: /* res_2_xnn_d */ this.RES_XNN(2, addr, this.regs.DE.h); break;
      case 0x93: /* res_2_xnn_e */ this.RES_XNN(2, addr, this.regs.DE.l); break;
      case 0x94: /* res_2_xnn_h */ this.RES_XNN(2, addr, this.regs.HL.h); break;
      case 0x95: /* res_2_xnn_l */ this.RES_XNN(2, addr, this.regs.HL.l); break;
      case 0x96: /* res_2_xnn */ { let r = new Register(); this.RES_XNN(2, addr, r); } break;
      case 0x97: /* res_2_xnn_a */ this.RES_XNN(2, addr, this.regs.AF.h); break;
      case 0x98: /* res_3_xnn_b */ this.RES_XNN(3, addr, this.regs.BC.h); break;
      case 0x99: /* res_3_xnn_c */ this.RES_XNN(3, addr, this.regs.BC.l); break;
      case 0x9a: /* res_3_xnn_d */ this.RES_XNN(3, addr, this.regs.DE.h); break;
      case 0x9b: /* res_3_xnn_e */ this.RES_XNN(3, addr, this.regs.DE.l); break;
      case 0x9c: /* res_3_xnn_h */ this.RES_XNN(3, addr, this.regs.HL.h); break;
      case 0x9d: /* res_3_xnn_l */ this.RES_XNN(3, addr, this.regs.HL.l); break;
      case 0x9e: /* res_3_xnn */ { let r = new Register(); this.RES_XNN(3, addr, r); } break;
      case 0x9f: /* res_3_xnn_a */ this.RES_XNN(3, addr, this.regs.AF.h); break;
      case 0xa0: /* res_4_xnn_b */ this.RES_XNN(4, addr, this.regs.BC.h); break;
      case 0xa1: /* res_4_xnn_c */ this.RES_XNN(4, addr, this.regs.BC.l); break;
      case 0xa2: /* res_4_xnn_d */ this.RES_XNN(4, addr, this.regs.DE.h); break;
      case 0xa3: /* res_4_xnn_e */ this.RES_XNN(4, addr, this.regs.DE.l); break;
      case 0xa4: /* res_4_xnn_h */ this.RES_XNN(4, addr, this.regs.HL.h); break;
      case 0xa5: /* res_4_xnn_l */ this.RES_XNN(4, addr, this.regs.HL.l); break;
      case 0xa6: /* res_4_xnn */ { let r = new Register(); this.RES_XNN(4, addr, r); } break;
      case 0xa7: /* res_4_xnn_a */ this.RES_XNN(4, addr, this.regs.AF.h); break;
      case 0xa8: /* res_5_xnn_b */ this.RES_XNN(5, addr, this.regs.BC.h); break;
      case 0xa9: /* res_5_xnn_c */ this.RES_XNN(5, addr, this.regs.BC.l); break;
      case 0xaa: /* res_5_xnn_d */ this.RES_XNN(5, addr, this.regs.DE.h); break;
      case 0xab: /* res_5_xnn_e */ this.RES_XNN(5, addr, this.regs.DE.l); break;
      case 0xac: /* res_5_xnn_h */ this.RES_XNN(5, addr, this.regs.HL.h); break;
      case 0xad: /* res_5_xnn_l */ this.RES_XNN(5, addr, this.regs.HL.l); break;
      case 0xae: /* res_5_xnn */ { let r = new Register(); this.RES_XNN(5, addr, r); } break;
      case 0xaf: /* res_5_xnn_a */ this.RES_XNN(5, addr, this.regs.AF.h); break;
      case 0xb0: /* res_6_xnn_b */ this.RES_XNN(6, addr, this.regs.BC.h); break;
      case 0xb1: /* res_6_xnn_c */ this.RES_XNN(6, addr, this.regs.BC.l); break;
      case 0xb2: /* res_6_xnn_d */ this.RES_XNN(6, addr, this.regs.DE.h); break;
      case 0xb3: /* res_6_xnn_e */ this.RES_XNN(6, addr, this.regs.DE.l); break;
      case 0xb4: /* res_6_xnn_h */ this.RES_XNN(6, addr, this.regs.HL.h); break;
      case 0xb5: /* res_6_xnn_l */ this.RES_XNN(6, addr, this.regs.HL.l); break;
      case 0xb6: /* res_6_xnn */ { let r = new Register(); this.RES_XNN(6, addr, r); } break;
      case 0xb7: /* res_6_xnn_a */ this.RES_XNN(6, addr, this.regs.AF.h); break;
      case 0xb8: /* res_7_xnn_b */ this.RES_XNN(7, addr, this.regs.BC.h); break;
      case 0xb9: /* res_7_xnn_c */ this.RES_XNN(7, addr, this.regs.BC.l); break;
      case 0xba: /* res_7_xnn_d */ this.RES_XNN(7, addr, this.regs.DE.h); break;
      case 0xbb: /* res_7_xnn_e */ this.RES_XNN(7, addr, this.regs.DE.l); break;
      case 0xbc: /* res_7_xnn_h */ this.RES_XNN(7, addr, this.regs.HL.h); break;
      case 0xbd: /* res_7_xnn_l */ this.RES_XNN(7, addr, this.regs.HL.l); break;
      case 0xbe: /* res_7_xnn */ { let r = new Register(); this.RES_XNN(7, addr, r); } break;
      case 0xbf: /* res_7_xnn_a */ this.RES_XNN(7, addr, this.regs.AF.h); break;
      case 0xc0: /* set_0_xnn_b */ this.SET_XNN(0, addr, this.regs.BC.h); break;
      case 0xc1: /* set_0_xnn_c */ this.SET_XNN(0, addr, this.regs.BC.l); break;
      case 0xc2: /* set_0_xnn_d */ this.SET_XNN(0, addr, this.regs.DE.h); break;
      case 0xc3: /* set_0_xnn_e */ this.SET_XNN(0, addr, this.regs.DE.l); break;
      case 0xc4: /* set_0_xnn_h */ this.SET_XNN(0, addr, this.regs.HL.h); break;
      case 0xc5: /* set_0_xnn_l */ this.SET_XNN(0, addr, this.regs.HL.l); break;
      case 0xc6: /* set_0_xnn */ { let r = new Register(); this.SET_XNN(0, addr, r); } break;
      case 0xc7: /* set_0_xnn_a */ this.SET_XNN(0, addr, this.regs.AF.h); break;
      case 0xc8: /* set_1_xnn_b */ this.SET_XNN(1, addr, this.regs.BC.h); break;
      case 0xc9: /* set_1_xnn_c */ this.SET_XNN(1, addr, this.regs.BC.l); break;
      case 0xca: /* res_1_xnn_d */ this.SET_XNN(1, addr, this.regs.DE.h); break;
      case 0xcb: /* res_1_xnn_e */ this.SET_XNN(1, addr, this.regs.DE.l); break;
      case 0xcc: /* res_1_xnn_h */ this.SET_XNN(1, addr, this.regs.HL.h); break;
      case 0xcd: /* res_1_xnn_l */ this.SET_XNN(1, addr, this.regs.HL.l); break;
      case 0xce: /* res_1_xnn */ { let r = new Register(); this.SET_XNN(1, addr, r); } break;
      case 0xcf: /* res_1_xnn_a */ this.SET_XNN(1, addr, this.regs.AF.h); break;
      case 0xd0: /* res_2_xnn_b */ this.SET_XNN(2, addr, this.regs.BC.h); break;
      case 0xd1: /* res_2_xnn_c */ this.SET_XNN(2, addr, this.regs.BC.l); break;
      case 0xd2: /* res_2_xnn_d */ this.SET_XNN(2, addr, this.regs.DE.h); break;
      case 0xd3: /* res_2_xnn_e */ this.SET_XNN(2, addr, this.regs.DE.l); break;
      case 0xd4: /* res_2_xnn_h */ this.SET_XNN(2, addr, this.regs.HL.h); break;
      case 0xd5: /* res_2_xnn_l */ this.SET_XNN(2, addr, this.regs.HL.l); break;
      case 0xd6: /* res_2_xnn */ { let r = new Register(); this.SET_XNN(2, addr, r); } break;
      case 0xd7: /* res_2_xnn_a */ this.SET_XNN(2, addr, this.regs.AF.h); break;
      case 0xd8: /* res_3_xnn_b */ this.SET_XNN(3, addr, this.regs.BC.h); break;
      case 0xd9: /* res_3_xnn_c */ this.SET_XNN(3, addr, this.regs.BC.l); break;
      case 0xda: /* res_3_xnn_d */ this.SET_XNN(3, addr, this.regs.DE.h); break;
      case 0xdb: /* res_3_xnn_e */ this.SET_XNN(3, addr, this.regs.DE.l); break;
      case 0xdc: /* res_3_xnn_h */ this.SET_XNN(3, addr, this.regs.HL.h); break;
      case 0xdd: /* res_3_xnn_l */ this.SET_XNN(3, addr, this.regs.HL.l); break;
      case 0xde: /* res_3_xnn */ { let r = new Register(); this.SET_XNN(3, addr, r); } break;
      case 0xdf: /* res_3_xnn_a */ this.SET_XNN(3, addr, this.regs.AF.h); break;
      case 0xe0: /* res_4_xnn_b */ this.SET_XNN(4, addr, this.regs.BC.h); break;
      case 0xe1: /* res_4_xnn_c */ this.SET_XNN(4, addr, this.regs.BC.l); break;
      case 0xe2: /* res_4_xnn_d */ this.SET_XNN(4, addr, this.regs.DE.h); break;
      case 0xe3: /* res_4_xnn_e */ this.SET_XNN(4, addr, this.regs.DE.l); break;
      case 0xe4: /* res_4_xnn_h */ this.SET_XNN(4, addr, this.regs.HL.h); break;
      case 0xe5: /* res_4_xnn_l */ this.SET_XNN(4, addr, this.regs.HL.l); break;
      case 0xe6: /* res_4_xnn */ { let r = new Register(); this.SET_XNN(4, addr, r); } break;
      case 0xe7: /* res_4_xnn_a */ this.SET_XNN(4, addr, this.regs.AF.h); break;
      case 0xe8: /* res_5_xnn_b */ this.SET_XNN(5, addr, this.regs.BC.h); break;
      case 0xe9: /* res_5_xnn_c */ this.SET_XNN(5, addr, this.regs.BC.l); break;
      case 0xea: /* res_5_xnn_d */ this.SET_XNN(5, addr, this.regs.DE.h); break;
      case 0xeb: /* res_5_xnn_e */ this.SET_XNN(5, addr, this.regs.DE.l); break;
      case 0xec: /* res_5_xnn_h */ this.SET_XNN(5, addr, this.regs.HL.h); break;
      case 0xed: /* res_5_xnn_l */ this.SET_XNN(5, addr, this.regs.HL.l); break;
      case 0xee: /* res_5_xnn */ { let r = new Register(); this.SET_XNN(5, addr, r); } break;
      case 0xef: /* res_5_xnn_a */ this.SET_XNN(5, addr, this.regs.AF.h); break;
      case 0xf0: /* res_6_xnn_b */ this.SET_XNN(6, addr, this.regs.BC.h); break;
      case 0xf1: /* res_6_xnn_c */ this.SET_XNN(6, addr, this.regs.BC.l); break;
      case 0xf2: /* res_6_xnn_d */ this.SET_XNN(6, addr, this.regs.DE.h); break;
      case 0xf3: /* res_6_xnn_e */ this.SET_XNN(6, addr, this.regs.DE.l); break;
      case 0xf4: /* res_6_xnn_h */ this.SET_XNN(6, addr, this.regs.HL.h); break;
      case 0xf5: /* res_6_xnn_l */ this.SET_XNN(6, addr, this.regs.HL.l); break;
      case 0xf6: /* res_6_xnn */ { let r = new Register(); this.SET_XNN(6, addr, r); } break;
      case 0xf7: /* res_6_xnn_a */ this.SET_XNN(6, addr, this.regs.AF.h); break;
      case 0xf8: /* res_7_xnn_b */ this.SET_XNN(7, addr, this.regs.BC.h); break;
      case 0xf9: /* res_7_xnn_c */ this.SET_XNN(7, addr, this.regs.BC.l); break;
      case 0xfa: /* res_7_xnn_d */ this.SET_XNN(7, addr, this.regs.DE.h); break;
      case 0xfb: /* res_7_xnn_e */ this.SET_XNN(7, addr, this.regs.DE.l); break;
      case 0xfc: /* res_7_xnn_h */ this.SET_XNN(7, addr, this.regs.HL.h); break;
      case 0xfd: /* res_7_xnn_l */ this.SET_XNN(7, addr, this.regs.HL.l); break;
      case 0xfe: /* res_7_xnn */ { let r = new Register(); this.SET_XNN(7, addr, r); } break;
      case 0xff: /* res_7_xnn_a */ this.SET_XNN(7, addr, this.regs.AF.h); break;
      default:
        throw new Error('Invalid opcode: nnCB' + (opcode & 0xff));
    }
  }
}
