import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from './context';
import { ErrorBox } from './ui';
import {
  getAdminEquipment,
  createEquipment,
  updateEquipment,
  authFetch,
  type AdminEquipmentDetail,
  type EquipmentInput,
  type IntroBlock,
  type ModelTable,
  type SpecItem,
} from '../api';
import { IntroEditor, ModelTablesEditor, SpecsEditor } from './EquipmentEditors';

const emptyForm = (): EquipmentInput => ({
  id: '',
  name_cn: '',
  name_en: '',
  category: 'crushing',
  images: [],
  desc_zh: '',
  desc_en: '',
  features_zh: [],
  features_en: [],
  specs: [],
  model_tables: [],
  intro: [],
  published: true,
  seo_title_zh: '',
  seo_title_en: '',
  seo_desc_zh: '',
  seo_desc_en: '',
  seo_keywords: '',
});

// 后端把 images/features 存成 JSON 字符串；解析失败则按行拆分兜底
const parseArr = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return s.split('\n').map((x) => x.trim()).filter(Boolean);
  }
};

const parseObj = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

const toLines = (arr: string[]) => arr.join('\n');
const fromLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * 高级 JSON 兜底编辑器：草稿本地保存，点「应用」才校验并回写。
 * （不做实时 parse —— 输入过程中 JSON 必然短暂非法，实时覆盖会吃掉用户输入）
 */
