import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PlateStack from '@/components/home/PlateStack.vue';

function plate(id, overrides = {}) {
  return {
    id,
    is_primary: false,
    display_text: `铭牌${id}`,
    definition: `释义${id}`,
    ...overrides,
  };
}

function mountStack({ plates = [], total = 0, canId = 9 } = {}) {
  return mount(PlateStack, {
    props: { plates, total, canId },
    global: {
      stubs: {
        NameplateVoteRow: {
          name: 'NameplateVoteRow',
          props: {
            nameplate: { type: Object, default: () => ({}) },
            canId: { type: [Number, String], default: null },
            suppressDetailTap: { type: Boolean, default: false },
          },
          emits: ['body-tap'],
          template: '<div class="row-stub" data-id="nameplate.id">'
            + '<button class="row-body" @click="$emit(\'body-tap\', nameplate)">body</button>'
            + '</div>',
        },
      },
    },
  });
}

describe('PlateStack (流上 3D 堆叠铭牌区)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { getStorageSync: vi.fn(() => '') };
  });

  it('空态：无铭牌时只渲染提示', () => {
    const wrapper = mountStack();

    expect(wrapper.text()).toContain('还没有铭牌');
    expect(wrapper.findAll('.plate-stack__sheet')).toHaveLength(0);
    expect(wrapper.find('.plate-stack__more').exists()).toBe(false);
  });

  it('单张：只渲染顶层主铭牌，无副铭牌厚度带', () => {
    const wrapper = mountStack({
      plates: [plate(1, { is_primary: true })],
      total: 1,
    });

    expect(wrapper.findAll('.row-stub')).toHaveLength(1);
    expect(wrapper.findAll('.plate-stack__sheet')).toHaveLength(0);
  });

  it('顶层 NameplateVoteRow 收到 suppressDetailTap，body 点按冒泡为 open-can', async () => {
    const wrapper = mountStack({
      plates: [plate(1, { is_primary: true }), plate(2), plate(3)],
      total: 3,
    });

    const row = wrapper.findComponent({ name: 'NameplateVoteRow' });
    expect(row.props('suppressDetailTap')).toBe(true);
    expect(row.props('nameplate').id).toBe(1);

    await wrapper.find('.row-body').trigger('click');
    expect(wrapper.emitted('open-can')).toHaveLength(1);
  });

  it('副铭牌渲染为纯视觉牌面（n-1 向右上偏移），顶层操作条只出现一次', () => {
    const wrapper = mountStack({
      plates: [plate(1, { is_primary: true }), plate(2), plate(3), plate(4)],
      total: 4,
    });

    const sheets = wrapper.findAll('.plate-stack__sheet');
    expect(sheets).toHaveLength(3);
    /* 牌面是纯视觉层：交互卡（NameplateVoteRow）只在顶层 face 出现一次，牌面自身不带操作条 */
    expect(wrapper.findAll('.row-stub')).toHaveLength(1);
    expect(wrapper.findAll('.plate-stack__sheet .row-stub')).toHaveLength(0);
  });

  it('总数超过展示上限时显示 +N 入口并可点开罐头', async () => {
    const wrapper = mountStack({
      plates: [plate(1, { is_primary: true }), plate(2), plate(3)],
      total: 8,
    });

    const more = wrapper.find('.plate-stack__more');
    expect(more.text()).toContain('+ 5 张铭牌');
    expect(more.text()).toContain('看全部');

    await more.trigger('tap');
    expect(wrapper.emitted('open-can')).toHaveLength(1);
  });
});
