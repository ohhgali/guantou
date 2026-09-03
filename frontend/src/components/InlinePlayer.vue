<template>
  <view
    class="inline-player"
    :class="{ 'inline-player--playing': playing }"
  >
    <button
      class="inline-player__toggle"
      :aria-label="playing ? '暂停播放' : '播放录音'"
      :disabled="!src"
      @tap.stop="toggle"
    >
      <view
        v-if="playing"
        class="inline-player__pause"
        aria-hidden="true"
      >
        <view class="inline-player__pause-bar" />
        <view class="inline-player__pause-bar" />
      </view>
      <view
        v-else
        class="inline-player__triangle"
        aria-hidden="true"
      />
    </button>

    <view class="inline-player__body">
      <view class="inline-player__title">
        {{ src ? titleText : '暂无可播放录音' }}
      </view>
      <view
        v-if="src"
        class="inline-player__time"
      >
        {{ formatSeconds(progressSeconds) }}
      </view>
      <view
        v-if="src"
        class="inline-player__track"
        aria-hidden="true"
      >
        <view
          class="inline-player__progress"
          :style="{ width: `${Math.round(progress * 100)}%` }"
        />
      </view>
    </view>
  </view>
</template>

<script>
import {
  onExternalStop,
  playManaged,
  stopAudio,
} from '@/utils/audio';

export default {
  name: 'InlinePlayer',
  props: {
    src: {
      type: String,
      default: '',
    },
    /* 静止态标题文案，如「播放这张铭牌所解释的乡音」 */
    label: {
      type: String,
      default: '播放所属录音',
    },
  },
  data() {
    return {
      playing: false,
      progress: 0,
      progressSeconds: 0,
    };
  },
  computed: {
    titleText() {
      return this.playing ? '正在播放' : this.label;
    },
  },
  watch: {
    src() {
      this.stopPlayback();
    },
  },
  created() {
    /* 播放句柄不进 data：需与外部停止广播携带的句柄做全等比较 */
    this.playbackHandle = null;
  },
  mounted() {
    this.unsubscribeExternalStop = onExternalStop(this.resetPlaybackState);
  },
  beforeUnmount() {
    this.stopPlayback();
    if (this.unsubscribeExternalStop) {
      this.unsubscribeExternalStop();
      this.unsubscribeExternalStop = null;
    }
  },
  methods: {
    resetPlaybackState(stoppedHandle) {
      if (stoppedHandle && stoppedHandle !== this.playbackHandle) return;
      this.playbackHandle = null;
      this.playing = false;
      this.progress = 0;
      this.progressSeconds = 0;
    },
    formatSeconds(seconds) {
      return `${Math.max(0, Math.floor(seconds))}″`;
    },
    toggle() {
      if (!this.src) return;
      if (this.playing) {
        this.stopPlayback();
        return;
      }
      this.progress = 0;
      this.progressSeconds = 0;
      this.playing = true;
      this.playbackHandle = playManaged(this.src, {
        onTimeUpdate: ({ currentTime, duration }) => {
          this.progressSeconds = currentTime;
          if (duration > 0) {
            this.progress = Math.min(1, currentTime / duration);
          }
        },
        onEnded: () => {
          this.resetPlaybackState();
        },
        onError: () => {
          this.resetPlaybackState();
          uni.showToast({ title: '播放失败', icon: 'none' });
        },
      });
    },
    stopPlayback() {
      if (this.playing) stopAudio();
      this.resetPlaybackState();
    },
  },
};
</script>

<style scoped>
.inline-player {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.inline-player--playing {
  border-color: var(--accent-color);
}

.inline-player__toggle {
  flex: 0 0 auto;
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 1rpx solid var(--border-color);
  background: var(--surface-subtle-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.inline-player__toggle::after {
  border: 0;
}

.inline-player__toggle:active {
  transform: scale(0.92);
}

.inline-player__triangle {
  width: 0;
  height: 0;
  margin-left: 6rpx;
  border-left: 22rpx solid var(--accent-color);
  border-top: 13rpx solid transparent;
  border-bottom: 13rpx solid transparent;
}

.inline-player__pause {
  display: flex;
  gap: 8rpx;
}

.inline-player__pause-bar {
  width: 7rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: var(--accent-color);
}

.inline-player__body {
  min-width: 0;
  flex: 1;
}

.inline-player__title {
  color: var(--text-color);
  font-size: 25rpx;
  font-weight: 800;
}

.inline-player__time {
  margin-top: 4rpx;
  color: var(--accent-color);
  font-size: 19rpx;
  font-weight: 700;
}

.inline-player__track {
  margin-top: 10rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: var(--border-color);
  overflow: hidden;
}

.inline-player__progress {
  height: 100%;
  border-radius: 999rpx;
  background: var(--accent-color);
  transition: width 0.2s linear;
}
</style>
