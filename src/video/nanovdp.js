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
define(["require", "exports", "../core/iomanager"], function (require, exports, iomanager_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // Minimal MSX1 VDP implementation, for testing mostly.
    var NanoVdp = /** @class */ (function () {
        function NanoVdp(ioManager, z80) {
            this.ioManager = ioManager;
            this.z80 = z80;
            this.status = 0;
            this.latch = 0;
            this.address = 0;
            this.data = 0;
            this.regs = [0x00, 0x10, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00];
            this.key = 0;
            this.vramDirtyFlag = false;
            this.vram = new Array(0x4000);
            this.read = this.read.bind(this);
            this.write = this.write.bind(this);
            for (var i = 0; i < 0x4000; i++) {
                this.vram[i] = 0;
            }
            this.ioManager.registerPort(0x98, new iomanager_1.Port(this.read, this.write));
            this.ioManager.registerPort(0x99, new iomanager_1.Port(this.read, this.write));
        }
        NanoVdp.prototype.getStatus = function () { return this.status; };
        NanoVdp.prototype.setStatusBit = function (value) { this.status |= value; };
        NanoVdp.prototype.getRegister = function (reg) { return this.regs[reg]; };
        NanoVdp.prototype.getVram = function (index) { return this.vram[index & 0x3fff]; };
        NanoVdp.prototype.isDirty = function () { return this.vramDirtyFlag; };
        NanoVdp.prototype.clearDirty = function () { this.vramDirtyFlag = false; };
        NanoVdp.prototype.read = function (port) {
            switch (port & 1) {
                case 0:
                    {
                        var value = this.data;
                        this.data = this.vram[this.address++ & 0x3fff];
                        this.key = 0;
                        return value;
                    }
                case 1:
                    {
                        var status_1 = this.status;
                        this.status &= 0x1f;
                        this.z80.clearInt();
                        return status_1;
                    }
            }
            return 0xff;
        };
        NanoVdp.prototype.write = function (port, value) {
            switch (port & 1) {
                case 0:
                    this.vramDirtyFlag = true;
                    this.vram[this.address++ & 0x3fff] = value;
                    this.key = 0;
                    this.data = value;
                    break;
                case 1:
                    if (this.key) {
                        this.key = 0;
                        this.address = (value << 8 | this.latch) & 0xffff;
                        if ((value & 0xc0) == 0x80) {
                            this.regs[value & 0x07] = this.latch;
                            console.log('VDP REG ' + ('0000' + (value & 0x07).toString(16)).slice(-2) + ': ' + ('0000' + this.latch.toString(16)).slice(-2));
                            this.vramDirtyFlag = true;
                        }
                        if ((value & 0xc0) == 0x00) {
                            this.read(0);
                        }
                    }
                    else {
                        this.key = 1;
                        this.latch = value;
                    }
                    break;
            }
        };
        return NanoVdp;
    }());
    exports.NanoVdp = NanoVdp;
});
