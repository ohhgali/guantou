<template>
  <view class="plate-stack">
    <view
      v-if="!plates.length"
      class="plate-stack__empty"
    >
      这段乡音还没有铭牌。
    </view>

    <!-- 顶层主铭牌：可交互（支持/评论/立论），body 点按上抛 open-can 进罐头详情 -->
    <view
      v-else
      class="plate-stack__face"
    >
      <NameplateVoteRow
        :nameplate="plates[0]"
        :can-id="canId"
        suppress-detail-tap
        @body-tap="$emit('open-can')"
      />
    </view>

    <!-- 底层副铭牌：纯视觉层叠厚度（至多 5 张 → 4 层），不可点按，只承载“多张”的纵深观感。
         真实内容进罐头详情查看。 -->
    <view
      v-if="plates.length > 1"
      class="plate-stack__pad"
      aria-hidden="true"
    >
      <view
        v-for="(plate, index) in plates.slice(1)"
        :key="plate.id"
        class="plate-stack__edge"
        :class="`plate-stack__edge--${index + 1}`"
      />
    </view>

    <!-- 超过 5 张（后端已封顶预览）的剩余计数入口 -->
    <view
      v-if="extraCount > 0"
      class="plate-stack__more"
      role="button"
      aria-label="查看全部铭牌"
      @tap.stop="$emit('open-can')"
    >
      + {{ extraCount }} 张铭牌 · 看全部 ›
    </view>
  </view>
</template>

<script>
import NameplateVoteRow from '@/components/home/NameplateVoteRow.vue';

export default {
  name: 'PlateStack',
  components: { NameplateVoteRow },
  props: {
    /* 已按 主铭牌优先 排序、长度 ≤5 */
    plates: {
      type: Array,
      default: () => [],
    },
    /* 罐头铭牌总数（用于超过展示上限时的 +N） */
    total: {
      type: Number,
      default: 0,
    },
    canId: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['open-can'],
  computed: {
    extraCount() {
      return Math.max(0, Number(this.total || 0) - this.plates.length);
    },
  },
};
</script>

<style scoped>
.plate-stack {
  position: relative;
}

.plate-stack__empty {
  padding: 20rpx 22rpx;
  border-radius: var(--radius-md);
  border: 1rpx dashed var(--immersive-border-color);
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-xs);
  text-align: center;
}

.plate-stack__face {
  position: relative;
  z-index: 2;
}

/* 副铭牌厚度带：多行叠在顶层卡下方（负 margin 上收入卡底），逐层内收模拟纸牌纵深 */
.plate-stack__pad {
  position: relative;
  z-index: 1;
  margin: -6rpx 0 0;
  padding: 0;
}

.plate-stack__edge {
  height: 14rpx;
  margin: -2rpx auto 0;
  border: 1rpx solid var(--immersive-border-color);
  border-top: none;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  background: linear-gradient(
    180deg,
    var(--immersive-surface-color),
    var(--immersive-surface-strong-color)
  );
}

.plate-stack__edge--1 {
  width: calc(100% - 10rpx);
}

.plate-stack__edge--2 {
  width: calc(100% - 22rpx);
}

.plate-stack__edge--3 {
  width: calc(100% - 34rpx);
}

.plate-stack__edge--4 {
  width: calc(100% - 46rpx);
}

.plate-stack__more {
  margin-top: 14rpx;
  padding: 10rpx 22rpx;
  border-radius: var(--radius-pill);
  color: var(--immersive-accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 1rpx;
  background: var(--immersive-surface-color);
  border: 1rpx solid var(--immersive-border-color);
  text-align: center;
}
</style>
