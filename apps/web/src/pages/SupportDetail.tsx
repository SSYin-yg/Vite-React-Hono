import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSite } from '../site';
import { HERO_IMAGES } from '../i18n';

const TOPICS = ['equipment-selection', 'inspection-delivery', 'after-sales', 'spare-parts'] as const;
type Topic = (typeof TOPICS)[number];

type Section = { title: string; body: string; points: string[] };

type Detail = {
  titleKey: string;
  copyKey: string;
  seoZh: string;
  seoEn: string;
  eyebrowZh: string;
  eyebrowEn: string;
  sectionsZh: Section[];
  sectionsEn: Section[];
};

const DETAILS: Record<Topic, Detail> = {
  'equipment-selection': {
    titleKey: 'footer.select',
    copyKey: 'support.item.select',
    seoZh: '矿山设备选型服务 | 矿联矿机',
    seoEn: 'Mining Equipment Selection Service | Minelink Equipment',
    eyebrowZh: '设备选型',
    eyebrowEn: 'EQUIPMENT SELECTION',
    sectionsZh: [
      { title: '从工况出发，而不是只看型号', body: '我们根据原料类型、进料尺寸、目标产量、成品规格和现场空间等条件协助确定设备组合，减少前期选型偏差。', points: ['原料与硬度、含泥量、湿度', '进料尺寸与目标产品粒级', '目标处理能力与连续运行要求', '固定式、轮胎式或履带式方案'] },
      { title: '破碎、筛分、洗选一体化建议', body: '对于需要多段处理的项目，可结合颚式、圆锥式、反击式、筛分及洗选设备，形成更完整的工艺配置建议。', points: ['一级粗碎与二级细碎配置', '筛分层级与返料逻辑', '洗砂、脱水及物料回收', '输送、堆料及现场衔接'] },
      { title: '提交项目资料即可开始', body: '为了提高方案准确度，询价时可同时提供物料照片、进料粒度、目标产量、成品要求、现场照片或流程图。', points: ['支持中文或英文技术资料', '支持图纸、参数表和现场照片', '可基于目标市场调整配置', '完成确认后进入正式报价阶段'] },
    ],
    sectionsEn: [
      { title: 'Select from operating conditions, not just model numbers', body: 'We evaluate feed material, feed size, target capacity, product size and site conditions to help you build a practical equipment configuration. ', points: ['Material type, hardness, moisture and fines', 'Feed size and target product gradation', 'Required capacity and duty cycle', 'Stationary, wheeled or tracked solutions'] },
      { title: 'Integrated crushing, screening and washing', body: 'For multi-stage projects, we can combine jaw, cone, impact, screening and washing equipment into a more complete process configuration.', points: ['Primary and secondary crushing', 'Screening stages and recirculation', 'Sand washing, dewatering and recovery', 'Conveying and stockpile interfaces'] },
      { title: 'Send project data to start', body: 'Material photos, feed size, target capacity, product requirements, site photos or flow diagrams help us prepare a more accurate recommendation.', points: ['Chinese or English technical documents', 'Drawings, data sheets and site photos', 'Configuration aligned with target market', 'Formal quotation after technical confirmation'] },
    ],
  },
  'inspection-delivery': {
    titleKey: 'footer.inspect',
    copyKey: 'support.item.inspect',
    seoZh: '矿山设备验货与交付服务 | 矿联矿机',
    seoEn: 'Mining Equipment Inspection & Delivery | Minelink Equipment',
    eyebrowZh: '验货交付',
    eyebrowEn: 'INSPECTION & DELIVERY',
    sectionsZh: [
      { title: '出厂前检查', body: '围绕设备外观、主要部件、焊接结构、传动系统、易损件及随机附件进行出厂检查，尽量在发货前发现问题。', points: ['外观与铭牌信息', '关键部件与连接部位', '传动、电机及液压系统', '随机工具、备件与附件'] },
      { title: '视频或第三方验货', body: '可根据订单安排现场视频验货；对有明确要求的项目，也可配合第三方检验或客户指定的验货流程。', points: ['现场视频验货', '客户代表验货', '第三方检验协调', '检验记录与问题闭环'] },
      { title: '包装、装运与出口资料', body: '设备完成验收后，根据运输方式进行包装、防护和装柜，并配合准备常用的商业及出口文件。', points: ['防锈、防潮及运输防护', '散件与主机分类包装', '装柜与出货记录', '商业发票、装箱单等资料'] },
    ],
    sectionsEn: [
      { title: 'Pre-shipment inspection', body: 'We check equipment appearance, key components, welded structures, drive systems, wear parts and accessories before shipment.', points: ['Appearance and nameplate data', 'Key components and connections', 'Drive, motor and hydraulic systems', 'Tools, spares and accessories'] },
      { title: 'Video or third-party inspection', body: 'On-site video inspection can be arranged. For projects with specific requirements, we can also coordinate customer or third-party inspection procedures.', points: ['Video inspection', 'Customer representative inspection', 'Third-party inspection coordination', 'Inspection records and issue closure'] },
      { title: 'Packing, loading and export documents', body: 'After inspection, equipment is packed and protected according to the transport method and prepared for loading and shipment.', points: ['Rust, moisture and transit protection', 'Main unit and loose parts packing', 'Container loading records', 'Commercial invoice, packing list and related documents'] },
    ],
  },
  'after-sales': {
    titleKey: 'footer.aftersale',
    copyKey: 'support.item.aftersale',
    seoZh: '矿山设备售后运维服务 | 矿联矿机',
    seoEn: 'Mining Equipment After-Sales & Operation Support | Minelink Equipment',
    eyebrowZh: '售后运维',
    eyebrowEn: 'AFTER-SALES & OPERATION',
    sectionsZh: [
      { title: '安装、调试与操作支持', body: '设备到场后，可根据项目情况提供安装、调试及操作方面的技术支持，帮助客户更快进入稳定运行阶段。', points: ['安装指导与调试建议', '操作与日常点检说明', '易损件更换建议', '远程技术沟通'] },
      { title: '运行问题快速响应', body: '针对异常振动、堵料、产量波动、磨损异常等运行问题，可根据现场反馈进行故障排查和处理建议。', points: ['工况信息收集', '故障现象分析', '检查步骤与处理建议', '必要时跟进备件需求'] },
      { title: '长期维护与备件支持', body: '对于持续运行的矿山项目，可按照设备使用情况建立备件和维护建议，降低非计划停机风险。', points: ['常用易损件计划', '周期维护建议', '备件库存建议', '持续技术支持'] },
    ],
    sectionsEn: [
      { title: 'Installation, commissioning and operation support', body: 'After delivery, we can provide technical support for installation, commissioning and operation to help customers reach stable production faster.', points: ['Installation guidance and commissioning advice', 'Operation and routine inspection guidance', 'Wear-part replacement advice', 'Remote technical communication'] },
      { title: 'Fast response to operating issues', body: 'For abnormal vibration, blockage, output fluctuations or unusual wear, we can review field feedback and provide troubleshooting guidance.', points: ['Operating-condition review', 'Fault symptom analysis', 'Inspection and corrective steps', 'Spare-parts follow-up when required'] },
      { title: 'Long-term maintenance and spare-parts support', body: 'For continuous mining operations, we can help structure maintenance and spare-parts planning based on equipment duty and wear conditions.', points: ['Common wear-part planning', 'Periodic maintenance guidance', 'Spare-parts stock recommendations', 'Ongoing technical support'] },
    ],
  },
  'spare-parts': {
    titleKey: 'footer.spare',
    copyKey: 'support.item.spare',
    seoZh: '矿山机械配件供应服务 | 矿联矿机',
    seoEn: 'Mining Machinery Spare Parts Supply | Minelink Equipment',
    eyebrowZh: '配件供应',
    eyebrowEn: 'SPARE PARTS SUPPLY',
    sectionsZh: [
      { title: '常用破碎机与筛分设备配件', body: '我们可根据设备型号、图纸、实物照片或尺寸信息确认配件，并按项目要求匹配材料与加工方式。', points: ['颚板、衬板及耐磨件', '锤头、板锤及转子护板', '锤轴、筛网及筛机配件', '输送与洗选设备易损件'] },
      { title: '支持按图加工与定制', body: '对于标准目录之外的零件，可根据客户提供的图纸、样件或关键尺寸进行加工确认，减少采购与设备适配风险。', points: ['按图加工', '按样件复核', '材质与热处理要求确认', '尺寸、公差与检验要求确认'] },
      { title: '材质与检验文件', body: '根据订单和市场要求，可配合提供常见的材质证明、检测报告和出厂检验文件。', points: ['材质证明', '检测报告', '出厂检验记录', '批次与包装标识'] },
    ],
    sectionsEn: [
      { title: 'Common crusher and screening spare parts', body: 'We can identify parts by equipment model, drawings, physical samples, photos or key dimensions, then match material and machining requirements.', points: ['Jaw plates, liners and wear parts', 'Hammerheads, blow bars and rotor guards', 'Hammer shafts, screen mesh and screen parts', 'Conveyor and washing equipment wear parts'] },
      { title: 'Drawing-based machining and customization', body: 'For non-standard parts, we can review customer drawings, samples or critical dimensions and confirm the manufacturing route.', points: ['Drawing-based machining', 'Sample-based verification', 'Material and heat-treatment confirmation', 'Dimension, tolerance and inspection requirements'] },
      { title: 'Material and inspection documents', body: 'Depending on the order and target market, we can support common material certificates, inspection reports and factory inspection records.', points: ['Material certificates', 'Inspection reports', 'Factory inspection records', 'Batch and package identification'] },
    ],
  },
};

