<template>
  <PageShell
    title="铭牌详情"
    :scroll-locked="sheetActive"
  >
    <!-- 评论半屏面板宿主：面板激活时锁定整页滚动 -->
    <CommentSheet @active-change="onSheetActiveChange" />
    <view
      v-if="nameplate"
      class="nameplate-page"
    >
      <view class="nameplate-hero">
        <view class="nameplate-hero__kicker">
          {{ nameplate.is_primary ? '主铭牌' : '社区铭牌' }} · {{ dialectText }}
          <text
            v-if="evidencePill"
            class="nameplate-hero__evidence"
          >
            {{ evidencePill }}
          </text>
        </view>
        <view class="nameplate-hero__writing">
          {{ nameplate.display_text }}
        </view>
        <view class="nameplate-hero__definition">
          {{ nameplate.definition || '这张铭牌还没有补充释义。' }}
        </view>

        <!-- 归属当前铭牌的两个操作：支持 / 评论；「立论」另置于依据区 -->
        <view class="nameplate-hero__actions">
          <BaseButton
            class="support-action"
            :text="`${supported ? '已支持' : '支持'} ${supportCount}`"
            :loading="supportBusy"
            @click="toggleSupport"
          />
          <BaseButton
            class="comments-action"
            variant="light"
            :text="`评论 ${nameplate.comment_count || 0}`"
            @click="openComments"
          />
        </view>
      </view>

      <!-- 读音记录：把“组词后读音变化”用 变调前 → 变调后 箭头流可视化 -->
      <view class="nameplate-sheet">
        <view class="nameplate-sheet__title">
          读音变化
        </view>
        <ReadingSandhiFlow
          :pronunciation="nameplate.pronunciation || null"
          :pronunciation-text="nameplate.pronunciation_text || ''"
        />
      </view>

      <!-- 所属录音：铭牌页内联播放，不必跳到罐头详情 -->
      <view class="nameplate-sheet">
        <view class="nameplate-sheet__title">
          所属录音
        </view>
        <InlinePlayer
          v-if="canAudioUrl"
          :src="canAudioUrl"
          label="播放这张铭牌所解释的乡音"
        />
        <view
          v-else
          class="nameplate-sheet__note"
        >
          这段铭牌尚未关联可播放的录音。
        </view>
        <view
          v-if="nameplate.can"
          class="can-link"
          @tap="openCan"
        >
          <view class="can-link__value">
            查看录音罐头详情 ›
          </view>
        </view>
      </view>

      <!-- 立论依据：叙述式来源卡 + 独立的「立论」动作（提竞争铭牌，≠支持当前铭牌） -->
      <view class="nameplate-sheet">
        <view class="nameplate-sheet__title">
          立论依据
        </view>
        <view class="evidence">
          <text class="evidence__lead">
            {{ evidenceLead }}
          </text>
          <text
            v-if="sourceTitle"
            class="evidence__source"
          >
            《{{ sourceTitle }}》
          </text>
          <text
            v-if="nameplate.source?.note"
            class="evidence__note"
          >
            {{ nameplate.source.note }}
          </text>
        </view>
        <view class="evidence__cta">
          <text class="evidence__cta-copy">
            不同意这张铭牌的写法或读音？立论是提出一张有依据的竞争铭牌，不修改当前铭牌。
          </text>
          <BaseButton
            class="debate-action"
            variant="danger-ghost"
            text="立论"
            @click="openDebate"
          />
        </view>
      </view>
    </view>
    <BaseLoading
      v-else
      text="正在取出铭牌"
    />
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import CommentSheet from '@/components/CommentSheet.vue';
import InlinePlayer from '@/components/InlinePlayer.vue';
import PageShell from '@/components/PageShell.vue';
import ReadingSandhiFlow from '@/components/ReadingSandhiFlow.vue';
import { getNameplate, supportNameplate, unsupportNameplate } from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';
import {
  closeCommentSheet,
  isCommentSheetActive,
  openCommentSheet,
} from '@/services/commentSheet';
import { goCanDetail, goCreateNameplate } from '@/services/navigation';

const SOURCE_LABELS = {
  creator: '创作者自述',
  oral: '口述',
  fieldwork: '田野记录',
  book: '书籍',
  article: '论文 / 文章',
  archive: '档案',
  web: '网页',
  other: '其他',
};
const EVIDENCE_LABELS = {
  1: '本人记忆', 2: '社区公认', 3: '文献考据', 4: '官方认证',
};

