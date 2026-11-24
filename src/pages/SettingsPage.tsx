import { Archive, ArrowDown, ArrowUp, Check, Code2, Copy, Download, FolderOpen, KeyRound, Lock, RefreshCw, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { ProviderIcon } from '../components/ProviderIcon';
import {
  clearSavedBackupDirectory,
  getSavedBackupDirectoryInfo,
  isEmbeddedIframe,
  pickBackupDirectory,
  supportsBackupDirectoryPicker,
} from '../services/sourceBackupClient';
import type {
  AppSettings,
  CatalogMeta,
  ExportBundle,
  GatewayStatus,
  PublicProviderConfig,
  SourceBackupSettings,
  TaskCategory,
} from '../types/ai';

interface SettingsPageProps {
  settings: AppSettings;
  providers: PublicProviderConfig[];
  gateway: GatewayStatus;
  catalogMeta: CatalogMeta | null;
  checkingUpdates: boolean;
  onCheckUpdates: () => void;
  onOpenSourceBackup: () => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onExportBundle: (options: { includeSecrets: boolean; password?: string }) => Promise<ExportBundle>;
  onImportBundle: (options: { bundle: ExportBundle; password?: string }) => Promise<void>;
  onGenerateGatewayToken: () => Promise<void>;
  onCopyGatewayToken: () => Promise<void>;
  onRevokeGatewayToken: () => Promise<void>;
}

const TASKS: Array<{ id: TaskCategory; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'coding', label: 'Coding' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'fast', label: 'Fast' },
  { id: 'vision', label: 'Vision' },
];

