/**
 * 设备编辑 · 可视化字段编辑器
 *
 * 目标：运维人员不需要接触 JSON / HTML，用「加一行 / 加一列 / 加一段」就能维护
 *  - 主要参数（specs）      → 行式编辑器
 *  - 型号表（model_tables） → 表格式编辑器（列、行均可增删）
 *  - 产品介绍（intro）      → 段落块编辑器（小标题 + 正文，小标题即详情页 h3 锚点）
 *
 * 全部为受控组件：value / onChange 由 EquipmentForm 统一持有，保存时直接落到后端。
 */
import type { IntroBlock, ModelTable, SpecItem } from '../api';
import { useAdmin } from './context';

/* ---------------- 通用小工具 ---------------- */

/** 不可变数组替换（避免原地 mutate 触发不了 React 更新） */
const replaceAt = <T,>(arr: T[], i: number, v: T): T[] => arr.map((x, j) => (j === i ? v : x));
const moveAt = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** 行操作小按钮组：上移 / 下移 / 删除 */
function RowTools({
  index,
  total,
  onMove,
  onRemove,
  removeLabel,
}: {
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="adm-ed-tools">
      <button
        type="button"
        className="admin-btn admin-btn-sm"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        title="上移"
        aria-label="上移"
      >
        ↑
      </button>
      <button
        type="button"
        className="admin-btn admin-btn-sm"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        title="下移"
        aria-label="下移"
      >
        ↓
      </button>
      <button
        type="button"
        className="admin-btn admin-btn-sm admin-btn-danger"
        onClick={onRemove}
        title={removeLabel}
        aria-label={removeLabel}
      >
        ×
      </button>
    </div>
  );
}

/* ============================================================
   主要参数（specs）— 行式
   ============================================================ */