function JsonField({
  label,
  value,
  onApply,
}: {
  label: string;
  value: unknown;
  onApply: (v: unknown) => void;
}) {
  const { t } = useAdmin();
  const [draft, setDraft] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [err, setErr] = useState<string | null>(null);

  // 外部值变化（切换设备 / 可视化编辑器改动）时同步草稿
  useEffect(() => {
    setDraft(JSON.stringify(value ?? [], null, 2));
    setErr(null);
  }, [value]);

  const apply = () => {
    try {
      onApply(JSON.parse(draft));
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <label>
      {label}
      <textarea
        value={draft}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        style={err ? { borderColor: 'var(--adm-danger)' } : undefined}
      />
      <span className="adm-ed-json-actions">
        <button type="button" className="admin-btn admin-btn-sm" onClick={apply}>
          {t('equipment.ed.apply_json')}
        </button>
        {err && <small className="adm-ed-json-err">{err}</small>}
      </span>
    </label>
  );
}

export default function EquipmentForm() {
  const { t, base } = useAdmin();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<EquipmentInput>(emptyForm());
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAdminEquipment(id)
      .then((d: AdminEquipmentDetail | null) => {
        if (!d) return;
        setForm({
          id: d.id,
          name_cn: d.name_cn,
          name_en: d.name_en,
          category: d.category,
          images: parseArr(d.images),
          desc_zh: d.desc_cn,
          desc_en: d.desc_en,
          features_zh: parseArr(d.features_cn),
          features_en: parseArr(d.features_en),
          specs: parseObj<SpecItem[]>(d.specs, []),
          model_tables: parseObj<ModelTable[]>(d.model_tables, []),
          intro: parseObj<IntroBlock[]>(d.intro, []),
          published: !!d.published,
          seo_title_zh: d.seo_title_cn ?? '',
          seo_title_en: d.seo_title_en ?? '',
          seo_desc_zh: d.seo_desc_cn ?? '',
          seo_desc_en: d.seo_desc_en ?? '',
          seo_keywords: d.seo_keywords ?? '',
        });
      })
      .catch((e) => setErr(String(e)));
  }, [id]);

  const set = (patch: Partial<EquipmentInput>) => setForm((f) => ({ ...f, ...patch }));

  // 上传图片到 R2（POST /api/admin/images），把返回的 /api/images/<key> 追加到列表
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选择同一文件
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch('/api/admin/images', { method: 'POST', body: fd });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!data?.ok) throw new Error(data?.error ?? 'upload failed');
      const url = String(data.url ?? '');
      const rel = url.startsWith('/') ? url.slice(1) : url; // 去前导斜杠，匹配前端 src={`/${src}`}
      set({ images: [...form.images, rel] });
    } catch (err) {
      setErr(String(err));
    }
  };

  const persist = async (): Promise<boolean> => {
    if (!form.id.trim()) { setErr(t('equipment.fields.slug') + ' ' + t('login.err_required')); return false; }
    setSaving(true); setErr(null);
    try {
      if (id) await updateEquipment(id, form);
      else await createEquipment(form);
      return true;
    } catch (e) {
      setErr(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await persist()) navigate(`${base}/equipment`);
  };

  const saveAndView = async () => {
    if (await persist()) window.open(`/equipment/${form.id}`, '_blank');
  };

  const f = (k: string) => t(`equipment.fields.${k}`);

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="inq-head">
        <h2 style={{ margin: 0 }}>{id ? t('equipment.edit') : t('equipment.add')}</h2>
      </div>

      {err && <ErrorBox>{err}</ErrorBox>}

      <fieldset className="admin-fieldset">
        <legend>{t('equipment.group_basic')}</legend>
        <label>{f('slug')}
          <input value={form.id} onChange={(e) => set({ id: e.target.value })} disabled={!!id} />
        </label>
        <div className="admin-form-grid">
          <label>{f('name')} (CN)
            <input value={form.name_cn} onChange={(e) => set({ name_cn: e.target.value })} />
          </label>
          <label>{f('name')} (EN)
            <input value={form.name_en} onChange={(e) => set({ name_en: e.target.value })} />
          </label>
        </div>
        <label>{f('category')}
          <input value={form.category} onChange={(e) => set({ category: e.target.value })} />
        </label>
        <label className="admin-check">
          <input type="checkbox" checked={form.published} onChange={(e) => set({ published: e.target.checked })} />
          <span>{f('published')}</span>
        </label>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>{t('equipment.group_content')}</legend>
        <div className="admin-upload">
          <input type="file" accept="image/*" onChange={onUpload} disabled={saving} />
          <small style={{ display: 'block', margin: '4px 0 8px', color: '#667' }}>
            上传到 R2（返回 /api/images/...），自动追加到列表
          </small>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 10, margin: 0 }}>
            {form.images.map((src, i) => (
              <li key={src + i} style={{ position: 'relative', width: 120 }}>
                <img
                  src={`/${src}`}
                  alt=""
                  style={{ width: 120, height: 80, objectFit: 'cover', border: '1px solid #ddd', borderRadius: 6 }}
                />
                <button
                  type="button"
                  onClick={() => set({ images: form.images.filter((_, j) => j !== i) })}
                  style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer' }}
                  aria-label="remove"
                >
                  ×
                </button>
                <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{src}</code>
              </li>
            ))}
          </ul>
        </div>
        <label style={{ display: 'block', marginTop: 8 }}>{f('image')}（手动填写 / 每行一个）
          <textarea value={toLines(form.images)} onChange={(e) => set({ images: fromLines(e.target.value) })} />
        </label>
        <div className="admin-form-grid">
          <label>{f('summary')} (CN)
            <textarea value={form.desc_zh} onChange={(e) => set({ desc_zh: e.target.value })} />
          </label>
          <label>{f('summary')} (EN)
            <textarea value={form.desc_en} onChange={(e) => set({ desc_en: e.target.value })} />
          </label>
          <label>{f('features')} (CN, 一行一条)
            <textarea value={toLines(form.features_zh)} onChange={(e) => set({ features_zh: fromLines(e.target.value) })} />
          </label>
          <label>{f('features')} (EN, 一行一条)
            <textarea value={toLines(form.features_en)} onChange={(e) => set({ features_en: fromLines(e.target.value) })} />
          </label>
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>{t('equipment.group_intro')}</legend>
        <IntroEditor value={form.intro} onChange={(v) => set({ intro: v })} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>{t('equipment.group_specs')}</legend>

        <SpecsEditor value={form.specs} onChange={(v) => set({ specs: v })} />
        <hr className="adm-ed-sep" />
        <ModelTablesEditor value={form.model_tables} onChange={(v) => set({ model_tables: v })} />

        {/* 高级兜底：技术人员可直接编辑 JSON；普通运维无需打开 */}
        <details className="adm-ed-advanced">
          <summary>{t('equipment.ed.advanced')}</summary>
          <JsonField label={f('specs')} value={form.specs} onApply={(v) => set({ specs: v as SpecItem[] })} />
          <JsonField label={f('model_tables')} value={form.model_tables} onApply={(v) => set({ model_tables: v as ModelTable[] })} />
          <JsonField label={t('equipment.ed.intro_json')} value={form.intro} onApply={(v) => set({ intro: v as IntroBlock[] })} />
        </details>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>{f('seo')}</legend>
        <div className="admin-form-grid">
          <label>{f('seo_title')} (CN)
            <input value={form.seo_title_zh} onChange={(e) => set({ seo_title_zh: e.target.value })}
              placeholder={form.name_cn || '设备名 | 矿联矿机'} maxLength={120} />
          </label>
          <label>{f('seo_title')} (EN)
            <input value={form.seo_title_en} onChange={(e) => set({ seo_title_en: e.target.value })}
              placeholder={form.name_en || 'Equipment | Minelink'} maxLength={120} />
          </label>
          <label>{f('seo_desc')} (CN)
            <textarea value={form.seo_desc_zh} onChange={(e) => set({ seo_desc_zh: e.target.value })} maxLength={300} />
          </label>
          <label>{f('seo_desc')} (EN)
            <textarea value={form.seo_desc_en} onChange={(e) => set({ seo_desc_en: e.target.value })} maxLength={300} />
          </label>
        </div>
        <label>{f('seo_keywords')}
          <input value={form.seo_keywords} onChange={(e) => set({ seo_keywords: e.target.value })}
            placeholder="jaw crusher, crushing plant, mining equipment" />
        </label>
      </fieldset>

      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving ? '…' : (id ? t('equipment.edit') : t('equipment.add'))}
        </button>
        <button type="button" className="admin-btn" disabled={saving} onClick={saveAndView}>
          {t('equipment.save_view')}
        </button>
        <button type="button" className="admin-btn" onClick={() => navigate(`${base}/equipment`)}>{t('back')}</button>
      </div>
    </form>
  );
}
