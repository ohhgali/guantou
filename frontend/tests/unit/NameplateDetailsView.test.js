import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  getNameplate: vi.fn(),
  supportNameplate: vi.fn(),
  unsupportNameplate: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));

vi.mock('@/services/commentSheet', () => ({
  closeCommentSheet: vi.fn(),
  isCommentSheetActive: vi.fn(() => false),
  openCommentSheet: vi.fn(),
}));

vi.mock('@/services/navigation', () => ({
  ROUTES: { home: '/pages/index/index' },
  goBack: vi.fn(),
  goCanDetail: vi.fn(),
  goCreateNameplate: vi.fn(),
}));

import NameplateDetailsPage from '@/pages/nameplates/details.vue';
import { getNameplate } from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';
import {
  closeCommentSheet,
  isCommentSheetActive,
  openCommentSheet,
} from '@/services/commentSheet';
import { goCanDetail, goCreateNameplate } from '@/services/navigation';

function makeNameplate(overrides = {}) {
  return {
    id: 7,
    is_primary: true,
    display_text: '巴适',
    definition: '舒服',
    pronunciation_text: '巴适',
    pronunciation: {
      base_romanization: 'ba5',
      surface_romanization: 'bai5',
      ipa: 'pa˧',
      reading_type: 'general',
      is_canonical: true,
    },
    dialect: { id: 1, name: '西南官话' },
    evidence_level: 3,
    source: { type: 'book', title: '某县志', note: '据县志记载' },
    comment_count: 4,
    support_count: 2,
    supported_by_current_user: false,
    can: { id: 5, audio_url: 'https://example.com/a.mp3' },
    ...overrides,
  };
}

function setupUni() {
  globalThis.uni = {
    getStorageSync: vi.fn(() => ''),
    showToast: vi.fn(),
  };
  globalThis.getApp = vi.fn(() => ({ globalData: {} }));
}

function mountPage() {
  return mount(NameplateDetailsPage, {
    global: {
      stubs: {
        PageShell: { template: '<div class="ps-shell"><slot /></div>' },
        CommentSheet: { template: '<div class="comment-sheet-stub" />' },
        ReadingSandhiFlow: {
          name: 'ReadingSandhiFlow',
          props: ['pronunciation', 'pronunciationText'],
          template: '<div class="sandhi-stub" :data-ipa="pronunciation && pronunciation.ipa" />',
        },
        InlinePlayer: {
          name: 'InlinePlayer',
          props: ['src'],
          template: '<div class="player-stub" :data-src="src" />',
        },
      },
    },
  });
}

async function loadPage(nameplate = makeNameplate()) {
  getNameplate.mockResolvedValue(nameplate);
  const wrapper = mountPage();
  await wrapper.vm.$options.onLoad.call(wrapper.vm, { id: '7' });
  await flushPromises();
  return wrapper;
}

function buttons(wrapper) {
  return wrapper.findAllComponents({ name: 'BaseButton' });
}

function buttonByText(wrapper, text) {
  return buttons(wrapper).find((button) => button.props('text').includes(text));
}

describe('铭牌详情页信息重排 (Step 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockReturnValue(true);
    isCommentSheetActive.mockReturnValue(false);
    setupUni();
  });

  it('加载后展示读音变化组件并传入 pronunciation/原样读音', async () => {
    const wrapper = await loadPage();

    expect(getNameplate).toHaveBeenCalledWith(7);
    const sandhi = wrapper.findComponent({ name: 'ReadingSandhiFlow' });
    expect(sandhi.exists()).toBe(true);
    expect(sandhi.props('pronunciation').ipa).toBe('pa˧');
    expect(sandhi.props('pronunciationText')).toBe('巴适');

    wrapper.unmount();
  });

  it('hero 主操作只含 支持/评论，不含「立论」', async () => {
    const wrapper = await loadPage();

    const heroActions = wrapper.find('.nameplate-hero__actions');
    expect(heroActions.text()).toContain('支持 2');
    expect(heroActions.text()).toContain('评论 4');
    expect(heroActions.text()).not.toContain('立论');

    wrapper.unmount();
  });

  it('「立论」独立出现在依据区：走 goCreateNameplate(canId, id) 而非 hero 操作', async () => {
    const wrapper = await loadPage();

    expect(wrapper.find('.evidence__cta').exists()).toBe(true);
    await buttonByText(wrapper, '立论').vm.$emit('click');

    expect(requireAuth).toHaveBeenCalledWith('nameplate_create', {
      nameplateId: 7,
      canId: 5,
    });
    expect(goCreateNameplate).toHaveBeenCalledWith(5, 7);

    wrapper.unmount();
  });

  it('评论按钮打开单目标半屏面板（无 scopes 切换条）', async () => {
    const wrapper = await loadPage();

    wrapper.vm.openComments();

    expect(openCommentSheet).toHaveBeenCalledWith({
      targetType: 'nameplate',
      targetId: 7,
      theme: 'default',
    });

    wrapper.unmount();
  });

  it('有录音时内联播放器渲染并链接罐头详情', async () => {
    const wrapper = await loadPage();

    const player = wrapper.findComponent({ name: 'InlinePlayer' });
    expect(player.exists()).toBe(true);
    expect(player.props('src')).toBe('https://example.com/a.mp3');

    await wrapper.find('.can-link').trigger('tap');
    expect(goCanDetail).toHaveBeenCalledWith(5);

    wrapper.unmount();
  });

  it('无录音时显示占位、不渲染播放器', async () => {
    const wrapper = await loadPage(makeNameplate({ can: { id: 5, audio_url: '' } }));

    expect(wrapper.findComponent({ name: 'InlinePlayer' }).exists()).toBe(false);
    expect(wrapper.text()).toContain('尚未关联可播放的录音');

    wrapper.unmount();
  });

  it('面板激活时返回键先关面板；关闭后重新 load 同步计数', async () => {
    const wrapper = await loadPage();

    wrapper.vm.onSheetActiveChange(true);
    isCommentSheetActive.mockReturnValue(true);
    const backPress = wrapper.vm.$options.onBackPress;
    expect(backPress.call(wrapper.vm)).toBe(true);
    expect(closeCommentSheet).toHaveBeenCalled();
    expect(getNameplate).toHaveBeenCalledTimes(1);

    wrapper.vm.onSheetActiveChange(false);
    await flushPromises();
    expect(getNameplate).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });
});
