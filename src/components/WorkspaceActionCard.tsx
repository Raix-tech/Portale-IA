import {
  Check,
  Eye,
  EyeOff,
  FilePenLine,
  FileSearch,
  FolderOpen,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { checkWorkspaceFileExists } from '../services/localWorkspace';
import type {
  WorkspaceConnectRequest,
  WorkspaceReadRequest,
  WorkspaceWriteRequest,
} from '../utils/workspaceActions';

export interface WorkspaceActionDecision {
  status: 'pending' | 'approved' | 'rejected' | 'error';
  message?: string;
}

interface WorkspaceActionCardProps {
  action: WorkspaceConnectRequest | WorkspaceReadRequest | WorkspaceWriteRequest;
  workspaceConnected: boolean;
  workspaceNeedsPermission?: boolean;
  workspaceFolderName?: string;
  isStreaming: boolean;
  decision?: WorkspaceActionDecision;
  onAuthorizeConnect?: (action: WorkspaceConnectRequest) => Promise<void>;
  onAuthorizeRead: (action: WorkspaceReadRequest) => Promise<void>;
  onAuthorizeWrite: (action: WorkspaceWriteRequest) => Promise<void>;
  onReject: (actionId: string) => void;
  onAuthorizeFolder: () => Promise<void>;
}

export function WorkspaceActionCard({
  action,
  workspaceConnected,
  workspaceNeedsPermission,
  workspaceFolderName,
  isStreaming,
  decision,
  onAuthorizeConnect,
  onAuthorizeRead,
  onAuthorizeWrite,
  onReject,
  onAuthorizeFolder,
}: WorkspaceActionCardProps) {
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(action.type === 'write');
  const [existingContent, setExistingContent] = useState<string | null | undefined>(undefined);

  const status = decision?.status ?? 'pending';

  useEffect(() => {
    if (action.type !== 'write' || !workspaceConnected) {
      setExistingContent(undefined);
      return;
    }
    let active = true;
    checkWorkspaceFileExists(action.path).then((res) => {
      if (active) setExistingContent(res);
    });
    return () => {
      active = false;
    };
  }, [action, workspaceConnected]);

  const handleApprove = async () => {
    setBusy(true);
    try {
      if (action.type === 'connect') {
        if (onAuthorizeConnect) {
          await onAuthorizeConnect(action);
        } else {
          await onAuthorizeFolder();
        }
      } else if (action.type === 'read') {
        await onAuthorizeRead(action);
      } else {
        await onAuthorizeWrite(action);
      }
    } finally {
      setBusy(false);
    }
  };

  if (action.type === 'connect') {
    return (
      <div className="my-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 text-xs space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200">
            <FolderOpen className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              {workspaceNeedsPermission && workspaceFolderName
                ? `Riattivazione permesso cartella "${workspaceFolderName}"`
                : 'Autorizzazione cartella locale sul PC'}
            </span>
          </div>
          {status === 'approved' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
              <Check className="w-3 h-3" />
              Cartella collegata
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

        {decision?.message && (
          <div
            className={`text-[11px] font-medium ${
              status === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {decision.message}
          </div>
        )}

        {(status === 'pending' || status === 'error') && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy || isStreaming}
              onClick={() => void handleApprove()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {busy
                ? 'Autorizzazione...'
                : workspaceNeedsPermission && workspaceFolderName
                  ? `Riattiva cartella "${workspaceFolderName}"`
                  : 'Seleziona e autorizza cartella PC'}
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
          </div>
        )}
      </div>
    );
  }

  if (action.type === 'read') {
    return (
      <div className="my-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 text-xs space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200">
            <FileSearch className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>Richiesta autorizzazione lettura file dal PC</span>
          </div>
          {status === 'approved' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
              <Check className="w-3 h-3" />
              Autorizzato
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

        <div className="space-y-1">
          {action.paths.map((p) => (
            <div
              key={p}
              className="rounded-md border border-blue-200/80 dark:border-blue-900/50 bg-white/80 dark:bg-zinc-950/70 px-2.5 py-1 font-mono text-[11px] text-zinc-900 dark:text-zinc-100 break-all"
            >
              {p}
            </div>
          ))}
        </div>

        {decision?.message && (
          <div
            className={`text-[11px] font-medium ${
              status === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {decision.message}
          </div>
        )}

        {(status === 'pending' || status === 'error') && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!workspaceConnected ? (
              <button
                type="button"
                onClick={() => void onAuthorizeFolder()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Autorizza prima la cartella PC
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || isStreaming}
                  onClick={() => void handleApprove()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {busy ? 'Lettura...' : "Autorizza lettura e invia all'AI"}
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

  // Write request card
  const isModify = typeof existingContent === 'string';
  const lineCount = action.content.split(/\r?\n/).length;

  return (
    <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 text-xs space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-amber-950 dark:text-amber-200">
          <FilePenLine className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            {existingContent === undefined
              ? 'Proposta scrittura file su PC'
              : isModify
                ? 'Proposta modifica file esistente su PC'
                : 'Proposta creazione nuovo file su PC'}
          </span>
        </div>

        {status === 'approved' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
            <Check className="w-3 h-3" />
            Scritto su PC
          </span>
        )}
        {status === 'rejected' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shrink-0">
            Rifiutato
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/80 dark:border-amber-900/50 bg-white/80 dark:bg-zinc-950/70 px-2.5 py-1.5">
        <span className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100 break-all">
          {action.path}
        </span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
          {lineCount} righe · {action.content.length} caratteri
        </span>
      </div>

      {action.reason && (
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{action.reason}</p>
      )}

      <div>
        <button
          type="button"
          onClick={() => setPreviewOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:underline"
        >
          {previewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {previewOpen ? 'Nascondi anteprima contenuto' : 'Mostra anteprima contenuto'}
        </button>

        {previewOpen && (
          <pre className="mt-2 max-h-60 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">
            {action.content}
          </pre>
        )}
      </div>

      {decision?.message && (
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium ${
            status === 'error'
              ? 'text-red-600 dark:text-red-400'
              : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {status === 'error' && <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
          <span>{decision.message}</span>
        </div>
      )}

      {(status === 'pending' || status === 'error') && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!workspaceConnected ? (
            <button
              type="button"
              onClick={() => void onAuthorizeFolder()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Autorizza prima la cartella PC
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || isStreaming}
                onClick={() => void handleApprove()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {busy ? 'Scrittura...' : 'Autorizza e scrivi su PC'}
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
