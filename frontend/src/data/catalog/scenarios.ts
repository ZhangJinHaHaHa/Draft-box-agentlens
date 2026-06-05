import type { ScenarioRef } from "@/domain/catalog";
import type { I18nText } from "@/domain/i18nText";

const map: Record<string, I18nText> = {
  "defi-trading": { zh: "DeFi 交易", en: "DeFi trading" },
  "customer-support": { zh: "客服自动化", en: "Customer support automation" },
  "devops-sre": { zh: "DevOps 与 SRE", en: "DevOps & SRE" },
  "data-analysis": { zh: "数据分析", en: "Data analysis" },
  "developer-assistant": { zh: "研发助手", en: "Developer assistant" },
  "workflow-automation": { zh: "流程自动化", en: "Workflow automation" },
  "content-generation": { zh: "内容生成", en: "Content generation" },
  "market-research": { zh: "市场调研", en: "Market research" },
  "ide-coding": { zh: "IDE 内编程", en: "In-IDE coding" },
  "agentic-coding": { zh: "Agentic 自主编程", en: "Agentic coding" },
  "ui-prototyping": { zh: "UI 原型生成", en: "UI prototyping" },
  "fullstack-prototyping": { zh: "全栈原型搭建", en: "Full-stack prototyping" },
  "knowledge-qa": { zh: "知识库问答", en: "Knowledge base Q&A" },
  "multimodal-chat": { zh: "多模态对话", en: "Multimodal chat" }
};

export function scenario(id: keyof typeof map): ScenarioRef {
  const label = map[id];
  if (!label) {
    throw new Error(`Unknown scenario id: ${id}`);
  }
  return { id, label };
}

export const SCENARIO_IDS = Object.keys(map) as Array<keyof typeof map>;
export const SCENARIO_MAP = map;
