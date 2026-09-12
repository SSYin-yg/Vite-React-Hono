/** 动态写入 <head> 里的 meta 标签（详情页/列表页 SEO 用） */

function upsertMeta(name: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function setMetaDescription(content: string) {
  upsertMeta('description', content);
}

export function setMetaKeywords(content: string) {
  upsertMeta('keywords', content);
}
