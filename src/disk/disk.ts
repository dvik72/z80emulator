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

const MAXSECTOR = 2 * 9 * 81;

const SVI328_CPM80_TRACK = [0, 0, 0, 0, 0, 0, 0]; // TODO: Should be: 'CP/M-80'

const HD_IDENTIFY_BLOCK = [
  0x5a,0x0c,0xba,0x09,0x00,0x00,0x10,0x00,0x00,0x00,0x00,0x00,0x3f,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,
  0x20,0x20,0x20,0x20,0x20,0x20,0x31,0x20,0x00,0x00,0x00,0x01,0x04,0x00,0x31,0x56,
  0x30,0x2e,0x20,0x20,0x20,0x20,0x6c,0x62,0x65,0x75,0x53,0x4d,0x00,0x58,0x48,0x20,
  0x52,0x41,0x20,0x44,0x49,0x44,0x4b,0x53,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,
  0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x20,0x10,0x80,
  0x00,0x00,0x00,0x0b,0x00,0x00,0x00,0x02,0x00,0x02,0x03,0x00,0xba,0x09,0x10,0x00,
  0x3f,0x00,0x60,0x4c,0x26,0x00,0x00,0x00,0xe0,0x53,0x26,0x00,0x07,0x00,0x07,0x04,
  0x03,0x00,0x78,0x00,0x78,0x00,0xf0,0x00,0x78,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
];


export enum DiskType { UNKNOWN, MSX, SVI328, IDEHD };

export enum DiskError { OK, NO_DATA, CRC_ERROR };

export class Disk {
  constructor(
    private diskData: Uint8Array
  ) {
    this.updateInfo();
  }

  private getType(): DiskType {
    return this.type;
  }

  private getSectorsPerTrack(): number {
    return this.sectorsPerTrack;
  }

  private getSides(): number {
    return this.sides;
  }

  private getSectorSize(side: number = 0, track: number = 0, density: number = 0): number {
    if (this.type == DiskType.SVI328) {
        return (track == 0 && side == 0 && density == 1) ? 128 : 256;
    }

    return this.sectorSize;
  }

  private getSectorOffset(sector: number, side: number, track: number, density: number = 0): number {
    const sectorSize = this.getSectorSize(side, track, density);

    if (this.type == DiskType.SVI328) {
      if (track == 0 && side == 0 && density == 1) {
        return (sector - 1) * 128; 
      }
      return ((track * this.sides + side) *17 + sector - 1) * 256 - 2048;
    }
        
    const offset =  sector - 1 + this.getSectorsPerTrack() * (track * this.getSides() + side);
    return offset * sectorSize;
  }

  getReadError(sector: number): DiskError {
    return (this.errors[sector >> 3] & (0x80 >> (sector & 7))) ? DiskError.CRC_ERROR : DiskError.OK;
  }

  public readSector(sector: number, side: number, track: number, density: number = 0): [DiskError, Uint8Array?] {
    if (this.type == DiskType.IDEHD && sector == -1) {
        return [ DiskError.OK, this.readHdIdentifySector() ];
    }
    
    const offset = this.getSectorOffset(sector, side, track, density);
    const sectorSize = this.getSectorSize(side, track, density);

    if (this.diskData.length < offset + sectorSize) {
    return [ DiskError.NO_DATA ];
    }

    let sectorData = new Uint8Array(sectorSize);
    for (let i = 0; i < sectorSize; i++) {
      sectorData[i] = this.diskData[offset + i];
    }

    const sectorNum = sector - 1 + this.getSectorsPerTrack() * (track * this.getSides() + side);
    return [ this.getReadError(sectorNum), sectorData ];
  }

  public writeSector(sectorData: Uint8Array, sector: number, side: number, track: number, density: number = 0): DiskError {
    if (sector >= this.maxSector) {
        return DiskError.NO_DATA;
    }

    if (density == 0) {
      density = this.sectorSize;
    }

    const offset = this.getSectorOffset(sector, side, track, density);
    const sectorSize = this.getSectorSize(side, track, density);

    if (this.diskData.length < offset + sectorSize) {
        return DiskError.NO_DATA;
    }

    for (let i = 0; i < sectorSize; i++) {
      this.diskData[offset + i] = sectorData[i];
    }

    return DiskError.OK;
  }