export function SpecsEditor({
  value,
  onChange,
}: {
  value: SpecItem[];
  onChange: (v: SpecItem[]) => void;
}) {
  const { t } = useAdmin();
  const e = (k: string) => t(`equipment.ed.${k}`);

  const setRow = (i: number, patch: Partial<SpecItem>) =>
    onChange(replaceAt(value, i, { ...value[i], ...patch }));

  return (
    <div className="adm-ed">
      <p className="adm-ed-hint">{e('specs_hint')}</p>

      {value.length === 0 ? (
        <p className="adm-ed-empty">{e('empty_specs')}</p>
      ) : (
        <div className="adm-ed-specs">
          <div className="adm-ed-specs-head" aria-hidden="true">
            <span>{e('key_zh')}</span>
            <span>{e('key_en')}</span>
            <span>{e('value')}</span>
            <span />
          </div>
          {value.map((row, i) => (
            <div className="adm-ed-specs-row" key={i}>
              <input
                value={row.k_zh}
                placeholder="功率"
                onChange={(ev) => setRow(i, { k_zh: ev.target.value })}
              />
              <input
                value={row.k_en}
                placeholder="Power"
                onChange={(ev) => setRow(i, { k_en: ev.target.value })}
              />
              <input
                value={row.v}
                placeholder="110 kW"
                onChange={(ev) => setRow(i, { v: ev.target.value })}
              />
              <RowTools
                index={i}
                total={value.length}
                onMove={(d) => onChange(moveAt(value, i, d))}
                onRemove={() => onChange(value.filter((_, j) => j !== i))}
                removeLabel={e('remove')}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="admin-btn admin-btn-sm"
        onClick={() => onChange([...value, { k_zh: '', k_en: '', v: '' }])}
      >
        + {e('add_spec')}
      </button>
    </div>
  );
}

/* ============================================================
   型号表（model_tables）— 表格式
   ============================================================ */

export function ModelTablesEditor({
  value,
  onChange,
}: {
  value: ModelTable[];
  onChange: (v: ModelTable[]) => void;
}) {
  const { t } = useAdmin();
  const e = (k: string) => t(`equipment.ed.${k}`);

  const patchTable = (i: number, patch: Partial<ModelTable>) =>
    onChange(replaceAt(value, i, { ...value[i], ...patch }));

  // 增列：所有行同步补一个空格子
  const addColumn = (i: number) => {
    const tb = value[i];
    patchTable(i, {
      columns: [...tb.columns, { zh: '', en: '' }],
      rows: tb.rows.map((r) => [...r, '']),
    });
  };

  // 删列：所有行同步删掉该列（先设好列结构再加数据，避免错位）
  const removeColumn = (i: number, ci: number) => {
    const tb = value[i];
    patchTable(i, {
      columns: tb.columns.filter((_, j) => j !== ci),
      rows: tb.rows.map((r) => r.filter((_, j) => j !== ci)),
    });
  };

  const setColumn = (i: number, ci: number, patch: { zh?: string; en?: string }) => {
    const tb = value[i];
    patchTable(i, { columns: replaceAt(tb.columns, ci, { ...tb.columns[ci], ...patch }) });
  };

  const addRow = (i: number) => {
    const tb = value[i];
    patchTable(i, { rows: [...tb.rows, Array.from({ length: tb.columns.length }, () => '')] });
  };

  const setCell = (i: number, ri: number, ci: number, v: string) => {
    const tb = value[i];
    patchTable(i, {
      rows: replaceAt(tb.rows, ri, tb.rows[ri].map((c, j) => (j === ci ? v : c))),
    });
  };

  const addTable = () =>
    onChange([
      ...value,
      { title_zh: '', title_en: '', columns: [{ zh: '', en: '' }], rows: [['']] },
    ]);

  return (
    <div className="adm-ed">
      <p className="adm-ed-hint">{e('models_hint')}</p>

      {value.length === 0 && <p className="adm-ed-empty">{e('empty_models')}</p>}

      {value.map((tb, i) => (
        <div className="adm-ed-card" key={i}>
          <div className="adm-ed-card-head">
            <span className="adm-ed-card-title">
              {e('table')} {i + 1}
              {tb.title_zh || tb.title_en ? ` · ${tb.title_zh || tb.title_en}` : ''}
            </span>
            <RowTools
              index={i}
              total={value.length}
              onMove={(d) => onChange(moveAt(value, i, d))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
              removeLabel={e('remove_table')}
            />
          </div>

          <div className="admin-form-grid">
            <label>{e('table_title_cn')}
              <input value={tb.title_zh} onChange={(ev) => patchTable(i, { title_zh: ev.target.value })} />
            </label>
            <label>{e('table_title_en')}
              <input value={tb.title_en} onChange={(ev) => patchTable(i, { title_en: ev.target.value })} />
            </label>
          </div>

          {/* 列定义 */}
          <div className="adm-ed-sub">
            <span className="adm-ed-sub-title">{e('columns')}</span>
            <div className="adm-ed-cols">
              {tb.columns.map((col, ci) => (
                <div className="adm-ed-col" key={ci}>
                  <span className="adm-ed-col-no">{ci + 1}</span>
                  <input
                    value={col.zh}
                    placeholder={e('col_zh')}
                    onChange={(ev) => setColumn(i, ci, { zh: ev.target.value })}
                  />
                  <input
                    value={col.en}
                    placeholder={e('col_en')}
                    onChange={(ev) => setColumn(i, ci, { en: ev.target.value })}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => removeColumn(i, ci)}
                    title={e('remove_col')}
                    aria-label={e('remove_col')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="admin-btn admin-btn-sm" onClick={() => addColumn(i)}>
              + {e('add_col')}
            </button>
          </div>

          {/* 数据行 */}
          <div className="adm-ed-sub">
            <span className="adm-ed-sub-title">{e('rows')}</span>
            {tb.columns.length === 0 ? (
              <p className="adm-ed-empty">{e('need_col_first')}</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table adm-ed-table">
                  <thead>
                    <tr>
                      {tb.columns.map((c, ci) => (
                        <th key={ci}>{c.zh || c.en || `${e('col_no')}${ci + 1}`}</th>
                      ))}
                      <th aria-label={e('remove')} />
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.map((row, ri) => (
                      <tr key={ri}>
                        {tb.columns.map((_, ci) => (
                          <td key={ci}>
                            <input
                              value={row[ci] ?? ''}
                              onChange={(ev) => setCell(i, ri, ci, ev.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-danger"
                            onClick={() =>
                              patchTable(i, { rows: tb.rows.filter((_, j) => j !== ri) })
                            }
                            title={e('remove_row')}
                            aria-label={e('remove_row')}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tb.rows.length === 0 && (
                      <tr>
                        <td colSpan={tb.columns.length + 1} className="adm-ed-empty">
                          {e('empty_rows')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className="admin-btn admin-btn-sm" onClick={() => addRow(i)}>
              + {e('add_row')}
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="admin-btn admin-btn-sm" onClick={addTable}>
        + {e('add_table')}
      </button>
    </div>
  );
}

/* ============================================================
   产品介绍（intro）— 段落块
   ============================================================ */

export function IntroEditor({
  value,
  onChange,
}: {
  value: IntroBlock[];
  onChange: (v: IntroBlock[]) => void;
}) {
  const { t } = useAdmin();
  const e = (k: string) => t(`equipment.ed.${k}`);

  const setBlock = (i: number, patch: Partial<IntroBlock>) =>
    onChange(replaceAt(value, i, { ...value[i], ...patch }));

  return (
    <div className="adm-ed">
      <p className="adm-ed-hint">{e('intro_hint')}</p>

      {value.length === 0 && <p className="adm-ed-empty">{e('empty_intro')}</p>}

      {value.map((b, i) => (
        <div className="adm-ed-card" key={i}>
          <div className="adm-ed-card-head">
            <span className="adm-ed-card-title">
              {e('block')} {i + 1}
              {b.title_zh || b.title_en ? ` · ${b.title_zh || b.title_en}` : ''}
            </span>
            <RowTools
              index={i}
              total={value.length}
              onMove={(d) => onChange(moveAt(value, i, d))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
              removeLabel={e('remove_block')}
            />
          </div>

          <div className="admin-form-grid">
            <label>{e('block_heading_cn')}
              <input
                value={b.title_zh}
                placeholder="工作原理"
                onChange={(ev) => setBlock(i, { title_zh: ev.target.value })}
              />
            </label>
            <label>{e('block_heading_en')}
              <input
                value={b.title_en}
                placeholder="Working Principle"
                onChange={(ev) => setBlock(i, { title_en: ev.target.value })}
              />
            </label>
          </div>

          <div className="admin-form-grid adm-ed-prose">
            <label>{e('block_body_cn')}
              <textarea
                value={b.body_zh}
                rows={5}
                placeholder="用一段或几段话介绍该部分内容，空行分段。"
                onChange={(ev) => setBlock(i, { body_zh: ev.target.value })}
              />
            </label>
            <label>{e('block_body_en')}
              <textarea
                value={b.body_en}
                rows={5}
                placeholder="Write the English copy here. Blank lines separate paragraphs."
                onChange={(ev) => setBlock(i, { body_en: ev.target.value })}
              />
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="admin-btn admin-btn-sm"
        onClick={() => onChange([...value, { title_zh: '', title_en: '', body_zh: '', body_en: '' }])}
      >
        + {e('add_block')}
      </button>
    </div>
  );
}