export default {
  components: {
    BaseButton,
    BaseLoading,
    CommentSheet,
    InlinePlayer,
    PageShell,
    ReadingSandhiFlow,
  },
  data() {
    return {
      id: null,
      nameplate: null,
      supported: false,
      supportCount: 0,
      supportBusy: false,
      resumeAction: '',
      sheetActive: false,
      sheetOpenedOnce: false,
    };
  },
  computed: {
    dialectText() {
      return this.nameplate?.dialect?.name || '方言点待补';
    },
    evidencePill() {
      const level = this.nameplate?.evidence_level;
      return EVIDENCE_LABELS[level] || '';
    },
    evidenceText() {
      return EVIDENCE_LABELS[this.nameplate?.evidence_level] || '未说明';
    },
    evidenceLead() {
      const source = this.sourceTypeText ? `，来源为 ${this.sourceTypeText}` : '';
      return `这张铭牌由「${this.evidenceText}」立论${source}。`;
    },
    sourceTypeText() {
      const type = this.nameplate?.source_type || this.nameplate?.source?.type || 'other';
      return SOURCE_LABELS[type] || SOURCE_LABELS.other;
    },
    sourceTitle() {
      const source = this.nameplate?.source || {};
      return source.title || source.attributed_to || '';
    },
    canAudioUrl() {
      return this.nameplate?.can?.audio_url || '';
    },
  },
  onLoad(options) {
    this.id = Number(options.id);
    this.resumeAction = options.resume || '';
    this.load();
  },
  onHide() {
    // 评论面板不随页面保留：离开即收起。
    closeCommentSheet();
  },
  onBackPress() {
    // 面板打开时返回键先关闭面板而非退出页面。
    if (isCommentSheetActive()) {
      closeCommentSheet();
      return true;
    }
    return false;
  },
  methods: {
    async load() {
      this.nameplate = await getNameplate(this.id);
      this.supported = Boolean(this.nameplate.supported_by_current_user);
      this.supportCount = Number(this.nameplate.support_count || 0);
      if (this.resumeAction === 'support' && !this.supported) {
        this.resumeAction = '';
        await this.toggleSupport();
      }
    },
    async toggleSupport() {
      if (!this.supported && !requireAuth('nameplate_support', {
        nameplateId: this.id,
        canId: this.nameplate.can?.id,
      })) return;
      if (this.supportBusy) return;
      this.supportBusy = true;
      try {
        const result = this.supported
          ? await unsupportNameplate(this.id)
          : await supportNameplate(this.id);
        this.supported = Boolean(result.supported_by_current_user);
        this.supportCount = Number(result.support_count || 0);
      } finally {
        this.supportBusy = false;
      }
    },
    openComments() {
      // 本页评论只讨论这张铭牌：单目标半屏面板（无 scopes 切换条）
      openCommentSheet({
        targetType: 'nameplate',
        targetId: this.id,
        theme: 'default',
      });
    },
    onSheetActiveChange(active) {
      this.sheetActive = active;
      if (active) {
        this.sheetOpenedOnce = true;
      } else if (this.sheetOpenedOnce) {
        this.sheetOpenedOnce = false;
        this.load();
      }
    },
    openDebate() {
      // “立论” = 提出一张有依据的竞争铭牌主张，不代表修订或取代当前铭牌。
      if (!requireAuth('nameplate_create', {
        nameplateId: this.id,
        canId: this.nameplate.can?.id,
      })) return;
      goCreateNameplate(this.nameplate.can.id, this.id);
    },
    openCan() {
      goCanDetail(this.nameplate.can.id);
    },
  },
};
</script>

<style scoped>
.nameplate-page { padding-bottom: 60rpx; }
.nameplate-hero {
  position: relative;
  padding: 44rpx 34rpx 34rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  background: var(--surface-color);
  box-shadow: 0 18rpx 48rpx var(--border-color);
}
.nameplate-hero::after {
  content: '铭牌';
  position: absolute;
  right: 28rpx;
  top: 28rpx;
  padding: 8rpx;
  border: 2rpx solid var(--danger-color);
  color: var(--danger-color);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 4rpx;
  transform: rotate(4deg);
}
.nameplate-hero__kicker {
  color: var(--accent-color);
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}
.nameplate-hero__evidence {
  margin-left: 12rpx;
  padding: 2rpx 12rpx;
  border: 1rpx solid var(--accent-color);
  border-radius: var(--radius-pill);
  color: var(--accent-color);
  font-size: 18rpx;
  letter-spacing: 1rpx;
}
.nameplate-hero__writing {
  margin-top: 18rpx;
  color: var(--text-color);
  font-family: STKaiti, KaiTi, serif;
  font-size: 76rpx;
  font-weight: 900;
  line-height: 1.2;
}
.nameplate-hero__definition {
  margin-top: 24rpx;
  color: var(--text-secondary-color);
  font-size: 28rpx;
  line-height: 1.7;
}
.nameplate-hero__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-top: 30rpx;
}
.nameplate-sheet {
  margin-top: 24rpx;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}
.nameplate-sheet__title {
  padding: 22rpx 26rpx 6rpx;
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}
.nameplate-sheet__note {
  padding: 20rpx 26rpx 24rpx;
  color: var(--muted-text-color);
  font-size: 24rpx;
  line-height: 1.6;
}

/* ---------- 立论依据（叙述式） ---------- */
.evidence {
  padding: 14rpx 26rpx 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.evidence__lead {
  color: var(--text-color);
  font-size: 26rpx;
  line-height: 1.7;
}
.evidence__source {
  align-self: flex-start;
  padding: 4rpx 16rpx;
  border-radius: var(--radius-sm);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: 23rpx;
}
.evidence__note {
  color: var(--muted-text-color);
  font-size: 23rpx;
  line-height: 1.6;
}
.evidence__cta {
  margin-top: 16rpx;
  padding: 22rpx 26rpx;
  border-top: 1rpx solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.evidence__cta-copy {
  min-width: 0;
  flex: 1;
  color: var(--muted-text-color);
  font-size: 21rpx;
  line-height: 1.5;
}
.debate-action {
  flex: 0 0 auto;
  margin: 0;
}

/* ---------- 所属录音 ---------- */
.can-link {
  padding: 4rpx 26rpx 22rpx;
  display: flex;
  align-items: center;
}
.can-link__value {
  color: var(--accent-color);
  font-size: 24rpx;
  font-weight: 800;
}
</style>
