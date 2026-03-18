import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Topbar } from '../components/layout/Topbar.tsx';
import { resetAllStores } from './testUtils.ts';
import { useDeviceStore } from '../stores/deviceStore.ts';
import { useLiveStore } from '../stores/liveStore.ts';

const { pipeline, saveCurrentRecordingAsSession, sendTareCommand } = vi.hoisted(() => ({
  pipeline: {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    finalizeActiveEffort: vi.fn(),
  },
  saveCurrentRecordingAsSession: vi.fn(async () => undefined),
  sendTareCommand: vi.fn(),
}));

vi.mock('../pipeline/SamplePipeline.ts', () => ({
  pipeline,
}));

vi.mock('../live/sessionWorkflow.ts', () => ({
  saveCurrentRecordingAsSession,
  sendTareCommand,
}));

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find(node => node.textContent?.includes(label));
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}

describe('Topbar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the device connect control visible when disconnected', async () => {
    await act(async () => {
      root.render(<Topbar onOpenProfilePage={() => undefined} />);
    });

    expect(buttonByText(container, 'Connect device')).toBeInstanceOf(HTMLButtonElement);
    expect(buttonByText(container, 'Change device')).toBeInstanceOf(HTMLButtonElement);
    expect(container.textContent).toContain('Device');
    expect(container.textContent).toContain('Disconnected');
  });

  it('lets the sticky topbar disconnect and save an active recording', async () => {
    useDeviceStore.setState({
      sourceKind: 'Serial',
      connected: true,
      connectionState: 'connected',
    });
    useLiveStore.setState({
      recording: true,
    });

    await act(async () => {
      root.render(<Topbar onOpenProfilePage={() => undefined} />);
    });

    await act(async () => {
      buttonByText(container, 'Disconnect').click();
    });

    expect(pipeline.finalizeActiveEffort).toHaveBeenCalledTimes(1);
    expect(saveCurrentRecordingAsSession).toHaveBeenCalledTimes(1);
    expect(pipeline.disconnect).toHaveBeenCalledTimes(1);
  });
});
