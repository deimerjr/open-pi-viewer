import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  getCustomProvidersPi,
  disconnectPi,
  getSddProfilesPi,
  saveMcpServerPi,
  deleteMcpServerPi,
  getMessagesPi,
} from '@infra/bridge';
import { ProjectDock } from '@features/projects/ProjectDock';
import { mapProvidersToArray, resolveModelDefaultThinkingLevel } from '@features/providers/providers';
import { isConfigReady, validateConnectConfig } from '@features/settings/config';
import { canRetryConnection } from '@features/settings/connection';
import {
  formatLocalizedDiagnostic,
  formatLocalizedStatus,
  formatLocalizedStatusDetail,
  type TranslationKey,
} from '@shared/i18n';
import {
  ThinkingCard,
  ToolCard,
} from '@features/chat/ActivityBlocks';
import {
  MarkdownContent,
  shouldRenderAsMarkdown,
} from '@features/chat/MarkdownContent';
import { ProcessGroupCard } from '@features/chat/components/ProcessGroupCard';
import { InteractiveQuestionCard } from '@features/chat/components/InteractiveQuestionCard';
import { UserMessageContent } from '@features/chat/components/UserMessageContent';
import {
  groupChatMessages,
  extractProcessItemsFromMessage,
  createProcessGroup,
  isInteractiveUserTool,
} from '@core/process-grouping';
import { getLastAssistantCodeBlocks } from '@core/markdown';
import { copyText } from '@shared/clipboard';
import { isAppTheme } from '@shared/theme';
import { CommandPalettePopover } from '@features/chat/components/CommandPalettePopover';
import {
  matchCommands,
  parseCommandInput,
  type CommandDefinition,
} from '@core/commands/registry';
import { PromptControls } from '@features/chat/PromptControls';
import { isMessageEmpty, calculateContextMetrics } from '@core/prompt-controls-utils';
import {
  multiProjectChatReducer,
  createInitialMultiProjectState,
  getActiveProjectState,
} from '@core/reducer';
import { hydrateChatMessages } from '@core/session';
import { SessionSidebar } from '@features/sessions/SessionSidebar';
import { SettingsView } from '@features/settings/SettingsView';
import { FileTree } from '@features/workspace/FileTree';
import { FileViewerModal } from '@features/workspace/FileViewerModal';
import { ProvidersView } from '@features/providers/ProvidersView';
import { McpView } from '@features/mcp/McpView';
import { ExtensionsView } from '@features/extensions/ExtensionsView';
import { ProfilesView } from '@features/profiles/ProfilesView';
import {
  applyProfileRuntime,
  PROFILE_ACTIVATED_EVENT,
  PROFILE_CLEARED_EVENT,
  type ProfileSummary,
  type ProfileActivationEventDetail,
} from '@core/types/profiles';
import type { ToolCallBlock } from '@core/types/messages';
import { ProfileModal } from '@features/profiles/components/ProfileModal';
import { useProfiles } from '@features/profiles/hooks/useProfiles';
import { STATUS_CONFIG, type AppStatusState } from '@core/icon-status';
import {
  triggerTauriWindowAttention,
  updateFavicon,
  updateWindowTitle,
} from '@infra/icon-status';
import type { ConnectConfig, ConnectResult } from '@core/types/connection';
import { useWorkspaceView } from '@features/workspace/hooks/useWorkspaceView';
import { normalizeWorkspaceKey, getWorkspaceSnapshot } from '@features/workspace/workspace-cache';
import { exportToMarkdown, exportToJson, generateExportFilename } from '@core/export';
import { triggerFileDownload } from '@infra/download';
import { readWorkspaceFilePi } from '@infra/bridge';
import type { SessionSummary } from '@core/types/sessions';
import { useChatScroll } from '@features/chat/hooks/useChatScroll';
import { useSessionEvents } from '@features/chat/hooks/useSessionEvents';
import { useEngramProject } from '@features/chat/hooks/useEngramProject';
import {
  useExtensionUiDialog,
  type AnsweredQuestionRecord,
} from '@features/chat/hooks/useExtensionUiDialog';
import { ExtensionUiPromptBar } from '@features/chat/components/ExtensionUiPromptBar';
import { computeWorkAnimationStyles } from '@infra/preferences';
import { usePreferences } from '@features/settings/hooks/usePreferences';
import { useConnection } from '@features/settings/hooks/useConnection';
import { useProjects } from '@features/projects/hooks/useProjects';
import {
  findProjectByCwd,
  getProjectDisplayName,
  type ProjectItem,
  type ProjectStatusInfo,
  loadProjectsRegistry,
} from '@features/projects/projects';
import { useSessions } from '@features/sessions/hooks/useSessions';
import { usePromptState } from '@features/chat/hooks/usePromptState';
import { useModels } from '@features/providers/hooks/useModels';
import { useMcpServers } from '@features/mcp/hooks/useMcpServers';
import { usePiResources } from '@features/extensions/hooks/usePiResources';