export default function SupportDetail() {
  const { topic } = useParams<{ topic: string }>();
  const { t, base, lang, openQuote } = useSite();
  const key = TOPICS.includes(topic as Topic) ? (topic as Topic) : TOPICS[0];
  const detail = DETAILS[key];
  const sections = useMemo(() => (lang === 'en' ? detail.sectionsEn : detail.sectionsZh), [lang, detail]);

  useEffect(() => {
    document.title = lang === 'en' ? detail.seoEn : detail.seoZh;
  }, [detail, lang]);

  return (
    <main>
      <section className="catalog-hero support-detail-hero" style={{ backgroundImage: `linear-gradient(118deg,rgba(12,27,34,.92),rgba(29,51,58,.86)),url('${HERO_IMAGES.home3}')` }}>
        <div className="shell">
          <div className="breadcrumb">
            <Link to={`${base}/`}>{t('nav.home')}</Link>　/　<Link to={`${base}/support`}>{t('nav.service')}</Link>　/　<span>{t(detail.titleKey)}</span>
          </div>
          <div className="eyebrow"><span>{lang === 'en' ? detail.eyebrowEn : detail.eyebrowZh}</span></div>
          <h1>{t(detail.titleKey)}</h1>
          <p><span>{t(detail.copyKey)}</span></p>
        </div>
      </section>

      <section className="section support-detail-body">
        <div className="shell">
          <div className="support-detail-grid">
            {sections.map((section) => (
              <article className="support-detail-card" key={section.title}>
                <div className="support-detail-bar" />
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                <ul>
                  {section.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark support-detail-flow">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="section-label">{lang === 'en' ? 'NEXT STEP' : '下一步'}</div>
              <h2>{lang === 'en' ? 'Send your requirements for a project-specific response' : '提交项目需求，获取针对性回复'}</h2>
            </div>
            <p>{lang === 'en' ? 'Share your equipment model, material, capacity target or drawings. Our team will review the information and continue with the next technical or commercial step.' : '提交设备型号、物料、产量要求或图纸，我们会根据资料进入下一步技术与商务沟通。'}</p>
          </div>
          <div className="support-detail-actions">
            <button type="button" className="primary" onClick={() => openQuote()}>{lang === 'en' ? 'Get a Quote' : '获取报价'}</button>
            <Link className="outline" to={`${base}/support`}>{lang === 'en' ? 'Back to Support Center' : '返回服务支持中心'}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
