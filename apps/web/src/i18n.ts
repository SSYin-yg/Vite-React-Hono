import dict from './i18n-dict.json';

export type Lang = 'zh' | 'en';

const DICT = dict as { zh: Record<string, string>; en: Record<string, string> };

/** 按 i18n 键取当前语言文案；键缺失时回退中文，再回退键名本身 */
export function tr(lang: Lang, key: string): string {
  return DICT[lang][key] ?? DICT.zh[key] ?? key;
}

/** 首页轮播等页面使用的生产头图（已迁至 R2：/api/images/global/<file>） */
export const HERO_IMAGES = {
  home1: '/api/images/global/1788670622_899fd2_f0595f56df.jpg',
  home2: '/api/images/global/1788670622_e2fbce_2194f69fb0.jpg',
  home3: '/api/images/global/1788670622_be892b_c476041743.jpg',
  side: '/api/images/global/1788670622_899fd2_f0595f56df.jpg',
};
