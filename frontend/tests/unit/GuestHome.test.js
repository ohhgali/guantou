import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/homeFeed', () => ({
  resolveDefaultTab: vi.fn(() => 'recommended'),
  getNameplatePreview: vi.fn(),
  getTodayCan: vi.fn(),
  listHomeFeed: vi.fn(),
  HOME_FEED_TABS: [
    { key: 'today', label: '今日罐' },
    { key: 'dialect', label: '同方言' },
    { key: 'following', label: '关注' },
    { key: 'recommended', label: '推荐' },
  ],
}));

vi.mock('@/services/guantou', () => ({
  supportNameplate: vi.fn(),
  unsupportNameplate: vi.fn(),
}));

vi.mock('@/utils/audio', () => {
  /* 忠实复刻真实 audio.js 的调用顺序：受控播放全局互斥，
   * playManaged/stopAudio 先销毁旧句柄并向订阅者广播（携带被停止句柄），
   * 再创建/返回新句柄。测试借此覆盖 A→B 置换播放的竞态。 */
  const externalStopListeners = new Set();
  let managedHandle = null;
  const notifyExternalStop = (stoppedHandle) => {
    externalStopListeners.forEach((callback) => callback(stoppedHandle));
  };
  const playManaged = vi.fn((src) => {
    if (managedHandle) {
      const stopped = managedHandle;
      managedHandle = null;
      notifyExternalStop(stopped);
    }
    managedHandle = { src, destroy: vi.fn() };
    return managedHandle;
  });
  const stopAudio = vi.fn(() => {
    if (!managedHandle) return;
    const stopped = managedHandle;
    managedHandle = null;
    notifyExternalStop(stopped);
  });
  return {
    playAudio: vi.fn(),
    playManaged,
    stopAudio,
    preload: vi.fn(),
    onExternalStop: vi.fn((callback) => {
      externalStopListeners.add(callback);
      return () => externalStopListeners.delete(callback);
    }),
    offExternalStop: vi.fn((callback) => externalStopListeners.delete(callback)),
    __externalStopListeners: externalStopListeners,
    __resetManaged() {
      managedHandle = null;
    },
  };
});

vi.mock('@/services/commentSheet', () => ({
  closeCommentSheet: vi.fn(),
  isCommentSheetActive: vi.fn(() => false),
}));

import HomePage from '@/pages/index.vue';
import CanStageCard from '@/components/home/CanStageCard.vue';
import HomeTabBar from '@/components/home/HomeTabBar.vue';
import NameplateVoteRow from '@/components/home/NameplateVoteRow.vue';
import { closeCommentSheet, isCommentSheetActive } from '@/services/commentSheet';
import { getNameplatePreview, resolveDefaultTab } from '@/services/homeFeed';
import { supportNameplate } from '@/services/guantou';
import * as audioModule from '@/utils/audio';

function setupUni(token = '') {
  globalThis.uni = {
    getStorageSync: vi.fn((key) => (key === 'token' ? token : '')),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  };
  globalThis.getCurrentPages = vi.fn(() => []);
  globalThis.getApp = vi.fn(() => ({ globalData: {} }));
}

/* 记录每个 HomeFeed 实例的挂载，验证 tab 缓存不重复重建 */
const homeFeedMounts = [];

function mountHome() {
  return mount(HomePage, {
    global: {
      stubs: {
        HomeFeed: {
          props: ['tab'],
          template: '<div class="home-feed-stub" :data-tab="tab" />',
          mounted() {
            homeFeedMounts.push(this.tab);
          },
        },
        HomeTopBar: {
          props: ['activeTab'],
          template: '<div class="home-top-bar-stub" :data-active="activeTab">乡声集盒</div>',
        },
        HomeTabBar: true,
        CommentSheet: {
          name: 'CommentSheet',
          template: '<div />',
        },
      },
    },
  });
}

function triggerShow(wrapper) {
  const hook = wrapper.vm.$options.onShow;
  (Array.isArray(hook) ? hook : [hook]).forEach((fn) => fn.call(wrapper.vm));
}

function stageCanFixture(overrides = {}) {
  return {
    id: 11,
    concept_text: '舒服',
    audio_url: 'https://example.com/a.mp3',
    nameplate_previews: [],
    nameplate_total: 0,
    recorder: { id: 3, nickname: '老乡', avatar: '' },
    submitted_dialect: { qualified_code: '西南官话.四川' },
    status: 'verified',
    ...overrides,
  };
}

function mountStageCard(overrides = {}) {
  return mount(CanStageCard, {
    props: {
      can: stageCanFixture(overrides),
      active: true,
    },
  });
}

function triggerBackPress(wrapper) {
  const hook = wrapper.vm.$options.onBackPress;
  return (Array.isArray(hook) ? hook : [hook]).map((fn) => fn.call(wrapper.vm));
}

