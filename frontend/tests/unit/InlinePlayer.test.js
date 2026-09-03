import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/audio', () => {
  const listeners = new Set();
  let stopCount = 0;
  const playManaged = vi.fn((src) => {
    const handle = { src, destroy: vi.fn() };
    return handle;
  });
  const stopAudio = vi.fn(() => {
    stopCount += 1;
    listeners.forEach((cb) => cb(null));
  });
  const onExternalStop = vi.fn((callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  });
  return {
    playManaged,
    stopAudio,
    onExternalStop,
    playAudio: vi.fn(),
    __notifyExternalStop: (handle) => listeners.forEach((cb) => cb(handle)),
    __stopCount: () => stopCount,
  };
});

import InlinePlayer from '@/components/InlinePlayer.vue';
import { onExternalStop, playManaged, stopAudio } from '@/utils/audio';
import * as audioModule from '@/utils/audio';

function mountPlayer(props = {}) {
  return mount(InlinePlayer, {
    props: { src: 'https://example.com/a.mp3', ...props },
  });
}

describe('InlinePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { showToast: vi.fn(), getStorageSync: vi.fn(() => '') };
  });

  it('点击播放：调用 playManaged 并进入播放态', async () => {
    const wrapper = mountPlayer();
    wrapper.vm.toggle();

    expect(playManaged).toHaveBeenCalledWith('https://example.com/a.mp3', expect.any(Object));
    expect(wrapper.vm.playing).toBe(true);

    wrapper.unmount();
  });

  it('播放结束/外部停止会复位本地播放态', async () => {
    const wrapper = mountPlayer();
    let callbacks = {};
    playManaged.mockImplementation((src, cb) => {
      callbacks = cb;
      return { src, destroy: vi.fn() };
    });
    wrapper.vm.toggle();
    expect(wrapper.vm.playing).toBe(true);

    callbacks.onEnded();
    expect(wrapper.vm.playing).toBe(false);
    expect(wrapper.vm.progress).toBe(0);

    wrapper.unmount();
  });

  it('再次点击停止并调用 stopAudio', () => {
    const wrapper = mountPlayer();
    wrapper.vm.toggle();
    wrapper.vm.toggle();

    expect(stopAudio).toHaveBeenCalled();
    expect(wrapper.vm.playing).toBe(false);

    wrapper.unmount();
  });

  it('无 src 时点按不触发播放', () => {
    const wrapper = mountPlayer({ src: '' });
    wrapper.vm.toggle();

    expect(playManaged).not.toHaveBeenCalled();
    expect(wrapper.vm.playing).toBe(false);

    wrapper.unmount();
  });

  it('卸载时退订外部停止广播', () => {
    const wrapper = mountPlayer();
    expect(onExternalStop).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(stopAudio).not.toHaveBeenCalled();
  });
});
