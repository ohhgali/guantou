import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  getCan: vi.fn(),
  supportNameplate: vi.fn(),
  transitionCan: vi.fn(),
  unsupportNameplate: vi.fn(),
}));

vi.mock('@/services/canSocial', () => ({
  likeCan: vi.fn(),
  unlikeCan: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));

vi.mock('@/services/commentSheet', () => ({
  closeCommentSheet: vi.fn(),
  isCommentSheetActive: vi.fn(() => false),
  openCommentSheet: vi.fn(),
}));

vi.mock('@/services/canPostJourney', () => ({
  openCanPost: vi.fn(),
  startUseSame: vi.fn(),
}));

vi.mock('@/services/navigation', () => ({
  ROUTES: { home: '/pages/index/index' },
  goBack: vi.fn(),
  goCreateNameplate: vi.fn(),
  goNameplateDetail: vi.fn(),
}));

vi.mock('@/utils/audio', () => ({ playAudio: vi.fn() }));

vi.mock('@/utils/shareCan', () => ({
  canSharePayload: vi.fn(),
  shareCanOnWeb: vi.fn(),
}));

vi.mock('@/routers/user', () => ({ toUserPage: vi.fn() }));

import CanDetailsPage, { buildCommentScopes } from '@/pages/cans/details.vue';
import { getCan } from '@/services/guantou';
import {
  closeCommentSheet,
  isCommentSheetActive,
  openCommentSheet,
} from '@/services/commentSheet';

function makeCan(overrides = {}) {
  return {
    id: 5,
    audio_url: 'https://example.com/a.mp3',
    concept_text: '舒服',
    comment_count: 2,
    recent_comments: [
      { id: 1, content: '说得地道', author: { nickname: '老乡', username: 'lx' }, created_at: '2026-08-01T10:00:00' },
    ],
    nameplates: [
      { id: 21, is_primary: true, status: 'active', display_text: '巴适', definition: '舒服', comment_count: 1, weight: 10 },
      { id: 22, is_primary: false, status: 'active', display_text: '安逸', definition: '舒适', comment_count: 3, weight: 5 },
      { id: 30, is_primary: false, status: 'withdrawn', display_text: '退稿', comment_count: 0, weight: 0 },
    ],
    recent_posts: [],
    use_count: 0,
    like_count: 0,
    liked_by_me: false,
    recorder: { id: 3, nickname: '老乡', avatar: '' },
    submitted_dialect: { qualified_code: '西南官话.四川' },
    status: 'verified',
    source_note: '',
    duration_ms: 8000,
    created_at: '2026-08-01T10:00:00',
    ...overrides,
  };
}

function setupUni() {
  globalThis.uni = {
    getStorageSync: vi.fn(() => ''),
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  };
  globalThis.getApp = vi.fn(() => ({ globalData: {} }));
}

function mountPage() {
  return mount(CanDetailsPage, {
    global: {
      stubs: {
        PageShell: { template: '<div class="ps-shell"><slot /></div>' },
        CommentSheet: { template: '<div class="comment-sheet-stub" />' },
        NameplateCard: {
          name: 'NameplateCard',
          props: ['plate'],
          emits: ['open', 'comments', 'debate', 'support', 'unsupport'],
          template: '<div class="card-stub" data-id="plate.id" @tap="$emit(\'comments\', plate.id)" />',
        },
      },
    },
  });
}

async function loadPage() {
  const wrapper = mountPage();
  await wrapper.vm.$options.onLoad.call(wrapper.vm, { id: '5' });
  await flushPromises();
  return wrapper;
}

describe('罐头详情页信息重排 (Step 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCommentSheetActive.mockReturnValue(false);
    setupUni();
  });

  describe('buildCommentScopes', () => {
    it('录音在前，active 铭牌（主牌优先/权重降序）随后，含各自计数', () => {
      const scopes = buildCommentScopes(makeCan());
      expect(scopes).toEqual([
        { type: 'can', id: 5, label: '本段录音', count: 2 },
        { type: 'nameplate', id: 21, label: '巴适', count: 1 },
        { type: 'nameplate', id: 22, label: '安逸', count: 3 },
      ]);
    });

    it('无 can 时返回 null；withdrawn 铭牌不进入 scopes', () => {
      expect(buildCommentScopes(null)).toBeNull();
      const ids = buildCommentScopes(makeCan()).map((s) => s.id);
      expect(ids).not.toContain(30);
    });
  });

  it('加载后区块按 大家怎么说 → 铭牌 → 引用表达 → 档案 排列，档案默认折叠', async () => {
    getCan.mockResolvedValue(makeCan());
    const wrapper = await loadPage();

    const titles = wrapper.findAll('.section-title').map((node) => node.text());
    expect(titles.slice(0, 4)).toEqual([
      '大家怎么说 · 2',
      '这段录音的铭牌',
      '引用表达 · 0',
      '录音档案与状态',
    ]);
    /* 档案默认折叠：action 文案为「展开」，状态仍为 false */
    expect(wrapper.vm.showArchive).toBe(false);
    expect(wrapper.find('.section-action').text()).toBe('展开');

    wrapper.vm.showArchive = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.showArchive).toBe(true);
    expect(wrapper.find('.section-action').text()).toBe('收起');

    wrapper.unmount();
  });

  it('「大家怎么说」展示最近评论摘要并渲染该罐头的最近讨论', async () => {
    getCan.mockResolvedValue(makeCan());
    const wrapper = await loadPage();

    expect(wrapper.text()).toContain('说得地道');
    expect(wrapper.text()).toContain('老乡');

    wrapper.unmount();
  });

  it('评论入口调用 openCommentSheet 并携带 scopes（录音为初始目标）', async () => {
    getCan.mockResolvedValue(makeCan());
    const wrapper = await loadPage();

    wrapper.vm.openCanSheet();

    expect(openCommentSheet).toHaveBeenCalledWith({
      targetType: 'can',
      targetId: 5,
      theme: 'default',
      scopes: buildCommentScopes(makeCan()),
    });

    wrapper.unmount();
  });

  it('NameplateCard 的评论事件切到该铭牌 scope 打开面板', async () => {
    getCan.mockResolvedValue(makeCan());
    const wrapper = await loadPage();

    const plateCard = wrapper.findAll('.card-stub').at(0);
    await plateCard.trigger('tap');

    expect(openCommentSheet).toHaveBeenCalledWith(expect.objectContaining({
      targetType: 'nameplate',
      targetId: 21,
    }));
    expect(openCommentSheet.mock.calls[0][0].scopes[0].type).toBe('can');

    wrapper.unmount();
  });

  it('面板激活时返回键先关面板；关闭后轻量刷新同步摘要', async () => {
    getCan.mockResolvedValue(makeCan());
    const wrapper = await loadPage();

    wrapper.vm.onSheetActiveChange(true);
    isCommentSheetActive.mockReturnValue(true);
    const backPress = wrapper.vm.$options.onBackPress;
    expect(backPress.call(wrapper.vm)).toBe(true);
    expect(closeCommentSheet).toHaveBeenCalled();
    expect(getCan).toHaveBeenCalledTimes(1);

    wrapper.vm.onSheetActiveChange(false);
    await flushPromises();
    /* 面板曾打开：关闭后 refresh 一次让 recent_comments/计数新鲜 */
    expect(getCan).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });
});
