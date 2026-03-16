import { KG_TO_N, type DeviceCommand, type SourceKind } from '@krimblokk/core';
import { defaultConnectedDevice } from './deviceProfiles.ts';
import {
  encodeTindeqCommand,
  parseTindeqNotification,
  TINDEQ_COMMANDS,
  TINDEQ_CONTROL_CHAR_UUID,
  TINDEQ_DATA_CHAR_UUID,
  TINDEQ_NAME_PREFIX,
  TINDEQ_SERVICE_UUID,
  TindeqProtocolError,
} from './tindeqProtocol.ts';
import type { ConnectedDeviceInfo, ForceSample } from '../types/force.ts';
import type {
  DeviceConnectionState,
  DeviceError,
  DeviceFrame,
  DeviceProvider,
  DeviceScanResult,
} from '../types/device.ts';

const BATTERY_TIMEOUT_MS = 2500;

function mapBluetoothError(error: unknown): DeviceError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('bluetooth') && lower.includes('not available')) {
    return { code: 'ble_unavailable', message: 'Bluetooth is not available in this browser or on this device.' };
  }
  if (lower.includes('permission') || lower.includes('denied')) {
    return { code: 'permissions_denied', message: 'Bluetooth permission was denied.' };
  }
  if (lower.includes('user cancelled') || lower.includes('user canceled') || lower.includes('chooser cancelled')) {
    return { code: 'user_cancellation', message: 'Device selection was cancelled.' };
  }

  return {
    code: 'connect_failure',
    message: `Could not connect to Tindeq Progressor: ${message}`,
    cause: error,
  };
}

export class TindeqDeviceProvider implements DeviceProvider {
  readonly displayName = 'Tindeq Progressor';
  readonly sourceKind: SourceKind = 'Tindeq';

  onForceData: ((frame: DeviceFrame) => void) | null = null;
  onConnectionStateChange: ((state: DeviceConnectionState, device: ConnectedDeviceInfo | null) => void) | null = null;
  onStatus: ((message: string) => void) | null = null;
  onError: ((error: DeviceError) => void) | null = null;

  private device: BluetoothDevice | null = null;
  private gatt: BluetoothRemoteGATTServer | null = null;
  private dataCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private controlCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private connectedDevice: ConnectedDeviceInfo | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private lastBatteryMv: number | null = null;
  private pendingBatteryResolver: ((value: number | null) => void) | null = null;
  private streamOriginUs: number | null = null;