describe('immersive home (Issue #192)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homeFeedMounts.length = 0;
    audioModule.__externalStopListeners.clear();
    audioModule.__resetManaged();
    resolveDefaultTab.mockReturnValue('recommended');
    getNameplatePreview.mockReturnValue({ previews: [], total: 0 });
  });

  it('guest lands on the recommended feed', () => {
    setupUni();
    resolveDefaultTab.mockReturnValue('recommended');

    const wrapper = mountHome();

    expect(resolveDefaultTab).toHaveBeenCalled();
    expect(wrapper.find('.home-feed-stub').attributes('data-tab')).toBe('recommended');
    expect(wrapper.find('.home-top-bar-stub').attributes('data-active')).toBe('recommended');
  });

  it('user with a primary dialect lands on the dialect feed', () => {
    setupUni('token-value');
    resolveDefaultTab.mockReturnValue('dialect');

    const wrapper = mountHome();

    expect(wrapper.find('.home-feed-stub').attributes('data-tab')).toBe('dialect');
    expect(wrapper.find('.home-top-bar-stub').attributes('data-active')).toBe('dialect');
  });

  it('stage card renders the primary nameplate as the interactive top with stacked edges beneath', async () => {
    setupUni();
    getNameplatePreview.mockReturnValue({
      previews: [
        { id: 1, is_primary: true, display_text: '巴适', definition: '舒服', support_count: 12, supported_by_current_user: false },
        { id: 2, display_text: '巴适得板', definition: '很舒服', support_count: 8, supported_by_current_user: false },
        { id: 3, display_text: '安逸', definition: '舒适', support_count: 5, supported_by_current_user: false },
      ],
      total: 5,
    });

    const wrapper = mount(CanStageCard, {
      props: {
        can: {
          id: 11,
          concept_text: '舒服',
          audio_url: 'https://example.com/a.mp3',
          nameplate_previews: [],
          nameplate_total: 5,
          recorder: { id: 3, nickname: '老乡', avatar: '' },
          submitted_dialect: { qualified_code: '西南官话.四川' },
          status: 'verified',
        },
        active: true,
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(getNameplatePreview).toHaveBeenCalledWith(11, expect.any(Object));
    const rows = wrapper.findAllComponents(NameplateVoteRow);
    /* 堆叠后只有顶层主铭牌渲染为可交互卡；副铭牌退化为纯视觉厚度带 */
    expect(rows).toHaveLength(1);
    expect(rows.at(0).props('compact')).toBe(false);
    expect(rows.at(0).props('suppressDetailTap')).toBe(true);
    expect(wrapper.findAll('.plate-stack__edge')).toHaveLength(2);
    expect(wrapper.text()).toContain('巴适');
    expect(wrapper.text()).not.toContain('巴适得板');
    /* 展示 3 张、共 5 张 → 剩余 2 张收进 +N 入口 */
    expect(wrapper.text()).toContain('+ 2 张铭牌');
  });

  it('stage card stacks up to five plates and overflows the rest into +N', async () => {
    setupUni();
    getNameplatePreview.mockReturnValue({
      previews: [
        { id: 1, is_primary: true, display_text: '主牌', support_count: 0, supported_by_current_user: false },
        { id: 2, display_text: '副一', support_count: 0, supported_by_current_user: false },
        { id: 3, display_text: '副二', support_count: 0, supported_by_current_user: false },
        { id: 4, display_text: '副三', support_count: 0, supported_by_current_user: false },
        { id: 5, display_text: '副四', support_count: 0, supported_by_current_user: false },
        { id: 6, display_text: '副五', support_count: 0, supported_by_current_user: false },
      ],
      total: 6,
    });

    const wrapper = mount(CanStageCard, {
      props: {
        can: {
          id: 11,
          concept_text: '舒服',
          audio_url: 'https://example.com/a.mp3',
          nameplate_previews: [],
          nameplate_total: 6,
          recorder: { id: 3, nickname: '老乡', avatar: '' },
          submitted_dialect: { qualified_code: '西南官话.四川' },
          status: 'verified',
        },
        active: true,
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    /* 堆叠至多 5 张（4 层厚度带），第 6 张进 +N */
    expect(wrapper.findAllComponents(NameplateVoteRow)).toHaveLength(1);
    expect(wrapper.findAll('.plate-stack__edge')).toHaveLength(4);
    expect(wrapper.text()).toContain('主牌');
    expect(wrapper.text()).not.toContain('副五');
    expect(wrapper.text()).toContain('+ 1 张铭牌');
  });

  it('tapping the top nameplate opens the can detail instead of the nameplate page', async () => {
    setupUni();
    getNameplatePreview.mockReturnValue({
      previews: [
        { id: 1, is_primary: true, display_text: '巴适', support_count: 0, supported_by_current_user: false },
      ],
      total: 1,
    });

    const wrapper = mount(CanStageCard, {
      props: {
        can: {
          id: 11,
          concept_text: '舒服',
          audio_url: 'https://example.com/a.mp3',
          nameplate_previews: [],
          nameplate_total: 1,
          recorder: { id: 3, nickname: '老乡', avatar: '' },
          submitted_dialect: { qualified_code: '西南官话.四川' },
          status: 'verified',
        },
        active: true,
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    await wrapper.find('.plate-card__body').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/cans/details?id=11',
    }));
    expect(uni.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining('/pages/nameplates/details'),
    }));
  });

  it('guest voting asks for login instead of calling the API', async () => {
    setupUni();

    const wrapper = mount(NameplateVoteRow, {
      props: {
        nameplate: { id: 7, display_text: '巴适', support_count: 3, supported_by_current_user: false },
      },
    });
    await wrapper.find('.vote-row__support').trigger('tap');
    await wrapper.vm.$nextTick();

    expect(supportNameplate).not.toHaveBeenCalled();
    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/login',
    }));
    expect(wrapper.vm.supportCount).toBe(3);
  });

  it('tab bar shows the raised 装罐 key and reaches the create page', async () => {
    setupUni('token-value');

    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });

    expect(wrapper.text()).toContain('装罐');
    await wrapper.find('[aria-label="装罐"]').trigger('tap');
    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/cans/create',
    }));
  });

  it('tab bar 装罐 key asks guests to login first', async () => {
    setupUni();

    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });
    await wrapper.find('[aria-label="装罐"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/login',
    }));
    expect(uni.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/cans/create',
    }));
  });

  it('keeps visited feeds mounted and never re-mounts a revisited tab', async () => {
    setupUni();
    const wrapper = mountHome();

    // 首屏仅挂载当前激活的 tab
    expect(wrapper.findAll('.home-feed-stub')).toHaveLength(1);
    expect(homeFeedMounts).toEqual(['recommended']);

    // 切到新 tab：新建一个 feed 实例
    wrapper.vm.switchTab('dialect');
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.home-feed-stub')).toHaveLength(2);
    expect(homeFeedMounts).toEqual(['recommended', 'dialect']);

    // 切回已访问的 tab：保持挂载，仅切换可见性（不重建不重请求）
    wrapper.vm.switchTab('recommended');
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.home-feed-stub')).toHaveLength(2);
    expect(homeFeedMounts).toEqual(['recommended', 'dialect']);

    const stubs = wrapper.findAll('.home-feed-stub');
    const dialectStub = stubs.find((stub) => stub.attributes('data-tab') === 'dialect');
    const recommendedStub = stubs.find((stub) => stub.attributes('data-tab') === 'recommended');
    expect(dialectStub.element.style.display).toBe('none');
    expect(recommendedStub.element.style.display).not.toBe('none');
  });

  it('keeps at most two feeds alive and lazy-reloads evicted tabs', async () => {
    setupUni();
    const wrapper = mountHome();

    wrapper.vm.switchTab('dialect');
    await wrapper.vm.$nextTick();
    wrapper.vm.switchTab('today');
    await wrapper.vm.$nextTick();

    // 超出上限：最旧的 recommended 被卸载，仅保留最近访问的 2 个
    expect(wrapper.vm.visitedTabs).toEqual(['dialect', 'today']);
    expect(wrapper.findAll('.home-feed-stub')).toHaveLength(2);
    expect(homeFeedMounts).toEqual(['recommended', 'dialect', 'today']);

    // 回访被卸载的 tab：按首次进入的懒加载流程重新挂载，最旧者再次被挤出
    wrapper.vm.switchTab('recommended');
    await wrapper.vm.$nextTick();
    expect(homeFeedMounts).toEqual(['recommended', 'dialect', 'today', 'recommended']);
    expect(wrapper.vm.visitedTabs).toEqual(['today', 'recommended']);
    expect(wrapper.findAll('.home-feed-stub')).toHaveLength(2);
  });

  it('keeps the feed state when returning without an auth change', () => {
    setupUni('token-value');
    const wrapper = mountHome();

    triggerShow(wrapper);

    expect(wrapper.vm.feedRevision).toBe(0);
  });

  it('rebuilds the feed when the login state changes while away', () => {
    setupUni('');
    const wrapper = mountHome();

    // 模拟登录后返回首页：token 从无到有
    setupUni('token-value');
    triggerShow(wrapper);

    expect(wrapper.vm.feedRevision).toBe(1);

    // 登录态稳定后的再次返回不再重建
    triggerShow(wrapper);
    expect(wrapper.vm.feedRevision).toBe(1);
  });

  it('rebuilds the feed when the primary dialect changes while away', () => {
    setupUni('token-value');
    const wrapper = mountHome();

    // 模拟 onboarding 换主方言后返回：globalData.userInfo.primary_dialect 从无到有
    globalThis.getApp = vi.fn(() => ({
      globalData: { userInfo: { primary_dialect: { id: 5 } } },
    }));
    triggerShow(wrapper);

    expect(wrapper.vm.feedRevision).toBe(1);
  });

  it('converges alive feeds to the active tab when the fingerprint changes', async () => {
    setupUni('');
    const wrapper = mountHome();

    // 先常驻两个 tab（用户已手动选择，onShow 不会重置 activeTab）
    wrapper.vm.switchTab('dialect');
    await wrapper.vm.$nextTick();
    expect(homeFeedMounts).toEqual(['recommended', 'dialect']);

    // 模拟登录后返回首页：指纹变化 → 仅当前激活 tab 重挂载，避免多路并发重建
    setupUni('token-value');
    triggerShow(wrapper);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.feedRevision).toBe(1);
    expect(wrapper.vm.visitedTabs).toEqual(['dialect']);
    const stubs = wrapper.findAll('.home-feed-stub');
    expect(stubs).toHaveLength(1);
    expect(stubs[0].attributes('data-tab')).toBe('dialect');
    // 只有当前 tab 因 key 变化重挂载一次，其余常驻实例全部卸载而非重建
    expect(homeFeedMounts).toEqual(['recommended', 'dialect', 'dialect']);
  });

  it('resets the stage card playback state when playback is stopped externally', async () => {
    setupUni();
    const wrapper = mountStageCard();
    await wrapper.vm.$nextTick();

    // 模拟播放中：本地展示态已建立（进度/秒数非零）
    wrapper.vm.playing = true;
    wrapper.vm.progress = 0.5;
    wrapper.vm.progressSeconds = 3;

    // 触发外部停止广播（切 tab / 跳详情 / 被其他播放顶掉）
    audioModule.__externalStopListeners.forEach((callback) => callback());
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.playing).toBe(false);
    expect(wrapper.vm.progress).toBe(0);
    expect(wrapper.vm.progressSeconds).toBe(0);
    // 回调只复位本地状态，不得再调 stopAudio（避免递归广播）
    expect(audioModule.stopAudio).not.toHaveBeenCalled();

    // 卸载后取消订阅，不再接收广播也不泄漏监听器
    wrapper.unmount();
    expect(audioModule.__externalStopListeners.size).toBe(0);
  });

  it('keeps the initiator playing when taking over playback from another card (A→B)', async () => {
    setupUni();
    const cardA = mountStageCard({ id: 11, audio_url: 'https://example.com/a.mp3' });
    const cardB = mountStageCard({ id: 12, audio_url: 'https://example.com/b.mp3' });
    await cardA.vm.$nextTick();
    await cardB.vm.$nextTick();

    // A 先开始播放，持有全局受控句柄
    await cardA.find('.play-button').trigger('tap');
    expect(cardA.vm.playing).toBe(true);
    expect(cardA.vm.playbackHandle).not.toBeNull();

    // B 发起置换播放：真实顺序为先置 playing，随后 playManaged 内部销毁 A 的旧句柄
    // 并广播外部停止。B 必须忽略这条不属于自己的停止，否则刚置好的播放态被误复位
    await cardB.find('.play-button').trigger('tap');

    expect(cardA.vm.playing).toBe(false);
    expect(cardA.vm.playbackHandle).toBeNull();
    expect(cardB.vm.playing).toBe(true);
    expect(cardB.vm.playbackHandle).not.toBeNull();
    expect(audioModule.playManaged).toHaveBeenCalledTimes(2);

    // B 再次点击暂停：stopAudio 广播携带 B 的句柄，仅归属者 B 复位，A 不受影响
    await cardB.find('.play-button').trigger('tap');
    expect(cardA.vm.playing).toBe(false);
    expect(cardB.vm.playing).toBe(false);
    expect(cardB.vm.playbackHandle).toBeNull();
  });

  it('首页挂载全局 CommentSheet 浮层（#257）', () => {
    const wrapper = mountHome();

    expect(wrapper.findComponent({ name: 'CommentSheet' }).exists()).toBe(true);
  });

  it('评论面板打开时返回键先关闭面板而非退出页面（#255）', () => {
    isCommentSheetActive.mockReturnValue(true);
    const wrapper = mountHome();

    const results = triggerBackPress(wrapper);
    expect(results).toContain(true);
    expect(closeCommentSheet).toHaveBeenCalled();
  });

  it('面板关闭时返回键保持原有退出行为（#255）', () => {
    isCommentSheetActive.mockReturnValue(false);
    const wrapper = mountHome();

    const results = triggerBackPress(wrapper);
    expect(results.every((value) => value === false)).toBe(true);
    expect(closeCommentSheet).not.toHaveBeenCalled();
  });
});
