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
define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var EMPTY_RAM = new Array(0x4000);
    var Slot = /** @class */ (function () {
        function Slot(description, readCb, writeCb, ejectCb) {
            this.description = description;
            this.readCb = readCb;
            this.writeCb = writeCb;
            this.ejectCb = ejectCb;
            this.pageData = EMPTY_RAM;
            this.writeEnable = false;
            this.readEnable = false;
            this.readCb = readCb;
            this.writeCb = writeCb;
            this.ejectCb = ejectCb;
        }
        Slot.prototype.map = function (readEnable, writeEnable, pageData) {
            this.pageData = pageData ? pageData : EMPTY_RAM;
            this.writeEnable = writeEnable;
            this.readEnable = readEnable;
        };
        Slot.prototype.unmap = function () {
            this.pageData = EMPTY_RAM;
            this.writeEnable = false;
            this.readEnable = false;
        };
        return Slot;
    }());
    exports.Slot = Slot;
    var RamSlot = /** @class */ (function () {
        function RamSlot() {
            this.slot = 0;
            this.sslot = 0;
            this.slotInfo = new Slot('Undefined');
        }
        return RamSlot;
    }());
    var SlotState = /** @class */ (function () {
        function SlotState(subslotted, state, substate, sslReg) {
            this.subslotted = false;
            this.state = 0;
            this.substate = 0;
            this.sslReg = 0;
            this.subslotted = subslotted;
            this.state = state;
            this.substate = substate;
            this.sslReg = sslReg;
        }
        return SlotState;
    }());
    var SlotManager = /** @class */ (function () {
        function SlotManager() {
            this.pslot = new Array(4);
            this.ramslot = new Array(8);
            this.slotTable = new Array(4);
            this.write0Cb = undefined;
            this.read = this.read.bind(this);
            this.write = this.write.bind(this);
            for (var i = 0; i < 4; i++)
                this.pslot[i] = new SlotState(false, 0, 0, 0);
            for (var i = 0; i < 4; i++) {
                this.slotTable[i] = new Array(4);
                for (var j = 0; j < 4; j++) {
                    this.slotTable[i][j] = new Array(8);
                    for (var k = 0; k < 8; k++) {
                        this.slotTable[i][j][k] = new Slot('Unmapped');
                    }
                }
            }
            for (var i = 0; i < 8; i++) {
                this.ramslot[i] = new RamSlot();
                this.ramslot[i].slotInfo = this.slotTable[0][0][i];
            }
        }
        SlotManager.prototype.registerSlot = function (slot, sslot, page, slotInfo) {
            this.slotTable[slot][sslot][page] = slotInfo;
            // Update ram mapping if slot is currently mapped to main memory.
            for (var _i = 0, _a = this.ramslot; _i < _a.length; _i++) {
                var ramslot = _a[_i];
                if (ramslot.slot == slot && ramslot.sslot == sslot) {
                    this.mapRamPage(slot, sslot, page);
                }
            }
        };
        SlotManager.prototype.remove = function (slot, sslot) {
            for (var page = 0; page < 8; page++) {
                var slotInfo = this.slotTable[slot][sslot][page];
                if (slotInfo.ejectCb) {
                    slotInfo.ejectCb();
                }
            }
        };
        SlotManager.prototype.registerWrite0Callback = function (writeCb) {
            this.write0Cb = writeCb;
        };
        SlotManager.prototype.unregisterWrite0Callback = function () {
            this.write0Cb = undefined;
        };
        SlotManager.prototype.read = function (address) {
            if (address == 0xffff) {
                var sslReg = this.pslot[3].state;
                if (this.pslot[sslReg].subslotted) {
                    return ~this.pslot[sslReg].sslReg;
                }
            }
            if (this.ramslot[address >> 13].slotInfo.readEnable) {
                return this.ramslot[address >> 13].slotInfo.pageData[address & 0x1fff];
            }
            var psl = this.pslot[address >> 14].state;
            var ssl = this.pslot[psl].subslotted ? this.pslot[address >> 14].substate : 0;
            var slotInfo = this.slotTable[psl][ssl][address >> 13];
            if (slotInfo.readCb) {
                return slotInfo.readCb(address & 0x1fff);
            }
            return 0xff;
        };
        SlotManager.prototype.write = function (address, value) {
            if (address == 0xffff) {
                var pslReg = this.pslot[3].state;
                if (this.pslot[pslReg].subslotted) {
                    this.pslot[pslReg].sslReg = value;
                    for (var page = 0; page < 4; page++) {
                        if (this.pslot[page].state == pslReg) {
                            this.pslot[page].substate = value & 3;
                            this.mapRamPage(pslReg, value & 3, 2 * page);
                            this.mapRamPage(pslReg, value & 3, 2 * page + 1);
                        }
                        value >>= 2;
                    }
                    return;
                }
            }
            if (address == 0) {
                if (this.write0Cb) {
                    this.write0Cb(address, value);
                    return;
                }
            }
            if (this.ramslot[address >> 13].slotInfo.writeEnable) {
                this.ramslot[address >> 13].slotInfo.pageData[address & 0x1FFF] = value;
                return;
            }
            var psl = this.pslot[address >> 14].state;
            var ssl = this.pslot[psl].subslotted ? this.pslot[address >> 14].substate : 0;
            var slotInfo = this.slotTable[psl][ssl][address >> 13];
            if (slotInfo.writeCb) {
                slotInfo.writeCb(address & 0x1fff, value);
            }
        };
        SlotManager.prototype.mapRamPage = function (slot, sslot, page) {
            this.ramslot[page].slot = slot;
            this.ramslot[page].sslot = sslot;
            this.ramslot[page].slotInfo = this.slotTable[slot][sslot][page];
        };
        SlotManager.prototype.setRamSlot = function (slot, psl) {
            this.pslot[slot].state = psl;
            this.pslot[slot].substate = (this.pslot[psl].sslReg >> (slot * 2)) & 3;
            var ssl = this.pslot[psl].subslotted ? this.pslot[slot].substate : 0;
            this.mapRamPage(psl, ssl, 2 * slot);
            this.mapRamPage(psl, ssl, 2 * slot + 1);
        };
        SlotManager.prototype.getRamSlot = function (page) {
            for (var i = 0; i < 4; i++) {
                if (this.pslot[i].state == page) {
                    return i;
                }
            }
            return 0;
        };
        SlotManager.prototype.setSubslotted = function (slot, subslotted) {
            this.pslot[slot].subslotted = subslotted;
        };
        return SlotManager;
    }());
    exports.SlotManager = SlotManager;
});
