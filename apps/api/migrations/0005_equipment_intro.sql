-- 设备「产品介绍」：结构化段落块，后台可视化编辑（无需手写 JSON / HTML）
-- 存储：JSON 数组 [{title_zh,title_en,body_zh,body_en}]，无内容时为 []
-- 前台：每块渲染为 <h3 id="intro-N"> + 段落，并作为详情页「h 标签导航」的一项

ALTER TABLE equipment ADD COLUMN intro TEXT NOT NULL DEFAULT '[]';
