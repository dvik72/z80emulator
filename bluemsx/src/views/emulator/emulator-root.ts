import { css, LitElement, customElement, html, unsafeCSS, query } from 'lit-element';
import { styleMap } from 'lit-html/directives/style-map';
import { MsxEmu } from '../../emulator/api/msx';
import { WebAudio } from './webaudio/webaudio';

import '../../../src/views/emulator/gl-canvas.js';

const styles = require('./emulator-root.css');
const blueMsxIcon = require('./img/bluemsx.png');

const WINDOW_SIZES = [
  [0, 'Auto'],
  [0.75, '0.75x'],
  [1, '1x'],
  [1.5, '1.5x'],
  [2, '2x']
];

@customElement('emulator-root')
class EmulatorRoot extends LitElement {
  static get styles() {
    return css`${unsafeCSS(styles)}`;
  }

  @query('#left-bar') leftBarElem!: HTMLDivElement;
  @query('#right-bar') rightBarElem!: HTMLDivElement;

  private windowSize = 0;
  private emuWidth = 0;
  private emuHeight = 0;

  private webAudio = new WebAudio();

  private msxEmu: MsxEmu;

  private updateEmulatorSize(): void {
    this.emuHeight = /* Fullscreen.fullscreenElement() ? 0 : */ +WINDOW_SIZES[this.windowSize][0] * 480;

    if (this.emuHeight == 0 && this.leftBarElem && this.rightBarElem) {
      let width = window.innerWidth || document.documentElement!.clientWidth;
      this.emuHeight = window.innerHeight || document.documentElement!.clientHeight;

      this.emuHeight = Math.max(240, Math.min(this.emuHeight, (width - this.leftBarElem.clientWidth - this.rightBarElem.clientWidth) * 3 / 4) - 20);
    }

    this.emuWidth = this.emuHeight * 4 / 3;
  }

  private resize(event?: Event): void {
    this.requestUpdate();
  }

  firstUpdated() {
    this.runEmulator = this.runEmulator.bind(this);

    window.addEventListener('resize', this.resize.bind(this));
    document.addEventListener('click', () => { this.webAudio.resume(); });

    this.msxEmu = new MsxEmu(window.performance, this.webAudio, {});
    this.msxEmu.setMachine();
    this.runEmulator();

    this.requestUpdate();
  }

  private runEmulator() {
    const timeout = this.msxEmu!.runStep();
    setTimeout(this.runEmulator, timeout);
  }

  render() {
    this.updateEmulatorSize();

    return html`
      <div class="top-container">
        <div class="root-container">
          <div class="left-bar" id="left-bar">
          </div>
          <div class="emu-canvas-container" style="${styleMap({ width: this.emuWidth + 'px', height: this.emuHeight + 'px'})}">
            <gl-canvas .msxEmu=${this.msxEmu}></gl-canvas>
          </div>
          <div class="right-bar" id="right-bar">
            <div class="bar-top"></div>
            <div class="bar-filler"></div>
            <div class="bar-logo-container">
                <img class="bar-logo" src="${blueMsxIcon}" />
            </div>
            <div class="bar-bottom"></div>
          </div>
        </div>
      </div>
    `;
  }
}