  async scanDevices(): Promise<DeviceScanResult[]> {
    if (!navigator.bluetooth) {
      const error: DeviceError = {
        code: 'ble_unavailable',
        message: 'Web Bluetooth is not supported in this browser.',
      };
      this.onError?.(error);
      throw new Error(error.message);
    }

    const available = await navigator.bluetooth.getAvailability();
    if (!available) {
      const error: DeviceError = {
        code: 'ble_unavailable',
        message: 'Bluetooth is turned off or unavailable.',
      };
      this.onError?.(error);
      throw new Error(error.message);
    }

    this.emitState('scanning', this.connectedDevice);

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: TINDEQ_NAME_PREFIX, services: [TINDEQ_SERVICE_UUID] }],
        optionalServices: [TINDEQ_SERVICE_UUID],
      });
      this.device = device;
      const deviceInfo = {
        ...defaultConnectedDevice('Tindeq'),
        deviceName: device.name ?? 'Tindeq Progressor',
      };
      return [{
        id: device.id,
        sourceKind: 'Tindeq',
        device: deviceInfo,
      }];
    } catch (error) {
      const mapped = mapBluetoothError(error);
      this.onError?.(mapped);
      throw error instanceof Error ? error : new Error(mapped.message);
    }
  }

  async connect(target?: DeviceScanResult): Promise<void> {
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.emitState('connecting', this.connectedDevice);

    try {
      if (!this.device) {
        await this.scanDevices();
      }

      if (target?.device) {
        this.connectedDevice = target.device;
      }

      if (!this.device?.gatt) {
        throw new Error('Selected Progressor device has no GATT server.');
      }

      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnected);
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnected);

      this.gatt = await this.device.gatt.connect();
      const service = await this.gatt.getPrimaryService(TINDEQ_SERVICE_UUID);
      this.dataCharacteristic = await service.getCharacteristic(TINDEQ_DATA_CHAR_UUID);
      this.controlCharacteristic = await service.getCharacteristic(TINDEQ_CONTROL_CHAR_UUID);
      this.dataCharacteristic.removeEventListener('characteristicvaluechanged', this.handleNotification);
      this.dataCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotification);
      await this.dataCharacteristic.startNotifications();

      this.connectedDevice = {
        ...defaultConnectedDevice('Tindeq'),
        deviceName: this.device.name ?? 'Tindeq Progressor',
        batteryMv: this.lastBatteryMv,
      };
      this.streamOriginUs = null;
      this.emitState('connected', this.connectedDevice);
      await this.startStreaming();
      await this.getBatteryStatus().catch(() => null);
    } catch (error) {
      const mapped = mapBluetoothError(error);
      this.onError?.(mapped);
      this.emitState('error', this.connectedDevice);
      throw error instanceof Error ? error : new Error(mapped.message);
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.emitState('disconnecting', this.connectedDevice);
    await this.stopStreaming().catch(() => undefined);
    this.cleanupGatt();
    this.connectedDevice = null;
    this.emitState('idle', null);
  }

  async tare(): Promise<void> {
    await this.writeCommand(TINDEQ_COMMANDS.tare);
    this.onStatus?.('Progressor tare requested');
  }

  async startStreaming(): Promise<void> {
    await this.writeCommand(TINDEQ_COMMANDS.startWeightMeasurement);
    this.onStatus?.('Progressor streaming started');
  }

  async stopStreaming(): Promise<void> {
    if (!this.controlCharacteristic) return;
    await this.writeCommand(TINDEQ_COMMANDS.stopWeightMeasurement);
    this.onStatus?.('Progressor streaming stopped');
  }

  async getBatteryStatus(): Promise<number | null> {
    if (!this.controlCharacteristic) return null;

    const batteryPromise = new Promise<number | null>((resolve) => {
      this.pendingBatteryResolver = resolve;
      window.setTimeout(() => {
        if (this.pendingBatteryResolver === resolve) {
          this.pendingBatteryResolver = null;
          resolve(null);
        }
      }, BATTERY_TIMEOUT_MS);
    });

    await this.writeCommand(TINDEQ_COMMANDS.sampleBatteryVoltage);
    const batteryMv = await batteryPromise;
    this.lastBatteryMv = batteryMv;
    if (this.connectedDevice) {
      this.connectedDevice = { ...this.connectedDevice, batteryMv };
      this.emitState('connected', this.connectedDevice);
    }
    return batteryMv;
  }

  async sendCommand(_cmd: string): Promise<boolean> {
    const error: DeviceError = {
      code: 'unsupported_command',
      message: 'Raw command strings are not supported for Tindeq Progressor.',
    };
    this.onError?.(error);
    return false;
  }

  async sendDeviceCommand(_command: DeviceCommand): Promise<boolean> {
    const error: DeviceError = {
      code: 'unsupported_command',
      message: 'Only tare/start/stop/battery commands are supported for Tindeq Progressor in this build.',
    };
    this.onError?.(error);
    return false;
  }

  isConnected(): boolean {
    return Boolean(this.gatt?.connected);
  }

  getConnectedDevice(): ConnectedDeviceInfo | null {
    return this.connectedDevice;
  }

  private async writeCommand(opcode: number): Promise<void> {
    if (!this.controlCharacteristic || !this.gatt?.connected) {
      const error: DeviceError = {
        code: 'stale_connection',
        message: 'Tindeq connection is not active.',
      };
      this.onError?.(error);
      throw new Error(error.message);
    }

    const payload = encodeTindeqCommand(opcode);
    const buffer = new ArrayBuffer(payload.byteLength);
    new Uint8Array(buffer).set(payload);
    await this.controlCharacteristic.writeValueWithResponse(buffer);
  }

  private readonly handleNotification = (event: BluetoothCharacteristicValueChangedEvent): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic | null;
    const value = characteristic?.value;
    if (!value) return;

    try {
      const notification = parseTindeqNotification(value);
      if (notification.kind === 'battery_voltage') {
        this.lastBatteryMv = notification.batteryMv;
        this.pendingBatteryResolver?.(notification.batteryMv);
        this.pendingBatteryResolver = null;
        return;
      }

      if (notification.kind === 'low_power_warning') {
        this.onStatus?.('Progressor reported low battery and may power off soon.');
        return;
      }

      for (const sample of notification.samples) {
        if (this.streamOriginUs === null) {
          this.streamOriginUs = sample.timestampUs;
        }
        const timestampMs = Math.max(0, Math.round((sample.timestampUs - this.streamOriginUs) / 1000));
        const forceSample: ForceSample = {
          tMs: timestampMs,
          source: 'tindeq',
          raw: null,
          kg: null,
          totalKg: sample.weightKg,
          totalN: sample.weightKg * KG_TO_N,
          batteryMv: this.lastBatteryMv,
          stability: null,
        };
        this.onForceData?.({
          kind: 'force',
          sample: forceSample,
        });
      }
    } catch (error) {
      const mapped: DeviceError = error instanceof TindeqProtocolError
        ? {
            code: 'malformed_payload',
            message: error.message,
            cause: error,
            recoverable: true,
          }
        : {
            code: 'dropped_notifications',
            message: `Failed to process a Progressor notification: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
            recoverable: true,
          };
      this.onError?.(mapped);
    }
  };

  private readonly handleDisconnected = (): void => {
    if (!this.shouldReconnect || !this.device) {
      this.cleanupGatt();
      this.connectedDevice = null;
      this.emitState('idle', null);
      return;
    }

    if (this.reconnectAttempts >= 1) {
      this.cleanupGatt();
      this.onError?.({
        code: 'reconnect_failure',
        message: 'Tindeq Progressor disconnected and reconnect failed.',
        recoverable: false,
      });
      this.connectedDevice = null;
      this.emitState('error', null);
      return;
    }

    this.reconnectAttempts += 1;
    this.emitState('reconnecting', this.connectedDevice);
    window.setTimeout(() => {
      void this.connect().catch(error => {
        this.onError?.({
          code: 'reconnect_failure',
          message: `Could not reconnect to Tindeq Progressor: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        });
        this.connectedDevice = null;
        this.emitState('error', null);
      });
    }, 500);
  };

  private cleanupGatt(): void {
    this.dataCharacteristic?.removeEventListener('characteristicvaluechanged', this.handleNotification);
    this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnected);
    if (this.gatt?.connected) {
      this.gatt.disconnect();
    }
    this.gatt = null;
    this.dataCharacteristic = null;
    this.controlCharacteristic = null;
    this.streamOriginUs = null;
    this.pendingBatteryResolver?.(null);
    this.pendingBatteryResolver = null;
  }

  private emitState(state: DeviceConnectionState, device: ConnectedDeviceInfo | null): void {
    this.onConnectionStateChange?.(state, device);
  }
}
