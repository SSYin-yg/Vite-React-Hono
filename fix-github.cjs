const { execSync } = require('child_process');
const repo = 'SSYin-yg/Vite-React-Hono';
const lrm = '‪'; // 实际由下方 char 构造，这里仅占位
const files = ['i18n.ts','EquipmentList.tsx','Inquiries.tsx','SiteSettings.tsx'];
const LRM = String.fromCharCode(0x200E);
for (const f of files) {
  const oldP = `apps/web/src/admin/${LRM}${f}`;
  const newP = `apps/web/src/admin/${f}`;
  const get = execSync(`gh api "repos/${repo}/contents/${oldP}"`, {encoding:'utf8'});
  const obj = JSON.parse(get);
  const b64 = obj.content.replace(/\s/g,'');
  execSync(`gh api -X PUT "repos/${repo}/contents/${newP}" -f message="fix(filename): ${f}" -f content=${b64} -f branch=main`, {stdio:'inherit'});
  execSync(`gh api -X DELETE "repos/${repo}/contents/${oldP}" -f message="remove LRM: ${f}" -f sha=${obj.sha} -f branch=main`, {stdio:'inherit'});
  console.log('done', f);
}
