import type { DataSource } from '../types/device.ts';
import type { AcquisitionSample } from '../types/force.ts';
import { parseSampleLine, statusMessageFromLine } from './parsing.ts';
import {
  serializeDeviceCommand,
  streamModeForInputMode,
  type DeviceStreamMode,
  type InputMode,
} from '@krimblokk/core';

export class WebSerialSource implements DataSource {
  private static readonly BOOT_WAIT_MS = 1800;

  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private running = false;
  private lineBuffer = '';
  private baudRate: number;
  private requestedStreamMode: DeviceStreamMode;

  onSample: ((s: AcquisitionSample) => void) | null = null;
  onStatus: ((msg: string) => void) | null = null;
  onConnectionChange: ((c: boolean) => void) | null = null;

  constructor(baudRate = 115200, inputMode: InputMode = 'MODE_KG_DIRECT') {
    this.baudRate = baudRate;
    this.requestedStreamMode = streamModeForInputMode(inputMode);
  }

  async start(): Promise<void> {
    if (this.running) return;

    if (!navigator.serial) {
      throw new Error('Web Serial API is not supported in this browser. Use Chrome/Edge over HTTPS.');
    }

    // requestPort requires user gesture — caller must ensure this
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: this.baudRate });
    this.running = true;
    this.lineBuffer = '';
    this.onConnectionChange?.(true);
    this.onStatus?.('Serial connected');

    // Start read loop (fire and forget)
    this.readLoop().catch(err => {
      this.onStatus?.(`Serial read error: ${err}`);
      this.stop();
    });

    // Arduino resets when the serial port opens, so mode/tare commands sent
    // immediately after connect are often dropped during boot.
    await this.waitForBootWindow();
    if (!this.running) return;

    this.sendCommand(serializeDeviceCommand({
      kind: 'set_stream_mode',
      mode: this.requestedStreamMode,
    }));
    this.onStatus?.(`Requested firmware ${this.requestedStreamMode.toUpperCase()} mode`);
  }

  stop(): void {
    if (!this.running && !this.port && !this.reader) return;
    this.running = false;
    void this.closeResources();
  }

  private async closeResources(): Promise<void> {
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Reader can already be canceled/closed.
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // Port can already be closed.
      }
      this.port = null;
    }

    this.onConnectionChange?.(false);
    this.onStatus?.('Serial disconnected');
  }

  isRunning(): boolean {
    return this.running;
  }

  setStreamMode(mode: DeviceStreamMode): void {
    this.requestedStreamMode = mode;
    if (this.running) {
      this.sendCommand(serializeDeviceCommand({ kind: 'set_stream_mode', mode }));
      this.onStatus?.(`Requested firmware ${mode.toUpperCase()} mode`);
    }
  }

  sendCommand(cmd: string): void {
    if (!this.port?.writable) return;
    const writer = this.port.writable.getWriter();
    const encoded = new TextEncoder().encode(cmd.trim() + '\n');
    void writer
      .write(encoded)
      .catch(() => {})
      .finally(() => writer.releaseLock());
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;
    const decoder = new TextDecoder();
    this.reader = this.port.readable.getReader();

    try {
      while (this.running) {
        const { value, done } = await this.reader.read();
        if (done) break;
        this.lineBuffer += decoder.decode(value, { stream: true });

        const lines = this.lineBuffer.split('\n');
        this.lineBuffer = lines.pop() ?? ''; // keep incomplete tail

        for (const line of lines) {
          this.processLine(line.trim());
        }
      }
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
    }
  }

  private processLine(line: string): void {
    if (!line) return;

    const status = statusMessageFromLine(line);
    if (status !== null) {
      this.onStatus?.(status);
      return;
    }

    const sample = parseSampleLine(line, performance.now());
    if (sample) {
      this.onSample?.(sample);
    }
  }

  private async waitForBootWindow(): Promise<void> {
    await new Promise<void>(resolve => {
      window.setTimeout(resolve, WebSerialSource.BOOT_WAIT_MS);
    });
  }
}
