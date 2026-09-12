import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from './context';
import { ErrorBox } from './ui';
import {
  getAdminEquipment,
  createEquipment,
  updateEquipment,
  type AdminEquipmentDetail,
  type EquipmentInput,
} from '../api';

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
          specs: parseObj(d.specs, []),
          model_tables: parseObj(d.model_tables, []),
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
        <label>{f('image')} (一行一个)
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
        <legend>{t('equipment.group_specs')}</legend>
        <label>{f('specs')} (JSON)
          <textarea value={JSON.stringify(form.specs, null, 2)} onChange={(e) => { try { set({ specs: JSON.parse(e.target.value) }); } catch { /* 保留上次合法值 */ } }} />
        </label>
        <label>{f('model_tables')} (JSON)
          <textarea value={JSON.stringify(form.model_tables, null, 2)} onChange={(e) => { try { set({ model_tables: JSON.parse(e.target.value) }); } catch { /* 保留上次合法值 */ } }} />
        </label>
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