export const App: React.FC = () => {
  const [multiProjectState, multiDispatch] = useReducer(
    multiProjectChatReducer,
    loadProjectsRegistry(undefined, undefined).registry.activeProjectId,
    createInitialMultiProjectState
  );
  const state = getActiveProjectState(multiProjectState);
  const dispatch = multiDispatch;

  // Moved up from its original position (still right after useChatScroll in behavior
  // terms - these are plain derived consts, not hooks, so relocating them earlier has no
  // effect on hook or effect registration order) so `isBusy` is available for useProjects
  // below without forcing useProjects to depend on the reducer directly.
  const isConnected = state.connectionStatus === 'connected';
  const isConnecting = state.connectionStatus === 'connecting';
  const isBusy = state.agentActivity === 'busy';
  const isReadyToInput = isConnected && state.isHydrated && !state.isResetting;
  const isReadyToSend = isReadyToInput && !isBusy;
  const { isHighContext } = calculateContextMetrics(state.sessionStats, state.modelInfo, state.availableModels);

  // Preference for compacting processes by category (+ / -)
  const [isCompactProcesses, setIsCompactProcesses] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pi_viewer_compact_processes');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleCompactProcesses = useCallback(() => {
    setIsCompactProcesses((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pi_viewer_compact_processes', String(next));
      } catch {}
      return next;
    });
  }, []);

  const renderableChatItems = useMemo(() => {
    const nonEmpty = state.messages.filter((msg) => !isMessageEmpty(msg));
    return groupChatMessages(nonEmpty, isCompactProcesses);
  }, [state.messages, isCompactProcesses]);

  // Tail-First progressive chat window: render initial window to keep UI instant on large sessions
  const INITIAL_VISIBLE_ITEMS = 40;
  const BATCH_LOAD_ITEMS = 40;
  const [visibleItemsCount, setVisibleItemsCount] = useState<number>(INITIAL_VISIBLE_ITEMS);
  const prevItemsLengthRef = useRef(renderableChatItems.length);

  // Reset window when session switches
  useEffect(() => {
    setVisibleItemsCount(INITIAL_VISIBLE_ITEMS);
    prevItemsLengthRef.current = renderableChatItems.length;
  }, [state.sessionId]);

  // When new messages arrive during an active turn, expand the window so recent additions stay visible
  useEffect(() => {
    const diff = renderableChatItems.length - prevItemsLengthRef.current;
    if (diff > 0) {
      setVisibleItemsCount((prev) => prev + diff);
    }
    prevItemsLengthRef.current = renderableChatItems.length;
  }, [renderableChatItems.length]);

  const hasOlderItems = renderableChatItems.length > visibleItemsCount;
  const displayedChatItems = useMemo(() => {
    if (!hasOlderItems) return renderableChatItems;
    return renderableChatItems.slice(-visibleItemsCount);
  }, [renderableChatItems, hasOlderItems, visibleItemsCount]);

  const hiddenOlderCount = hasOlderItems ? renderableChatItems.length - visibleItemsCount : 0;

  // Separate Settings draft state for connection configuration. settingsDraft's initial
  // value depends on `config`, which now comes from useConnection below, so its
  // declaration moves there too; the other settings-panel state is independent and stays.
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'general' | 'theme' | 'profiles' | 'providers' | 'mcp' | 'extensions'
  >('general');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsStorageNotice, setSettingsStorageNotice] = useState<string | null>(null);

  const {
    chatViewportRef,
    showScrollBottom,
    handleViewportScroll,
    handleScrollToBottom,
    pinAndHide,
    scrollToBottomNextFrame,
    pinAndJumpToBottom,
  } = useChatScroll({
    messages: state.messages,
    sessionId: state.sessionId,
    showSettings,
  });

  const handleLoadMoreOlderItems = useCallback(() => {
    const viewport = chatViewportRef.current;
    const oldScrollHeight = viewport ? viewport.scrollHeight : 0;
    const oldScrollTop = viewport ? viewport.scrollTop : 0;

    setVisibleItemsCount((prev) => Math.min(prev + BATCH_LOAD_ITEMS, renderableChatItems.length));

    requestAnimationFrame(() => {
      if (viewport) {
        const heightDiff = viewport.scrollHeight - oldScrollHeight;
        viewport.scrollTop = oldScrollTop + heightDiff;
      }
    });
  }, [renderableChatItems.length, chatViewportRef]);

  const handleLoadAllOlderItems = useCallback(async () => {
    setVisibleItemsCount(renderableChatItems.length);
    try {
      const allRaw = await getMessagesPi();
      if (allRaw && allRaw.length > state.messages.length) {
        const hydrated = hydrateChatMessages(allRaw);
        dispatch({
          type: 'SWITCH_SESSION_SUCCESS',
          payload: {
            sessionId: state.sessionId || '',
            sessionFile: state.sessionFile || '',
            messages: hydrated,
          },
        });
        setVisibleItemsCount(hydrated.length);
      }
    } catch {}
  }, [renderableChatItems.length, state.messages.length, state.sessionId, state.sessionFile, dispatch]);

  const onViewportScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      handleViewportScroll(e);
    },
    [handleViewportScroll]
  );

  // Prompt cluster: draft text, send/abort, and the Enter-to-send binding.
  // `pinAndJumpToBottom` is T5a's scroll primitive, injected here rather
  // than imported by the hook itself.
  const {
    prompt,
    setPrompt,
    attachedFiles,
    addAttachedFiles,
    removeAttachedFile,
    clearAttachedFiles,
    handleSend,
    handleAbort,
    handleKeyDown,
    insertCodeIntoPrompt,
  } = usePromptState({
    isReadyToInput,
    isReadyToSend,
    isBusy,
    pendingPromptId: state.pendingPromptId,
    dispatch,
    pinAndJumpToBottom,
  });

  const handleOpenImageInNewTab = useCallback((e: React.MouseEvent, src: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!src) return;
    if (src.startsWith('data:')) {
      try {
        const parts = src.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return;
      } catch {}
    }
    window.open(src, '_blank');
  }, []);

  // Global shortcuts from pi-messages (Alt+C: copy code, Alt+I: insert into prompt)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        const blocks = getLastAssistantCodeBlocks(state.messages);
        if (blocks.length === 0) return;
        e.preventDefault();
        if (blocks.length === 1) {
          void copyText(blocks[0].code);
        } else {
          const allCode = blocks.map((b) => b.code).join('\n\n');
          void copyText(allCode);
        }
      } else if (key === 'i') {
        const blocks = getLastAssistantCodeBlocks(state.messages);
        if (blocks.length === 0) return;
        e.preventDefault();
        const target = blocks[blocks.length - 1];
        insertCodeIntoPrompt(target.code, target.fileName, target.language);
        const textarea = document.querySelector<HTMLTextAreaElement>('.prompt-input');
        if (textarea) {
          textarea.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => {
      window.removeEventListener('keydown', handleGlobalShortcuts);
    };
  }, [state.messages, insertCodeIntoPrompt]);

  // Connection cluster: persisted ConnectConfig, the connection-load storage warning, and
  // the StartupManager instance (attempt lifecycle, coalescing, retry). The onConnect*
  // callbacks are captured once by useConnection at first construction, exactly matching
  // this component's previous mount-frozen closures over `dispatch`/`pinAndJumpToBottom`.
  const {
    config,
    storageWarning,
    setStorageWarning,
    startConnection,
    cancelConnection,
    retryConnection,
    applyConfig,
    applyWorkingDirectory,
  } = useConnection({
    onConnectStart: (cfg: ConnectConfig) => {
      const matched = cfg.workingDirectory
        ? findProjectByCwd(projectsRegistryRef.current.projects, cfg.workingDirectory)
        : undefined;
      const targetProjectId = matched?.id;

      if (targetProjectId) {
        const targetState = multiProjectStateRef.current.projects[targetProjectId];
        if (targetState?.connectionStatus === 'connected' && targetState?.isHydrated === true) {
          return;
        }
      }

      dispatch({
        type: 'CONNECT_START',
        targetProjectId,
      });
    },
    onConnectSuccess: (res: ConnectResult) => {
      const matched = res.canonicalCwd
        ? findProjectByCwd(projectsRegistryRef.current.projects, res.canonicalCwd)
        : undefined;
      let targetProjectId = matched?.id;

      if (!targetProjectId && res.canonicalCwd) {
        addProjectForPath(res.canonicalCwd);
        const recheck = findProjectByCwd(
          projectsRegistryRef.current.projects,
          res.canonicalCwd
        );
        targetProjectId = recheck?.id ?? projectsRegistryRef.current.activeProjectId ?? undefined;
      } else if (!targetProjectId) {
        targetProjectId = projectsRegistryRef.current.activeProjectId ?? undefined;
      }

      if (targetProjectId) {
        const targetState = multiProjectStateRef.current.projects[targetProjectId];
        if (
          targetState?.isHydrated === true &&
          (targetState.messages.length > 0 || targetState.agentActivity === 'busy')
        ) {
          if (targetState.connectionStatus !== 'connected') {
            dispatch({
              type: 'CONNECT_SUCCESS',
              targetProjectId,
              payload: { model: res.model },
            });
          }
          return;
        }
      }

      const hydrated = hydrateChatMessages(res.messages ?? []);
      dispatch({
        type: 'SESSION_READY',
        targetProjectId,
        payload: {
          sessionId: res.sessionId,
          sessionFile: res.sessionFile,
          messages: hydrated,
          model: res.model,
          detail:
            hydrated.length > 0
              ? `Resumed session (${hydrated.length} messages)`
              : 'Connected to fresh session',
        },
      });
      if (targetProjectId === projectsRegistryRef.current.activeProjectId) {
        pinAndJumpToBottom();
      }
    },
    onConnectError: (err: string, cfg?: ConnectConfig) => {
      const matched = cfg?.workingDirectory
        ? findProjectByCwd(projectsRegistryRef.current.projects, cfg.workingDirectory)
        : undefined;
      const targetProjectId = matched?.id;
      dispatch({
        type: 'CONNECT_FAIL',
        targetProjectId,
        payload: { error: err },
      });
    },
    onConfigApplied: (updatedConfig, outcome) => {
      setSettingsDraft(updatedConfig);
      setSettingsError(null);
      setShowSettings(false);
      setSettingsStorageNotice(outcome.settingsStorageNotice);
    },
  });

  const {
    viewingFile,
    fileViewerInitialTab,
    openFile,
    closeFile,
    fileTreeRefreshTrigger,
    requestFileTreeRefresh,
    gitChangesCount,
    handleGitStatusChange,
  } = useWorkspaceView({
    workingDirectory: config.workingDirectory,
    refreshInterval: config.fileTreeRefreshInterval,
  });

  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'files'>('sessions');

  // settingsDraft's initial value depends on `config`, now sourced from useConnection above.
  const [settingsDraft, setSettingsDraft] = useState<ConnectConfig>(config);

  // UI preferences (Language & Theme), separate from connection settings.
  // Owns preferences state, the document-language and theme-sync effects,
  // the PreferencesController wiring, and the `t` translate helper.
  const {
    preferences,
    preferencesWarning,
    dismissPreferencesWarning,
    handleThemeChange,
    handleLanguageChange,
    handleWorkAnimationChange,
    handleCustomThemeColorsChange,
    handleCustomBackgroundChange,
    setNotifications,
    t,
  } = usePreferences();

  const workAnimStyles = useMemo(
    () => computeWorkAnimationStyles(preferences.workAnimation),
    [preferences.workAnimation]
  );

  // Projects cluster: registry state and handlers. Real decision logic (already-active/
  // isBusy no-op guard, and whether removing the active project should switch the working
  // directory) lives in the pure decideSelectProject/decideRemoveProject; this hook is
  // thin glue delegating the actual working-directory switch to the connection cluster's
  // applyWorkingDirectory (the inversion this slice exists to make).
  const {
    projectsRegistry,
    handleSelectProject,
    handleAddProject,
    handleRenameProject,
    handleRemoveProject,
    addProjectForPath,
  } = useProjects({
    workingDirectory: config.workingDirectory,
    isBusy,
    applyWorkingDirectory,
  });

  const projectsRegistryRef = useRef(projectsRegistry);
  projectsRegistryRef.current = projectsRegistry;
  const multiProjectStateRef = useRef(multiProjectState);
  multiProjectStateRef.current = multiProjectState;

  const handleSelectProjectAndSync = useCallback(
    (project: ProjectItem) => {
      dispatch({ type: 'SET_ACTIVE_PROJECT', payload: { projectId: project.id } });
      handleSelectProject(project);
    },
    [dispatch, handleSelectProject]
  );

  const handleRemoveProjectAndSync = useCallback(
    (projectId: string) => {
      dispatch({ type: 'REMOVE_PROJECT_STATE', payload: { projectId } });
      handleRemoveProject(projectId);
    },
    [dispatch, handleRemoveProject]
  );

  const projectStatusMap: Record<string, ProjectStatusInfo> = useMemo(() => {
    const map: Record<string, ProjectStatusInfo> = {};
    for (const project of projectsRegistry.projects) {
      const projState = multiProjectState.projects[project.id];
      if (projState) {
        map[project.id] = {
          connectionState: projState.connectionStatus,
          agentActivity: projState.agentActivity,
          isBusy: projState.agentActivity === 'busy',
        };
      } else {
        map[project.id] = {
          connectionState: 'disconnected',
          agentActivity: 'idle',
          isBusy: false,
        };
      }
    }
    return map;
  }, [projectsRegistry.projects, multiProjectState.projects]);

  // Global extension UI dialog queue visible across project switches
  const {
    activeDialog,
    pendingCount: dialogPendingCount,
    dialogAdapter,
    canGoBack,
    flowAnswers,
    handleSelect: handleDialogSelect,
    handleMultiSelectSubmit: handleDialogMultiSelectSubmit,
    handleInput: handleDialogInput,
    handleConfirm: handleDialogConfirm,
    handleCancel: handleDialogCancel,
    handleBack,
  } = useExtensionUiDialog();

  const handleSelectInteractiveOption = useCallback(
    (label: string) => {
      if (activeDialog) {
        handleDialogSelect(activeDialog.itemKey, label);
      } else {
        setPrompt(label);
        const textarea = document.querySelector<HTMLTextAreaElement>('#prompt-input');
        if (textarea) {
          textarea.focus();
        }
      }
    },
    [activeDialog, handleDialogSelect, setPrompt]
  );

  const handleDialogBack = useCallback(
    (
      itemKey: string,
      targetStep?: number,
      currentDraft?: Partial<AnsweredQuestionRecord>
    ) => {
      handleBack(itemKey, targetStep, currentDraft);
    },
    [handleBack]
  );

  // Session-events cluster: SessionEventController wiring (fresh-value mirror refs,
  // dispatch wrapping for the workspace refresh) and the mount effect that registers
  // bridge listeners and starts the automatic connection. Fused in the original code
  // (sessionEventControllerRef.asBridgeListeners() alongside startConnection/
  // cancelConnection) and kept fused here rather than split across a callback, since
  // requestFileTreeRefresh (workspace), setStorageWarning (connection) and
  // startConnection/cancelConnection (connection) all cross feature lines and arrive as
  // injected callbacks - the hook itself imports none of those features.
  useSessionEvents({
    config,
    sessionId: state.sessionId,
    projects: projectsRegistry.projects,
    activeProjectId: projectsRegistry.activeProjectId,
    dispatch,
    onWorkspaceChanged: requestFileTreeRefresh,
    onStorageWarning: setStorageWarning,
    startConnection,
    cancelConnection,
    dialogAdapter,
    isConfigReadyFn: isConfigReady,
    onMissingConfiguration: ({ diagnostic, partialConfig }) => {
      setShowSettings(true);
      setSettingsError(diagnostic);
      setSettingsDraft((prev) => ({
        ...prev,
        nodePath: prev.nodePath?.trim() ? prev.nodePath : (partialConfig.nodePath || prev.nodePath),
        piEntrypoint: prev.piEntrypoint?.trim() ? prev.piEntrypoint : (partialConfig.piEntrypoint || prev.piEntrypoint),
        workingDirectory: prev.workingDirectory?.trim() ? prev.workingDirectory : (partialConfig.workingDirectory || prev.workingDirectory),
      }));
    },
  });

  // Explicit retry without replaying prompts
  const handleRetry = () => {
    if (isConnecting || state.isResetting) return;
    dispatch({ type: 'CLEAR_ERROR' });
    void retryConnection(config);
  };

  // Sessions-list cluster: loadSessions, the load-on-connect and busy->idle reload
  // effects, and the three session handlers. Real decision logic (the active-session
  // early return, the busy/switching guards, and what happens when a delete or a reset
  // targets the active session) lives in the pure, tested functions in
  // features/sessions/session-actions.ts.
  const { handleSelectSession, handleDeleteSession, handleRenameSession, handleNewConversation } = useSessions({
      activeProjectId: projectsRegistry.activeProjectId,
      connectionStatus: state.connectionStatus,
      config,
      isBusy,
      isConnected,
      isConnecting,
      isResetting: state.isResetting,
      isSwitchingSession: state.isSwitchingSession,
      sessionId: state.sessionId,
      sessionFile: state.sessionFile,
      showSettings,
      setShowSettings,
      dispatch,
      t,
      requestFileTreeRefresh,
      pinAndHide,
      scrollToBottomNextFrame,
      startConnection,
    });

  // Dynamic application status and window title / favicon updater
  const appStatus: AppStatusState = useMemo(() => {
    if (activeDialog) {
      return 'waiting';
    }
    if (isBusy) {
      return 'busy';
    }
    if (isConnected) {
      return 'idle';
    }
    if (state.connectionStatus === 'error') {
      return 'error';
    }
    return 'disconnected';
  }, [activeDialog, isBusy, isConnected, state.connectionStatus]);

  const prevStatusRef = useRef<AppStatusState>(appStatus);

  useEffect(() => {
    updateFavicon(appStatus);
    const label = t(STATUS_CONFIG[appStatus].labelKey as TranslationKey);
    updateWindowTitle(appStatus, label);

    if (
      prevStatusRef.current !== appStatus &&
      (appStatus === 'waiting' || appStatus === 'idle')
    ) {
      void triggerTauriWindowAttention(appStatus);
    }
    prevStatusRef.current = appStatus;
  }, [appStatus, t]);

  // Models cluster: thinking-level overrides map, model/thinking-level selection,
  // manual refresh, and the connect-time effect that fetches available models, thinking
  // levels, session stats, custom providers and the thinking-level overrides map.
  const {
    modelThinkingLevels,
    handleSelectModel,
    handleSelectThinkingLevel,
  } = useModels({
    connectionStatus: state.connectionStatus,
    sessionId: state.sessionId,
    modelInfo: state.modelInfo,
    availableModels: state.availableModels,
    dispatch,
  });

  // The OAuth helper updates auth.json outside Pi RPC. Its model-list command reads
  // a snapshot, so refreshing it requires replacing this project's idle process.
  const providerRefreshInFlight = useRef(false);
  const providerRefreshPending = useRef(false);
  const handleProviderModelsChanged = useCallback(async () => {
    if (state.connectionStatus !== 'connected') return;
    if (isBusy || providerRefreshInFlight.current) {
      // A login can finish during a response. Refresh once the session is idle.
      providerRefreshPending.current = true;
      return;
    }
    providerRefreshPending.current = false;
    providerRefreshInFlight.current = true;
    try {
      await disconnectPi(config.workingDirectory);
      await startConnection(config, { force: true });
    } finally {
      providerRefreshInFlight.current = false;
    }
  }, [state.connectionStatus, isBusy, config, startConnection]);

  useEffect(() => {
    if (!isBusy && state.connectionStatus === 'connected' && providerRefreshPending.current) {
      void handleProviderModelsChanged();
    }
  }, [isBusy, state.connectionStatus, handleProviderModelsChanged]);

  // Global MCP servers managed exclusively in Settings (~/.pi/agent/mcp.json)
  const globalMcp = useMcpServers();

  // Project MCP servers with global defaults & project overrides for the chat prompt bar
  const projectMcp = useMcpServers({ cwd: config.workingDirectory });

  // Global Pi resources managed exclusively in Settings (~/.pi/agent/settings.json)
  const globalPiResources = usePiResources();

  // Project Pi resources with global defaults & project overrides for the chat prompt bar
  const projectPiResources = usePiResources({ cwd: config.workingDirectory });

  // Reactive refresh of MCP servers and Pi resources on session switch or cwd change
  useEffect(() => {
    if (state.connectionStatus === 'connected') {
      void projectMcp.refreshServers();
      void globalMcp.refreshServers();
      void projectPiResources.refreshResources();
      void globalPiResources.refreshResources();
    }
  }, [state.sessionId, state.connectionStatus, config.workingDirectory]);

  // Profiles hook for project-scoped profile selector & global settings
  const profilesHook = useProfiles({
    cwd: config.workingDirectory,
    availableModels: state.availableModels,
  });

  // Zen Mode Escape listener
  useEffect(() => {
    if (!isZenMode) return;
    const handleZenEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !viewingFile && !showSettings && !profilesHook.isModalOpen) {
        setIsZenMode(false);
      }
    };
    window.addEventListener('keydown', handleZenEsc);
    return () => window.removeEventListener('keydown', handleZenEsc);
  }, [isZenMode, viewingFile, showSettings, profilesHook.isModalOpen]);

  // Engram project detection for current working directory
  const {
    engramProject,
    cloudStatus,
    isCheckingCloud,
    checkCloudStatus,
    isEnrolling,
    enrollProject,
    observations: engramObservations,
  } = useEngramProject({ cwd: config.workingDirectory });

  const handleSelectProfile = useCallback(
    async (profile: ProfileSummary | null) => {
      if (!profile) {
        await profilesHook.handleClearProjectActive();
      } else {
        await profilesHook.handleActivateProfile(profile, 'project');
      }
    },
    [profilesHook]
  );

  // Profile runtime synchronization: listen for profile activations / clears across
  // PromptControls and Settings ProfilesView and live-apply default_model and
  // default_effort to the connected session without restart.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onProfileActivated = async (e: Event) => {
      const customEvent = e as CustomEvent<ProfileActivationEventDetail>;
      const activatedProfile = customEvent.detail?.profile;
      if (!activatedProfile) return;

      if (isConnected && !isBusy) {
        await applyProfileRuntime(activatedProfile, {
          isConnected,
          availableModels: state.availableModels,
          onSelectModel: handleSelectModel,
          onSelectThinkingLevel: handleSelectThinkingLevel,
        });
      }

      void profilesHook.refreshProfiles();
    };

    const onProfileCleared = async () => {
      const data = await getSddProfilesPi(config.workingDirectory).catch(() => null);
      await profilesHook.refreshProfiles();

      if (isConnected && !isBusy && data) {
        const globalName = data.globalActiveProfile;
        if (globalName) {
          const globalProf =
            data.profiles.find((p) => p.name === globalName && p.scope === 'global') ||
            data.profiles.find((p) => p.name === globalName);
          if (globalProf) {
            await applyProfileRuntime(globalProf, {
              isConnected,
              availableModels: state.availableModels,
              onSelectModel: handleSelectModel,
              onSelectThinkingLevel: handleSelectThinkingLevel,
            });
          }
        }
      }
    };

    window.addEventListener(PROFILE_ACTIVATED_EVENT, onProfileActivated);
    window.addEventListener(PROFILE_CLEARED_EVENT, onProfileCleared);

    return () => {
      window.removeEventListener(PROFILE_ACTIVATED_EVENT, onProfileActivated);
      window.removeEventListener(PROFILE_CLEARED_EVENT, onProfileCleared);
    };
  }, [
    isConnected,
    isBusy,
    config.workingDirectory,
    state.availableModels,
    handleSelectModel,
    handleSelectThinkingLevel,
    profilesHook,
  ]);

  const handleOpenSettings = (
    tab?: 'general' | 'theme' | 'profiles' | 'providers' | 'mcp' | 'extensions' | React.MouseEvent
  ) => {
    const targetTab = typeof tab === 'string' ? tab : 'general';
    setSettingsDraft(config);
    setSettingsError(null);
    setSettingsStorageNotice(null);
    setSettingsInitialTab(targetTab);
    setShowSettings(true);
  };

  const handleToggleSettings = () => {
    if (showSettings) {
      handleCancelSettings();
    } else {
      handleOpenSettings();
    }
  };

  const handleCancelSettings = () => {
    setSettingsDraft(config);
    setSettingsError(null);
    setSettingsStorageNotice(null);
    setShowSettings(false);
  };


  const handleSaveAndApplySettings = (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent applying settings during active generation
    if (isBusy) {
      setSettingsError('Cannot apply configuration while response generation is active');
      return;
    }

    // Validate fields before persisting
    const validation = validateConnectConfig(settingsDraft);
    if (!validation.valid || !validation.config) {
      setSettingsError(validation.error || 'Invalid configuration');
      return;
    }

    const validConfig = validation.config;

    if (validConfig.workingDirectory !== config.workingDirectory) {
      addProjectForPath(validConfig.workingDirectory);
    }

    // Display storage failures honestly without crashing; apply configuration and
    // restart connection (saveConnectConfig + notice/warning decision + setConfig +
    // forced StartupManager.start now live in useConnection's applyConfig).
    const outcome = applyConfig(validConfig);
    setSettingsStorageNotice(outcome.settingsStorageNotice);
    setSettingsError(null);
    setShowSettings(false);
  };

  // Command palette & recognition for Gentle-AI, Gentle Shell and Pi
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const matchedCommands = useMemo(() => {
    const trimmed = prompt.trimStart();
    if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
      return matchCommands(trimmed);
    }
    return [];
  }, [prompt]);

  useEffect(() => {
    if (matchedCommands.length > 0) {
      setShowCommandPalette(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandPalette(false);
    }
  }, [matchedCommands.length, prompt]);

  const handleCopyCodeAction = useCallback((arg?: string) => {
    const blocks = getLastAssistantCodeBlocks(state.messages);
    if (blocks.length === 0) return;
    if (arg === 'all') {
      const allCode = blocks.map((b) => b.code).join('\n\n');
      void copyText(allCode);
    } else {
      const idx = arg ? parseInt(arg, 10) : NaN;
      if (!isNaN(idx) && idx >= 1 && idx <= blocks.length) {
        void copyText(blocks[idx - 1].code);
      } else {
        void copyText(blocks[blocks.length - 1].code);
      }
    }
  }, [state.messages]);

  const handleInsertCodeAction = useCallback((_arg?: string) => {
    const blocks = getLastAssistantCodeBlocks(state.messages);
    if (blocks.length === 0) return;
    const target = blocks[blocks.length - 1];
    insertCodeIntoPrompt(target.code, target.fileName, target.language);
    const textarea = document.querySelector<HTMLTextAreaElement>('#prompt-input');
    if (textarea) {
      textarea.focus();
    }
  }, [state.messages, insertCodeIntoPrompt]);

  const renderHelpGuide = useCallback(() => {
    const isEs = preferences.language === 'es';
    const guideMarkdown = isEs
      ? `### 🛠 Catálogo de Comandos Reconocidos en Pi-Viewer

#### 🤖 Gentle AI / SDD
| Comando | Descripción | Uso |
| :--- | :--- | :--- |
| \`/sdd-init\` | Inicializar especificación formal y estructura OpenSpec/SDD | \`/sdd-init [nombre]\` |
| \`/sdd-explore\` | Exploración arquitectónica y mapeo de contexto existente | \`/sdd-explore\` |
| \`/sdd-proposal\` | Generar o revisar la propuesta formal de cambios | \`/sdd-proposal\` |
| \`/sdd-spec\` | Especificación de requerimientos y criterios de aceptación | \`/sdd-spec\` |
| \`/sdd-design\` | Documento de diseño técnico y decisiones arquitectónicas | \`/sdd-design\` |
| \`/sdd-tasks\` | Desglose de tareas de implementación ejecutables | \`/sdd-tasks\` |
| \`/sdd-apply\` | Ejecutar tareas de implementación de la fase SDD actual | \`/sdd-apply\` |
| \`/sdd-verify\` | Verificación estricta, suite de pruebas y validación | \`/sdd-verify\` |
| \`/sdd-archive\` | Archivar el cambio SDD verificado y aprobado formalmente | \`/sdd-archive\` |
| \`/sdd-profiles\` | Administrar o listar perfiles de modelos para subagentes | \`/sdd-profiles\` |
| \`/sdd-profile-switch\` | Cambiar perfil activo de subagentes y SDD | \`/sdd-profile-switch <nombre>\` |
| \`/judgment-day\` | Revisión ciega dual adversarial (\`/juzgar\`) | \`/judgment-day\` |
| \`/branch-pr\` | Crear o preparar Pull Request con verificación de issues | \`/branch-pr\` |
| \`/chained-pr\` | Dividir cambios extensos (>400 líneas) en PRs en cadena | \`/chained-pr\` |
| \`/work-unit-commits\` | Planificar commits atómicos como unidades de trabajo | \`/work-unit-commits\` |
| \`/rdd-defect-workflow\`| Gestionar flujo de defectos por autoridad RDD y receipts | \`/rdd-defect-workflow\` |
| \`/btw\` | Conversación lateral paralela sin interrumpir el hilo | \`/btw <pregunta>\` |

#### ⚡ Gentle Shell / pi-messages
| Comando | Descripción | Atajo |
| :--- | :--- | :--- |
| \`/cc\` | Copiar al portapapeles el código del último mensaje (\`/cc all\`) | \`Alt+C\` |
| \`/ci\` | Insertar código en el editor del prompt (\`/ci all\`) | \`Alt+I\` |
| \`/picolor\` | Configurar motor de resaltado (PiColor vs Vanilla) | \`/picolor\` |

#### ⚙️ Pi Core & Controles
| Comando | Descripción |
| :--- | :--- |
| \`/new\` / \`/reset\` | Iniciar nueva conversación reseteando contexto |
| \`/clear\` | Limpiar historial visual en pantalla |
| \`/compact\` | Alternar compactación de procesos por categoría |
| \`/model\` | Cambiar modelo de lenguaje activo |
| \`/thinking\` | Cambiar nivel de razonamiento (off, low, medium, high) |
| \`/theme\` | Cambiar tema visual (DjRomoro, dark, light, etc.) |
| \`/reload\` | Recargar y refrescar el navegador y la sesión |
| \`/stats\` | Ver estadísticas de tokens y contexto |
| \`/settings\` | Abrir panel de configuración |
| \`/mcp\` | Abrir gestión de servidores MCP |
| \`/extensions\` | Abrir gestión de extensiones |
| \`/profiles\` | Abrir gestión de perfiles de agentes |

#### 🖥️ Interacción GUI / Workspace
| Comando | Descripción |
| :--- | :--- |
| \`/open <ruta>\` | Abrir archivo en el visor de código modal (\`/view\`) |
| \`/diff [ruta]\` | Ver diferencias Git de archivo o cambios pendientes |
| \`/files\` | Mostrar y enfocar árbol de archivos en el panel (\`/tree\`) |
| \`/sidebar\` | Mostrar u ocultar barra lateral de sesiones (\`/sessions\`) |
| \`/rename <título>\` | Renombrar título de la sesión activa |
| \`/project [nombre]\` | Cambiar o listar proyectos registrados (\`/projects\`) |
| \`/top\` / \`/bottom\` | Desplazar chat al inicio o al final |
| \`/export [md\|json]\`| Descargar conversación en Markdown o JSON |
| \`/zen\` | Activar o desactivar Modo Zen de concentración (\`/focus\`) |
| \`/detach\` | Eliminar todos los archivos adjuntos del prompt |
`
      : `### 🛠 Recognized Commands in Pi-Viewer

#### 🤖 Gentle AI / SDD
| Command | Description | Usage |
| :--- | :--- | :--- |
| \`/sdd-init\` | Initialize formal specification and OpenSpec/SDD structure | \`/sdd-init [name]\` |
| \`/sdd-explore\` | Architectural exploration and context mapping | \`/sdd-explore\` |
| \`/sdd-proposal\` | Generate or review formal change proposal | \`/sdd-proposal\` |
| \`/sdd-spec\` | Requirements specification and acceptance criteria | \`/sdd-spec\` |
| \`/sdd-design\` | Technical design document and architectural decisions | \`/sdd-design\` |
| \`/sdd-tasks\` | Breakdown implementation tasks into work units | \`/sdd-tasks\` |
| \`/sdd-apply\` | Execute implementation tasks of current SDD phase | \`/sdd-apply\` |
| \`/sdd-verify\` | Strict verification, test suite and phase validation | \`/sdd-verify\` |
| \`/sdd-archive\` | Archive verified and approved SDD change | \`/sdd-archive\` |
| \`/sdd-profiles\` | Manage or list model profiles for subagents | \`/sdd-profiles\` |
| \`/sdd-profile-switch\` | Switch active subagent/SDD model profile | \`/sdd-profile-switch <name>\` |
| \`/judgment-day\` | Blind dual adversarial review | \`/judgment-day\` |
| \`/branch-pr\` | Create or prepare PR with issue verification | \`/branch-pr\` |
| \`/chained-pr\` | Split oversized changes (>400 lines) into chained PRs | \`/chained-pr\` |
| \`/work-unit-commits\` | Plan atomic commits as reviewable work units | \`/work-unit-commits\` |
| \`/rdd-defect-workflow\`| Defect workflow via review authority and receipts | \`/rdd-defect-workflow\` |
| \`/btw\` | Side-conversation thread without interrupting main flow | \`/btw <query>\` |

#### ⚡ Gentle Shell / pi-messages
| Command | Description | Shortcut |
| :--- | :--- | :--- |
| \`/cc\` | Copy code to clipboard from last message (\`/cc all\`) | \`Alt+C\` |
| \`/ci\` | Insert code into prompt editor (\`/ci all\`) | \`Alt+I\` |
| \`/picolor\` | Configure syntax highlighting engine (PiColor vs Vanilla) | \`/picolor\` |

#### ⚙️ Pi Core & Controls
| Command | Description |
| :--- | :--- |
| \`/new\` / \`/reset\` | Start new conversation resetting context |
| \`/clear\` | Clear visual message history on screen |
| \`/compact\` | Toggle process compacting mode by category |
| \`/model\` | Switch active language model |
| \`/thinking\` | Set thinking / reasoning level |
| \`/theme\` | Switch visual theme (DjRomoro, dark, light, etc.) |
| \`/reload\` | Reload and refresh browser and Pi session |
| \`/stats\` | View session token and context statistics |
| \`/settings\` | Open connection configuration panel |
| \`/mcp\` | Open MCP servers management |
| \`/extensions\` | Open Pi extensions management |
| \`/profiles\` | Open agent profiles management |

#### 🖥️ GUI & Workspace Interaction
| Command | Description |
| :--- | :--- |
| \`/open <path>\` | Open file in modal code viewer (\`/view\`) |
| \`/diff [path]\` | Open Git diff viewer for a file or pending changes |
| \`/files\` | Open and focus file tree tab in sidebar (\`/tree\`) |
| \`/sidebar\` | Toggle visibility of sessions and files sidebar |
| \`/rename <title>\` | Rename active conversation title |
| \`/project [name]\` | Switch active project or list registered projects |
| \`/top\` / \`/bottom\` | Scroll smoothly to top or bottom of chat |
| \`/export [md\|json]\`| Download conversation as Markdown or JSON |
| \`/zen\` | Toggle distraction-free Zen Focus Mode (\`/focus\`) |
| \`/detach\` | Remove all attached files or images from prompt |
`;

    dispatch({
      type: 'ADD_SYSTEM_MESSAGE',
      payload: { message: guideMarkdown },
    });
  }, [dispatch, preferences.language]);

  const executeClientCommand = useCallback(
    async (cmd: CommandDefinition, args: string) => {
      switch (cmd.id) {
        case 'cc':
          handleCopyCodeAction(args);
          setPrompt('');
          break;
        case 'ci':
          handleInsertCodeAction(args);
          setPrompt('');
          break;
        case 'new':
          handleNewConversation();
          setPrompt('');
          break;
        case 'clear':
          dispatch({ type: 'CLEAR_MESSAGES' });
          setPrompt('');
          break;
        case 'compact':
          toggleCompactProcesses();
          setPrompt('');
          break;
        case 'reload':
          setPrompt('');
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
          } else {
            handleRetry();
          }
          break;
        case 'settings':
          handleOpenSettings();
          setPrompt('');
          break;
        case 'mcp':
        case 'extensions':
          handleOpenSettings();
          setPrompt('');
          break;
        case 'profiles':
          if (args) {
            const match = profilesHook.profiles.find(
              (p) => p.name.toLowerCase() === args.toLowerCase()
            );
            if (match) {
              void handleSelectProfile(match);
            }
          } else {
            handleOpenSettings();
          }
          setPrompt('');
          break;
        case 'theme':
          if (args && isAppTheme(args)) {
            handleThemeChange(args);
          } else {
            handleOpenSettings('theme');
          }
          setPrompt('');
          break;
        case 'thinking':
          if (args) {
            const validLevels = ['off', 'low', 'medium', 'high'];
            if (validLevels.includes(args.toLowerCase())) {
              handleSelectThinkingLevel(args.toLowerCase() as any);
            }
          }
          setPrompt('');
          break;
        case 'model':
          if (args) {
            const match = state.availableModels.find(
              (m) =>
                Boolean((m.id && m.id.toLowerCase().includes(args.toLowerCase())) ||
                (m.name && m.name.toLowerCase().includes(args.toLowerCase())))
            );
            if (match && match.provider && match.id) {
              void handleSelectModel(match.provider, match.id);
            }
          }
          setPrompt('');
          break;
        case 'picolor':
          dispatch({
            type: 'ADD_SYSTEM_MESSAGE',
            payload: {
              message: `🎨 **PiColor Engine**: Motor semántico activo. Integrado con la paleta de ${preferences.theme}.`,
            },
          });
          setPrompt('');
          break;
        case 'open': {
          const target = args.trim();
          if (!target) {
            dispatch({
              type: 'ADD_SYSTEM_MESSAGE',
              payload: {
                message:
                  preferences.language === 'es'
                    ? '⚠️ Uso: `/open <ruta-archivo>` (Ej: `/open src/app/App.tsx`)'
                    : '⚠️ Usage: `/open <file-path>` (e.g. `/open src/app/App.tsx`)',
              },
            });
          } else {
            try {
              const fileContent = await readWorkspaceFilePi(target, config.workingDirectory);
              openFile(fileContent, 'content');
            } catch (err: any) {
              dispatch({
                type: 'ADD_SYSTEM_MESSAGE',
                payload: {
                  message:
                    preferences.language === 'es'
                      ? `⚠️ No se pudo abrir el archivo \`${target}\`: ${err?.message || 'Archivo no encontrado'}`
                      : `⚠️ Could not open file \`${target}\`: ${err?.message || 'File not found'}`,
                },
              });
            }
          }
          setPrompt('');
          break;
        }
        case 'diff': {
          const target = args.trim();
          if (target) {
            try {
              const fileContent = await readWorkspaceFilePi(target, config.workingDirectory);
              openFile(fileContent, 'diff');
            } catch (err: any) {
              dispatch({
                type: 'ADD_SYSTEM_MESSAGE',
                payload: {
                  message:
                    preferences.language === 'es'
                      ? `⚠️ No se pudo obtener el diff de \`${target}\`: ${err?.message || 'Archivo no encontrado'}`
                      : `⚠️ Could not get diff for \`${target}\`: ${err?.message || 'File not found'}`,
                },
              });
            }
          } else {
            const snapshot = getWorkspaceSnapshot(config.workingDirectory);
            const firstChanged =
              snapshot?.gitStatus?.modifiedFiles?.[0] ||
              snapshot?.gitStatus?.addedFiles?.[0] ||
              snapshot?.gitStatus?.untrackedFiles?.[0];
            if (firstChanged) {
              try {
                const fileContent = await readWorkspaceFilePi(firstChanged, config.workingDirectory);
                openFile(fileContent, 'diff');
              } catch (err: any) {
                dispatch({
                  type: 'ADD_SYSTEM_MESSAGE',
                  payload: {
                    message:
                      preferences.language === 'es'
                        ? `⚠️ Error al abrir diff de \`${firstChanged}\`: ${err?.message || String(err)}`
                        : `⚠️ Error opening diff for \`${firstChanged}\`: ${err?.message || String(err)}`,
                  },
                });
              }
            } else {
              dispatch({
                type: 'ADD_SYSTEM_MESSAGE',
                payload: {
                  message:
                    preferences.language === 'es'
                      ? 'ℹ️ **Git Status**: No hay archivos con cambios pendientes en este repositorio.'
                      : 'ℹ️ **Git Status**: No pending modified files found in this repository.',
                },
              });
            }
          }
          setPrompt('');
          break;
        }
        case 'files':
          dispatch({ type: 'TOGGLE_SIDEBAR', payload: { isOpen: true } });
          setSidebarTab('files');
          setPrompt('');
          break;
        case 'sidebar':
          dispatch({ type: 'TOGGLE_SIDEBAR' });
          setPrompt('');
          break;
        case 'rename': {
          const newTitle = args.trim();
          if (!newTitle) {
            dispatch({
              type: 'ADD_SYSTEM_MESSAGE',
              payload: {
                message:
                  preferences.language === 'es'
                    ? '⚠️ Uso: `/rename <nuevo-título>`'
                    : '⚠️ Usage: `/rename <new-title>`',
              },
            });
          } else if (state.sessionId && state.sessionFile) {
            const currentSession: SessionSummary = {
              id: state.sessionId,
              path: state.sessionFile,
              firstMessage: '',
              messageCount: state.messages.length,
              isActive: true,
            };
            void handleRenameSession(currentSession, newTitle);
            dispatch({
              type: 'ADD_SYSTEM_MESSAGE',
              payload: {
                message:
                  preferences.language === 'es'
                    ? `✓ **Sesión renombrada a**: ${newTitle}`
                    : `✓ **Session renamed to**: ${newTitle}`,
              },
            });
          }
          setPrompt('');
          break;
        }
        case 'project': {
          const query = args.trim().toLowerCase();
          if (!query) {
            const list = projectsRegistry.projects
              .map(
                (p) =>
                  `• **${getProjectDisplayName(p)}** (\`${p.path}\`)${
                    p.id === projectsRegistry.activeProjectId ? ' *(Activo / Active)*' : ''
                  }`
              )
              .join('\n');
            dispatch({
              type: 'ADD_SYSTEM_MESSAGE',
              payload: {
                message:
                  preferences.language === 'es'
                    ? `📁 **Proyectos registrados**:\n\n${list}\n\n*Usa \`/project <nombre>\` para cambiar.*`
                    : `📁 **Registered projects**:\n\n${list}\n\n*Use \`/project <name>\` to switch.*`,
              },
            });
          } else {
            const matched = projectsRegistry.projects.find((p) => {
              const name = (p.customName || '').toLowerCase();
              const folder = (p.path.split(/[/\\]/).pop() || '').toLowerCase();
              const id = p.id.toLowerCase();
              return name.includes(query) || folder.includes(query) || id.includes(query);
            });
            if (matched) {
              void handleSelectProjectAndSync(matched);
              dispatch({
                type: 'ADD_SYSTEM_MESSAGE',
                payload: {
                  message:
                    preferences.language === 'es'
                      ? `🔄 **Cambiando a proyecto**: ${getProjectDisplayName(matched)}`
                      : `🔄 **Switching to project**: ${getProjectDisplayName(matched)}`,
                },
              });
            } else {
              dispatch({
                type: 'ADD_SYSTEM_MESSAGE',
                payload: {
                  message:
                    preferences.language === 'es'
                      ? `⚠️ Proyecto no encontrado para "${args}". Usa \`/project\` para ver la lista.`
                      : `⚠️ Project not found for "${args}". Use \`/project\` to list available projects.`,
                },
              });
            }
          }
          setPrompt('');
          break;
        }
        case 'top':
          if (chatViewportRef.current) {
            chatViewportRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setPrompt('');
          break;
        case 'bottom':
          handleScrollToBottom();
          setPrompt('');
          break;
        case 'export': {
          const format = args.trim().toLowerCase() === 'json' ? 'json' : 'md';
          const activeSession = state.sessions.find(
            (s) => s.id === state.sessionId || s.path === state.sessionFile
          );
          const activeProj = projectsRegistry.projects.find(
            (p) => p.id === projectsRegistry.activeProjectId
          );
          const currentProjectName = activeProj ? getProjectDisplayName(activeProj) : undefined;
          const activeTitle =
            activeSession?.customTitle ||
            activeSession?.firstMessage ||
            currentProjectName ||
            'pi-conversation';
          const filename = generateExportFilename(activeTitle, format);
          const content =
            format === 'json'
              ? exportToJson(state.messages, activeTitle)
              : exportToMarkdown(state.messages, activeTitle);
          const mime =
            format === 'json'
              ? 'application/json;charset=utf-8'
              : 'text/markdown;charset=utf-8';
          const ok = triggerFileDownload(content, filename, mime);
          dispatch({
            type: 'ADD_SYSTEM_MESSAGE',
            payload: {
              message: ok
                ? preferences.language === 'es'
                  ? `📥 **Conversación exportada**: Se descargó el archivo \`${filename}\`.`
                  : `📥 **Conversation exported**: Downloaded file \`${filename}\`.`
                : preferences.language === 'es'
                  ? '⚠️ No se pudo iniciar la descarga en el navegador.'
                  : '⚠️ Could not trigger file download in browser.',
            },
          });
          setPrompt('');
          break;
        }
        case 'zen':
          setIsZenMode((prev) => {
            const next = !prev;
            dispatch({
              type: 'ADD_SYSTEM_MESSAGE',
              payload: {
                message: next
                  ? preferences.language === 'es'
                    ? '🧘 **Modo Zen activado**: Paneles laterales y cabecera ocultos. Presiona `Esc` o ejecuta `/zen` para restaurar.'
                    : '🧘 **Zen Mode activated**: Sidebars and header hidden. Press `Esc` or run `/zen` to restore.'
                  : preferences.language === 'es'
                    ? '🖥️ **Modo Zen desactivado**: Paneles restaurados.'
                    : '🖥️ **Zen Mode deactivated**: Panels restored.',
              },
            });
            return next;
          });
          setPrompt('');
          break;
        case 'detach':
          clearAttachedFiles();
          dispatch({
            type: 'ADD_SYSTEM_MESSAGE',
            payload: {
              message:
                preferences.language === 'es'
                  ? '📎 **Adjuntos eliminados**: El prompt ha quedado sin archivos ni imágenes adjuntas.'
                  : '📎 **Attachments cleared**: All attached files and images removed from prompt.',
            },
          });
          setPrompt('');
          break;
        case 'help':
          renderHelpGuide();
          setPrompt('');
          break;
        default:
          break;
      }
    },
    [
      handleCopyCodeAction,
      handleInsertCodeAction,
      handleNewConversation,
      toggleCompactProcesses,
      handleRetry,
      handleOpenSettings,
      handleSelectProfile,
      handleThemeChange,
      preferences.theme,
      preferences.language,
      handleSelectThinkingLevel,
      state.availableModels,
      state.sessionId,
      state.sessionFile,
      state.messages,
      state.sessions,
      handleSelectModel,
      renderHelpGuide,
      setPrompt,
      dispatch,
      config.workingDirectory,
      openFile,
      handleRenameSession,
      projectsRegistry.projects,
      projectsRegistry.activeProjectId,
      handleSelectProjectAndSync,
      clearAttachedFiles,
      handleScrollToBottom,
      chatViewportRef,
    ]
  );

  const handleSelectCommand = useCallback(
    (cmd: CommandDefinition) => {
      if (
        cmd.id === 'new' ||
        cmd.id === 'clear' ||
        cmd.id === 'reload' ||
        cmd.id === 'settings' ||
        cmd.id === 'compact' ||
        cmd.id === 'picolor' ||
        cmd.id === 'help' ||
        cmd.id === 'sidebar' ||
        cmd.id === 'files' ||
        cmd.id === 'top' ||
        cmd.id === 'bottom' ||
        cmd.id === 'zen' ||
        cmd.id === 'detach'
      ) {
        setShowCommandPalette(false);
        executeClientCommand(cmd, '');
        return;
      }

      if (cmd.id === 'cc' && !prompt.includes('all')) {
        setShowCommandPalette(false);
        executeClientCommand(cmd, '');
        return;
      }

      if (cmd.id === 'export' && !prompt.includes('json') && !prompt.includes('md')) {
        setShowCommandPalette(false);
        executeClientCommand(cmd, 'md');
        return;
      }

      setPrompt(`${cmd.name} `);
      setShowCommandPalette(false);
      const textarea = document.querySelector<HTMLTextAreaElement>('#prompt-input');
      if (textarea) {
        textarea.focus();
      }
    },
    [executeClientCommand, prompt, setPrompt]
  );

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette && matchedCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % matchedCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev - 1 + matchedCommands.length) % matchedCommands.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        handleSelectCommand(matchedCommands[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSelectCommand(matchedCommands[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPalette(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const parsed = parseCommandInput(prompt);
      if (parsed && parsed.command?.isClientAction) {
        e.preventDefault();
        executeClientCommand(parsed.command, parsed.args);
        return;
      }
      if (parsed && parsed.command?.id === 'help') {
        e.preventDefault();
        renderHelpGuide();
        setPrompt('');
        return;
      }
    }

    handleKeyDown(e);
  };


  const activeProject = projectsRegistry.projects.find(
    (p) => p.id === projectsRegistry.activeProjectId
  );
  const activeProjectName = activeProject ? getProjectDisplayName(activeProject) : undefined;

  // Localized presentation mappings preserving reducer contracts
  const localizedStatusLabel = formatLocalizedStatus(
    state.connectionStatus,
    state.agentActivity,
    preferences.language
  );
  const localizedStatusDetail = formatLocalizedStatusDetail(
    state.statusDetail,
    preferences.language
  );

  return (
    <div className={`app-container ${isZenMode ? 'zen-mode' : ''}`}>
      {preferences.customBackground?.image?.enabled && preferences.customBackground?.image?.url && (
        <div
          className="app-custom-background-layer"
          style={{
            backgroundImage: `url("${preferences.customBackground.image.url}")`,
            backgroundSize: preferences.customBackground.image.fit || 'cover',
            backgroundPosition: preferences.customBackground.image.position || 'center',
            backgroundRepeat:
              preferences.customBackground.image.repeat ||
              preferences.customBackground.image.fit === 'repeat'
                ? 'repeat'
                : 'no-repeat',
            opacity: preferences.customBackground.image.opacity ?? 0.4,
            filter: preferences.customBackground.image.blur
              ? `blur(${preferences.customBackground.image.blur}px)`
              : undefined,
          }}
          aria-hidden="true"
        />
      )}
      {isZenMode && (
        <button
          type="button"
          className="btn-exit-zen"
          onClick={() => setIsZenMode(false)}
          title={preferences.language === 'es' ? 'Salir de Modo Zen (Esc)' : 'Exit Zen Mode (Esc)'}
        >
          ✕ {preferences.language === 'es' ? 'Salir de Modo Zen' : 'Exit Zen Mode'}
        </button>
      )}
      <header className="app-header" role="banner">
        <div className="header-brand">
          <button
            type="button"
            className="btn-sidebar-toggle"
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            title={t('sidebar.toggle')}
            aria-label={t('sidebar.toggle')}
            aria-expanded={state.isSidebarOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <div className="brand-mark" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="brand-text">
            <h1 className="brand-title">{t('app.title')}</h1>
            <span className="brand-version">{t('app.version')}</span>
          </div>
        </div>

        <div className="header-controls">
          <div className="header-status" role="status" aria-live="polite">
            <span
              className={`status-indicator status-${state.connectionStatus}`}
              aria-hidden="true"
            />
            <span className="status-label">{localizedStatusLabel}</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm btn-header-reload"
            onClick={() => {
              if (typeof window !== 'undefined' && window.location) {
                window.location.reload();
              } else {
                handleRetry();
              }
            }}
            title={t('header.reload_title')}
            aria-label={t('header.reload_title')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>{t('header.reload')}</span>
          </button>

          {canRetryConnection(state.connectionStatus) && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleRetry}
              disabled={isConnecting || state.isResetting}
              title={t('header.retry_title')}
            >
              {t('action.retry')}
            </button>
          )}
        </div>
      </header>

      {/* Workspace Layout: Sidebar + Main Content */}
      <div className="app-workspace">
        <ProjectDock
          projects={projectsRegistry.projects}
          activeProjectId={projectsRegistry.activeProjectId}
          connectionState={state.connectionStatus}
          agentActivity={state.agentActivity}
          isBusy={isBusy}
          locale={preferences.language}
          onSelectProject={handleSelectProjectAndSync}
          onAddProject={handleAddProject}
          onRenameProject={handleRenameProject}
          onRemoveProject={handleRemoveProjectAndSync}
          projectStatusMap={projectStatusMap}
          isSettingsOpen={showSettings}
          onOpenSettings={handleToggleSettings}
        />

        {state.isSidebarOpen && (
          <SessionSidebar
            projectName={activeProjectName}
            sessions={state.sessions}
            isLoading={state.isSessionsLoading}
            isSwitching={state.isSwitchingSession}
            error={state.sessionsError}
            activeSessionId={state.sessionId}
            activeSessionFile={state.sessionFile}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewConversation}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onClose={() => dispatch({ type: 'TOGGLE_SIDEBAR', payload: { isOpen: false } })}
            locale={preferences.language}
            filesChangesCount={gitChangesCount}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            filesPanel={
              <FileTree
                key={config.workingDirectory ? normalizeWorkspaceKey(config.workingDirectory) : 'empty'}
                workingDirectory={config.workingDirectory}
                locale={preferences.language}
                onOpenFile={openFile}
                refreshInterval={config.fileTreeRefreshInterval}
                refreshTrigger={fileTreeRefreshTrigger}
                onGitStatusChange={handleGitStatusChange}
              />
            }
          />
        )}

        <main className="workspace-main" role="main">
          {showSettings ? (
            <SettingsView
              initialTab={settingsInitialTab}
              config={config}
              settingsDraft={settingsDraft}
              setSettingsDraft={setSettingsDraft}
              preferences={preferences}
              onThemeChange={handleThemeChange}
              onLanguageChange={handleLanguageChange}
              onWorkAnimationChange={handleWorkAnimationChange}
              onCustomThemeColorsChange={handleCustomThemeColorsChange}
              onCustomBackgroundChange={handleCustomBackgroundChange}
              onNotificationsChange={setNotifications}
              settingsError={settingsError}
              settingsStorageNotice={settingsStorageNotice}
              isBusy={isBusy}
              onSaveAndApply={handleSaveAndApplySettings}
              onClose={handleCancelSettings}
              t={t}
              activeProfileName={profilesHook.effectiveActiveProfile}
              activeProfileScope={profilesHook.effectiveScope}
              loadCustomProviders={async () =>
                mapProvidersToArray((await getCustomProvidersPi()).providers || {})
              }
              renderProfiles={(onBackToSettings) => (
                <ProfilesView
                  cwd={config.workingDirectory}
                  isBusy={isBusy}
                  onClose={onBackToSettings}
                />
              )}
              renderProviders={() => (
                <ProvidersView
                  onRefreshModels={handleProviderModelsChanged}
                  t={t}
                  language={preferences.language}
                  isBusy={isBusy}
                />
              )}
              renderMcp={() => (
                <McpView
                  servers={globalMcp.servers}
                  onToggleServer={async (server, enabled) => {
                    await globalMcp.handleToggleServer(server, enabled, 'global');
                    void projectMcp.refreshServers();
                  }}
                  onRefresh={async () => {
                    await globalMcp.refreshServers();
                    void projectMcp.refreshServers();
                  }}
                  onSaveServer={async (payload) => {
                    const res = await saveMcpServerPi({
                      ...payload,
                      scope: 'global',
                      cwd: undefined,
                    });
                    if (res.success) {
                      await globalMcp.refreshServers();
                      void projectMcp.refreshServers();
                      return true;
                    }
                    return false;
                  }}
                  onDeleteServer={async (server) => {
                    const res = await deleteMcpServerPi({
                      name: server.name,
                      scope: 'global',
                      cwd: undefined,
                    });
                    if (res.success) {
                      await globalMcp.refreshServers();
                      void projectMcp.refreshServers();
                      return true;
                    }
                    return false;
                  }}
                  t={t}
                  language={preferences.language}
                  isBusy={isBusy}
                />
              )}
              renderExtensions={() => (
                <ExtensionsView
                  resources={globalPiResources.resources}
                  onToggleResource={async (resource, enabled) => {
                    await globalPiResources.handleToggleResource(resource, enabled, 'global');
                    void projectPiResources.refreshResources();
                  }}
                  onRefresh={async () => {
                    await globalPiResources.refreshResources();
                    void projectPiResources.refreshResources();
                  }}
                  onSaveResource={async (payload, original) => {
                    const ok = await globalPiResources.handleSaveResource(
                      { ...payload, scope: 'global', cwd: undefined },
                      original
                    );
                    if (ok) {
                      void projectPiResources.refreshResources();
                    }
                    return ok;
                  }}
                  onDeleteResource={async (resource) => {
                    const ok = await globalPiResources.handleDeleteResource(resource);
                    if (ok) {
                      void projectPiResources.refreshResources();
                    }
                    return ok;
                  }}
                  t={t}
                  language={preferences.language}
                  isBusy={isBusy}
                />
              )}
            />
          ) : (
            <>
              {/* Connection Storage Diagnostic Banner */}
        {storageWarning && (
          <aside className="storage-warning-banner" role="status">
            <span>{formatLocalizedDiagnostic(storageWarning, preferences.language)}</span>
            <button
              type="button"
              className="btn-dismiss"
              onClick={() => setStorageWarning(null)}
              aria-label={t('action.dismiss_warning')}
            >
              ×
            </button>
          </aside>
        )}

        {/* UI Preferences Diagnostic Banner (Globally exposed on startup and runtime) */}
        {preferencesWarning && (
          <aside className="storage-warning-banner" role="status">
            <span>{formatLocalizedDiagnostic(preferencesWarning, preferences.language)}</span>
            <button
              type="button"
              className="btn-dismiss"
              onClick={dismissPreferencesWarning}
              aria-label={t('action.dismiss_warning')}
            >
              ×
            </button>
          </aside>
        )}

        {/* Error Diagnostics Banner */}
        {state.lastError && (
          <aside className="error-banner" role="alert">
            <div className="error-banner-content">
              <strong>{t('error.prefix')}</strong> {state.lastError}
            </div>
            <div className="error-banner-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRetry}
                disabled={isConnecting || state.isResetting}
              >
                {t('action.retry')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleNewConversation}
                disabled={isConnecting || isBusy || state.isResetting}
              >
                {t('action.new_conversation')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleOpenSettings}
              >
                {t('action.settings')}
              </button>
              <button
                type="button"
                className="btn-dismiss"
                onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
                aria-label={t('action.dismiss_error')}
              >
                ×
              </button>
            </div>
          </aside>
        )}

        {/* Chat History Viewport */}
        <div className="chat-container">
          {state.messages.length > 0 && (
            <div className="chat-toolbar-container">
              <button
                type="button"
                className={`btn-chat-toolbar ${isCompactProcesses ? 'is-active' : ''}`}
                onClick={toggleCompactProcesses}
                title={
                  isCompactProcesses
                    ? t('process.detailed_processes')
                    : t('process.compact_processes')
                }
              >
                <span className="toolbar-glyph" aria-hidden="true">
                  {isCompactProcesses ? '⊟' : '⊞'}
                </span>
                <span>
                  {isCompactProcesses
                    ? t('process.compacted_processes')
                    : t('process.compact_processes')}
                </span>
              </button>
            </div>
          )}

          <section
            ref={chatViewportRef}
            onScroll={onViewportScroll}
            className={`chat-viewport ${state.isSwitchingSession || state.messages.length === 0 ? 'is-empty' : 'has-messages'}`}
            aria-label={t('empty.history_label')}
            tabIndex={0}
          >
          {state.isSwitchingSession ? (
            <div className="empty-state switching-state">
              <div className="spinner" aria-hidden="true" />
              <h3 className="empty-state-title">{t('status.switching_session')}</h3>
            </div>
          ) : state.messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="empty-state-title">
                {isConnected
                  ? t('empty.connected_title')
                  : isConnecting
                    ? t('empty.connecting_title')
                    : state.connectionStatus === 'error'
                      ? t('empty.error_title')
                      : t('empty.offline_title')}
              </h3>
              <p className="empty-state-description">
                {isConnected
                  ? t('empty.connected_desc')
                  : isConnecting
                    ? t('empty.connecting_desc')
                    : state.connectionStatus === 'error'
                      ? state.lastError || t('empty.error_desc_fallback')
                      : t('empty.offline_desc')}
              </p>
              {canRetryConnection(state.connectionStatus) && (
                <div className="empty-state-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleRetry}
                    disabled={isConnecting}
                  >
                    {t('empty.retry_button')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleOpenSettings}
                  >
                    {t('empty.configure_button')}
                  </button>
                </div>
              )}
              <div className="empty-state-meta">
                <span className="meta-badge">{t('empty.meta_strict_lf')}</span>
                <span className="meta-badge">{t('empty.meta_direct_argv')}</span>
                <span className="meta-badge">{t('empty.meta_plain_text')}</span>
                <span className="meta-badge">{t('empty.meta_auto_lifecycle')}</span>
              </div>
            </div>
          ) : (
            <ul className="message-list">
              {hasOlderItems && (
                <li key="load-older-banner" className="chat-history-load-container">
                  <div className="chat-history-load-bar">
                    <button
                      type="button"
                      className="btn-load-older-messages"
                      onClick={handleLoadMoreOlderItems}
                    >
                      <span className="load-icon" aria-hidden="true">↑</span>
                      <span>{t('chat.load_older_messages', { count: hiddenOlderCount })}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-load-all-messages"
                      onClick={handleLoadAllOlderItems}
                    >
                      <span>{t('chat.load_all_messages')}</span>
                    </button>
                  </div>
                </li>
              )}
              {displayedChatItems.map((item) => {
                if (item.type === 'process_group') {
                  return (
                    <li key={item.id} className="message-item message-process-group">
                      <ProcessGroupCard group={item} t={t} />
                    </li>
                  );
                }

                const msg = item.message;
                const processItems = extractProcessItemsFromMessage(msg);
                const textBlocks = msg.blocks?.filter((b) => b.type === 'text') || [];
                const interactiveBlocks =
                  msg.blocks?.filter(
                    (b): b is ToolCallBlock =>
                      b.type === 'tool_call' && isInteractiveUserTool(b.name)
                  ) || [];

                const isPureProcessMessage =
                  msg.role === 'assistant' &&
                  interactiveBlocks.length === 0 &&
                  (!msg.content || msg.content.trim() === '') &&
                  msg.blocks &&
                  msg.blocks.length > 0 &&
                  msg.blocks.every((b) => b.type === 'tool_call' || b.type === 'thinking');

                return (
                  <li
                    key={msg.id}
                    className={`message-item message-${msg.role}${msg.isCancelled ? ' message-cancelled' : ''}${isPureProcessMessage ? ' message-pure-process' : ''}`}
                  >
                    {!isPureProcessMessage && (
                      <div className="message-header">
                        <span className="message-role">
                          {msg.role === 'user' ? (
                            t('message.role_user')
                          ) : msg.role === 'assistant' ? (
                            <span className="odd-agent-oval agent-orchestrator" title="Orquestador">
                              <span className="odd-agent-dot" aria-hidden="true" />
                              <strong className="odd-agent-name">{t('message.role_assistant')}</strong>
                            </span>
                          ) : (
                            t('message.role_system')
                          )}
                        </span>
                        {msg.isCancelled && (
                          <span className="message-badge-cancelled">
                            {t('message.status_cancelled')}
                          </span>
                        )}
                        <span className="message-time">{msg.timestamp}</span>
                      </div>
                    )}
                    <div className={`message-content message-content-${msg.role}`}>
                      {msg.role === 'assistant' && (processItems.length > 0 || interactiveBlocks.length > 0) ? (
                        <div className="activity-blocks">
                          {processItems.length > 0 && (
                            <ProcessGroupCard
                              group={createProcessGroup(`proc-sub-${msg.id}`, processItems, msg.timestamp)}
                              t={t}
                            />
                          )}
                          {interactiveBlocks.map((ib) => (
                            <InteractiveQuestionCard
                              key={ib.id || `interactive-${ib.name}`}
                              block={ib}
                              onSelectOption={handleSelectInteractiveOption}
                              t={t}
                            />
                          ))}
                          {textBlocks.length > 0 ? (
                            textBlocks.map((tb, idx) => (
                              <MarkdownContent
                                key={`text-${idx}`}
                                content={tb.text}
                                onInsertPrompt={insertCodeIntoPrompt}
                                t={t}
                              />
                            ))
                          ) : msg.content ? (
                            <MarkdownContent
                              content={msg.content}
                              onInsertPrompt={insertCodeIntoPrompt}
                              t={t}
                            />
                          ) : null}
                        </div>
                      ) : msg.role === 'assistant' && msg.blocks && msg.blocks.length > 0 ? (
                        <div className="activity-blocks">
                          {msg.blocks.map((block, bIndex) => {
                            if (block.type === 'thinking') {
                              return (
                                <ThinkingCard
                                  key={`thinking-${bIndex}`}
                                  block={block}
                                  t={t}
                                />
                              );
                            }
                            if (block.type === 'tool_call') {
                              if (isInteractiveUserTool(block.name)) {
                                return (
                                  <InteractiveQuestionCard
                                    key={block.id || `interactive-${bIndex}`}
                                    block={block}
                                    onSelectOption={handleSelectInteractiveOption}
                                    t={t}
                                  />
                                );
                              }
                              return (
                                <ToolCard
                                  key={block.id || `tool-${bIndex}`}
                                  block={block}
                                  t={t}
                                />
                              );
                            }
                            if (block.type === 'text') {
                              return (
                                <MarkdownContent
                                  key={`text-${bIndex}`}
                                  content={block.text}
                                  onInsertPrompt={insertCodeIntoPrompt}
                                  t={t}
                                />
                              );
                            }
                            return null;
                          })}
                          {textBlocks.length === 0 && msg.content && (
                            <MarkdownContent
                              content={msg.content}
                              onInsertPrompt={insertCodeIntoPrompt}
                              t={t}
                            />
                          )}
                        </div>
                      ) : shouldRenderAsMarkdown(msg.role) ? (
                        <MarkdownContent
                          content={msg.content}
                          onInsertPrompt={insertCodeIntoPrompt}
                          t={t}
                        />
                      ) : (
                        <UserMessageContent content={msg.content} />
                      )}
                      {msg.images && msg.images.length > 0 && (
                        <div className="message-images-grid">
                          {msg.images.map((imgSrc, imgIdx) => (
                            <a
                              key={`msg-img-${imgIdx}`}
                              href={imgSrc}
                              target="_blank"
                              rel="noreferrer"
                              className="message-image-wrap"
                              onClick={(e) => handleOpenImageInNewTab(e, imgSrc)}
                              title={preferences.language === 'es' ? 'Abrir imagen en una pestaña nueva' : 'Open image in new tab'}
                            >
                              <img src={imgSrc} alt={`Attachment ${imgIdx + 1}`} className="message-image-thumb" />
                            </a>
                          ))}
                        </div>
                      )}
                      {msg.isStreaming && (
                        <span
                          className="streaming-dot"
                          aria-label={t('message.generating')}
                        />
                      )}
                      {msg.isCancelled && (
                        <div className="message-cancelled-notice">
                          <span aria-hidden="true">⏹</span>
                          <span>{t('message.cancelled_note')}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              <li className="scroll-anchor" aria-hidden="true" />
            </ul>
          )}
        </section>

        {showScrollBottom && state.messages.length > 0 && (
          <button
            type="button"
            className="btn-scroll-bottom"
            onClick={handleScrollToBottom}
            title={t('chat.scroll_to_bottom')}
            aria-label={t('chat.scroll_to_bottom')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

        <footer className="app-footer" role="contentinfo">
          {activeDialog ? (
            <ExtensionUiPromptBar
              key="active-extension-ui-prompt"
              dialog={activeDialog}
              pendingCount={dialogPendingCount}
              canGoBack={canGoBack}
              flowAnswers={flowAnswers}
              onBack={handleDialogBack}
              onSelect={handleDialogSelect}
              onMultiSelectSubmit={handleDialogMultiSelectSubmit}
              onInput={handleDialogInput}
              onConfirm={handleDialogConfirm}
              onCancel={handleDialogCancel}
            />
          ) : (
            <form className="prompt-form" onSubmit={handleSend}>
          <div className="prompt-field-group">
            <div className="prompt-header-row">
              <div className="prompt-label-wrapper">
                <label htmlFor="prompt-input" className="prompt-label">
                  {t('prompt.label')}
                </label>
                {isBusy ? (
                  <section
                    className={workAnimStyles.className}
                    style={workAnimStyles.style as React.CSSProperties}
                    aria-live="polite"
                  >
                    <div className="loader" aria-hidden="true">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                        <div key={`dot-l-${i}`} className="dot" style={{ '--i': i } as React.CSSProperties} />
                      ))}
                    </div>
                    <h2>Working</h2>
                    <div className="loader" aria-hidden="true">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                        <div key={`dot-r-${i}`} className="dot" style={{ '--i': i } as React.CSSProperties} />
                      ))}
                    </div>
                  </section>
                ) : (
                  <span
                    className={`prompt-status-dot status-${state.connectionStatus}`}
                    title={localizedStatusDetail || localizedStatusLabel}
                    aria-label={t('prompt.status_dot_aria', { status: localizedStatusLabel })}
                  />
                )}
              </div>
              <span id="prompt-status-hint" className={`prompt-hint ${isBusy ? 'is-busy' : ''}`}>
                {isBusy
                  ? t('prompt.hint_busy')
                  : state.isResetting
                    ? t('prompt.hint_resetting')
                    : !state.isHydrated && isConnected
                      ? t('prompt.hint_hydrating')
                      : isConnected
                        ? t('prompt.hint_ready')
                        : isConnecting
                          ? t('prompt.hint_connecting')
                          : t('prompt.hint_disabled')}
              </span>
            </div>

            {attachedFiles.length > 0 && (
              <div className="prompt-attachments-list">
                {attachedFiles.map((file) => (
                  <div key={file.id} className="prompt-attachment-chip">
                    {file.type === 'video' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    ) : file.type === 'audio' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    ) : file.type === 'image' && file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="attachment-thumb"
                        onClick={(e) => file.previewUrl && handleOpenImageInNewTab(e, file.previewUrl)}
                        style={{ cursor: 'pointer' }}
                        title={preferences.language === 'es' ? 'Abrir imagen en una pestaña nueva' : 'Open image in new tab'}
                      />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                        <polyline points="13 2 13 9 20 9" />
                      </svg>
                    )}
                    <span className="attachment-name" title={file.name}>{file.name}</span>
                    <button
                      type="button"
                      className="btn-remove-attachment"
                      onClick={() => removeAttachedFile(file.id)}
                      title={t('prompt_controls.remove_attachment')}
                      aria-label={t('prompt_controls.remove_attachment')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="command-palette-wrapper">
              {showCommandPalette && matchedCommands.length > 0 && (
                <CommandPalettePopover
                  commands={matchedCommands}
                  selectedIndex={selectedCommandIndex}
                  onSelectCommand={handleSelectCommand}
                  locale={preferences.language}
                />
              )}

              <textarea
                id="prompt-input"
                name="prompt"
                className={`prompt-textarea ${isHighContext ? 'context-pulse-red' : ''}`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                onPaste={async (e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;

                  const imageFiles: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.startsWith('image/')) {
                      const file = item.getAsFile();
                      if (file) imageFiles.push(file);
                    }
                  }

                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    for (const file of imageFiles) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        const base64Data = dataUrl.split(',')[1] || '';
                        addAttachedFiles([
                          {
                            id: `paste-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            name: file.name || `image-${Date.now()}.png`,
                            size: file.size,
                            type: 'image',
                            mimeType: file.type || 'image/png',
                            data: base64Data,
                            previewUrl: dataUrl,
                          },
                        ]);
                      };
                      reader.readAsDataURL(file);
                    }
                  }
                }}
                placeholder={
                  isConnecting
                    ? t('prompt.placeholder_connecting')
                    : state.isResetting
                      ? t('prompt.placeholder_resetting')
                      : !state.isHydrated && isConnected
                        ? t('prompt.placeholder_hydrating')
                        : state.connectionStatus === 'error'
                          ? t('prompt.placeholder_error')
                          : !isConnected
                            ? t('prompt.placeholder_offline')
                            : isBusy
                              ? (preferences.language === 'es'
                                  ? 'Escriba un mensaje para encolar... (Enter para enviar a la cola)'
                                  : 'Type a message to queue... (Enter to queue)')
                              : t('prompt.placeholder_ready')
                }
                disabled={!isReadyToInput}
                aria-disabled={!isReadyToInput}
                aria-describedby="prompt-status-hint"
                rows={3}
              />
            </div>

            <PromptControls
              modelInfo={state.modelInfo}
              availableModels={state.availableModels}
              isChangingModel={state.isChangingModel}
              thinkingLevel={state.thinkingLevel}
              defaultThinkingLevel={resolveModelDefaultThinkingLevel(state.modelInfo, modelThinkingLevels, state.availableThinkingLevels)}
              availableThinkingLevels={state.availableThinkingLevels}
              sessionStats={state.sessionStats}
              isHighContext={isHighContext}
              isConnected={isConnected}
              isBusy={isBusy}
              canSend={isReadyToInput && (prompt.trim().length > 0 || attachedFiles.length > 0)}
              attachedFiles={attachedFiles}
              onAttachFiles={addAttachedFiles}
              onAbort={handleAbort}
              onSelectModel={handleSelectModel}
              onSelectThinkingLevel={handleSelectThinkingLevel}
              mcpServers={projectMcp.servers}
              mcpActiveCount={projectMcp.activeCount}
              mcpTotalCount={projectMcp.totalCount}
              onToggleMcpServer={projectMcp.handleToggleProjectServer}
              piResources={projectPiResources.resources}
              piActiveCount={projectPiResources.activeCount}
              piTotalCount={projectPiResources.totalCount}
              onTogglePiResource={projectPiResources.handleToggleProjectResource}
              engramProject={engramProject}
              cloudStatus={cloudStatus}
              isCheckingCloud={isCheckingCloud}
              onCheckCloudStatus={checkCloudStatus}
              isEnrolling={isEnrolling}
              onEnrollProject={enrollProject}
              engramObservations={engramObservations}
              profiles={profilesHook.profiles}
              activeProfileName={profilesHook.effectiveActiveProfile}
              effectiveScope={profilesHook.effectiveScope}
              isChangingProfile={profilesHook.activatingName !== null}
              onSelectProfile={handleSelectProfile}
              onCreateProfile={profilesHook.openCreateModal}
              t={t}
            />
          </div>
        </form>
          )}
      </footer>
            </>
          )}
        </main>
      </div>

      {viewingFile && (
        <FileViewerModal
          file={viewingFile}
          workingDirectory={config.workingDirectory}
          onClose={closeFile}
          locale={preferences.language}
          initialTab={fileViewerInitialTab}
        />
      )}

      {profilesHook.isModalOpen && (
        <ProfileModal
          isOpen={profilesHook.isModalOpen}
          isEditing={profilesHook.isEditing}
          isSaving={profilesHook.isSaving}
          formData={profilesHook.formData}
          error={profilesHook.modalError}
          availableModels={profilesHook.availableModels}
          categories={profilesHook.categories}
          agentMeta={profilesHook.agentMeta}
          cwd={config.workingDirectory}
          onClose={profilesHook.closeModal}
          onChangeField={profilesHook.updateFormField}
          onChangeAgentModel={profilesHook.updateAgentModel}
          onRemoveAgentOverride={profilesHook.removeAgentOverride}
          onSave={async (e) => {
            await profilesHook.handleSaveProfile(e);
          }}
        />
      )}
    </div>
  );
};
