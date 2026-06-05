import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import { computeTrustTier } from "@/domain/trustTier";
import { isAttestationPresent } from "@/lib/chainEvidence";

import { TrustTierExplain } from "./TrustTierExplain";

interface TrustEvidenceCardProps {
  entry: AgentCatalogEntry;
}

export function TrustEvidenceCard({ entry }: TrustEvidenceCardProps): JSX.Element {
  const { buildPath } = useLocale();
  const { t } = useTranslation("detail");
  const tier = computeTrustTier({ entry });
  const native = isNativeEntry(entry);
  const audit = entry.chainEvidence;
  const auditReportIndex =
    typeof audit?.auditCount === "number" && audit.auditCount > 0 ? audit.auditCount - 1 : 0;
  const auditReportPath =
    audit?.tokenId && (audit.auditCount === undefined || audit.auditCount > 0)
      ? buildPath(`/agent/${audit.tokenId}/audits/latest/${auditReportIndex}`)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("trust.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <TrustTierExplain result={tier} className="border-0 shadow-none" />

        {native && audit ? (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("trust.audit")}
              </p>
              <ul className="flex flex-col gap-1.5 text-xs font-mono text-foreground/80">
                {audit.reportHash ? (
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground">report:</span>
                    <span className="break-all">{audit.reportHash}</span>
                  </li>
                ) : null}
                {isAttestationPresent(audit.attestationHash) ? (
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground">attestation:</span>
                    <span className="break-all">{audit.attestationHash}</span>
                  </li>
                ) : null}
                {audit.tokenId ? (
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground">tokenId:</span>
                    <span>{audit.tokenId}</span>
                  </li>
                ) : null}
              </ul>
              {auditReportPath ? (
                <div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to={auditReportPath}>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      {t("header.viewAudit")}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("trust.noChainEvidence")}</p>
        )}
      </CardContent>
    </Card>
  );
}
