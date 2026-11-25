import {
  Check,
  Eye,
  EyeOff,
  FolderOpen,
  Play,
  Settings2,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  PcAccessSettings,
  PcDiscoverySnapshot,
  PcExecuteResult,
} from '../types/ai';
import {
  isPcToolAuthorizedClient,
  type PcExecRequest,
} from '../utils/pcActions';

export interface PcActionDecision {
  status: 'pending' | 'approved' | 'rejected' | 'error';
  message?: string;
  result?: PcExecuteResult;
}

interface PcActionCardProps {
  action: PcExecRequest;
  pcAccess: PcAccessSettings;
  discovery: PcDiscoverySnapshot | null;
  isStreaming: boolean;
  decision?: PcActionDecision;
  onAuthorizeExec: (action: PcExecRequest, workingDirectoryOverride?: string) => Promise<void>;
  onReject: (actionId: string) => void;
  onOpenPcAccessSettings: () => void;
}

export function PcActionCard({
  action,
  pcAccess,
  discovery,
  isStreaming,
  decision,
  onAuthorizeExec,
  onReject,
  onOpenPcAccessSettings,
}: PcActionCardProps) {
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [cwdInput, setCwdInput] = useState(action.workingDirectory || '');

  const status = decision?.status ?? 'pending';

  const matchedTool = useMemo(() => {
    if (!discovery) return null;
    const ref = (action.toolId || action.toolQuery || '').trim().toLowerCase();
    if (!ref) return null;
    return (
      discovery.tools.find(
        (t) =>
          t.id.toLowerCase() === ref ||
          t.name.toLowerCase() === ref ||
          t.executable.toLowerCase() === ref ||
          t.executable.replace(/\.(exe|cmd|bat)$/i, '').toLowerCase() === ref,
      ) ?? null
    );
  }, [discovery, action.toolId, action.toolQuery]);

  const isModeDisabled = pcAccess.mode === 'none';
  const isDynamicFullAllowed =
    !matchedTool &&
    (pcAccess.mode === 'full' || (pcAccess.mode === 'custom' && pcAccess.allowAllInstalled));
  const isToolAllowed = matchedTool
    ? isPcToolAuthorizedClient(matchedTool, pcAccess)
    : isDynamicFullAllowed;

  const toolLabel = matchedTool?.name || action.toolId || action.toolQuery || 'Strumento PC';
  const isGui = Boolean(matchedTool?.isGui);

  const handleRun = async () => {
    setBusy(true);
    try {
      await onAuthorizeExec(action, cwdInput.trim() || undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/60 dark:bg-indigo-950/25 p-3.5 text-xs space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-indigo-950 dark:text-indigo-200">
          <Terminal className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span>
            {isGui
              ? `Richiesta avvio applicazione: ${toolLabel}`
              : `Richiesta esecuzione su PC: ${toolLabel}`}
          </span>
        </div>

        {status === 'approved' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
            <Check className="w-3 h-3" />
            {decision?.result?.launchedGui ? 'Avviato' : 'Eseguito'}
          </span>
        )}
        {status === 'rejected' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shrink-0">
            Rifiutato
          </span>
        )}
      </div>

      {action.reason && (
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{action.reason}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
        <span className="rounded bg-white/80 dark:bg-zinc-950/80 border border-indigo-200/70 dark:border-indigo-900/50 px-2 py-0.5 font-mono text-zinc-900 dark:text-zinc-100">
          Tool: {matchedTool?.executable || action.toolId || action.toolQuery}
        </span>
        {matchedTool?.path && (
          <span className="font-mono truncate max-w-[340px]" title={matchedTool.path}>
            {matchedTool.path}
          </span>
        )}
        {matchedTool && !matchedTool.available && (
          <span className="text-red-600 dark:text-red-400 font-medium">
            Non installato su questo PC
          </span>
        )}
      </div>

      {(action.command || action.script) && (
        <div>
          <button
            type="button"
            onClick={() => setPreviewOpen((p) => !p)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:underline"
          >
            {previewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewOpen ? 'Nascondi comando / script' : 'Mostra comando / script'}
          </button>
          {previewOpen && (
            <pre className="mt-1.5 max-h-56 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">
              {action.script || action.command}
            </pre>
          )}
        </div>
      )}

      {(status === 'pending' || status === 'error') && !isModeDisabled && isToolAllowed && (
        <div className="flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={cwdInput}
            onChange={(e) => setCwdInput(e.target.value)}
            placeholder="Cartella di lavoro (opzionale, default Home utente)"
            className="flex-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1 text-[11px] font-mono text-zinc-800 dark:text-zinc-200"
          />
        </div>
      )}

      {decision?.message && (
        <div
          className={`flex items-start gap-1.5 text-[11px] font-medium ${
            status === 'error'
              ? 'text-red-600 dark:text-red-400'
              : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {status === 'error' && <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <span>{decision.message}</span>
        </div>
      )}

      {decision?.result && (decision.result.stdout || decision.result.stderr) && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span>
              Exit code: {decision.result.exitCode ?? '—'} · {decision.result.durationMs} ms
            </span>
          </div>
          {decision.result.stdout && (
            <pre className="max-h-52 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap break-words">
              {decision.result.stdout}
            </pre>
          )}
          {decision.result.stderr && (
            <pre className="max-h-40 overflow-auto rounded-lg border border-red-900/60 bg-zinc-950 p-2.5 font-mono text-[11px] text-red-400 whitespace-pre-wrap break-words">
              {decision.result.stderr}
            </pre>
          )}
        </div>
      )}

      {(status === 'pending' || status === 'error') && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isModeDisabled || !isToolAllowed ? (
            <>
              <div className="w-full text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isModeDisabled
                    ? 'Accesso alle risorse locali disattivato ("Nessun accesso").'
                    : matchedTool && !matchedTool.available
                      ? `Strumento "${matchedTool.name}" non rilevato come installato sul PC.`
                      : `Lo strumento "${toolLabel}" non è abilitato nel profilo attuale (${pcAccess.mode}).`}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenPcAccessSettings}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Impostazioni → Accesso al PC
              </button>
              <button
                type="button"
                disabled={busy || isStreaming}
                onClick={() => onReject(action.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-3.5 h-3.5" />
                Rifiuta
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || isStreaming}
                onClick={() => void handleRun()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {busy
                  ? 'Esecuzione in corso...'
                  : isGui
                    ? 'Autorizza e avvia app'
                    : 'Autorizza ed esegui su PC'}
              </button>
              <button
                type="button"
                disabled={busy || isStreaming}
                onClick={() => onReject(action.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Rifiuta
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