export function SettingsPage({
  settings,
  providers,
  gateway,
  catalogMeta,
  checkingUpdates,
  onCheckUpdates,
  onOpenSourceBackup,
  onUpdateSettings,
  onExportBundle,
  onImportBundle,
  onGenerateGatewayToken,
  onCopyGatewayToken,
  onRevokeGatewayToken,
}: SettingsPageProps) {
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [pendingImportBundle, setPendingImportBundle] = useState<ExportBundle | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sourceBackupCfg: SourceBackupSettings = settings.sourceBackup ?? {
    autoEnabled: false,
    intervalHours: 24,
    localPath: '',
    fileNamePrefix: 'free-ai-hub-source',
  };
  const [backupLocalPath, setBackupLocalPath] = useState(sourceBackupCfg.localPath);
  const [backupPrefix, setBackupPrefix] = useState(sourceBackupCfg.fileNamePrefix);
  const [backupDirInfo, setBackupDirInfo] = useState<{ connected: boolean; folderName?: string }>({
    connected: false,
  });
  const [backupDirMsg, setBackupDirMsg] = useState<string | null>(null);

  useEffect(() => {
    setBackupLocalPath(sourceBackupCfg.localPath);
    setBackupPrefix(sourceBackupCfg.fileNamePrefix);
  }, [sourceBackupCfg.localPath, sourceBackupCfg.fileNamePrefix]);

  useEffect(() => {
    void getSavedBackupDirectoryInfo().then(setBackupDirInfo);
  }, []);

  const providerMap = new Map(providers.map((p) => [p.id, p]));
  const orderedProviders = settings.smartRouter.providerPriority
    .map((id) => providerMap.get(id))
    .filter((p): p is PublicProviderConfig => Boolean(p));

  const movePriority = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedProviders.length) return;
    const copy = orderedProviders.map((p) => p.id);
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    await onUpdateSettings({
      smartRouter: {
        ...settings.smartRouter,
        providerPriority: copy,
      },
    });
  };

  const handleExport = async () => {
    setExportError(null);
    setExportStatus(null);
    try {
      const bundle = await onExportBundle({
        includeSecrets,
        password: includeSecrets ? exportPassword : undefined,
      });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = includeSecrets
        ? `free-ai-hub-backup-encrypted-${new Date().toISOString().slice(0, 10)}.json`
        : `free-ai-hub-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportPassword('');
      setExportStatus(
        includeSecrets
          ? 'Backup cifrato con segreti scaricato.'
          : 'Configurazione esportata senza API key.',
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Errore durante esportazione.');
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as ExportBundle;
      if (bundle.format !== 'free-ai-hub-backup') {
        throw new Error('Il file selezionato non è un backup valido di Free AI Hub.');
      }
      if (bundle.encrypted) {
        setPendingImportBundle(bundle);
      } else {
        await onImportBundle({ bundle });
        setImportStatus('Configurazione importata con successo.');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'File non valido.');
    } finally {
      e.target.value = '';
    }
  };

  const handleEncryptedImportConfirm = async () => {
    if (!pendingImportBundle) return;
    setImportError(null);
    try {
      await onImportBundle({ bundle: pendingImportBundle, password: importPassword });
      setPendingImportBundle(null);
      setImportPassword('');
      setImportStatus('Backup cifrato importato e ripristinato.');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Decifratura fallita.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Gestisci le priorità di Smart Router AUTO, fallback automatico, aspetto e backup cifrati.
        </p>
      </div>

      {/* AUTO / Smart Router & Fallback */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-5">
        <div>
          <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
            AUTO / Smart Router &amp; Fallback
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Personalizza l&apos;ordine di priorità dei provider e il comportamento in caso di rate limit, timeout o quota esaurita.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Modalità AUTO attiva
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Seleziona automaticamente il miglior provider/modello
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.smartRouter.enabled}
              onChange={(e) =>
                void onUpdateSettings({
                  smartRouter: { ...settings.smartRouter, enabled: e.target.checked },
                })
              }
              className="h-4 w-4 accent-blue-600"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Fallback automatico
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Passa al provider successivo su 429, 5xx o timeout
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.smartRouter.fallbackEnabled}
              onChange={(e) =>
                void onUpdateSettings({
                  smartRouter: {
                    ...settings.smartRouter,
                    fallbackEnabled: e.target.checked,
                  },
                })
              }
              className="h-4 w-4 accent-blue-600"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Dai priorità ai modelli gratuiti
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Preferisci Free e Free Tier rispetto a Paid
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.smartRouter.preferFree}
              onChange={(e) =>
                void onUpdateSettings({
                  smartRouter: { ...settings.smartRouter, preferFree: e.target.checked },
                })
              }
              className="h-4 w-4 accent-blue-600"
            />
          </label>

          <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Task predefinito AUTO
            </span>
            <select
              value={settings.smartRouter.taskCategory}
              onChange={(e) =>
                void onUpdateSettings({
                  smartRouter: {
                    ...settings.smartRouter,
                    taskCategory: e.target.value as TaskCategory,
                  },
                })
              }
              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-xs font-medium"
            >
              {TASKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
            Ordine di priorità provider (usato da AUTO e Fallback)
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {orderedProviders.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3.5 py-2 bg-zinc-50/50 dark:bg-zinc-950/40 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-zinc-400 w-5">{idx + 1}.</span>
                  <ProviderIcon providerId={p.id} className="w-3.5 h-3.5" />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                  {!p.configured && (
                    <span className="text-[11px] text-zinc-400">(non configurato)</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => void movePriority(idx, -1)}
                    aria-label={`Sposta su ${p.name}`}
                    className="rounded border border-zinc-200 dark:border-zinc-800 p-1 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === orderedProviders.length - 1}
                    onClick={() => void movePriority(idx, 1)}
                    aria-label={`Sposta giù ${p.name}`}
                    className="rounded border border-zinc-200 dark:border-zinc-800 p-1 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Prompt & Theme */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
          Preferenze generali
        </h2>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            System Prompt predefinito per la Chat
          </label>
          <textarea
            rows={3}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void onUpdateSettings({ systemPrompt })}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-zinc-950 hover:opacity-90"
            >
              Salva System Prompt
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Tema interfaccia
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Scegli tra Light Mode e Dark Mode
            </div>
          </div>
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-zinc-100 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => void onUpdateSettings({ theme: 'light' })}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                settings.theme === 'light'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Light Mode
            </button>
            <button
              type="button"
              onClick={() => void onUpdateSettings({ theme: 'dark' })}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                settings.theme === 'dark'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Dark Mode
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Aggiornamenti catalogo provider e modelli
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Verifica nuovi provider e modelli su <span className="font-mono">providers-catalog.json</span> e chiedi sempre conferma prima di aggiornare.
              </div>
            </div>
            <button
              type="button"
              onClick={onCheckUpdates}
              disabled={checkingUpdates}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
              {checkingUpdates ? 'Ricerca in corso...' : 'Controlla aggiornamenti ora'}
            </button>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Controlla e proponi aggiornamenti ad ogni accesso
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                All&apos;avvio verifica se esistono aggiornamenti e mostra il riepilogo per decidere se procedere.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoUpdateCatalogOnLogin !== false}
              onChange={(e) =>
                void onUpdateSettings({ autoUpdateCatalogOnLogin: e.target.checked })
              }
              className="h-4 w-4 accent-blue-600 shrink-0"
            />
          </label>

          {catalogMeta && (
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
              <span>
                Provider nel catalogo JSON:{' '}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {catalogMeta.catalogProvidersCount}
                </strong>
              </span>
              {catalogMeta.lastCheckedAt && (
                <span>
                  Ultimo controllo:{' '}
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    {new Date(catalogMeta.lastCheckedAt).toLocaleString('it-IT')}
                  </strong>
                </span>
              )}
              <span>
                Catalogo aggiornato il:{' '}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {new Date(catalogMeta.updatedAt).toLocaleString('it-IT')}
                </strong>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* VS Code Integration: Kilo Code & Cline */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center shrink-0">
            <Code2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
              Integrazione VS Code (Kilo Code &amp; Cline)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Collega le estensioni <strong>Kilo Code</strong> e <strong>Cline</strong> di Visual Studio Code
              direttamente a Free AI Hub tramite il gateway compatibile OpenAI integrato, sfruttando
              Smart Router <span className="font-mono">auto</span> e fallback automatico.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              1. Endpoint Base URL (OpenAI Compatible)
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs font-mono text-zinc-800 dark:text-zinc-200">
                {typeof window !== 'undefined' ? `${window.location.origin}/v1` : '/v1'}
              </code>
              <button
                type="button"
                onClick={async () => {
                  const val = `${window.location.origin}/v1`;
                  await navigator.clipboard.writeText(val);
                  setCopiedField('baseUrl');
                  setTimeout(() => setCopiedField(null), 1600);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {copiedField === 'baseUrl' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copia
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Modelli consigliati in VS Code:{' '}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">auto:coding</span>,{' '}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">auto</span>,{' '}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">auto:fast</span> oppure{' '}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">&lt;provider&gt;/&lt;modelId&gt;</span>.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                2. Gateway API Key (per VS Code)
              </div>
            </div>

            {gateway.hasToken ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-zinc-800 dark:text-zinc-200">
                  {gateway.maskedToken}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await onCopyGatewayToken();
                    setCopiedField('token');
                    setTimeout(() => setCopiedField(null), 1600);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {copiedField === 'token' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copia Token
                </button>
                <button
                  type="button"
                  onClick={() => void onRevokeGatewayToken()}
                  title="Revoca token Gateway"
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 dark:border-red-900/60 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoca
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={generatingToken}
                onClick={async () => {
                  setGeneratingToken(true);
                  try {
                    await onGenerateGatewayToken();
                  } finally {
                    setGeneratingToken(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {generatingToken ? 'Generazione...' : 'Genera Gateway Token'}
              </button>
            )}
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Usa questo token come API Key nelle impostazioni OpenAI Compatible di Kilo Code e Cline.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-3.5 space-y-1">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              Setup rapido su Cline (VS Code)
            </div>
            <p>1. Apri impostazioni Cline → API Provider: <strong>OpenAI Compatible</strong>.</p>
            <p>2. Incolla il Base URL (<span className="font-mono">.../v1</span>) e il Gateway Token.</p>
            <p>3. Imposta Model ID su <span className="font-mono">auto:coding</span> o scegli un modello dalla lista.</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-3.5 space-y-1">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              Setup rapido su Kilo Code (VS Code)
            </div>
            <p>1. Apri impostazioni Kilo Code → API Provider: <strong>OpenAI Compatible</strong>.</p>
            <p>2. Incolla il Base URL (<span className="font-mono">.../v1</span>) e il Gateway Token.</p>
            <p>3. Imposta Model ID su <span className="font-mono">auto:coding</span> (o usa Kilo Gateway tra i Providers).</p>
          </div>
        </div>
      </section>

      {/* Import / Export */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-5">
        <div>
          <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
            Import / Export Configurazione
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Per impostazione predefinita l&apos;esportazione esclude tutte le API key. Se desideri
            includere i segreti, il file viene cifrato con AES-256-GCM protetto da password.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Esporta configurazione
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSecrets}
                onChange={(e) => setIncludeSecrets(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Includi API key (backup cifrato protetto da password)
            </label>

            {includeSecrets && (
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Password di cifratura (minimo 6 caratteri)
                </label>
                <div className="mt-1 relative">
                  <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                  <input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Inserisci password sicura"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-8 pr-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={includeSecrets && exportPassword.length < 6}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Esporta JSON
            </button>

            {exportStatus && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{exportStatus}</p>
            )}
            {exportError && (
              <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Importa configurazione
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Carica un file esportato da Free AI Hub (standard o cifrato).
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <Upload className="w-3.5 h-3.5" />
              Seleziona file JSON
            </button>

            {pendingImportBundle && (
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Backup cifrato rilevato: inserisci la password
                </div>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Password backup"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEncryptedImportConfirm()}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Decifra e importa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingImportBundle(null);
                      setImportPassword('');
                    }}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {importStatus && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{importStatus}</p>
            )}
            {importError && (
              <p className="text-xs text-red-600 dark:text-red-400">{importError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Source Code Local Backup */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center shrink-0">
              <Archive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Backup Locale dell&apos;Intero Codice del Portale
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Scarica un archivio ZIP completo con tutti i sorgenti (<span className="font-mono">src/</span>,{' '}
                <span className="font-mono">server/</span>, <span className="font-mono">public/</span>, configurazioni),
                chiedendo sempre conferma di percorso e nome file prima di salvare.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSourceBackup}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Archive className="w-3.5 h-3.5" />
            Esegui backup codice ora
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Abilita backup automatico del codice
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Quando scade l&apos;intervallo chiede conferma, percorso e nome file prima di procedere.
              </div>
            </div>
            <input
              type="checkbox"
              checked={sourceBackupCfg.autoEnabled}
              onChange={(e) =>
                void onUpdateSettings({
                  sourceBackup: {
                    ...sourceBackupCfg,
                    autoEnabled: e.target.checked,
                  },
                })
              }
              className="h-4 w-4 accent-blue-600 shrink-0"
            />
          </label>

          <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 gap-3">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Frequenza backup automatico
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Intervallo dopo il quale proporre il backup
              </div>
            </div>
            <select
              value={String(sourceBackupCfg.intervalHours)}
              onChange={(e) =>
                void onUpdateSettings({
                  sourceBackup: {
                    ...sourceBackupCfg,
                    intervalHours: Number(e.target.value),
                  },
                })
              }
              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 text-xs font-medium"
            >
              <option value="0">Ad ogni accesso</option>
              <option value="24">Ogni 24 ore</option>
              <option value="168">Ogni 7 giorni</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Percorso locale predefinito
              </label>
              {supportsBackupDirectoryPicker() && !isEmbeddedIframe() && (
                <button
                  type="button"
                  onClick={async () => {
                    setBackupDirMsg(null);
                    try {
                      const res = await pickBackupDirectory();
                      setBackupDirInfo({ connected: true, folderName: res.folderName });
                      const nextPath = backupLocalPath.trim() || res.folderName;
                      setBackupLocalPath(nextPath);
                      await onUpdateSettings({
                        sourceBackup: {
                          ...sourceBackupCfg,
                          localPath: nextPath,
                        },
                      });
                    } catch (err) {
                      setBackupDirMsg(
                        err instanceof Error ? err.message : 'Selezione cartella annullata.',
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <FolderOpen className="w-3 h-3" />
                  Collega cartella PC
                </button>
              )}
            </div>
            <input
              type="text"
              value={backupLocalPath}
              onChange={(e) => setBackupLocalPath(e.target.value)}
              placeholder="es. C:\Backup\Free-AI-Hub o ~/Backups"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100"
            />
            {backupDirInfo.connected && (
              <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                <span>Cartella collegata: {backupDirInfo.folderName}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await clearSavedBackupDirectory();
                    setBackupDirInfo({ connected: false });
                  }}
                  className="underline"
                >
                  Scollega
                </button>
              </div>
            )}
            {backupDirMsg && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">{backupDirMsg}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Prefisso nome file predefinito
            </label>
            <input
              type="text"
              value={backupPrefix}
              onChange={(e) => setBackupPrefix(e.target.value)}
              placeholder="free-ai-hub-source"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Alla creazione viene proposta la data corrente (es. <span className="font-mono">{backupPrefix || 'free-ai-hub-source'}-YYYY-MM-DD.zip</span>).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {sourceBackupCfg.lastBackupAt ? (
              <span>
                Ultimo backup:{' '}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {new Date(sourceBackupCfg.lastBackupAt).toLocaleString('it-IT')}
                </strong>
                {sourceBackupCfg.lastBackupFileName ? ` (${sourceBackupCfg.lastBackupFileName})` : ''}
              </span>
            ) : (
              <span>Nessun backup sorgente ancora eseguito.</span>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              void onUpdateSettings({
                sourceBackup: {
                  ...sourceBackupCfg,
                  localPath: backupLocalPath.trim(),
                  fileNamePrefix: backupPrefix.trim() || 'free-ai-hub-source',
                },
              })
            }
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-zinc-950 hover:opacity-90"
          >
            Salva percorso e nome predefiniti
          </button>
        </div>
      </section>
    </div>
  );
}
