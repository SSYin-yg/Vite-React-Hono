/**
 * site_settings 读写（key-value 表）
 *
 * 站点设置与邮件通知共用同一张表，读写逻辑集中在这里，避免两处实现漂移。
 */

/** 读取全部设置为普通对象 */
export async function readSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM site_settings').all();
  const out: Record<string, string> = {};
  for (const r of results ?? []) out[r.key as string] = String(r.value ?? '');
  return out;
}

/** 批量 upsert；value 传空字符串表示「清空该键」 */
export async function saveSettings(
  db: D1Database,
  entries: Record<string, string>
): Promise<void> {
  const stmts = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        'INSERT INTO site_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2'
      )
      .bind(String(key), String(value))
  );
  if (stmts.length) await db.batch(stmts);
}
