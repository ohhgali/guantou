import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ReadingSandhiFlow from '@/components/ReadingSandhiFlow.vue';
import {
  buildReadingPipeline,
  readingTypeLabel,
} from '@/utils/readingSandhi';

describe('readingSandhi 工具（连读变调 前→后 管道）', () => {
  it('readingTypeLabel 映射文/白/通/其他', () => {
    expect(readingTypeLabel('general')).toBe('通用');
    expect(readingTypeLabel('literary')).toBe('文读');
    expect(readingTypeLabel('colloquial')).toBe('白读');
    expect(readingTypeLabel('other')).toBe('其他');
    expect(readingTypeLabel('bogus')).toBe('');
  });

  it('base≠surface 时产出两节点箭头并带 IPA/类型/认证信息', () => {
    const pipeline = buildReadingPipeline({
      base_romanization: 'ba5',
      surface_romanization: 'bai5',
      ipa: 'pa˧',
      reading_type: 'general',
      is_canonical: true,
    }, '巴适');

    expect(pipeline.nodes).toEqual([
      { label: '变调前', value: 'ba5' },
      { label: '变调后', value: 'bai5' },
    ]);
    expect(pipeline.ipa).toBe('pa˧');
    expect(pipeline.readingType).toBe('通用');
    expect(pipeline.canonical).toBe(true);
  });

  it('base==surface 或只有单值 → 退化为单节点，不出现“同一→同一”', () => {
    expect(buildReadingPipeline(
      { base_romanization: 'ba5', surface_romanization: 'ba5' },
      '巴适',
    ).nodes).toEqual([{ label: '原样读音', value: 'ba5' }]);

    expect(buildReadingPipeline(
      { surface_romanization: 'bai5' },
      '巴适',
    ).nodes).toEqual([{ label: '原样读音', value: 'bai5' }]);
  });

  it('缺 base/surface 时用原样读音兜底；全空则空流水线', () => {
    expect(buildReadingPipeline({}, '巴适').nodes).toEqual([
      { label: '原样读音', value: '巴适' },
    ]);
    expect(buildReadingPipeline({}, '').nodes).toEqual([]);
  });
});

describe('ReadingSandhiFlow 渲染', () => {
  it('全量渲染 变调前→变调后 箭头流与元信息', () => {
    const wrapper = mount(ReadingSandhiFlow, {
      props: {
        pronunciation: {
          base_romanization: 'ba5',
          surface_romanization: 'bai5',
          ipa: 'pa˧',
          reading_type: 'colloquial',
          is_canonical: false,
        },
        pronunciationText: '巴适',
      },
    });

    expect(wrapper.text()).toContain('变调前');
    expect(wrapper.text()).toContain('ba5');
    expect(wrapper.text()).toContain('bai5');
    expect(wrapper.find('.sandhi-flow__arrow-glyph').exists()).toBe(true);
    expect(wrapper.text()).toContain('白读');
    expect(wrapper.find('.sandhi-flow__canonical').exists()).toBe(false);

    wrapper.unmount();
  });

  it('无任何读音数据时显示占位文案', () => {
    const wrapper = mount(ReadingSandhiFlow, {
      props: { pronunciation: null, pronunciationText: '' },
    });

    expect(wrapper.text()).toContain('未记录读音变化');
    expect(wrapper.find('.sandhi-flow__chain').exists()).toBe(false);

    wrapper.unmount();
  });
});
