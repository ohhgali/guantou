import { goCanComments, goNameplateComments, goNotFound } from '@/services/navigation';

/*
 * CommentSheet 宿主注册（页面栈多宿主契约，最后注册者胜）：
 * - uni-app 页面栈上层页面常驻挂载，进入新页面时其自挂 host 注册为栈顶，
 *   离开时（onUnload）注销回退上一层宿主 —— activeHost() 取最后注册者即可
 *   命中「当前可见页面」的面板；
 * - 首页沉浸流、罐头详情页、铭牌详情页各挂一个 CommentSheet，互不冲突。
 */
const hosts = [];

export function registerCommentSheetHost(host) {
  if (!host || hosts.includes(host)) return;
  hosts.push(host);
}

export function unregisterCommentSheetHost(host) {
  const index = hosts.indexOf(host);
  if (index >= 0) hosts.splice(index, 1);
}

function activeHost() {
  return hosts[hosts.length - 1] || null;
}

/**
 * 打开半屏评论区（见 #219）。targetType: 'can' | 'nameplate'；
 * theme: 'immersive'（首页沉浸流深色）| 'default'（常规 Token）。
 * scopes：面板内可切换的讨论对象数组（每项 { type, id, label, count }，
 * 如罐头详情 = 录音 + 各张铭牌）；不传时按单目标渲染（旧行为）。
 * 尚未挂载 CommentSheet 时按初始目标退回整页跳转，保证旧页面不回归。
 */
export function openCommentSheet({
  targetType,
  targetId,
  theme = 'default',
  scopes = null,
} = {}) {
  const host = activeHost();
  if (host && typeof host.open === 'function') {
    host.open({
      targetType, targetId, theme, scopes,
    });
    return;
  }
  if (targetType === 'nameplate') {
    goNameplateComments(targetId);
    return;
  }
  if (targetType === 'can') {
    goCanComments(targetId);
    return;
  }
  // 未知目标类型（含 undefined）提前失败，避免带空/错误 id 跳转（#257）。
  goNotFound();
}

export function closeCommentSheet() {
  const host = activeHost();
  if (host && typeof host.close === 'function') host.close();
}

/** 面板当前是否激活；供返回键拦截等场景判断是否先关闭面板（#255）。 */
export function isCommentSheetActive() {
  const host = activeHost();
  return Boolean(host && typeof host.isActive === 'function' && host.isActive());
}

export default {
  closeCommentSheet,
  isCommentSheetActive,
  openCommentSheet,
  registerCommentSheetHost,
  unregisterCommentSheetHost,
};
