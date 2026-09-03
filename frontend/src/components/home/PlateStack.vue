<template>
  <view class="plate-stack">
    <view
      v-if="!plates.length"
      class="plate-stack__empty"
    >
      这段乡音还没有铭牌。
    </view>

    <!-- 主铭牌在左下角；副铭牌作为整张同尺寸牌面绝对定位在主铭牌上，
         向右上角逐张偏移露出边角，形成扇形牌叠观感（纯视觉，不可点按）。
         deck 顶部按层数预留上升空间，露角不溢出到上方播放区 -->
    <view
      v-else
      class="plate-stack__deck"
      :style="{ paddingTop: `${topPad}rpx` }"
    >
      <view class="plate-stack__stage">
        <view
          v-for="(plate, index) in plates.slice(1)"
          :key="plate.id"
          class="plate-stack__sheet"
          :class="`plate-stack__sheet--${index + 1}`"
          aria-hidden="true"
        />
        <view class="plate-stack__face">
          <NameplateVoteRow
            :nameplate="plates[0]"
            :can-id="canId"
            suppress-detail-tap
            @body-tap="$emit('open-can')"
          />
        </view>
      </view>
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
    /* 副牌向右上每层升 14rpx，deck 顶部预留同样高度，露角不溢出到播放区 */
    topPad() {
      return Math.max(0, this.plates.length - 1) * 14;
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

/* 牌叠底盒：顶部按层数预留上升空间（inline paddingTop），内层舞台承载牌面 */
.plate-stack__deck {
  box-sizing: border-box;
}

/* 内层舞台：高度由在流的顶层主铭牌决定，副铭牌在此坐标系内向右上偏移 */
.plate-stack__stage {
  position: relative;
}

/* 副铭牌牌面：与主铭牌同尺寸同圆角，绝对定位在主铭牌上向右上偏移露角 */
.plate-stack__sheet {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-lg);
  background: linear-gradient(
    180deg,
    var(--immersive-surface-color),
    var(--immersive-surface-strong-color)
  );
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.18);
  opacity: 0.9;
  pointer-events: none;
}

/* 第 k 张副牌向右上偏移 k 步（右 +12rpx、上 -14rpx/层），露出上缘与右缘 */
.plate-stack__sheet--1 {
  transform: translate(12rpx, -14rpx);
}

.plate-stack__sheet--2 {
  transform: translate(24rpx, -28rpx);
}

.plate-stack__sheet--3 {
  transform: translate(36rpx, -42rpx);
}

.plate-stack__sheet--4 {
  transform: translate(48rpx, -56rpx);
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
