import type { AgentCatalogEntry } from "@/domain/catalog";

import { scenario } from "./scenarios";

/**
 * Marketplace tier — seller-listed expert agents.
 *
 * Unlike curated/listed (big-tech tools we link out to), these are agents an
 * individual expert lists ON the platform. Their moat is the seller's PRIVATE
 * accumulated context (years of real case files, deal records, playbooks) — the
 * raw corpus is never handed over; only the judgment is served as inference.
 * The platform's job is matchmaking + trust (access grant, settlement,
 * reputation, future TEE attestation).
 *
 * MVP modelling notes:
 *   - `source: "marketplace"`, NO `tokenId` → detail page renders the editorial
 *     `CuratedBlock`, not the on-chain `NativeChainPanel` (nothing on-chain yet).
 *   - NO `officialUrl` — these live on-platform, not on a vendor site.
 *   - Trust tier is earned, not claimed: a few carry `latestObservedAt` +
 *     `observationSummary` (→ Tier 1); the rest sit at Tier 0 until they accrue
 *     attestation/reputation. `trustTierHint` can only downgrade, so we do NOT
 *     use it to fake higher tiers.
 *   - Regulated domains (legal/tax/insurance) state "assist, not replace a
 *     licensed professional" in intro + riskNotes.
 */
export const marketplaceAgents: AgentCatalogEntry[] = [
  {
    id: "expert-criminal-defense",
    source: "marketplace",
    name: "无罪辩点·刑辩数字律师",
    vendor: "执业刑辩律师 · 14 年一线",
    intro: {
      zh: "由一位执业 14 年的刑辩律师上架，背后是其几年真实案卷沉淀的辩点库与当地量刑倾向。仅提供辩护思路与争议焦点梳理，辅助你和你的代理律师，不替代持证律师出具法律意见。",
      en: "Listed by a criminal-defense lawyer with 14 years of practice, backed by years of real case files, defense-argument libraries and local sentencing tendencies. It surfaces defense angles and disputed focal points to assist you and your counsel — it does not replace a licensed lawyer's opinion."
    },
    tagline: {
      zh: "护城河是真实案卷，不是通用模型",
      en: "The moat is real case files, not a generic model"
    },
    category: "Legal expert agent",
    tags: ["legal", "criminal-defense", "expert", "context-moat"],
    scenarios: [scenario("legal-defense")],
    unsuitableScenarios: [scenario("ide-coding"), scenario("content-generation")],
    recommendedFor: [
      { zh: "想在见律师前先理清辩护方向的当事人家属", en: "Family members who want to clarify defense direction before meeting a lawyer" },
      { zh: "需要快速梳理争议焦点的初级代理律师", en: "Junior counsel who need to map disputed focal points quickly" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "输出为辅助参考，不构成正式法律意见，最终须由持证律师确认。", en: "Output is advisory reference, not formal legal opinion — a licensed lawyer must confirm." },
      { zh: "案情高度个性化，泛化结论可能不适用具体案件。", en: "Cases are highly individual; generalised conclusions may not fit a specific matter." }
    ],
    riskMitigation: [
      { zh: "把结论作为与代理律师讨论的起点，而非依据。", en: "Use the output as a starting point for discussion with counsel, not as grounds for action." }
    ],
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥299 / 次案情分析 · 按次付费，可租用",
      en: "¥299 per case analysis, pay-as-you-go, rentable"
    },
    nativePricing: { rentable: true },
    latestObservedAt: "2026-05-20",
    observationSummary: {
      zh: "近一个月内处理的咨询里，辩点命中率获得多位代理律师正向反馈。",
      en: "Over the past month, several counsel reported positive hit-rates on the defense angles it raised."
    }
  },
  {
    id: "expert-tax-planning",
    source: "marketplace",
    name: "中小企业税务筹划数字员工",
    vendor: "注册税务师 · 服务过 300+ 企业",
    intro: {
      zh: "由一位注册税务师上架，沉淀了几百个真实中小企业筹划方案与当地税局实操口径。帮你在合规边界内梳理可行的节税路径，辅助你的财务与税务顾问，不替代持证税务师的正式申报。",
      en: "Listed by a certified tax adviser, distilled from hundreds of real SME planning cases and local tax-bureau practice. It maps compliant tax-saving paths to assist your finance team and adviser — it does not replace a licensed adviser's formal filing."
    },
    tagline: {
      zh: "几百个真实方案喂出来的口径",
      en: "Calibrated on hundreds of real cases"
    },
    category: "Tax expert agent",
    tags: ["tax", "finance", "sme", "expert"],
    scenarios: [scenario("tax-planning")],
    unsuitableScenarios: [scenario("customer-support")],
    recommendedFor: [
      { zh: "想先摸清节税空间再找顾问的中小企业主", en: "SME owners who want to scope tax-saving room before hiring an adviser" },
      { zh: "需要快速出筹划草案的企业财务", en: "In-house finance teams that need a fast first-draft plan" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "税收政策有地区与时效差异，方案须经持证税务师复核。", en: "Tax policy varies by region and over time; plans must be reviewed by a licensed adviser." }
    ],
    riskMitigation: [
      { zh: "落地前用当期当地政策核对每一条假设。", en: "Verify every assumption against current local policy before acting." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥0.6 / 次调用 · 包月 ¥1,200",
      en: "¥0.6 per call, ¥1,200 / month"
    },
    latestObservedAt: "2026-05-28",
    observationSummary: {
      zh: "包月客户中，多数在首月即跑出可落地的筹划草案。",
      en: "Most monthly subscribers produced an actionable draft plan within the first month."
    }
  },
  {
    id: "expert-patent-oa",
    source: "marketplace",
    name: "专利 OA 答审数字代理人",
    vendor: "专利代理师 · 撰写授权 800+ 件",
    intro: {
      zh: "由一位累计撰写、答审 800+ 件专利的代理师上架，沉淀了审查意见应对策略与各领域授权率数据。帮你草拟 OA 答审意见、定位驳回理由，辅助专利代理流程。",
      en: "Listed by a patent attorney with 800+ filed/granted cases, carrying office-action response strategies and field-level grant-rate data. It drafts OA responses and pinpoints rejection grounds to assist the patent-prosecution workflow."
    },
    tagline: {
      zh: "答审策略来自 800 件真实案子",
      en: "Response strategy from 800 real prosecutions"
    },
    category: "IP expert agent",
    tags: ["patent", "ip", "office-action", "expert"],
    scenarios: [scenario("ip-patent")],
    unsuitableScenarios: [scenario("content-generation")],
    recommendedFor: [
      { zh: "收到审查意见急需草拟答复的申请人", en: "Applicants who received an office action and need a fast response draft" },
      { zh: "想对比驳回理由命中率的代理新人", en: "Junior attorneys comparing rejection-ground hit-rates" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "答审草案须经代理师定稿后提交，AI 草稿不可直接递交。", en: "Drafts must be finalised by an attorney before filing — never submit the AI draft directly." }
    ],
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥499 / 件 OA 答审草拟",
      en: "¥499 per office-action draft"
    }
  },
  {
    id: "expert-venture-dd",
    source: "marketplace",
    name: "早期项目尽调数字分析师",
    vendor: "前美元基金投资人 · 看过 2000+ 项目",
    intro: {
      zh: "由一位看过 2000+ 早期项目的投资人上架，背后是其私有的 deal memo、估值 comps 与投后复盘库。帮你对一个早期项目做结构化尽调、识别红旗，辅助你的投资决策。",
      en: "Listed by an investor who has screened 2,000+ early-stage deals, backed by a private library of deal memos, valuation comps and post-mortems. It runs structured due diligence on an early-stage project and flags red flags to assist your decision."
    },
    tagline: {
      zh: "2000 个项目的复盘，压成一次尽调",
      en: "2,000 post-mortems, compressed into one review"
    },
    category: "Investment expert agent",
    tags: ["investment", "due-diligence", "venture", "expert"],
    scenarios: [scenario("venture-dd"), scenario("market-research")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "缺投研团队的天使/个人投资人", en: "Angels and solo investors without a research team" },
      { zh: "想用第二视角交叉验证的 FA", en: "FAs who want a second lens to cross-check" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "尽调结论依赖你提供的材料质量，不构成投资建议。", en: "Conclusions depend on the materials you provide and do not constitute investment advice." }
    ],
    riskMitigation: [
      { zh: "把红旗清单作为追问清单，而非直接决策依据。", en: "Treat the red-flag list as questions to chase, not a decision in itself." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥1,500 / 个项目尽调 · 可租用",
      en: "¥1,500 per deal review, rentable"
    },
    nativePricing: { rentable: true },
    latestObservedAt: "2026-05-15",
    observationSummary: {
      zh: "近期尽调报告中，红旗识别被多位投资人确认与后续暴雷点吻合。",
      en: "In recent reviews, several investors confirmed its red flags matched issues that later surfaced."
    }
  },
  {
    id: "expert-ecom-sourcing",
    source: "marketplace",
    name: "亚马逊蓝海选品数字买手",
    vendor: "亚马逊大卖 · 7 年选品数据",
    intro: {
      zh: "由一位经营 7 年的亚马逊卖家上架，背后是其私有的选品 win/loss 记录、广告 ROI 与供应链底价数据。帮你筛选低竞争高需求的品类、估算利润空间。",
      en: "Listed by a 7-year Amazon seller, backed by private product win/loss records, ad-ROI history and supplier floor-price data. It screens low-competition high-demand niches and estimates margin room."
    },
    tagline: {
      zh: "7 年真金白银试出来的选品直觉",
      en: "Seven years of real-money sourcing instinct"
    },
    category: "E-commerce expert agent",
    tags: ["ecommerce", "amazon", "sourcing", "expert"],
    scenarios: [scenario("ecom-sourcing"), scenario("market-research")],
    unsuitableScenarios: [scenario("devops-sre")],
    recommendedFor: [
      { zh: "想避开红海、找第一个品的新卖家", en: "New sellers who want to dodge red oceans and find a first product" },
      { zh: "需要快速验证选品假设的运营", en: "Operators who need to validate a sourcing hypothesis fast" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "平台政策与竞争格局变化快，历史数据不保证未来表现。", en: "Platform policy and competition shift fast; past data does not guarantee future results." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥99 / 次选品报告",
      en: "¥99 per sourcing report"
    },
    latestObservedAt: "2026-06-01",
    observationSummary: {
      zh: "近一个月输出的选品报告里，多个推荐品类被卖家验证为低竞争。",
      en: "Over the past month, several recommended niches were verified by sellers as low-competition."
    }
  },
  {
    id: "expert-content-ops",
    source: "marketplace",
    name: "小红书爆款选题数字操盘手",
    vendor: "MCN 操盘手 · 跑过千条投放",
    intro: {
      zh: "由一位 MCN 操盘手上架，背后是其私有的上千条投放数据与选题转化率实测。帮你按账号定位生成可投的选题与开头，辅助内容生产。",
      en: "Listed by an MCN operator, backed by private data on thousands of campaigns and tested topic-conversion rates. It generates account-fit topics and openings to assist content production."
    },
    tagline: {
      zh: "选题不是拍脑袋，是上千条投放喂出来的",
      en: "Topics tuned on thousands of campaigns, not guesswork"
    },
    category: "Content expert agent",
    tags: ["content", "xiaohongshu", "marketing", "expert"],
    scenarios: [scenario("content-ops"), scenario("content-generation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "选题枯竭、转化下滑的个人博主", en: "Solo creators whose topics dried up and conversion dropped" },
      { zh: "要批量起选题的品牌新媒体", en: "Brand social teams who need topics at volume" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "平台规则与流量偏好会变，爆款经验有时效。", en: "Platform rules and traffic preferences change; hit-making patterns expire." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥199 / 月 · 不限次选题，可租用",
      en: "¥199 / month, unlimited topics, rentable"
    },
    nativePricing: { rentable: true },
    latestObservedAt: "2026-06-02",
    observationSummary: {
      zh: "近一个月的选题里，多条被创作者反馈进入平台流量推荐。",
      en: "Over the past month, several of its topics were reported by creators to enter platform traffic recommendation."
    }
  },
  {
    id: "expert-insurance-claim",
    source: "marketplace",
    name: "重疾拒赔申诉数字顾问",
    vendor: "前理赔调查员 · 经手 1000+ 案",
    intro: {
      zh: "由一位经手 1000+ 理赔案的前调查员上架，沉淀了各家拒赔条款与申诉话术。帮你判断拒赔是否站得住、如何组织申诉材料，辅助维权，不替代持证律师或公估师。",
      en: "Listed by a former claims investigator with 1,000+ handled cases, carrying insurers' denial clauses and appeal scripts. It assesses whether a denial holds up and how to assemble an appeal — assisting your case, not replacing a licensed lawyer or loss adjuster."
    },
    tagline: {
      zh: "知道每家公司在哪条款上卡人",
      en: "Knows which clause each insurer denies on"
    },
    category: "Insurance expert agent",
    tags: ["insurance", "claims", "appeal", "expert"],
    scenarios: [scenario("insurance-claim")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "重疾理赔被拒、想判断该不该申诉的投保人", en: "Policyholders denied on a critical-illness claim, deciding whether to appeal" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "结论为辅助判断，正式维权须由律师或公估师把关。", en: "Conclusions are advisory; formal action must be vetted by a lawyer or loss adjuster." }
    ],
    riskMitigation: [
      { zh: "用它整理材料清单，再交专业人士定夺是否起诉。", en: "Use it to assemble the document list, then let a professional decide on litigation." }
    ],
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "按成功追回金额 5% 收费，不成功不收费",
      en: "5% of recovered amount, no win no fee"
    }
  },
  {
    id: "expert-construction-review",
    source: "marketplace",
    name: "施工图审查避坑数字工程师",
    vendor: "结构工程师 · 审过 500+ 套图",
    intro: {
      zh: "由一位审过 500+ 套施工图的结构工程师上架，沉淀了历年审图意见与消防、规范常见坑。帮你在送审前自查施工图、定位高频驳回点。",
      en: "Listed by a structural engineer who has reviewed 500+ drawing sets, carrying years of review comments and common fire-code/standard pitfalls. It self-checks your drawings before submission and locates high-frequency rejection points."
    },
    tagline: {
      zh: "500 套图踩过的坑，一次帮你绕开",
      en: "500 drawing sets of pitfalls, dodged in one pass"
    },
    category: "Engineering expert agent",
    tags: ["construction", "structural", "compliance", "expert"],
    scenarios: [scenario("construction-review")],
    unsuitableScenarios: [scenario("customer-support")],
    recommendedFor: [
      { zh: "送审前想先自查的设计院新人", en: "Junior design-institute engineers self-checking before submission" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "规范有地区与版本差异，自查不替代正式审图。", en: "Codes vary by region and version; self-check does not replace formal review." }
    ],
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥800 / 套图审查",
      en: "¥800 per drawing-set review"
    }
  },
  {
    id: "expert-exec-recruiting",
    source: "marketplace",
    name: "芯片行业高端猎头数字顾问",
    vendor: "半导体猎头 · 私有候选人池",
    intro: {
      zh: "由一位深耕半导体的猎头上架，背后是其私有候选人池与多年成功 placement 数据。帮你写出能打动芯片人才的 JD、判断一个画像的可挖性，辅助招聘。",
      en: "Listed by a semiconductor recruiter, backed by a private candidate pool and years of placement data. It writes JDs that resonate with chip talent and judges how poachable a profile is, to assist hiring."
    },
    tagline: {
      zh: "知道芯片人才真正在意什么",
      en: "Knows what chip talent actually cares about"
    },
    category: "Recruiting expert agent",
    tags: ["recruiting", "semiconductor", "talent", "expert"],
    scenarios: [scenario("exec-recruiting")],
    unsuitableScenarios: [scenario("customer-support")],
    recommendedFor: [
      { zh: "招芯片岗却写不出有吸引力 JD 的 HR", en: "HR hiring for chip roles but struggling to write a compelling JD" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "不提供具体候选人隐私信息，仅给画像与策略判断。", en: "Shares no individual candidate PII — only profile and strategy judgement." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "成功推荐按年薪 20% 结算",
      en: "20% of annual salary on a successful placement"
    },
    latestObservedAt: "2026-05-25",
    observationSummary: {
      zh: "近期 JD 改写帮助多家用人方提升了高端岗位的回应率。",
      en: "Recent JD rewrites lifted response rates on senior roles for several hiring teams."
    }
  },
  {
    id: "expert-study-abroad",
    source: "marketplace",
    name: "美研申请文书数字顾问",
    vendor: "留学顾问 · 1500+ 成功申请",
    intro: {
      zh: "由一位经手 1500+ 成功申请的留学顾问上架，沉淀了各校录取偏好与文书命中规律。帮你按目标项目打磨 PS / 文书结构，辅助申请准备。",
      en: "Listed by a study-abroad counsellor with 1,500+ successful applications, carrying school-level admission preferences and essay patterns. It refines your PS/essay structure against a target program to assist your application."
    },
    tagline: {
      zh: "1500 份录取喂出来的文书直觉",
      en: "Essay instinct from 1,500 admits"
    },
    category: "Education expert agent",
    tags: ["education", "study-abroad", "essay", "expert"],
    scenarios: [scenario("study-abroad")],
    unsuitableScenarios: [scenario("devops-sre")],
    recommendedFor: [
      { zh: "DIY 申请、想要专业第二意见的学生", en: "DIY applicants who want a professional second opinion" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "录取受多因素影响，文书优化不保证录取结果。", en: "Admission depends on many factors; essay polishing does not guarantee an offer." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    pricingHint: {
      zh: "¥2,000 / 套申请文书 · 可租用",
      en: "¥2,000 per application essay set, rentable"
    },
    nativePricing: { rentable: true },
    latestObservedAt: "2026-05-18",
    observationSummary: {
      zh: "近一季的文书打磨获得多位申请者关于结构清晰度的正向反馈。",
      en: "Over the past quarter, essay refinements drew positive feedback on structural clarity from several applicants."
    }
  }
];
