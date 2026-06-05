import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AppLayout } from "@/components/layout/AppLayout";
import type { AppConfig } from "@/config/appConfig";
import { ConfigurationErrorState } from "@/components/system/ConfigurationErrorState";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES
} from "@/i18n/config";
import { AgentDetailPage } from "@/pages/AgentDetailPage";
import { AgentListPage } from "@/pages/AgentListPage";
import { AuditReportPage } from "@/pages/AuditReportPage";
import { HomePage } from "@/pages/HomePage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

interface AppRoutesProps {
  config: AppConfig;
}

function LocaleRedirect(): JSX.Element {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const target = segments.length > 0 && isSupportedLocale(segments[0])
    ? segments.join("/")
    : `${DEFAULT_LOCALE}${location.pathname === "/" ? "" : location.pathname}`;
  return <Navigate to={`/${target}${location.search}${location.hash}`} replace />;
}

function ComparePagePlaceholder(): JSX.Element {
  const { t } = useTranslation("compare");
  return <PlaceholderPage title={t("page.title")} description={t("page.subtitle")} ctaHref="/agents" />;
}

function RecommendPagePlaceholder(): JSX.Element {
  const { t } = useTranslation("recommend");
  return <PlaceholderPage title={t("page.title")} description={t("page.comingSoon")} ctaHref="/agents" />;
}

function PublishPagePlaceholder(): JSX.Element {
  return (
    <PlaceholderPage
      title="Publish"
      description="Publishing tools land in Phase 3 alongside wallet integration. Routes are reserved so the URL won't move once they ship."
      ctaHref="/agents"
    />
  );
}

function NotFoundPage(): JSX.Element {
  const { t } = useTranslation("detail");
  return (
    <PlaceholderPage
      title={t("errors.notFound")}
      description={t("errors.tryHome")}
      ctaHref="/agents"
    />
  );
}

export function AppRoutes({ config }: AppRoutesProps): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LocaleRedirect />} />
      {SUPPORTED_LOCALES.map((locale) => (
        <Route key={locale} path={`/${locale}`} element={<AppLayout />}>
          <Route index element={<HomePage config={config} />} />
          <Route path="agents" element={<AgentListPage config={config} />} />
          <Route path="agent/:id" element={<AgentDetailPage config={config} />} />
          <Route
            path="agent/:id/audits/:auditId/:auditIndex"
            element={<AuditReportPage config={config} />}
          />
          <Route path="compare" element={<ComparePagePlaceholder />} />
          <Route path="recommend" element={<RecommendPagePlaceholder />} />
          <Route path="publish" element={<PublishPagePlaceholder />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      ))}
      <Route path="*" element={<LocaleRedirect />} />
    </Routes>
  );
}

export function ConfigErrorBoundary({ error }: { error: string }): JSX.Element {
  return <ConfigurationErrorState error={error} />;
}