  private isSectorSize256(sectorData: Uint8Array): boolean {
    // This implementation is quite rough, but it assmues that a disk with
    // 256 sectors have content in sector 1, while a 512 sector disk has
    // no data in the second half of the boot sector.
    let rv = 0;
    for (let i = 0x120; i < 0x1d0; i++) {
      rv |= sectorData[i];
    }
    return rv != 0;
  }

  private readHdIdentifySector(): Uint8Array {
    let buffer = new Uint8Array(HD_IDENTIFY_BLOCK);

    const totalSectors = this.diskData.length >> 9;
    const heads = 16;
    const sectors = 32;
    const cylinders = totalSectors / (heads * sectors) | 0;

    buffer[0x02] = cylinders & 0xff;
    buffer[0x03] = cylinders >> 8;
    buffer[0x06] = heads & 0xff;
    buffer[0x07] = heads >> 8;
    buffer[0x0c] = sectors & 0xff;
    buffer[0x0d] = sectors >> 8;
    buffer[0x78] = totalSectors & 0xff;
    buffer[0x79] = (totalSectors >> 8) & 0xff;
    buffer[0x7a] = (totalSectors >> 16) & 0xff;
    buffer[0x7b] = (totalSectors >> 24) & 0xff;

    return buffer;
  }

  private updateInfo(): void {
    if (this.diskData.length > 2 * 1024 * 1024) {
        // HD image
        this.sectorSize      = 512;
        this.sectorsPerTrack = this.diskData.length >> 9;
        this.tracks          = 1;
        this.sides           = 1;
        this.type            = DiskType.IDEHD;
        this.maxSector       = 99999999;
        return;
    }

    this.sectorsPerTrack = 9;
    this.sides           = 2;
    this.tracks          = 80;
    this.sectorSize      = 512;
    this.type            = DiskType.MSX;
    this.maxSector       = MAXSECTOR;

    if ((this.diskData.length >> 9) == 1440) {
        return;
    }

    let rv = this.readSector(1, 0, 0, 512);
    if (rv[0] != DiskError.OK) {
        return;
    }
    const sectorData = rv[1] || new Uint8Array(1);

    switch (this.diskData.length) {
      case 163840:
        if (this.isSectorSize256(sectorData)) {
          this.sectorSize      = 256;
          this.sectorsPerTrack = 16;
          this.tracks          = 40;
          this.sides           = 1;
        }
        break;

      case 172032:  /* SVI-328 40 SS */
        this.sides = 1;
        this.tracks = 40;
        this.sectorsPerTrack = 17;
        this.type  = DiskType.SVI328;
        return;

      case 184320:  /* BW 12 SSDD */
        if (this.isSectorSize256(sectorData)) {
          this.sectorSize = 256;
          this.sectorsPerTrack = 18;
          this.tracks = 40;
          this.sides = 1;
          }
          return;

      case 204800:  /* Kaypro II SSDD */
        this.sectorSize = 512;
        this.sectorsPerTrack = 10;
        this.tracks = 40;
        this.sides = 1;
        return;

      case 346112:  /* SVI-328 40 DS/80 SS */
        this.sides = 1;
        this.tracks = 80;
        this.sectorsPerTrack = 17;
        this.type = DiskType.SVI328;
        let rv = this.readSector(15, 0, 40, 0);
        if (rv[0] != DiskError.OK) {
          return;
        }
        const buf = rv[1] || new Uint8Array(1);
        // Is it formatted for 80 track Disk BASIC?
        if (buf[0] == 0xfe && buf[1] == 0xfe && buf[2] == 0xfe && buf[20] != 0xfe && buf[40] == 0xfe) {
          return;
        }
        rv = this.readSector(1, 0, 1, 0);
        if (rv[0] != DiskError.OK) {
          return;
        }

        // Is it sysgend for 80 track CP/M?
        let ok = true;
        for (let i = 0; i < SVI328_CPM80_TRACK.length; i++) {
          ok = ok && buf[176 + i] == SVI328_CPM80_TRACK[i];
        }
        if (ok) {
          rv = this.readSector(2, 0, 0, 1);
          if (rv[0] != DiskError.OK) {
            return;
          }
          if (buf[115] == 0x50 || buf[116] == 0x50) {
            return;
          }
        }
        this.sides = 2;
        this.tracks = 40;
        return;

      case 348160:  /* SVI-728 DSDD (CP/M) */
        if (this.isSectorSize256(sectorData)) {
          this.sectorSize = 256;
          this.sectorsPerTrack = 17;
          this.tracks = 40;
          this.sides = 2;
        }
        return;
    }

    if (sectorData[0] ==0xeb) {
      switch (sectorData[0x15]) {
        case 0xf8:
	        this.sides = 1;
          this.tracks = 80;
	        this.sectorsPerTrack = 9;
          return;

        case 0xf9:
	        this.sides = 2;
          this.tracks = 80;
	        this.sectorsPerTrack = 9;
          // This check is needed to get the SVI-738 MSX-DOS disks to work
          // Maybe it should be applied to other cases as well
          rv = this.readSector(2, 0, 0, 512);
          if (rv[0] == DiskError.OK && sectorData[0] == 0xf8) {
	          this.sides = 1;
          }
          return;

        case 0xfa:
	        this.sides = 1;
          this.tracks = 80;
	        this.sectorsPerTrack = 8;
          if (this.diskData.length == 368640) {
	          this.sectorsPerTrack = 9;
          }
          return;

        case 0xfb:
	        this.sides = 2;
          this.tracks = 80;
	        this.sectorsPerTrack = 8;
          return;

        case 0xfc:
	        this.sides = 1;
          this.tracks = 40;
	        this.sectorsPerTrack = 9;
          return;

        case 0xfd:
	        this.sides = 2;
          this.tracks = 40;
	        this.sectorsPerTrack = 9;
          return;

        case 0xfe:
	        this.sides = 1;
          this.tracks = 40;
	        this.sectorsPerTrack = 8;
          return;

        case 0xff:
	        this.sides = 2;
          this.tracks = 40;
	        this.sectorsPerTrack = 8;
          return;
      }
    }

    if ((sectorData[0] == 0xe9) || (sectorData[0] ==0xeb)) {
	    this.sectorsPerTrack = sectorData[0x18] + 256 * sectorData[0x19];
	    this.sides = sectorData[0x1a] + 256 * sectorData[0x1b];
    }
    else {
      rv = this.readSector(2, 0, 0, 512);
      if (rv[0] != DiskError.OK) {
          return;
      }
      let buf = rv[1] || new Uint8Array(1);
      if (buf[0] >= 0xF8) {
	      this.sectorsPerTrack = (buf[0] & 2) ? 8 : 9;
	      this.sides = (buf[0] & 1) ? 2 : 1;
	    }
    }

    if (this.sectorsPerTrack == 0 || this.sides == 0 || 
      this.sectorsPerTrack > 255 || this.sides > 2) 
    {
    	switch (this.diskData.length) {
        case 163840:
          this.sectorSize = 256;
	        this.sectorsPerTrack = 16;
          this.tracks = 40;
	        this.sides = 1;
          break;

        case 327680:  /* 80 tracks, 1 side, 8 sectors/track */
	        this.sectorsPerTrack = 8;
	        this.sides = 1;
          break;

        case 368640:  /* 80 tracks, 1 side, 9 sectors/track */
	        this.sectorsPerTrack = 9;
	        this.sides = 1;
          break;

        case 655360:  /* 80 tracks, 2 side, 8 sectors/track */
	        this.sectorsPerTrack = 8;
	        this.sides = 2;
          break;

        default:
          this.sectorsPerTrack = 9;
          this.sides = 2;
      }
    }
  }

  private sectorsPerTrack = 0;
  private sectorSize = 0;
  private sides = 0;
  private tracks = 0;
  private type = DiskType.UNKNOWN;
  private maxSector = 0;
  private errors = new Uint8Array(1500);
};


// diskPresent