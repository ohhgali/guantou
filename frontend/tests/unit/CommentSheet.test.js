import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/navigation', () => ({
  goCanComments: vi.fn(),
  goNameplateComments: vi.fn(),
  goNotFound: vi.fn(),
}));

import CommentSheet from '@/components/CommentSheet.vue';
import {
  isCommentSheetActive,
  openCommentSheet,
  registerCommentSheetHost,
  unregisterCommentSheetHost,
} from '@/services/commentSheet';
import { goCanComments, goNameplateComments, goNotFound } from '@/services/navigation';

const submitComment = vi.fn(() => Promise.resolve({ id: 1 }));
const submitReply = vi.fn(() => Promise.resolve({ id: 2, parent_id: 1 }));

function mountSheet() {
  return mount(CommentSheet, {
    global: {
      stubs: {
        CommentThread: {
          props: ['targetType', 'targetId'],
          template: '<div class="thread-stub" :data-type="targetType" :data-id="targetId" />',
          methods: { submitComment, submitReply },
        },
        // uni-app 原生滚动容器在 jsdom 中不可解析，静默其解析告警；透传默认插槽以保留 CommentThread
        'scroll-view': {
          template: '<div class="scroll-view-stub"><slot /></div>',
        },
      },
    },
  });
}

describe('CommentSheet (Issue #219 后续)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {};
  });

  describe('service fallback（未挂载 CommentSheet 时）', () => {
    it('整页跳转罐头评论', () => {
      openCommentSheet({ targetType: 'can', targetId: 12, theme: 'immersive' });

      expect(goCanComments).toHaveBeenCalledWith(12);
      expect(goNameplateComments).not.toHaveBeenCalled();
    });

    it('整页跳转铭牌评论', () => {
      openCommentSheet({ targetType: 'nameplate', targetId: 7, theme: 'immersive' });

      expect(goNameplateComments).toHaveBeenCalledWith(7);
      expect(goCanComments).not.toHaveBeenCalled();
    });

    it('未知目标类型不跳转（#257）', () => {
      openCommentSheet({ targetType: 'bogus', targetId: 1 });

      expect(goNotFound).toHaveBeenCalled();
      expect(goCanComments).not.toHaveBeenCalled();
      expect(goNameplateComments).not.toHaveBeenCalled();
    });
  });

  describe('hosted sheet（CommentSheet 挂载后）', () => {
    it('通过注册的 host 打开，并装载目标评论线程', async () => {
      const wrapper = mountSheet();

      openCommentSheet({ targetType: 'can', targetId: 12, theme: 'immersive' });
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.targetType).toBe('can');
      expect(wrapper.vm.targetId).toBe(12);
      expect(wrapper.vm.theme).toBe('immersive');
      expect(wrapper.vm.active).toBe(true);
      expect(wrapper.find('.thread-stub').attributes('data-id')).toBe('12');
      expect(goCanComments).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it('目标未就绪前不渲染评论线程', () => {
      const wrapper = mountSheet();

      expect(wrapper.find('.thread-stub').exists()).toBe(false);

      wrapper.unmount();
    });

    it('空闲时全屏浮层不渲染，打开后才出现（#256）', async () => {
      const wrapper = mountSheet();
      expect(wrapper.find('.comment-sheet__layer').exists()).toBe(false);
      expect(wrapper.find('.comment-sheet__mask').exists()).toBe(false);
      expect(wrapper.find('.comment-sheet__panel').exists()).toBe(false);

      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.comment-sheet__layer').exists()).toBe(true);
      expect(wrapper.find('.comment-sheet__mask').exists()).toBe(true);
      expect(wrapper.find('.comment-sheet__panel').exists()).toBe(true);

      wrapper.unmount();
    });

    it('面板开合时发射 active-change（用于锁定底层滑动）', async () => {
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await flushPromises();
      expect(wrapper.emitted('active-change').slice(-1)[0]).toEqual([true]);

      wrapper.vm.close();
      await flushPromises();
      expect(wrapper.emitted('active-change').slice(-1)[0]).toEqual([false]);

      wrapper.unmount();
    });

    it('isCommentSheetActive 反映面板激活态（#255）', async () => {
      const wrapper = mountSheet();
      expect(isCommentSheetActive()).toBe(false);

      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();
      expect(isCommentSheetActive()).toBe(true);

      wrapper.vm.close();
      expect(isCommentSheetActive()).toBe(false);

      wrapper.unmount();
    });

    it('点击遮罩关闭，并在过渡结束后清空目标', async () => {
      vi.useFakeTimers();
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.active).toBe(true);

      await wrapper.find('.comment-sheet__mask').trigger('tap');
      expect(wrapper.vm.active).toBe(false);

      vi.advanceTimersByTime(300);
      expect(wrapper.vm.targetId).toBeNull();
      expect(wrapper.vm.targetType).toBeNull();

      wrapper.unmount();
      vi.useRealTimers();
    });

    it('半屏时下拉超过阈值关闭面板（问题1）', async () => {
      vi.useFakeTimers();
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      const grip = wrapper.find('.comment-sheet__grip');
      await grip.trigger('touchstart', { touches: [{ clientY: 100 }] });
      // 向下位移跟手
      await grip.trigger('touchmove', { touches: [{ clientY: 300 }] });
      expect(wrapper.vm.dragDelta).toBe(200);
      await grip.trigger('touchend');
      expect(wrapper.vm.active).toBe(false);

      vi.advanceTimersByTime(300);
      expect(wrapper.vm.targetId).toBeNull();

      wrapper.unmount();
      vi.useRealTimers();
    });

    it('上拉进入全屏，全屏下拉退回半屏（问题1）', async () => {
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.mode).toBe('half');

      const grip = wrapper.find('.comment-sheet__grip');
      // 上拉 → 全屏
      await grip.trigger('touchstart', { touches: [{ clientY: 300 }] });
      await grip.trigger('touchmove', { touches: [{ clientY: 100 }] });
      expect(wrapper.vm.dragDelta).toBe(-200);
      await grip.trigger('touchend');
      expect(wrapper.vm.mode).toBe('full');
      expect(wrapper.find('.comment-sheet__panel').classes()).toContain('comment-sheet__panel--full');

      // 全屏下拉 → 回半屏
      await grip.trigger('touchstart', { touches: [{ clientY: 100 }] });
      await grip.trigger('touchmove', { touches: [{ clientY: 300 }] });
      await grip.trigger('touchend');
      expect(wrapper.vm.mode).toBe('half');
      expect(wrapper.vm.active).toBe(true);

      wrapper.unmount();
    });

    it('底部评论框：提交成功清空草稿（问题2）', async () => {
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      wrapper.vm.draft = '  你好  ';
      await wrapper.vm.submit();

      expect(submitComment).toHaveBeenCalledWith('  你好  ');
      expect(wrapper.vm.draft).toBe('');

      wrapper.unmount();
    });

    it('快速连点只提交一次（防抖，避免回复重复发送）', async () => {
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      wrapper.vm.draft = '你好';
      await wrapper.vm.submit();
      // 第二次提交落在 500ms 防抖窗口内，应被拦截
      await wrapper.vm.submit();

      expect(submitComment).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });

    it('回复模式：onReply 设置目标，submit 走 submitReply 并清空（问题2）', async () => {
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      wrapper.vm.onReply({ parentId: 1, replyToId: 2, nickname: '昵称2' });
      expect(wrapper.vm.replyTarget).toEqual({ parentId: 1, replyToId: 2, nickname: '昵称2' });

      wrapper.vm.draft = '回复内容';
      await wrapper.vm.submit();

      expect(submitReply).toHaveBeenCalledWith({ replyToId: 2, parentId: 1, content: '回复内容' });
      expect(submitComment).not.toHaveBeenCalled();
      expect(wrapper.vm.draft).toBe('');
      expect(wrapper.vm.replyTarget).toBeNull();

      wrapper.unmount();
    });

    it('手势取消时复位状态且不关闭（#257）', async () => {
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      const grip = wrapper.find('.comment-sheet__grip');
      await grip.trigger('touchstart', { touches: [{ clientY: 100 }] });
      await grip.trigger('touchmove', { touches: [{ clientY: 300 }] });
      expect(wrapper.vm.dragDelta).toBe(200);

      await grip.trigger('touchcancel');
      expect(wrapper.vm.dragging).toBe(false);
      expect(wrapper.vm.dragDelta).toBe(0);
      expect(wrapper.vm.active).toBe(true);

      wrapper.unmount();
    });

    describe('面板内多目标切换', () => {
      const SCOPES = [
        { type: 'can', id: 12, label: '本段录音', count: 3 },
        { type: 'nameplate', id: 21, label: '巴适', count: 1 },
        { type: 'nameplate', id: 22, label: '安逸', count: 4 },
      ];

      it('传 scopes(≥2) 渲染切换条并高亮初始目标', async () => {
        const wrapper = mountSheet();
        openCommentSheet({ targetType: 'can', targetId: 12, scopes: SCOPES });
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.hasScopes).toBe(true);
        const chips = wrapper.findAll('.comment-sheet__scope');
        expect(chips).toHaveLength(3);
        expect(chips.at(0).text()).toContain('本段录音');
        expect(chips.at(0).classes()).toContain('comment-sheet__scope--active');
        expect(chips.at(1).text()).toContain('巴适');

        wrapper.unmount();
      });

      it('单目标（不传 scopes）不渲染切换条，行为回归', async () => {
        const wrapper = mountSheet();
        openCommentSheet({ targetType: 'nameplate', targetId: 21 });
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.hasScopes).toBe(false);
        expect(wrapper.find('.comment-sheet__scopes').exists()).toBe(false);

        wrapper.unmount();
      });

      it('初始目标不在 scopes 时补到最前并高亮', async () => {
        const wrapper = mountSheet();
        openCommentSheet({ targetType: 'can', targetId: 99, scopes: SCOPES });
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.scopes[0]).toMatchObject({ type: 'can', id: 99 });
        expect(wrapper.vm.activeScopeIndex).toBe(0);

        wrapper.unmount();
      });

      it('切换 chip 更新目标、清空草稿与回复态，并保持面板激活', async () => {
        const wrapper = mountSheet();
        openCommentSheet({ targetType: 'can', targetId: 12, scopes: SCOPES });
        await wrapper.vm.$nextTick();

        wrapper.vm.draft = '写到一半';
        wrapper.vm.replyTarget = { parentId: 1, replyToId: 2, nickname: '某人' };

        const chips = wrapper.findAll('.comment-sheet__scope');
        await chips.at(1).trigger('tap');
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.targetType).toBe('nameplate');
        expect(wrapper.vm.targetId).toBe(21);
        expect(wrapper.vm.activeScopeIndex).toBe(1);
        expect(wrapper.vm.draft).toBe('');
        expect(wrapper.vm.replyTarget).toBeNull();
        expect(wrapper.vm.active).toBe(true);
        /* scroll-view :key 变化 → 评论线程以新目标重挂 */
        const thread = wrapper.find('.thread-stub');
        expect(thread.attributes('data-type')).toBe('nameplate');
        expect(thread.attributes('data-id')).toBe('21');

        wrapper.unmount();
      });

      it('关闭过渡结束后清空 scopes 与高亮', async () => {
        vi.useFakeTimers();
        const wrapper = mountSheet();
        openCommentSheet({ targetType: 'can', targetId: 12, scopes: SCOPES });
        await wrapper.vm.$nextTick();
        expect(wrapper.vm.scopes).not.toBeNull();

        wrapper.vm.close();
        vi.advanceTimersByTime(300);
        expect(wrapper.vm.scopes).toBeNull();
        expect(wrapper.vm.activeScopeIndex).toBe(0);

        wrapper.unmount();
        vi.useRealTimers();
      });
    });
  });

  describe('多宿主注册（页面栈最后注册者胜）', () => {
    function fakeHost(name) {
      return { name, open: vi.fn(), close: vi.fn(), isActive: vi.fn(() => false) };
    }

    it('后注册宿主接管 openCommentSheet，注销后回退前一宿主', () => {
      const home = fakeHost('home');
      const canDetail = fakeHost('can-detail');
      registerCommentSheetHost(home);
      registerCommentSheetHost(canDetail);

      openCommentSheet({ targetType: 'nameplate', targetId: 7 });
      expect(canDetail.open).toHaveBeenCalledWith(expect.objectContaining({
        targetType: 'nameplate',
        targetId: 7,
      }));

      unregisterCommentSheetHost(canDetail);
      openCommentSheet({ targetType: 'can', targetId: 9 });
      expect(home.open).toHaveBeenCalledWith(expect.objectContaining({
        targetType: 'can',
        targetId: 9,
      }));

      unregisterCommentSheetHost(home);
    });
  });
});
