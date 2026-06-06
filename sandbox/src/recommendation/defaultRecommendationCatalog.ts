import type { RecommendationCatalogEntry, RecommendationText } from "./recommendationTypes";

export const defaultRecommendationCatalog: RecommendationCatalogEntry[] = [
  {
    id: "cursor",
    name: "Cursor",
    vendor: "Cursor (Anysphere)",
    intro: {
      zh: "AI IDE，适合中型仓库内的多文件改动。",
      en: "AI IDE suited to multi-file edits in mid-sized repositories."
    },
    category: "AI IDE",
    tags: ["ide", "vscode", "coding", "team"],
    scenarioIds: ["ide-coding", "developer-assistant", "agentic-coding"],
    unsuitableScenarioIds: ["customer-support"],
    riskLevel: "low",
    accessTypes: ["local", "saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    source: "curated"
  },
  {
    id: "openai-gpt5",
    name: "ChatGPT (GPT-5 family)",
    vendor: "OpenAI",
    intro: {
      zh: "通用知识工作助手，覆盖写作、分析、搜索和多模态对话。",
      en: "General knowledge-work assistant for writing, analysis, search and multimodal chat."
    },
    category: "General assistant",
    tags: ["llm", "openai", "general", "multimodal"],
    scenarioIds: ["knowledge-qa", "content-generation", "market-research", "multimodal-chat"],
    unsuitableScenarioIds: ["defi-trading"],
    riskLevel: "low",
    accessTypes: ["saas", "api", "browser_ext"],
    complexity: "low",
    hasOnboardingGuide: true,
    source: "curated"
  },
  {
    id: "dify",
    name: "Dify",
    vendor: "Dify",
    intro: {
      zh: "开源 LLM 应用开发平台，支持 RAG、工作流和 Agent 编排。",
      en: "Open-source LLM app platform for RAG, workflows and agent orchestration."
    },
    category: "LLM app platform",
    tags: ["open-source", "self-host", "rag", "workflow"],
    scenarioIds: ["workflow-automation", "knowledge-qa", "data-analysis"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["local", "cloud", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "flowise",
    name: "Flowise",
    vendor: "Flowise",
    intro: {
      zh: "开源低代码 LLM 编排工具，适合快速搭建 RAG 和聊天流。",
      en: "Open-source low-code LLM orchestration tool for RAG and chatflows."
    },
    category: "LLM workflow builder",
    tags: ["open-source", "self-host", "rag", "low-code"],
    scenarioIds: ["workflow-automation", "knowledge-qa"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["local", "cloud", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "intercom-fin",
    name: "Intercom Fin",
    vendor: "Intercom",
    intro: {
      zh: "客服 AI Agent，接入帮助中心数据回答用户问题。",
      en: "Customer-support AI agent that answers from help-centre data."
    },
    category: "Support agent",
    tags: ["support", "intercom", "knowledge"],
    scenarioIds: ["customer-support", "knowledge-qa"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "ada-ai",
    name: "Ada",
    vendor: "Ada",
    intro: {
      zh: "客服自动化平台，支持多渠道对话和帮助中心接入。",
      en: "Customer-service automation platform with multichannel conversations."
    },
    category: "Support agent",
    tags: ["support", "customer-service", "automation"],
    scenarioIds: ["customer-support", "knowledge-qa"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    vendor: "GitHub / Microsoft",
    intro: {
      zh: "IDE 内 AI 助手，适合 GitHub 生态团队。",
      en: "In-IDE AI assistant for teams already in the GitHub ecosystem."
    },
    category: "AI IDE assistant",
    tags: ["ide", "github", "copilot"],
    scenarioIds: ["ide-coding", "developer-assistant"],
    unsuitableScenarioIds: ["customer-support"],
    riskLevel: "low",
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "runway",
    name: "Runway",
    vendor: "Runway",
    intro: {
      zh: "视频生成与编辑平台，适合创意团队探索视觉概念。",
      en: "Video generation and editing platform for creative teams."
    },
    category: "Video generation",
    tags: ["video", "creative", "design"],
    scenarioIds: ["content-generation", "ui-prototyping"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "windsurf",
    name: "Windsurf",
    vendor: "Codeium",
    intro: {
      zh: "AI IDE，主打 Cascade Agent 和跨文件长任务改动。",
      en: "AI IDE with Cascade Agent for long-running cross-file edits."
    },
    category: "AI IDE",
    tags: ["ide", "codeium", "cascade", "coding"],
    scenarioIds: ["ide-coding", "developer-assistant", "agentic-coding"],
    unsuitableScenarioIds: ["customer-support"],
    riskLevel: "low",
    accessTypes: ["local", "saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "perplexity",
    name: "Perplexity",
    vendor: "Perplexity AI",
    intro: {
      zh: "对话式搜索与研究助手，适合带引用的快速调研。",
      en: "Conversational search and research assistant for cited research."
    },
    category: "Research assistant",
    tags: ["search", "research", "citation", "rag"],
    scenarioIds: ["market-research", "knowledge-qa", "content-generation"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "low",
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "you-com",
    name: "You.com",
    vendor: "You.com",
    intro: {
      zh: "可选模型的 AI 搜索引擎，适合做对比型搜索。",
      en: "AI search engine with model choices for comparative research."
    },
    category: "AI search",
    tags: ["search", "research", "market"],
    scenarioIds: ["market-research", "knowledge-qa"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "low",
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "notion-ai",
    name: "Notion AI",
    vendor: "Notion",
    intro: {
      zh: "嵌入 Notion 工作区的写作、总结和知识库助手。",
      en: "Writing, summarisation and knowledge assistant embedded in Notion."
    },
    category: "Knowledge assistant",
    tags: ["notion", "writing", "summary", "knowledge"],
    scenarioIds: ["content-generation", "knowledge-qa", "workflow-automation"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "low",
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "zapier-agents",
    name: "Zapier Agents",
    vendor: "Zapier",
    intro: {
      zh: "基于 Zapier 应用生态的自动化 Agent，适合串联运营和销售流程。",
      en: "Automation agent based on Zapier's app ecosystem for ops and sales flows."
    },
    category: "Workflow agent",
    tags: ["automation", "zapier", "workflow"],
    scenarioIds: ["workflow-automation", "customer-support"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "n8n-ai",
    name: "n8n AI",
    vendor: "n8n",
    intro: {
      zh: "开源工作流引擎内的 AI 节点，支持自托管 Agent 编排。",
      en: "AI nodes in the open-source n8n workflow engine for self-hosted orchestration."
    },
    category: "Workflow agent",
    tags: ["automation", "open-source", "self-host", "workflow"],
    scenarioIds: ["workflow-automation", "customer-support"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["local", "saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "langgraph-platform",
    name: "LangGraph Platform",
    vendor: "LangChain",
    intro: {
      zh: "Agent 编排平台，适合需要显式状态机和多 Agent 拓扑的团队。",
      en: "Agent orchestration platform for explicit state machines and multi-agent topology."
    },
    category: "Agent platform",
    tags: ["langchain", "orchestration", "multi-agent", "workflow"],
    scenarioIds: ["workflow-automation", "agentic-coding", "data-analysis"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api", "cloud"],
    complexity: "high",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "crewai-platform",
    name: "CrewAI",
    vendor: "CrewAI",
    intro: {
      zh: "面向多 Agent 协作的 Python 框架与托管平台。",
      en: "Python framework and managed platform for multi-agent collaboration."
    },
    category: "Multi-agent framework",
    tags: ["python", "framework", "multi-agent", "workflow"],
    scenarioIds: ["workflow-automation", "data-analysis"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["api", "local", "cloud"],
    complexity: "high",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "v0",
    name: "v0 by Vercel",
    vendor: "Vercel",
    intro: {
      zh: "UI / 全栈原型生成 Agent，适合快速交付可部署的 Next.js + Tailwind 原型。",
      en: "UI and full-stack prototyping agent for quickly shipping deployable Next.js + Tailwind prototypes."
    },
    category: "UI prototyping",
    tags: ["ui", "nextjs", "tailwind", "prototype"],
    scenarioIds: ["ui-prototyping", "fullstack-prototyping", "content-generation"],
    unsuitableScenarioIds: ["defi-trading", "devops-sre"],
    riskLevel: "low",
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    source: "curated"
  },
  {
    id: "lovable",
    name: "Lovable",
    vendor: "Lovable",
    intro: {
      zh: "面向非技术创始人的全栈应用 Agent，通过自然语言迭代 React + Supabase 应用。",
      en: "Full-stack app builder for non-technical founders iterating React + Supabase apps in natural language."
    },
    category: "Full-stack app builder",
    tags: ["nocode", "react", "supabase", "founder"],
    scenarioIds: ["fullstack-prototyping", "ui-prototyping", "workflow-automation"],
    unsuitableScenarioIds: ["devops-sre", "data-analysis"],
    riskLevel: "medium",
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    source: "curated"
  },
  {
    id: "replit-agent",
    name: "Replit Agent",
    vendor: "Replit",
    intro: {
      zh: "Replit 内置全栈 Agent，结合在线 IDE 与一键部署，适合从想法快速到可访问 URL。",
      en: "Replit's built-in full-stack agent with online IDE and one-click deploy for the shortest path to a running URL."
    },
    category: "Full-stack agent",
    tags: ["replit", "ide", "deploy", "fullstack"],
    scenarioIds: ["fullstack-prototyping", "ui-prototyping", "developer-assistant"],
    unsuitableScenarioIds: ["defi-trading", "devops-sre"],
    riskLevel: "medium",
    accessTypes: ["saas", "cloud"],
    complexity: "low",
    hasOnboardingGuide: true,
    source: "curated"
  },
  {
    id: "bolt-new",
    name: "Bolt.new",
    vendor: "StackBlitz",
    intro: {
      zh: "浏览器内全栈 Agent，可在 WebContainer 中直接运行 Node.js + Vite 项目。",
      en: "In-browser full-stack agent that runs Node.js + Vite projects directly inside WebContainer."
    },
    category: "Browser full-stack",
    tags: ["webcontainer", "vite", "node", "fullstack"],
    scenarioIds: ["fullstack-prototyping", "ui-prototyping", "developer-assistant"],
    unsuitableScenarioIds: ["defi-trading", "devops-sre"],
    riskLevel: "low",
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    source: "curated"
  },
  {
    id: "midjourney",
    name: "Midjourney",
    vendor: "Midjourney",
    intro: {
      zh: "高质量图像生成工具，适合快速探索风格化视觉素材。",
      en: "High-quality image generation tool for quickly exploring stylized visual assets."
    },
    category: "Image generation",
    tags: ["image", "design", "creative"],
    scenarioIds: ["content-generation", "ui-prototyping"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "low",
    accessTypes: ["saas", "browser_ext"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    vendor: "ElevenLabs",
    intro: {
      zh: "语音合成与多语种配音平台，适合内容团队批量生成音频。",
      en: "Text-to-speech and multilingual voiceover platform for content teams producing audio at scale."
    },
    category: "Voice generation",
    tags: ["voice", "tts", "multilingual"],
    scenarioIds: ["content-generation", "customer-support"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "harvey",
    name: "Harvey",
    vendor: "Harvey",
    intro: {
      zh: "面向法律与专业服务的垂类 Agent，企业部署为主，输出仍需专业人士复核。",
      en: "Vertical agent for legal and professional services, mostly enterprise deployed, with outputs still requiring expert review."
    },
    category: "Vertical legal agent",
    tags: ["legal", "enterprise", "professional-services"],
    scenarioIds: ["legal-defense", "ip-patent", "knowledge-qa", "market-research"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    vendor: "Google",
    intro: {
      zh: "Google 的通用多模态助手，覆盖网页、移动端与 Gemini API。",
      en: "Google's general-purpose multimodal assistant across web, mobile and Gemini API access."
    },
    category: "General assistant",
    tags: ["google", "llm", "multimodal"],
    scenarioIds: ["knowledge-qa", "content-generation", "market-research", "multimodal-chat"],
    unsuitableScenarioIds: ["defi-trading"],
    riskLevel: "low",
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "glean",
    name: "Glean",
    vendor: "Glean",
    intro: {
      zh: "企业知识搜索与工作助手，连接公司文档、聊天和业务系统。",
      en: "Enterprise search and work assistant connecting company docs, chat and business systems."
    },
    category: "Enterprise knowledge agent",
    tags: ["enterprise", "search", "knowledge"],
    scenarioIds: ["knowledge-qa", "market-research", "workflow-automation"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "sierra-ai",
    name: "Sierra",
    vendor: "Sierra",
    intro: {
      zh: "企业客户体验对话 Agent，强调品牌控制、业务系统动作和人工兜底。",
      en: "Enterprise customer-experience agent emphasizing brand control, business-system actions and human fallback."
    },
    category: "Customer experience agent",
    tags: ["support", "enterprise", "automation"],
    scenarioIds: ["customer-support", "workflow-automation"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "synthesia",
    name: "Synthesia",
    vendor: "Synthesia",
    intro: {
      zh: "企业视频生成平台，常用于培训、产品说明和多语言视频本地化。",
      en: "Enterprise video generation platform for training, product explainers and multilingual localization."
    },
    category: "Video generation",
    tags: ["video", "avatar", "enterprise"],
    scenarioIds: ["content-generation", "customer-support"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "listed"
  },
  {
    id: "expert-criminal-defense",
    name: "无罪辩点·刑辩数字律师",
    vendor: "执业刑辩律师 · 14 年一线",
    intro: {
      zh: "由执业刑辩律师上架，基于真实案卷、辩点库与当地量刑倾向，辅助梳理辩护思路和争议焦点。",
      en: "Listed by a criminal-defense lawyer, backed by real case files, defense-angle libraries and local sentencing patterns."
    },
    category: "Legal expert agent",
    tags: ["legal", "criminal-defense", "lawyer", "case-files", "expert"],
    scenarioIds: ["legal-defense"],
    unsuitableScenarioIds: ["ide-coding", "content-generation"],
    riskLevel: "medium",
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-tax-planning",
    name: "中小企业税务筹划数字员工",
    vendor: "注册税务师 · 服务过 300+ 企业",
    intro: {
      zh: "由注册税务师上架，沉淀数百个中小企业筹划方案与当地税局实操口径，辅助合规节税路径梳理。",
      en: "Listed by a certified tax adviser with hundreds of SME planning cases and local tax-bureau practice notes."
    },
    category: "Tax expert agent",
    tags: ["tax", "finance", "sme", "planning", "expert"],
    scenarioIds: ["tax-planning"],
    unsuitableScenarioIds: ["customer-support"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-patent-oa",
    name: "专利 OA 答审数字代理人",
    vendor: "专利代理师 · 撰写授权 800+ 件",
    intro: {
      zh: "由专利代理师上架，携带 OA 答审策略、驳回理由和领域授权率经验，辅助草拟审查意见答复。",
      en: "Listed by a patent attorney with OA response strategies, rejection-pattern knowledge and field-level grant-rate experience."
    },
    category: "IP expert agent",
    tags: ["patent", "ip", "office-action", "expert"],
    scenarioIds: ["ip-patent", "legal-defense"],
    unsuitableScenarioIds: ["content-generation"],
    riskLevel: "low",
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-venture-dd",
    name: "早期项目尽调数字分析师",
    vendor: "前美元基金投资人 · 看过 2000+ 项目",
    intro: {
      zh: "由早期投资人上架，基于私有 deal memo、估值 comps 与投后复盘库，辅助识别项目红旗。",
      en: "Listed by an early-stage investor using private deal memos, valuation comps and post-mortems to flag deal risks."
    },
    category: "Investment expert agent",
    tags: ["investment", "due-diligence", "venture", "red-flags", "expert"],
    scenarioIds: ["venture-dd", "market-research"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-ecom-sourcing",
    name: "亚马逊蓝海选品数字买手",
    vendor: "亚马逊大卖 · 7 年选品数据",
    intro: {
      zh: "由亚马逊卖家上架，基于选品 win/loss、广告 ROI 与供应链底价记录，辅助筛选低竞争品类。",
      en: "Listed by an Amazon seller using product win/loss history, ad ROI and supplier floor-price records for niche selection."
    },
    category: "E-commerce expert agent",
    tags: ["ecommerce", "amazon", "sourcing", "margin", "expert"],
    scenarioIds: ["ecom-sourcing", "market-research"],
    unsuitableScenarioIds: ["devops-sre"],
    riskLevel: "low",
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-content-ops",
    name: "小红书爆款选题数字操盘手",
    vendor: "MCN 操盘手 · 跑过千条投放",
    intro: {
      zh: "由 MCN 操盘手上架，基于上千条投放数据、选题转化率与账号定位样本，辅助生成选题和开头。",
      en: "Listed by an MCN operator using thousands of campaign records and topic-conversion data to generate account-fit topics."
    },
    category: "Content expert agent",
    tags: ["content", "xiaohongshu", "marketing", "campaign", "expert"],
    scenarioIds: ["content-ops", "content-generation"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "low",
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-insurance-claim",
    name: "重疾拒赔申诉数字顾问",
    vendor: "前理赔调查员 · 经手 1000+ 案",
    intro: {
      zh: "由前理赔调查员上架，基于拒赔条款、调查路径与申诉模板，辅助判断拒赔和组织申诉材料。",
      en: "Listed by a former claims investigator using denial clauses, investigation patterns and appeal templates."
    },
    category: "Insurance expert agent",
    tags: ["insurance", "claims", "appeal", "expert"],
    scenarioIds: ["insurance-claim", "legal-defense"],
    unsuitableScenarioIds: ["ide-coding"],
    riskLevel: "medium",
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-construction-review",
    name: "施工图审查避坑数字工程师",
    vendor: "结构工程师 · 审过 500+ 套图",
    intro: {
      zh: "由结构工程师上架，基于审图意见、消防规范和高频驳回点，辅助送审前自查施工图。",
      en: "Listed by a structural engineer using review comments, fire-code constraints and frequent rejection patterns."
    },
    category: "Engineering expert agent",
    tags: ["construction", "structural", "compliance", "expert"],
    scenarioIds: ["construction-review"],
    unsuitableScenarioIds: ["customer-support"],
    riskLevel: "medium",
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-exec-recruiting",
    name: "芯片行业高端猎头数字顾问",
    vendor: "半导体猎头 · 私有候选人池",
    intro: {
      zh: "由半导体猎头上架，基于候选人画像、placement 数据与 JD 响应记录，辅助招聘策略和 JD 改写。",
      en: "Listed by a semiconductor recruiter using talent profiles, placement history and JD response records."
    },
    category: "Recruiting expert agent",
    tags: ["recruiting", "semiconductor", "talent", "jd", "expert"],
    scenarioIds: ["exec-recruiting"],
    unsuitableScenarioIds: ["customer-support"],
    riskLevel: "low",
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "marketplace"
  },
  {
    id: "expert-study-abroad",
    name: "美研申请文书数字顾问",
    vendor: "留学顾问 · 1500+ 成功申请",
    intro: {
      zh: "由留学顾问上架，基于学校录取偏好、文书结构样本与申请结果复盘，辅助申请文书打磨。",
      en: "Listed by a study-abroad counsellor using school-level preferences, essay structures and admissions post-mortems."
    },
    category: "Education expert agent",
    tags: ["education", "study-abroad", "essay", "admission", "expert"],
    scenarioIds: ["study-abroad", "content-generation"],
    unsuitableScenarioIds: ["devops-sre"],
    riskLevel: "low",
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    source: "marketplace"
  }
];

export interface RecommendationSelectionGroup {
  id: string;
  label: RecommendationText;
  agentIds: string[];
}

export const recommendationSelectionGroups: RecommendationSelectionGroup[] = [
  {
    id: "coding-assistants",
    label: { zh: "编码助手", en: "Coding assistants" },
    agentIds: ["cursor", "github-copilot", "windsurf"]
  },
  {
    id: "app-prototyping",
    label: { zh: "应用原型", en: "App prototyping" },
    agentIds: ["v0", "lovable", "replit-agent", "bolt-new"]
  },
  {
    id: "knowledge-rag",
    label: { zh: "知识库与 RAG", en: "Knowledge and RAG" },
    agentIds: ["dify", "flowise", "glean", "notion-ai"]
  },
  {
    id: "customer-experience",
    label: { zh: "客户体验", en: "Customer experience" },
    agentIds: ["intercom-fin", "ada-ai", "sierra-ai"]
  },
  {
    id: "workflow-automation",
    label: { zh: "流程自动化", en: "Workflow automation" },
    agentIds: ["zapier-agents", "n8n-ai", "langgraph-platform", "crewai-platform"]
  },
  {
    id: "research-assistants",
    label: { zh: "调研助手", en: "Research assistants" },
    agentIds: ["perplexity", "you-com", "openai-gpt5", "google-gemini"]
  },
  {
    id: "creative-media",
    label: { zh: "内容与媒体生成", en: "Creative media" },
    agentIds: ["runway", "midjourney", "synthesia", "elevenlabs"]
  },
  {
    id: "legal-professional",
    label: { zh: "法律与知产专业服务", en: "Legal and IP professional services" },
    agentIds: ["expert-criminal-defense", "expert-patent-oa", "harvey"]
  },
  {
    id: "business-advisory",
    label: { zh: "商业专业顾问", en: "Business advisory" },
    agentIds: ["expert-tax-planning", "expert-venture-dd", "expert-ecom-sourcing", "expert-exec-recruiting"]
  },
  {
    id: "regulated-review",
    label: { zh: "高风险材料复核", en: "Regulated review" },
    agentIds: ["expert-insurance-claim", "expert-construction-review", "expert-study-abroad", "expert-tax-planning"]
  }
];
