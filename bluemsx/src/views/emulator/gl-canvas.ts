/*
import { css, LitElement, customElement, html, property, query, unsafeCSS } from 'lit-element';
import { WebGlRenderer } from './webgl/webglrenderer';

import { MsxEmu } from '../../emulator/api/msx';

const styles = require('./gl-canvas.css');

const emptyFrameBuffer = new Uint16Array([0]);

@customElement('gl-canvas')
class GlCanvas extends LitElement {
  static get styles() {
    return css`${unsafeCSS(styles)}`;
  }

  @property({ attribute: false }) msxEmu?: MsxEmu;

  @query('#emu-canvas') glCanvas!: HTMLCanvasElement;

  private glRenderer: WebGlRenderer;

  firstUpdated() {
    this.refreshScreen = this.refreshScreen.bind(this);

    this.glRenderer = new WebGlRenderer(this.glCanvas);

    requestAnimationFrame(this.refreshScreen);
  }

  private refreshScreen(): void {
    if (this.msxEmu) {
      this.glRenderer.render(
        this.msxEmu.getFrameBufferWidth(),
        this.msxEmu.getFrameBufferHeight(),
        this.msxEmu.getFrameBufferData());
    }
    else {
      this.glRenderer.render(1, 1, emptyFrameBuffer);
    }

    requestAnimationFrame(this.refreshScreen);
  }

  render() {
    return html`
      <canvas class="emu-canvas" id="emu-canvas"></canvas>
    `;
  }
}
*/