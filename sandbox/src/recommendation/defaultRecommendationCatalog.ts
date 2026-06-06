import type { RecommendationCatalogEntry } from "./recommendationTypes";

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
  }
];
