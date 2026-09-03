<template>
  <view class="sandhi-flow">
    <template v-if="pipeline.nodes.length">
      <view class="sandhi-flow__chain">
        <view
          v-for="item in chainItems"
          :key="item.key"
          class="sandhi-flow__chain-item"
          :class="item.arrow ? 'sandhi-flow__arrow' : 'sandhi-flow__step'"
        >
          <text
            v-if="item.arrow"
            class="sandhi-flow__arrow-glyph"
            aria-hidden="true"
          >
            →
          </text>
          <template v-else>
            <text class="sandhi-flow__label">
              {{ item.label }}
            </text>
            <text class="sandhi-flow__value">
              {{ item.value }}
            </text>
          </template>
        </view>
      </view>
      <view
        v-if="pipeline.ipa || pipeline.readingType || pipeline.canonical"
        class="sandhi-flow__meta"
      >
        <text
          v-if="pipeline.ipa"
          class="sandhi-flow__ipa"
        >
          /{{ pipeline.ipa }}/
        </text>
        <text
          v-if="pipeline.readingType"
          class="sandhi-flow__type"
        >
          {{ pipeline.readingType }}
        </text>
        <text
          v-if="pipeline.canonical"
          class="sandhi-flow__canonical"
        >
          认证读音
        </text>
      </view>
    </template>
    <text
      v-else
      class="sandhi-flow__empty"
    >
      未记录读音变化。
    </text>
  </view>
</template>

<script>
import { buildReadingPipeline } from '@/utils/readingSandhi';

export default {
  name: 'ReadingSandhiFlow',
  props: {
    pronunciation: {
      type: Object,
      default: null,
    },
    pronunciationText: {
      type: String,
      default: '',
    },
  },
  computed: {
    pipeline() {
      return buildReadingPipeline(this.pronunciation, this.pronunciationText);
    },
    /* 步骤与箭头扁平交错，供 v-for 直接渲染 */
    chainItems() {
      return this.pipeline.nodes.flatMap((node, index) => {
        const items = [{ ...node, key: `${index}-${node.label}`, arrow: false }];
        if (index < this.pipeline.nodes.length - 1) {
          items.push({ key: `arrow-${index}`, arrow: true });
        }
        return items;
      });
    },
  },
};
</script>

<style scoped>
.sandhi-flow {
  padding: 20rpx 24rpx 24rpx;
}

.sandhi-flow__chain {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  row-gap: 14rpx;
}

.sandhi-flow__chain-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sandhi-flow__step {
  gap: 4rpx;
  padding: 12rpx 22rpx;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.sandhi-flow__arrow {
  justify-content: center;
  padding: 0 14rpx;
}

.sandhi-flow__arrow-glyph {
  color: var(--accent-color);
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1;
}

.sandhi-flow__label {
  color: var(--muted-color);
  font-size: 19rpx;
  letter-spacing: 2rpx;
}

.sandhi-flow__value {
  color: var(--text-color);
  font-size: 34rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.sandhi-flow__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.sandhi-flow__ipa {
  padding: 4rpx 14rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
  color: var(--text-secondary-color);
  font-size: 22rpx;
}

.sandhi-flow__type {
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 800;
}

.sandhi-flow__canonical {
  padding: 4rpx 14rpx;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  color: var(--surface-color);
  font-size: 19rpx;
  font-weight: 800;
}

.sandhi-flow__empty {
  color: var(--muted-color);
  font-size: 23rpx;
}
</style>
