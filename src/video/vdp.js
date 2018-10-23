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
    var VdpVersion;
    (function (VdpVersion) {
        VdpVersion[VdpVersion["V9938"] = 0] = "V9938";
        VdpVersion[VdpVersion["V9958"] = 1] = "V9958";
        VdpVersion[VdpVersion["TMS9929A"] = 2] = "TMS9929A";
        VdpVersion[VdpVersion["TMS99x8A"] = 3] = "TMS99x8A";
    })(VdpVersion = exports.VdpVersion || (exports.VdpVersion = {}));
    ;
    var VdpSyncMode;
    (function (VdpSyncMode) {
        VdpSyncMode[VdpSyncMode["SYNC_AUTO"] = 0] = "SYNC_AUTO";
        VdpSyncMode[VdpSyncMode["SYNC_50HZ"] = 1] = "SYNC_50HZ";
        VdpSyncMode[VdpSyncMode["SYNC_60HZ"] = 2] = "SYNC_60HZ";
    })(VdpSyncMode = exports.VdpSyncMode || (exports.VdpSyncMode = {}));
    ;
    var VdpConnectorType;
    (function (VdpConnectorType) {
        VdpConnectorType[VdpConnectorType["MSX"] = 0] = "MSX";
        VdpConnectorType[VdpConnectorType["SVI"] = 1] = "SVI";
        VdpConnectorType[VdpConnectorType["COLECO"] = 2] = "COLECO";
        VdpConnectorType[VdpConnectorType["SG1000"] = 3] = "SG1000";
    })(VdpConnectorType = exports.VdpConnectorType || (exports.VdpConnectorType = {}));
    ;
    var registerValueMaskMSX1 = [
        0x03, 0xfb, 0x0f, 0xff, 0x07, 0x7f, 0x07, 0xff
    ];
    var registerValueMaskMSX2 = [
        0x7e, 0x7b, 0x7f, 0xff, 0x3f, 0xff, 0x3f, 0xff,
        0xfb, 0xbf, 0x07, 0x03, 0xff, 0xff, 0x07, 0x0f,
        0x0f, 0xbf, 0xff, 0xff, 0x3f, 0x3f, 0x3f, 0xff,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
    ];
    var registerValueMaskMSX2p = [
        0x7e, 0x7b, 0x7f, 0xff, 0x3f, 0xff, 0x3f, 0xff,
        0xfb, 0xbf, 0x07, 0x03, 0xff, 0xff, 0x07, 0x0f,
        0x0f, 0xbf, 0xff, 0xff, 0x3f, 0x3f, 0x3f, 0xff,
        0x00, 0x7f, 0x3f, 0x07, 0x00, 0x00, 0x00, 0x00,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
    ];
    var Vdp = /** @class */ (function () {
        function Vdp(ioManager, z80, version, syncMode, connectorType, vramPages) {
            this.ioManager = ioManager;
            this.z80 = z80;
            this.version = version;
            this.syncMode = syncMode;
            this.connectorType = connectorType;
            this.vramPages = vramPages;
            this.vramSize = 0;
            this.vram192 = false;
            this.vram16 = false;
            this.vram128 = 0;
            this.enable = true;
            this.vramOffset = 0;
            this.offsets = new Array(2);
            this.masks = new Array(4);
            this.accMask = 0;
            this.mask = 0;
            this.palMask = 0;
            this.palValue = 0;
            this.registerValueMask = [0];
            this.registerMask = 0;
            this.hAdjustSc0 = 0;
            this.vdpKey = 0;
            this.vdpData = 0;
            this.vdpDataLatch = 0;
            this.vramAddress = 0;
            this.screenMode = 1;
            this.regs = new Array(64);
            this.status = new Array(16);
            this.vramSize = this.vramPages << 14;
            this.vram192 = this.vramPages == 12;
            this.vram16 = this.vramPages == 1;
            this.offsets[0] = 0;
            this.offsets[1] = this.vramSize > 0x20000 ? 0x20000 : 0;
            this.masks[0] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
            this.masks[1] = this.vramSize > 0x8000 ? 0x7fff : this.vramSize - 1;
            this.masks[2] = this.vramSize > 0x20000 ? 0x1ffff : this.vramSize - 1;
            this.masks[3] = this.vramSize > 0x20000 ? 0xffff : this.vramSize - 1;
            this.accMask = this.masks[2];
            if (this.vramPages > 8) {
                this.vramPages = 8;
            }
            this.vram128 = this.vramPages >= 8 ? 0x10000 : 0;
            this.mask = (this.vramPages << 14) - 1;
            if (this.syncMode == VdpSyncMode.SYNC_AUTO) {
                this.palMask = ~0;
                this.palValue = 0;
            }
            else if (this.syncMode == VdpSyncMode.SYNC_50HZ) {
                this.palMask = ~0x02;
                this.palValue = 0x02;
            }
            else if (this.syncMode == VdpSyncMode.SYNC_60HZ) {
                this.palMask = ~0x02;
                this.palValue = 0x00;
            }
            this.vram = new Array(this.vramSize);
            for (var i = 0; i < 0x4000; i++) {
                this.vram[i] = 0;
            }
            switch (this.version) {
                case VdpVersion.TMS9929A:
                    this.registerValueMask = registerValueMaskMSX1;
                    this.registerMask = 0x07;
                    this.hAdjustSc0 = -2; // 6
                    break;
                case VdpVersion.TMS99x8A:
                    this.registerValueMask = registerValueMaskMSX1;
                    this.registerMask = 0x07;
                    this.regs[9] &= ~0x02;
                    this.hAdjustSc0 = -2; // 6
                    break;
                case VdpVersion.V9938:
                    this.registerValueMask = registerValueMaskMSX2;
                    this.registerMask = 0x3f;
                    this.hAdjustSc0 = 1; // 9
                    break;
                case VdpVersion.V9958:
                    this.registerValueMask = registerValueMaskMSX2p;
                    this.registerMask = 0x3f;
                    this.hAdjustSc0 = 1; // 9
                    break;
            }
            this.read = this.read.bind(this);
            this.write = this.write.bind(this);
            this.readStatus = this.readStatus.bind(this);
            this.writeLatch = this.writeLatch.bind(this);
            this.writePaletteLatch = this.writePaletteLatch.bind(this);
            this.writeRegister = this.writeRegister.bind(this);
            switch (this.connectorType) {
                case VdpConnectorType.MSX:
                    this.ioManager.registerPort(0x98, new iomanager_1.Port(this.read, this.write));
                    this.ioManager.registerPort(0x99, new iomanager_1.Port(this.readStatus, this.writeLatch));
                    if (this.version == VdpVersion.V9938 || this.version == VdpVersion.V9958) {
                        this.ioManager.registerPort(0x9a, new iomanager_1.Port(undefined, this.writePaletteLatch));
                        this.ioManager.registerPort(0x9b, new iomanager_1.Port(undefined, this.writeRegister));
                    }
                    break;
                case VdpConnectorType.SVI:
                    this.ioManager.registerPort(0x80, new iomanager_1.Port(undefined, this.write));
                    this.ioManager.registerPort(0x81, new iomanager_1.Port(undefined, this.writeLatch));
                    this.ioManager.registerPort(0x84, new iomanager_1.Port(this.read, undefined));
                    this.ioManager.registerPort(0x85, new iomanager_1.Port(this.readStatus, undefined));
                    break;
                case VdpConnectorType.COLECO:
                    for (var i = 0xa0; i < 0xc0; i += 2) {
                        this.ioManager.registerPort(i, new iomanager_1.Port(this.read, this.write));
                        this.ioManager.registerPort(i + 1, new iomanager_1.Port(this.readStatus, this.writeLatch));
                    }
                    break;
                case VdpConnectorType.SG1000:
                    this.ioManager.registerPort(0xbe, new iomanager_1.Port(this.read, this.write));
                    this.ioManager.registerPort(0xbf, new iomanager_1.Port(this.readStatus, this.writeLatch));
                    break;
            }
        }
        // Temp hacks to allow the nano driver to work.
        Vdp.prototype.getStatus = function () { return this.status[0]; };
        Vdp.prototype.setStatusBit = function (value) { this.status[0] |= value; };
        Vdp.prototype.getRegister = function (reg) { return this.regs[reg]; };
        Vdp.prototype.getVram = function (index) { return this.vram[index & 0x3fff]; };
        Vdp.prototype.reset = function () {
            for (var i = 0; i < 64; i++)
                this.regs[i] = 0;
            for (var i = 0; i < 16; i++)
                this.status[i] = 0;
            this.status[0] = 0x9f;
            this.status[1] = this.version == VdpVersion.V9958 ? 0x04 : 0;
            this.status[2] = 0x6c;
            this.regs[1] = 0x10;
            this.regs[2] = 0xff;
            this.regs[3] = 0xff;
            this.regs[4] = 0xff;
            this.regs[5] = 0xff;
            this.regs[8] = 0x08;
            this.regs[9] = (0x02 & this.palMask) | this.palValue;
            this.regs[21] = 0x3b;
            this.regs[22] = 0x05;
            this.vdpKey = 0;
            this.vdpData = 0;
            this.vdpDataLatch = 0;
            this.vramAddress = 0;
            this.screenMode = 0;
            this.vramOffset = this.offsets[0];
        };
        Vdp.prototype.readVram = function (addr) {
            var offset = this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
            return this.vram[this.vramOffset + offset & this.accMask];
        };
        Vdp.prototype.getVramIndex = function (addr) {
            return this.screenMode >= 7 && this.screenMode <= 12 ? (addr >> 1 | ((addr & 1) << 16)) : addr;
        };
        Vdp.prototype.read = function (port) {
            var value = this.vdpData;
            this.vdpData = this.enable ? this.readVram((this.regs[14] << 14) | this.vramAddress) : 0xff;
            this.vramAddress = (this.vramAddress + 1) & 0x3fff;
            if (this.vramAddress == 0 && this.screenMode > 3) {
                this.regs[14] = (this.regs[14] + 1) & (this.vramPages - 1);
            }
            this.vdpKey = 0;
            return value;
        };
        Vdp.prototype.readStatus = function (port) {
            // TODO: Sync the VDP once V9938 engine is added.
            this.vdpKey = 0;
            if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
                var status_1 = this.status[0];
                this.status[0] &= 0x1f;
                this.z80.clearInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
                return status_1;
            }
            var status = this.status[this.regs[15]];
            switch (this.regs[15]) {
                case 0:
                    this.status[0] &= 0x1f;
                    this.z80.clearInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
                    break;
                default:
                    break;
                // TODO: Add MSX2 statuses
            }
            return status;
        };
        Vdp.prototype.write = function (port, value) {
            // TODO: Sync the VDP once V9938 engine is added.
            if (this.enable) {
                var index = this.getVramIndex((this.regs[14] << 14) | this.vramAddress);
                if (!(index & ~this.accMask)) {
                    this.vram[index] = value;
                }
            }
            this.vdpData = value;
            this.vdpKey = 0;
            this.vramAddress = (this.vramAddress + 1) & 0x3fff;
            if (this.vramAddress == 0 && this.screenMode > 3) {
                this.regs[14] = (this.regs[14] + 1) & (this.vramPages - 1);
            }
        };
        Vdp.prototype.writeLatch = function (port, value) {
            if (this.version == VdpVersion.TMS9929A || this.version == VdpVersion.TMS99x8A) {
                if (this.vdpKey) {
                    this.vramAddress = (value << 8 | (this.vramAddress & 0xff)) & 0x3fff;
                    if (!(value & 0x40)) {
                        if (value & 0x80)
                            this.updateRegisters(value, this.vdpDataLatch);
                        else
                            this.read(port);
                    }
                    this.vdpKey = 0;
                }
                else {
                    this.vramAddress = (this.vramAddress & 0x3f00) | value;
                    this.vdpDataLatch = value;
                    this.vdpKey = 1;
                }
            }
            else {
                if (this.vdpKey) {
                    if (value & 0x80) {
                        if (!(value & 0x40))
                            this.updateRegisters(value, this.vdpDataLatch);
                    }
                    else {
                        this.vramAddress = (value << 8 | (this.vramAddress & 0xff)) & 0x3fff;
                        if (!(value & 0x40))
                            this.read(port);
                    }
                    this.vdpKey = 0;
                }
                else {
                    this.vdpDataLatch = value;
                    this.vdpKey = 1;
                }
            }
        };
        Vdp.prototype.updateRegisters = function (reg, value) {
            reg &= this.registerMask;
            value &= this.registerValueMask[reg];
            var change = this.regs[reg] ^ value;
            this.regs[reg] = value;
            switch (reg) {
                case 0:
                    if (!(value & 0x10)) {
                        // TODO: Clear INT_IE1 when MSX2 is supported
                    }
                    if (change & 0x0e) {
                        this.scheduleScrModeChange();
                    }
                    if (change & 0x40) {
                        // At some point perhaps support video overlays, then output mode should be handled.
                    }
                    break;
                case 1:
                    if (this.status[0] & 0x80) {
                        if (value & 0x20) {
                            this.z80.setInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
                        }
                        else {
                            this.z80.clearInt(); // TODO: Add Interrupt handling on board with masks; INT_IE0
                        }
                    }
                    if (change & 0x58) {
                        this.scheduleScrModeChange();
                    }
                    // TODO: Also change timing mode on the 9938 once implemented.
                    break;
                default:
                    // Add handling later...
                    break;
            }
        };
        Vdp.prototype.scheduleScrModeChange = function () {
            // TODO: Should schedule screen mode change at end of scanline. for now just switch right away.
            switch (((this.regs[0] & 0x0e) >> 1) | (this.regs[1] & 0x18)) {
                case 0x10:
                    this.screenMode = 0;
                    break;
                case 0x00:
                    this.screenMode = 1;
                    break;
                case 0x01:
                    this.screenMode = 2;
                    break;
                case 0x08:
                    this.screenMode = 3;
                    break;
                case 0x02:
                    this.screenMode = 4;
                    break;
                case 0x03:
                    this.screenMode = 5;
                    break;
                case 0x04:
                    this.screenMode = 6;
                    break;
                case 0x05:
                    this.screenMode = 7;
                    break;
                case 0x07:
                    this.screenMode = 8;
                    break;
                case 0x12:
                    this.screenMode = 13;
                    break;
                case 0x11: // Screen 0 + 2
                    this.screenMode = 16;
                    break;
                case 0x18: // Screen 0 + 3
                case 0x19: // Screen 0 + 2 + 3
                    this.screenMode = 32;
                    break;
                default: // Unknown screen mode
                    this.screenMode = 64;
                    break;
            }
        };
        Vdp.prototype.writePaletteLatch = function (port, value) {
            // TODO: Implement when MSX2 support is added
        };
        Vdp.prototype.writeRegister = function (port, value) {
            // TODO: Implement when MSX2 support is added
        };
        return Vdp;
    }());
    exports.Vdp = Vdp;
});
