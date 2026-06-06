import { useEffect, useMemo, useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  HelpCircle,
  KeyRound,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { parseEther } from "ethers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { AppConfig } from "@/config/appConfig";
import { useWallet } from "@/hooks/useWallet";
import { useLocale } from "@/i18n/useLocale";
import { cn } from "@/lib/utils";
import { formatPriceEth, truncateAddress } from "@/lib/format";
import {
  approveHostedAgent,
  configureHostedAgentSecret,
  createHostedAgentLease,
  getHostedAgentGatewaySummary,
  invokeHostedAgent,
  submitHostedAgentDraft,
  submitHostedAgentForReview,
  type HostedAgentGatewaySummaryPayload,
  type HostedAgentHealthcheckPayload,
  type HostedAgentInvokeResult,
  type HostedAgentLeaseInput,
  type HostedAgentLeasePayload,
  type HostedAgentReviewResult
} from "@/lib/hostedAgentClient";
import { validateAgentManifestInput } from "@/lib/manifestValidation";
import { getPublishPricing, stakeAgent, type PublishPricing } from "@/lib/registryWriteClient";

interface PublishPageProps {
  config: AppConfig;
}

type PublishMode = "native-image" | "hosted-api";
type PublishStep = "choose" | "details";

interface PublishFormState {
  agentName: string;
  displayName: string;
  summary: string;
  useCases: string;
  capabilities: string;
  limitations: string;
  example: string;
  integrationType: string;
  docsUrl: string;
  supportUrl: string;
  image: string;
  allowedHosts: string;
  allowedRpcEndpoints: string;
  manifestUrl: string;
  endpointUrl: string;
  schemaUrl: string;
  healthcheckUrl: string;
  authMethod: string;
  gatewayAuthHeaderName: string;
  gatewayAuthHeaderValue: string;
  leaseUserId: string;
  leaseDurationHours: string;
  leaseMaxRequests: string;
  leaseMaxRequestsPerMinute: string;
  gatewayInvocationPayload: string;
  stakeAmountEth: string;
}

const DEFAULT_FORM: PublishFormState = {
  agentName: "",
  displayName: "",
  summary: "",
  useCases: "",
  capabilities: "",
  limitations: "",
  example: "",
  integrationType: "API",
  docsUrl: "",
  supportUrl: "",
  image: "",
  allowedHosts: "api.openai.com",
  allowedRpcEndpoints: "",
  manifestUrl: "",
  endpointUrl: "",
  schemaUrl: "",
  healthcheckUrl: "",
  authMethod: "Platform-held API key",
  gatewayAuthHeaderName: "X-Agent-Key",
  gatewayAuthHeaderValue: "",
  leaseUserId: "demo-user",
  leaseDurationHours: "24",
  leaseMaxRequests: "20",
  leaseMaxRequestsPerMinute: "5",
  gatewayInvocationPayload: "{\n  \"input\": \"hello\"\n}",
  stakeAmountEth: ""
};

const MODE_OPTIONS: Array<{ mode: PublishMode; icon: JSX.Element }> = [
  { mode: "native-image", icon: <ShieldCheck className="h-5 w-5" aria-hidden /> },
  { mode: "hosted-api", icon: <Server className="h-5 w-5" aria-hidden /> }
];

const README_KEYS = ["useCases", "capabilities", "limitations"] as const;
const IMAGE_HELP_BENEFITS = ["fingerprint", "audit", "ranking", "disputes"] as const;
const IMAGE_HELP_RECOMMENDED = ["highRisk", "trustTier", "platformLease"] as const;
const IMAGE_HELP_NOT_REQUIRED = ["closedSource", "earlyListing", "externalSaas"] as const;

export function PublishPage({ config }: PublishPageProps): JSX.Element {
  const { t } = useTranslation("publish");
  const wallet = useWallet();
  const { buildPath } = useLocale();
  const [step, setStep] = useState<PublishStep>("choose");
  const [mode, setMode] = useState<PublishMode | null>(null);
  const [form, setForm] = useState<PublishFormState>(DEFAULT_FORM);
  const [pricing, setPricing] = useState<PublishPricing | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingHostedDraft, setIsSavingHostedDraft] = useState(false);
  const [isSubmittingHostedReview, setIsSubmittingHostedReview] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ hash: string; tokenId: bigint } | null>(null);
  const [hostedDraftResult, setHostedDraftResult] = useState<{
    hostedAgentId: string;
    status: string;
    createdAt?: string;
  } | null>(null);
  const [hostedReviewResult, setHostedReviewResult] = useState<Extract<HostedAgentReviewResult, { ok: true }> | null>(null);
  const [hostedGatewayMessage, setHostedGatewayMessage] = useState<string | null>(null);
  const [hostedGatewayError, setHostedGatewayError] = useState<string | null>(null);
  const [hostedSecretConfigured, setHostedSecretConfigured] = useState(false);
  const [hostedLease, setHostedLease] = useState<HostedAgentLeasePayload | null>(null);
  const [hostedInvokeResult, setHostedInvokeResult] = useState<HostedAgentInvokeResult | null>(null);
  const [hostedGatewaySummary, setHostedGatewaySummary] = useState<HostedAgentGatewaySummaryPayload | null>(null);
  const [hostedGatewayAction, setHostedGatewayAction] = useState<
    "approve" | "secret" | "lease" | "invoke" | "summary" | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    setPricingError(null);
    void getPublishPricing(config)
      .then((nextPricing) => {
        if (!cancelled) setPricing(nextPricing);
      })
      .catch(() => {
        if (!cancelled) {
          setPricing(null);
          setPricingError(t("wallet.pricingError"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, t]);

  const nativeValidation = useMemo(
    () =>
      validateAgentManifestInput({
        agentName: form.agentName,
        image: form.image,
        allowedHosts: form.allowedHosts,
        allowedRpcEndpoints: form.allowedRpcEndpoints,
        manifestUrl: form.manifestUrl
      }),
    [form.agentName, form.allowedHosts, form.allowedRpcEndpoints, form.image, form.manifestUrl]
  );

  const publicProfile = useMemo(
    () => ({
      name: form.displayName.trim() || form.agentName.trim(),
      summary: form.summary.trim(),
      useCases: parseTextList(form.useCases),
      capabilities: parseTextList(form.capabilities),
      limitations: parseTextList(form.limitations),
      example: form.example.trim(),
      integrationType: form.integrationType.trim(),
      docsUrl: form.docsUrl.trim(),
      supportUrl: form.supportUrl.trim()
    }),
    [
      form.agentName,
      form.capabilities,
      form.displayName,
      form.docsUrl,
      form.example,
      form.integrationType,
      form.limitations,
      form.summary,
      form.supportUrl,
      form.useCases
    ]
  );

  const profileMissing = getProfileMissingFields(form);
  const profileReady = profileMissing.length === 0;
  const hostedMissing = getHostedMissingFields(form);
  const hostedReady = profileReady && hostedMissing.length === 0;
  const hostedGatewayDraftId = hostedDraftResult?.hostedAgentId;
  const hostedApproved = hostedDraftResult?.status === "approved";
  const hostedLeaseInput = parseHostedLeaseInput(form, t);
  const hostedInvocationInput = parseJsonInput(form.gatewayInvocationPayload, t);
  const chainMatches = wallet.chainId === config.chainId;
  const walletConnected = wallet.status === "connected" && Boolean(wallet.address);
  const requiredStake = pricing?.totalRequired ?? 0n;
  const resolvedStake = resolveStakeAmount(form.stakeAmountEth, requiredStake, t("validation.stakeInvalid"));
  const stakeAmountError =
    resolvedStake.error ??
    (resolvedStake.value < requiredStake ? t("validation.stakeTooLow") : null);
  const canSubmitNative =
    mode === "native-image" &&
    profileReady &&
    nativeValidation.ok &&
    walletConnected &&
    chainMatches &&
    Boolean(pricing) &&
    !stakeAmountError &&
    !isSubmitting;

  async function submitNative(): Promise<void> {
    setSubmitError(null);
    setResult(null);

    if (!profileReady) {
      setSubmitError(t("validation.fixProfile"));
      return;
    }
    if (!pricing) {
      setSubmitError(t("wallet.pricingMissing"));
      return;
    }
    if (!nativeValidation.ok) {
      setSubmitError(t("validation.fixManifest"));
      return;
    }
    if (wallet.status !== "connected") {
      await wallet.connect();
      return;
    }
    if (!chainMatches) {
      setSubmitError(t("wallet.chainMismatch", { current: wallet.chainId ?? t("wallet.unknownChain"), expected: config.chainId }));
      return;
    }
    if (stakeAmountError) {
      setSubmitError(stakeAmountError);
      return;
    }

    setIsSubmitting(true);
    try {
      const signer = await wallet.getSigner();
      const nextResult = await stakeAgent(config, signer, {
        agentName: nativeValidation.manifest.agent_name,
        manifestUrl: nativeValidation.manifestUrl,
        valueWei: resolvedStake.value
      });
      setResult(nextResult);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("wallet.txFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitHostedDraft(): Promise<void> {
    setSubmitError(null);
    setHostedDraftResult(null);
    setHostedReviewResult(null);
    if (!hostedReady) {
      setSubmitError(t("hosted.validation.fixHosted"));
      return;
    }
    if (!config.hostedAgentApiUrl) {
      setSubmitError(t("hosted.validation.apiMissing"));
      return;
    }

    setIsSavingHostedDraft(true);
    try {
      const nextResult = await submitHostedAgentDraft(
        {
          readme: {
            agentName: form.agentName.trim(),
            ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
            summary: form.summary.trim(),
            useCases: parseTextList(form.useCases),
            capabilities: parseTextList(form.capabilities),
            limitations: parseTextList(form.limitations),
            ...(form.example.trim() ? { example: form.example.trim() } : {}),
            integrationType: form.integrationType.trim(),
            ...(form.docsUrl.trim() ? { docsUrl: form.docsUrl.trim() } : {}),
            ...(form.supportUrl.trim() ? { supportUrl: form.supportUrl.trim() } : {})
          },
          integration: {
            endpointUrl: form.endpointUrl.trim(),
            schemaUrl: form.schemaUrl.trim(),
            ...(form.healthcheckUrl.trim() ? { healthcheckUrl: form.healthcheckUrl.trim() } : {}),
            authMethod: form.authMethod.trim()
          },
          ...(wallet.address ? { developerAddress: wallet.address } : {})
        },
        { endpointUrl: config.hostedAgentApiUrl }
      );

      if (!nextResult.ok) {
        setSubmitError(nextResult.error);
        return;
      }

      setHostedDraftResult({
        hostedAgentId: nextResult.hostedAgentId,
        status: nextResult.status,
        ...(nextResult.createdAt ? { createdAt: nextResult.createdAt } : {})
      });
      resetHostedGatewayState();
    } finally {
      setIsSavingHostedDraft(false);
    }
  }

  async function submitHostedReview(): Promise<void> {
    setSubmitError(null);
    setHostedReviewResult(null);
    if (!hostedDraftResult) {
      setSubmitError(t("hosted.review.draftMissing"));
      return;
    }
    if (!config.hostedAgentApiUrl) {
      setSubmitError(t("hosted.validation.apiMissing"));
      return;
    }

    setIsSubmittingHostedReview(true);
    try {
      const nextResult = await submitHostedAgentForReview(hostedDraftResult.hostedAgentId, {
        endpointUrl: config.hostedAgentApiUrl
      });

      if (!nextResult.ok) {
        setSubmitError(nextResult.error);
        return;
      }

      setHostedDraftResult((current) =>
        current
          ? {
              ...current,
              status: nextResult.status
            }
          : current
      );
      setHostedReviewResult(nextResult);
      setHostedGatewayMessage(null);
      setHostedGatewayError(null);
    } finally {
      setIsSubmittingHostedReview(false);
    }
  }

  async function approveHostedDraft(): Promise<void> {
    if (!hostedGatewayDraftId) {
      setHostedGatewayError(t("hosted.gateway.errors.draftMissing"));
      return;
    }
    if (!hostedReviewResult) {
      setHostedGatewayError(t("hosted.gateway.errors.reviewMissing"));
      return;
    }
    if (!config.hostedAgentApiUrl) {
      setHostedGatewayError(t("hosted.validation.apiMissing"));
      return;
    }

    setHostedGatewayAction("approve");
    setHostedGatewayError(null);
    setHostedGatewayMessage(null);
    try {
      const nextResult = await approveHostedAgent(
        hostedGatewayDraftId,
        {
          reviewer: "local-mvp-admin",
          note: "Local MVP approval after hosted black-box review."
        },
        { endpointUrl: config.hostedAgentApiUrl }
      );

      if (!nextResult.ok) {
        setHostedGatewayError(nextResult.error);
        return;
      }

      setHostedDraftResult((current) =>
        current
          ? {
              ...current,
              status: nextResult.status
            }
          : current
      );
      setHostedGatewayMessage(t("hosted.gateway.messages.approved"));
      await refreshHostedGatewaySummary(nextResult.hostedAgentId);
    } finally {
      setHostedGatewayAction(null);
    }
  }

  async function configureHostedSecret(): Promise<void> {
    if (!hostedGatewayDraftId) {
      setHostedGatewayError(t("hosted.gateway.errors.draftMissing"));
      return;
    }
    if (!hostedApproved) {
      setHostedGatewayError(t("hosted.gateway.errors.approvalMissing"));
      return;
    }
    if (!config.hostedAgentApiUrl) {
      setHostedGatewayError(t("hosted.validation.apiMissing"));
      return;
    }
    if (form.gatewayAuthHeaderName.trim().length === 0 || form.gatewayAuthHeaderValue.trim().length === 0) {
      setHostedGatewayError(t("hosted.gateway.errors.secretMissing"));
      return;
    }

    setHostedGatewayAction("secret");
    setHostedGatewayError(null);
    setHostedGatewayMessage(null);
    try {
      const nextResult = await configureHostedAgentSecret(
        hostedGatewayDraftId,
        {
          authHeaderName: form.gatewayAuthHeaderName.trim(),
          authHeaderValue: form.gatewayAuthHeaderValue.trim()
        },
        { endpointUrl: config.hostedAgentApiUrl }
      );

      if (!nextResult.ok) {
        setHostedGatewayError(nextResult.error);
        return;
      }

      setHostedSecretConfigured(nextResult.secretConfigured);
      setHostedGatewayMessage(t("hosted.gateway.messages.secretConfigured", { header: nextResult.authHeaderName }));
      await refreshHostedGatewaySummary(hostedGatewayDraftId);
    } finally {
      setHostedGatewayAction(null);
    }
  }

  async function createHostedLeaseGrant(): Promise<void> {
    if (!hostedGatewayDraftId) {
      setHostedGatewayError(t("hosted.gateway.errors.draftMissing"));
      return;
    }
    if (!hostedApproved || !hostedSecretConfigured) {
      setHostedGatewayError(t("hosted.gateway.errors.gatewayNotReady"));
      return;
    }
    if (!config.hostedAgentApiUrl) {
      setHostedGatewayError(t("hosted.validation.apiMissing"));
      return;
    }
    if (!hostedLeaseInput.ok) {
      setHostedGatewayError(hostedLeaseInput.error);
      return;
    }

    setHostedGatewayAction("lease");
    setHostedGatewayError(null);
    setHostedGatewayMessage(null);
    setHostedInvokeResult(null);
    try {
      const nextResult = await createHostedAgentLease(
        hostedGatewayDraftId,
        hostedLeaseInput.value,
        { endpointUrl: config.hostedAgentApiUrl }
      );

      if (!nextResult.ok) {
        setHostedGatewayError(nextResult.error);
        return;
      }

      setHostedLease(nextResult.lease);
      setHostedGatewayMessage(t("hosted.gateway.messages.leaseCreated"));
      await refreshHostedGatewaySummary(hostedGatewayDraftId);
    } finally {
      setHostedGatewayAction(null);
    }
  }

  async function invokeHostedGateway(): Promise<void> {
    if (!hostedGatewayDraftId || !hostedLease) {
      setHostedGatewayError(t("hosted.gateway.errors.leaseMissing"));
      return;
    }
    if (!config.hostedAgentApiUrl) {
      setHostedGatewayError(t("hosted.validation.apiMissing"));
      return;
    }
    if (!hostedInvocationInput.ok) {
      setHostedGatewayError(hostedInvocationInput.error);
      return;
    }

    setHostedGatewayAction("invoke");
    setHostedGatewayError(null);
    setHostedGatewayMessage(null);
    setHostedInvokeResult(null);
    try {
      const nextResult = await invokeHostedAgent(
        hostedGatewayDraftId,
        hostedLease.accessToken,
        hostedInvocationInput.value,
        { endpointUrl: config.hostedAgentApiUrl }
      );
      setHostedInvokeResult(nextResult);
      if (nextResult.ok) {
        setHostedGatewayMessage(t("hosted.gateway.messages.invoked"));
      } else {
        setHostedGatewayError(nextResult.error);
      }
      await refreshHostedGatewaySummary(hostedGatewayDraftId);
    } finally {
      setHostedGatewayAction(null);
    }
  }

  async function refreshHostedGatewaySummary(hostedAgentId: string | undefined = hostedGatewayDraftId): Promise<void> {
    if (!hostedAgentId) {
      setHostedGatewayError(t("hosted.gateway.errors.draftMissing"));
      return;
    }
    if (!config.hostedAgentApiUrl) {
      setHostedGatewayError(t("hosted.validation.apiMissing"));
      return;
    }

    setHostedGatewayAction("summary");
    try {
      const nextResult = await getHostedAgentGatewaySummary(hostedAgentId, {
        endpointUrl: config.hostedAgentApiUrl
      });

      if (!nextResult.ok) {
        setHostedGatewayError(nextResult.error);
        return;
      }

      setHostedGatewaySummary(nextResult.gateway);
      setHostedSecretConfigured(nextResult.gateway.secretConfigured);
    } finally {
      setHostedGatewayAction(null);
    }
  }

  function resetHostedGatewayState(): void {
    setHostedGatewayMessage(null);
    setHostedGatewayError(null);
    setHostedSecretConfigured(false);
    setHostedLease(null);
    setHostedInvokeResult(null);
    setHostedGatewaySummary(null);
    setHostedGatewayAction(null);
  }

  function chooseMode(nextMode: PublishMode): void {
    setMode(nextMode);
    setSubmitError(null);
    setResult(null);
    setHostedDraftResult(null);
    setHostedReviewResult(null);
    resetHostedGatewayState();
  }

  return (
    <section className="container-page flex flex-col gap-8 py-10">
      <div className="max-w-3xl">
        <Badge variant="secondary" className="mb-4">{t("badge")}</Badge>
        <h1 className="text-display text-3xl md:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-base text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {step === "choose" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{t("mode.title")}</CardTitle>
                <DockerImageHelp />
              </div>
              <CardDescription>{t("mode.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => chooseMode(option.mode)}
                  className={cn(
                    "flex w-full flex-col gap-3 rounded-lg border border-border bg-background p-4 text-left transition-colors",
                    "hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    mode === option.mode && "border-foreground bg-muted/40"
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                        {option.icon}
                      </span>
                      <span>
                        <span className="block text-base font-medium text-foreground">
                          {t(`mode.options.${option.mode}.title`)}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {t(`mode.options.${option.mode}.subtitle`)}
                        </span>
                      </span>
                    </span>
                    {mode === option.mode ? <Badge variant="success">{t("mode.selected")}</Badge> : null}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(`mode.options.${option.mode}.body`)}
                  </span>
                </button>
              ))}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" onClick={() => setStep("details")} disabled={!mode}>
                  {t("mode.continue")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("mode.trustTitle")}</CardTitle>
              <CardDescription>{t("mode.trustDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <TrustRow icon={<FileText className="h-4 w-4" aria-hidden />} title={t("mode.trust.readme.title")} body={t("mode.trust.readme.body")} />
              <TrustRow icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title={t("mode.trust.fingerprint.title")} body={t("mode.trust.fingerprint.body")} />
              <TrustRow icon={<LockKeyhole className="h-4 w-4" aria-hidden />} title={t("mode.trust.privacy.title")} body={t("mode.trust.privacy.body")} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("details.pathLabel")}</span>
              <span className="text-sm font-medium text-foreground">
                {mode ? t(`mode.options.${mode}.title`) : t("details.noPath")}
              </span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep("choose")}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {t("details.changePath")}
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("readme.title")}</CardTitle>
                  <CardDescription>{t("readme.description")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t("readme.agentName")} htmlFor="agentName">
                      <Input
                        id="agentName"
                        placeholder="hermes-agent"
                        value={form.agentName}
                        onChange={(event) => updateForm(setForm, "agentName", event.target.value)}
                      />
                    </Field>
                    <Field label={t("readme.displayName")} htmlFor="displayName">
                      <Input
                        id="displayName"
                        placeholder={t("readme.displayNamePlaceholder")}
                        value={form.displayName}
                        onChange={(event) => updateForm(setForm, "displayName", event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label={t("readme.summary")} htmlFor="summary">
                    <Textarea
                      id="summary"
                      className="min-h-20"
                      placeholder={t("readme.summaryPlaceholder")}
                      value={form.summary}
                      onChange={(event) => updateForm(setForm, "summary", event.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-3">
                    {README_KEYS.map((key) => (
                      <Field key={key} label={t(`readme.${key}`)} htmlFor={key}>
                        <Textarea
                          id={key}
                          placeholder={t(`readme.${key}Placeholder`)}
                          value={form[key]}
                          onChange={(event) => updateForm(setForm, key, event.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                  <Field label={t("readme.example")} htmlFor="example">
                    <Textarea
                      id="example"
                      placeholder={t("readme.examplePlaceholder")}
                      value={form.example}
                      onChange={(event) => updateForm(setForm, "example", event.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label={t("readme.integrationType")} htmlFor="integrationType">
                      <Input
                        id="integrationType"
                        placeholder="API / MCP / Webhook"
                        value={form.integrationType}
                        onChange={(event) => updateForm(setForm, "integrationType", event.target.value)}
                      />
                    </Field>
                    <Field label={t("readme.docsUrl")} htmlFor="docsUrl">
                      <Input
                        id="docsUrl"
                        placeholder="https://docs.example.com"
                        value={form.docsUrl}
                        onChange={(event) => updateForm(setForm, "docsUrl", event.target.value)}
                      />
                    </Field>
                    <Field label={t("readme.supportUrl")} htmlFor="supportUrl">
                      <Input
                        id="supportUrl"
                        placeholder="https://support.example.com"
                        value={form.supportUrl}
                        onChange={(event) => updateForm(setForm, "supportUrl", event.target.value)}
                      />
                    </Field>
                  </div>

                  <ValidationPanel
                    title={t("readme.validationTitle")}
                    ready={profileReady}
                    readyText={t("readme.ready")}
                    needsFixesText={t("readme.needsFixes")}
                    okBody={t("readme.ok")}
                    errors={profileMissing.map((key) => t(`readme.validation.${key}`))}
                  />
                </CardContent>
              </Card>

              {mode === "native-image" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("manifest.title")}</CardTitle>
                    <CardDescription>{t("manifest.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <Field label={t("manifest.dockerImage")} htmlFor="image">
                      <Input
                        id="image"
                        placeholder="registry.example.com/hermes-agent:1.0.0"
                        value={form.image}
                        onChange={(event) => updateForm(setForm, "image", event.target.value)}
                      />
                    </Field>
                    <Field label={t("manifest.allowedHosts")} htmlFor="allowedHosts">
                      <Textarea
                        id="allowedHosts"
                        placeholder={"api.openai.com\napi.example.com"}
                        value={form.allowedHosts}
                        onChange={(event) => updateForm(setForm, "allowedHosts", event.target.value)}
                      />
                    </Field>
                    <Field label={t("manifest.allowedRpcEndpoints")} htmlFor="allowedRpcEndpoints">
                      <Textarea
                        id="allowedRpcEndpoints"
                        placeholder="https://rpc.example.com"
                        value={form.allowedRpcEndpoints}
                        onChange={(event) => updateForm(setForm, "allowedRpcEndpoints", event.target.value)}
                      />
                    </Field>
                    <Field label={t("manifest.manifestUrl")} htmlFor="manifestUrl">
                      <Input
                        id="manifestUrl"
                        placeholder="https://raw.githubusercontent.com/org/repo/main/manifest.json"
                        value={form.manifestUrl}
                        onChange={(event) => updateForm(setForm, "manifestUrl", event.target.value)}
                      />
                    </Field>
                    <Field label={t("manifest.stakeOverride")} htmlFor="stakeAmountEth">
                      <Input
                        id="stakeAmountEth"
                        placeholder={pricing ? formatEthInput(pricing.totalRequired) : t("manifest.stakePlaceholder")}
                        value={form.stakeAmountEth}
                        onChange={(event) => updateForm(setForm, "stakeAmountEth", event.target.value)}
                      />
                    </Field>

                    <ValidationPanel
                      title={t("validation.title")}
                      ready={nativeValidation.ok && !stakeAmountError}
                      readyText={t("validation.ready")}
                      needsFixesText={t("validation.needsFixes")}
                      okBody={t("validation.ok")}
                      errors={[
                        ...(!nativeValidation.ok ? nativeValidation.errors.map((error) => t(`validation.${error}`)) : []),
                        ...(stakeAmountError ? [stakeAmountError] : [])
                      ]}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {mode === "hosted-api" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("hosted.title")}</CardTitle>
                    <CardDescription>{t("hosted.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <Field label={t("hosted.endpointUrl")} htmlFor="endpointUrl">
                      <Input
                        id="endpointUrl"
                        placeholder="https://api.example.com/agent"
                        value={form.endpointUrl}
                        onChange={(event) => updateForm(setForm, "endpointUrl", event.target.value)}
                      />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={t("hosted.schemaUrl")} htmlFor="schemaUrl">
                        <Input
                          id="schemaUrl"
                          placeholder="https://api.example.com/openapi.json"
                          value={form.schemaUrl}
                          onChange={(event) => updateForm(setForm, "schemaUrl", event.target.value)}
                        />
                      </Field>
                      <Field label={t("hosted.healthcheckUrl")} htmlFor="healthcheckUrl">
                        <Input
                          id="healthcheckUrl"
                          placeholder="https://api.example.com/health"
                          value={form.healthcheckUrl}
                          onChange={(event) => updateForm(setForm, "healthcheckUrl", event.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label={t("hosted.authMethod")} htmlFor="authMethod">
                      <Input
                        id="authMethod"
                        placeholder={t("hosted.authMethodPlaceholder")}
                        value={form.authMethod}
                        onChange={(event) => updateForm(setForm, "authMethod", event.target.value)}
                      />
                    </Field>

                    <ValidationPanel
                      title={t("hosted.validation.title")}
                      ready={hostedReady}
                      readyText={t("hosted.validation.ready")}
                      needsFixesText={t("hosted.validation.needsFixes")}
                      okBody={t("hosted.validation.ok")}
                      errors={hostedMissing.map((key) => t(`hosted.validation.${key}`))}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="flex flex-col gap-6">
              {mode === "native-image" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" aria-hidden />
                      {t("wallet.title")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Metric label={t("wallet.wallet")} value={wallet.address ? truncateAddress(wallet.address) : walletStatusLabel(wallet.status, t)} />
                      <Metric label={t("wallet.chain")} value={wallet.chainId ? String(wallet.chainId) : t("wallet.notConnected")} />
                      <Metric label={t("wallet.serviceFee")} value={pricing ? formatPriceEth(pricing.serviceFee) : t("wallet.loading")} />
                      <Metric label={t("wallet.minimumBond")} value={pricing ? formatPriceEth(pricing.minimumBond) : t("wallet.loading")} />
                    </div>
                    <p className="text-xs text-muted-foreground">{t("wallet.minimumNote")}</p>
                    {pricingError ? <p className="text-sm text-danger">{pricingError}</p> : null}
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      {wallet.status !== "connected" ? (
                        <Button type="button" onClick={() => void wallet.connect()} disabled={wallet.status === "connecting"}>
                          <Wallet className="h-4 w-4" aria-hidden />
                          {wallet.status === "connecting" ? t("wallet.connecting") : t("wallet.connect")}
                        </Button>
                      ) : null}
                      {wallet.status === "connected" && !chainMatches ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void wallet.switchChain(config.chainId).catch((error) => {
                            setSubmitError(error instanceof Error ? error.message : t("wallet.switchError"));
                          })}
                        >
                          {t("wallet.switchChain", { chainId: config.chainId })}
                        </Button>
                      ) : null}
                      <Button type="button" onClick={() => void submitNative()} disabled={!canSubmitNative}>
                        <ShieldCheck className="h-4 w-4" aria-hidden />
                        {isSubmitting ? t("wallet.submitting") : t("wallet.stake")}
                      </Button>
                    </div>
                    {wallet.errorMessage ? <p className="text-sm text-danger">{t("wallet.walletError")}</p> : null}
                    {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
                    {result ? (
                      <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                          {t("success.title")}
                        </div>
                        <p className="mt-2 break-all text-muted-foreground">{t("success.tx")}: {result.hash}</p>
                        <Button asChild size="sm" variant="secondary" className="mt-3 w-fit">
                          <Link to={buildPath(`/agent/${String(result.tokenId)}`)}>
                            {t("success.openToken", { tokenId: String(result.tokenId) })}
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {mode === "hosted-api" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("hosted.submitTitle")}</CardTitle>
                    <CardDescription>{t("hosted.submitDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <Button type="button" onClick={() => void submitHostedDraft()} disabled={!hostedReady || isSavingHostedDraft}>
                      <FileText className="h-4 w-4" aria-hidden />
                      {isSavingHostedDraft ? t("hosted.savingDraft") : t("hosted.submitDraft")}
                    </Button>
                    {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
                    {hostedDraftResult ? (
                      <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                          {t("hosted.savedTitle")}
                        </div>
                        <p className="mt-2 break-all text-muted-foreground">
                          {t("hosted.savedBody", { hostedAgentId: hostedDraftResult.hostedAgentId })}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{hostedDraftResult.status}</Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void submitHostedReview()}
                            disabled={isSubmittingHostedReview || hostedDraftResult.status === "pending_review"}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                            {isSubmittingHostedReview ? t("hosted.review.submitting") : t("hosted.review.submit")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {hostedReviewResult ? (
                      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                            {t("hosted.review.title")}
                          </div>
                          <Badge variant="warning">{hostedReviewResult.status}</Badge>
                        </div>
                        <div className="mt-3 grid gap-3">
                          <Metric label={t("hosted.review.fingerprint")} value={hostedReviewResult.fingerprint.value} />
                          <Metric
                            label={t("hosted.review.healthcheck")}
                            value={formatHostedHealthcheck(hostedReviewResult.healthcheck, t)}
                          />
                        </div>
                        <ul className="mt-3 flex flex-col gap-1 text-muted-foreground">
                          <li>{t("hosted.review.noteFingerprint")}</li>
                          <li>{t("hosted.review.noteReview")}</li>
                          <li>{t("hosted.review.noteGateway")}</li>
                        </ul>
                      </div>
                    ) : null}
                    {hostedDraftResult ? (
                      <div className="rounded-md border border-border bg-background p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 font-medium text-foreground">
                              <KeyRound className="h-4 w-4 text-success" aria-hidden />
                              {t("hosted.gateway.title")}
                            </div>
                            <p className="mt-1 text-muted-foreground">{t("hosted.gateway.description")}</p>
                          </div>
                          <Badge variant={hostedApproved ? "success" : "warning"}>
                            {hostedApproved ? t("hosted.gateway.approved") : t("hosted.gateway.pending")}
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <Metric
                            label={t("hosted.gateway.metrics.secret")}
                            value={hostedSecretConfigured ? t("hosted.gateway.yes") : t("hosted.gateway.no")}
                          />
                          <Metric
                            label={t("hosted.gateway.metrics.activeLeases")}
                            value={String(hostedGatewaySummary?.activeLeaseCount ?? 0)}
                          />
                          <Metric
                            label={t("hosted.gateway.metrics.totalRequests")}
                            value={String(hostedGatewaySummary?.totalRequestCount ?? 0)}
                          />
                          <Metric
                            label={t("hosted.gateway.metrics.failedRequests")}
                            value={String(hostedGatewaySummary?.failedRequestCount ?? 0)}
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void approveHostedDraft()}
                            disabled={!hostedReviewResult || hostedApproved || hostedGatewayAction !== null}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                            {hostedGatewayAction === "approve" ? t("hosted.gateway.actions.approving") : t("hosted.gateway.actions.approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void refreshHostedGatewaySummary()}
                            disabled={hostedGatewayAction !== null}
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                            {hostedGatewayAction === "summary" ? t("hosted.gateway.actions.refreshing") : t("hosted.gateway.actions.refresh")}
                          </Button>
                        </div>

                        <Separator className="my-4" />

                        <div className="flex flex-col gap-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={t("hosted.gateway.secret.headerName")} htmlFor="gatewayAuthHeaderName">
                              <Input
                                id="gatewayAuthHeaderName"
                                placeholder="X-Agent-Key"
                                value={form.gatewayAuthHeaderName}
                                onChange={(event) => updateForm(setForm, "gatewayAuthHeaderName", event.target.value)}
                              />
                            </Field>
                            <Field label={t("hosted.gateway.secret.headerValue")} htmlFor="gatewayAuthHeaderValue">
                              <Input
                                id="gatewayAuthHeaderValue"
                                type="password"
                                placeholder={t("hosted.gateway.secret.headerValuePlaceholder")}
                                value={form.gatewayAuthHeaderValue}
                                onChange={(event) => updateForm(setForm, "gatewayAuthHeaderValue", event.target.value)}
                              />
                            </Field>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="w-fit"
                            onClick={() => void configureHostedSecret()}
                            disabled={!hostedApproved || hostedGatewayAction !== null}
                          >
                            <KeyRound className="h-3.5 w-3.5" aria-hidden />
                            {hostedGatewayAction === "secret" ? t("hosted.gateway.actions.configuringSecret") : t("hosted.gateway.actions.configureSecret")}
                          </Button>
                          <p className="text-xs text-muted-foreground">{t("hosted.gateway.secret.note")}</p>
                        </div>

                        <Separator className="my-4" />

                        <div className="flex flex-col gap-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={t("hosted.gateway.lease.userId")} htmlFor="leaseUserId">
                              <Input
                                id="leaseUserId"
                                value={form.leaseUserId}
                                onChange={(event) => updateForm(setForm, "leaseUserId", event.target.value)}
                              />
                            </Field>
                            <Field label={t("hosted.gateway.lease.durationHours")} htmlFor="leaseDurationHours">
                              <Input
                                id="leaseDurationHours"
                                inputMode="numeric"
                                value={form.leaseDurationHours}
                                onChange={(event) => updateForm(setForm, "leaseDurationHours", event.target.value)}
                              />
                            </Field>
                            <Field label={t("hosted.gateway.lease.maxRequests")} htmlFor="leaseMaxRequests">
                              <Input
                                id="leaseMaxRequests"
                                inputMode="numeric"
                                value={form.leaseMaxRequests}
                                onChange={(event) => updateForm(setForm, "leaseMaxRequests", event.target.value)}
                              />
                            </Field>
                            <Field label={t("hosted.gateway.lease.maxRequestsPerMinute")} htmlFor="leaseMaxRequestsPerMinute">
                              <Input
                                id="leaseMaxRequestsPerMinute"
                                inputMode="numeric"
                                value={form.leaseMaxRequestsPerMinute}
                                onChange={(event) => updateForm(setForm, "leaseMaxRequestsPerMinute", event.target.value)}
                              />
                            </Field>
                          </div>
                          {!hostedLeaseInput.ok ? <p className="text-xs text-danger">{hostedLeaseInput.error}</p> : null}
                          <Button
                            type="button"
                            size="sm"
                            className="w-fit"
                            onClick={() => void createHostedLeaseGrant()}
                            disabled={!hostedApproved || !hostedSecretConfigured || hostedGatewayAction !== null}
                          >
                            <FileText className="h-3.5 w-3.5" aria-hidden />
                            {hostedGatewayAction === "lease" ? t("hosted.gateway.actions.creatingLease") : t("hosted.gateway.actions.createLease")}
                          </Button>
                          {hostedLease ? (
                            <div className="rounded-md border border-success/40 bg-success/5 p-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Metric label={t("hosted.gateway.lease.leaseId")} value={hostedLease.leaseId} />
                                <Metric label={t("hosted.gateway.lease.expiresAt")} value={hostedLease.expiresAt} />
                              </div>
                              <p className="mt-3 break-all text-muted-foreground">
                                {t("hosted.gateway.lease.accessToken")}: {hostedLease.accessToken}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">{t("hosted.gateway.lease.tokenNote")}</p>
                            </div>
                          ) : null}
                        </div>

                        <Separator className="my-4" />

                        <div className="flex flex-col gap-4">
                          <Field label={t("hosted.gateway.invoke.payload")} htmlFor="gatewayInvocationPayload">
                            <Textarea
                              id="gatewayInvocationPayload"
                              className="min-h-32 font-mono"
                              value={form.gatewayInvocationPayload}
                              onChange={(event) => updateForm(setForm, "gatewayInvocationPayload", event.target.value)}
                            />
                          </Field>
                          {!hostedInvocationInput.ok ? <p className="text-xs text-danger">{hostedInvocationInput.error}</p> : null}
                          <Button
                            type="button"
                            size="sm"
                            className="w-fit"
                            onClick={() => void invokeHostedGateway()}
                            disabled={!hostedLease || hostedGatewayAction !== null}
                          >
                            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                            {hostedGatewayAction === "invoke" ? t("hosted.gateway.actions.invoking") : t("hosted.gateway.actions.invoke")}
                          </Button>
                          {hostedInvokeResult ? (
                            <PreviewBlock
                              title={hostedInvokeResult.ok ? t("hosted.gateway.invoke.result") : t("hosted.gateway.invoke.error")}
                              value={hostedInvokeResult}
                            />
                          ) : null}
                        </div>

                        {hostedGatewayMessage ? <p className="mt-4 text-sm text-success">{hostedGatewayMessage}</p> : null}
                        {hostedGatewayError ? <p className="mt-4 text-sm text-danger">{hostedGatewayError}</p> : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>{t("preview.title")}</CardTitle>
                  <CardDescription>{t("preview.description")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <PreviewBlock title={t("preview.readme")} value={publicProfile} />
                  {mode === "native-image" ? (
                    <>
                      <PreviewBlock title={t("preview.manifest")} value={nativeValidation.manifest} />
                      {form.manifestUrl ? (
                        <Button asChild variant="link" size="sm" className="w-fit px-0">
                          <a href={form.manifestUrl} target="_blank" rel="noreferrer">
                            {t("preview.open")}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <PreviewBlock
                      title={t("preview.hosted")}
                      value={{
                        endpointUrl: form.endpointUrl.trim(),
                        schemaUrl: form.schemaUrl.trim(),
                        healthcheckUrl: form.healthcheckUrl.trim(),
                        authMethod: form.authMethod.trim()
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  function DockerImageHelp(): JSX.Element {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={t("mode.help.label")} className="h-8 w-8">
            <HelpCircle className="h-4 w-4" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))]">
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <p className="font-medium text-foreground">{t("mode.help.title")}</p>
              <p className="mt-1 text-muted-foreground">{t("mode.help.body")}</p>
            </div>
            <HelpList title={t("mode.help.benefitsTitle")} items={IMAGE_HELP_BENEFITS.map((key) => t(`mode.help.benefits.${key}`))} />
            <HelpList title={t("mode.help.recommendedTitle")} items={IMAGE_HELP_RECOMMENDED.map((key) => t(`mode.help.recommended.${key}`))} />
            <HelpList title={t("mode.help.notRequiredTitle")} items={IMAGE_HELP_NOT_REQUIRED.map((key) => t(`mode.help.notRequired.${key}`))} />
          </div>
        </PopoverContent>
      </Popover>
    );
  }
}

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground" title={value}>{value}</p>
    </div>
  );
}

function TrustRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }): JSX.Element {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
      </span>
    </div>
  );
}

function HelpList({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function ValidationPanel({
  title,
  ready,
  readyText,
  needsFixesText,
  okBody,
  errors
}: {
  title: string;
  ready: boolean;
  readyText: string;
  needsFixesText: string;
  okBody: string;
  errors: string[];
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Badge variant={ready ? "success" : "warning"}>
          {ready ? readyText : needsFixesText}
        </Badge>
      </div>
      {ready ? (
        <p className="mt-2 text-sm text-muted-foreground">{okBody}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
    </div>
  );
}

function PreviewBlock({ title, value }: { title: string; value: unknown }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <pre className="max-h-[260px] overflow-auto rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function updateForm(
  setForm: (updater: (current: PublishFormState) => PublishFormState) => void,
  key: keyof PublishFormState,
  value: string
): void {
  setForm((current) => ({ ...current, [key]: value }));
}

function resolveStakeAmount(
  input: string,
  fallbackWei: bigint,
  invalidMessage: string
): { value: bigint; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { value: fallbackWei, error: null };
  }

  try {
    return { value: parseEther(trimmed), error: null };
  } catch {
    return { value: 0n, error: invalidMessage };
  }
}

function formatEthInput(value: bigint): string {
  const asEth = Number(value) / 1e18;
  if (!Number.isFinite(asEth)) return "";
  return asEth.toString();
}

function formatHostedHealthcheck(
  healthcheck: HostedAgentHealthcheckPayload,
  t: (key: string, options?: Record<string, string | number>) => string
): string {
  if (healthcheck.status === "passed") {
    return t("hosted.review.healthcheckPassed", {
      status: healthcheck.httpStatus ?? "-",
      latency: healthcheck.latencyMs ?? "-"
    });
  }

  if (healthcheck.status === "failed") {
    return t("hosted.review.healthcheckFailed", {
      status: healthcheck.httpStatus ?? "-"
    });
  }

  return t("hosted.review.healthcheckMissing");
}

function walletStatusLabel(status: string, t: (key: string) => string): string {
  if (status === "connecting") return t("wallet.connecting");
  if (status === "unavailable") return t("wallet.unavailable");
  if (status === "error") return t("wallet.error");
  return t("wallet.disconnected");
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProfileMissingFields(form: PublishFormState): string[] {
  const missing: string[] = [];
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(form.agentName.trim())) missing.push("agentName");
  if (form.summary.trim().length === 0) missing.push("summary");
  if (parseTextList(form.useCases).length === 0) missing.push("useCases");
  if (parseTextList(form.capabilities).length === 0) missing.push("capabilities");
  if (form.integrationType.trim().length === 0) missing.push("integrationType");
  return missing;
}

function getHostedMissingFields(form: PublishFormState): string[] {
  const missing: string[] = [];
  if (!isHttpUrl(form.endpointUrl)) missing.push("endpointUrl");
  if (!isHttpUrl(form.schemaUrl)) missing.push("schemaUrl");
  if (form.healthcheckUrl.trim().length > 0 && !isHttpUrl(form.healthcheckUrl)) {
    missing.push("healthcheckUrl");
  }
  if (form.authMethod.trim().length === 0) missing.push("authMethod");
  return missing;
}

function parseHostedLeaseInput(
  form: PublishFormState,
  t: (key: string) => string
): { ok: true; value: HostedAgentLeaseInput } | { ok: false; error: string } {
  const userId = form.leaseUserId.trim();
  if (!userId) {
    return { ok: false, error: t("hosted.gateway.errors.leaseUserId") };
  }

  const durationHours = parsePositiveInteger(form.leaseDurationHours);
  if (!durationHours || durationHours > 24 * 30) {
    return { ok: false, error: t("hosted.gateway.errors.durationHours") };
  }

  const maxRequests = parsePositiveInteger(form.leaseMaxRequests);
  if (!maxRequests || maxRequests > 100_000) {
    return { ok: false, error: t("hosted.gateway.errors.maxRequests") };
  }

  const maxRequestsPerMinute = parsePositiveInteger(form.leaseMaxRequestsPerMinute);
  if (!maxRequestsPerMinute || maxRequestsPerMinute > 1_000) {
    return { ok: false, error: t("hosted.gateway.errors.maxRequestsPerMinute") };
  }

  return {
    ok: true,
    value: {
      userId,
      durationHours,
      maxRequests,
      maxRequestsPerMinute
    }
  };
}

function parsePositiveInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseJsonInput(
  value: string,
  t: (key: string) => string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, error: t("hosted.gateway.errors.payloadJson") };
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
