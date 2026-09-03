const READING_TYPE_LABELS = {
  general: '通用',
  literary: '文读',
  colloquial: '白读',
  other: '其他',
};

/**
 * 读音类型显示名：general/literary/colloquial/other → 通用/文读/白读/其他。
 */
export function readingTypeLabel(type) {
  return READING_TYPE_LABELS[type] || '';
}

/**
 * 把铭牌的读音数据整理成「连读变调 前→后」展示流水线。
 *
 * 铭牌读音本质是“几个字组词后的读音变化”：数据里只有一对
 * base_romanization（变调前）→ surface_romanization（变调后）。
 * - 两者都齐且不同 → 两节点箭头；
 * - 只有其一 / 退化相同 → 单节点，避免「同一发音 → 同一发音」的荒诞展示；
 * - pronunciation_text 仅在缺 base/surface 时兜底展示。
 * @returns {object} 含 nodes/ipa/readingType/canonical 的展示结构
 */
export function buildReadingPipeline(pronunciation, pronunciationText) {
  const pron = pronunciation || {};
  const base = String(pron.base_romanization || '').trim();
  const surface = String(pron.surface_romanization || '').trim();
  const raw = String(pronunciationText || '').trim();

  const nodes = [];
  if (base && surface && base !== surface) {
    nodes.push({ label: '变调前', value: base });
    nodes.push({ label: '变调后', value: surface });
  } else if (surface) {
    nodes.push({ label: raw ? '原样读音' : '读音', value: surface });
  } else if (base) {
    nodes.push({ label: raw ? '原样读音' : '读音', value: base });
  } else if (raw) {
    nodes.push({ label: '原样读音', value: raw });
  }

  return {
    nodes,
    ipa: String(pron.ipa || '').trim(),
    readingType: readingTypeLabel(pron.reading_type),
    canonical: Boolean(pron.is_canonical),
  };
}

export default {
  buildReadingPipeline,
  readingTypeLabel,
};
