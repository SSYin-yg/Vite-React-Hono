import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './context';
import { importEquipments, type EquipmentInput } from '../api';

const TEMPLATE = `[
  {
    "id": "example-machine",
    "name_cn": "示例设备",
    "name_en": "Example Machine",
    "category": "crushing",
    "images": ["https://example.com/a.webp"],
    "desc_zh": "中文简介…",
    "desc_en": "English summary…",
    "features_zh": ["特性一", "特性二"],
    "features_en": ["Feature one", "Feature two"],
    "specs": [{"k_zh": "功率", "k_en": "Power", "v": "100kW"}],
    "model_tables": [],
    "published": true
  }
]`;

export default function EquipmentImport() {
  const { t, base } = useAdmin();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    setErr(null);
    setResult(null);
    let items: unknown[];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('top-level value is not an array');
      items = parsed;
    } catch (e) {
      setErr(t('equipment.json_error') + ' ' + String(e));
      return;
    }
    setBusy(true);
    try {
      const r = await importEquipments(items as EquipmentInput[]);
      setResult({ inserted: r.inserted, total: r.total });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'equipment-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-import">
      <h2>{t('equipment.import')}</h2>
      <p className="admin-muted">{t('equipment.import_desc')}</p>

      <div className="admin-import-actions">
        <button type="button" className="admin-btn" onClick={downloadTemplate}>
          {t('equipment.download_template')}
        </button>
        <label className="admin-btn">
          {t('equipment.upload_file')}
          <input type="file" accept=".json,application/json" onChange={onFile} hidden />
        </label>
      </div>

      <textarea
        className="admin-import-area"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('equipment.paste_json')}
        spellCheck={false}
      />

      {err && <div className="admin-error">{err}</div>}
      {result && (
        <div className="admin-ok">
          {t('equipment.import_done')}：{result.inserted} / {result.total}
        </div>
      )}

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={doImport}
          disabled={busy || !text.trim()}
        >
          {busy ? '…' : t('equipment.import_btn')}
        </button>
        <button type="button" className="admin-btn" onClick={() => navigate(`${base}/equipment`)}>
          {t('back')}
        </button>
      </div>
    </div>
  );
}
