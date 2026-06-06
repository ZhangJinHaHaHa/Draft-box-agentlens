import {
  parseNeedParserResponse,
  type NeedParseResult,
  type NeedParserTaxonomy
} from "@/domain/needParser";

export interface NeedParserClientInput {
  query: string;
  locale: "zh" | "en";
  taxonomy: NeedParserTaxonomy;
}

export type NeedParserClientResult =
  | {
      ok: true;
      result: NeedParseResult;
    }
  | {
      ok: false;
      error: string;
    };

export async function parseNeedWithLlm(input: NeedParserClientInput): Promise<NeedParserClientResult> {
  try {
    const response = await fetch("/api/llm/parse-need", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
      return {
        ok: false,
        error: typeof body?.error === "string" ? body.error : "LLM need parser is unavailable."
      };
    }

    return {
      ok: true,
      result: parseNeedParserResponse(JSON.stringify(body.result), input.taxonomy)
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "LLM need parser is unavailable."
    };
  }
}
