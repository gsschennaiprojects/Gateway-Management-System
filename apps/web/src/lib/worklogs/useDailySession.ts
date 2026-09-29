'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getLiveDateInfo,
  calculateWorkingTime,
  calculateLiveElapsedWorkingTime,
  parseTasks,
  LiveDateInfo,
  WorkingTimeCalculation,
} from './worklog-session-utils';

export interface DailySessionState {
  isPunchedIn: boolean;
  isPunchedOut: boolean;
  loginTime: string;
  logoutTime: string;
  plannedTasks: string[];
  completedTasks: string[];
  incompleteReason: string;
  totalHours: string;
  workingCalc: WorkingTimeCalculation | null;
  elapsedTime: { hours: number; minutes: number; formatted: string; shortFormatted: string } | null;
  liveDate: LiveDateInfo;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
}

const SESSION_STORAGE_KEY_PREFIX = 'gss_daily_session_';
const SYNC_EVENT_NAME = 'gss-daily-session-updated';

export function useDailySession() {
  const { user } = useAuth();
  const [liveDate, setLiveDate] = useState<LiveDateInfo>(getLiveDateInfo());
  const [loginTime, setLoginTime] = useState<string>('');
  const [logoutTime, setLogoutTime] = useState<string>('');
  const [plannedTasks, setPlannedTasks] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [totalHours, setTotalHours] = useState<string>('');
  const [isPunchedIn, setIsPunchedIn] = useState<boolean>(false);
  const [isPunchedOut, setIsPunchedOut] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPunchOutModalOpen, setIsPunchOutModalOpen] = useState<boolean>(false);

  // Live timer for elapsed time
  const [elapsedTime, setElapsedTime] = useState<{ hours: number; minutes: number; formatted: string; shortFormatted: string } | null>(null);

  const storageKey = user ? `${SESSION_STORAGE_KEY_PREFIX}${user.id}_${liveDate.isoDate}` : null;

  // Broadcast state changes across components & tabs
  const broadcastSync = useCallback((payload: Partial<DailySessionState>) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail: payload }));
    }
  }, []);

  // Update live clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const nowInfo = getLiveDateInfo();
      setLiveDate(nowInfo);
      if (loginTime && !logoutTime) {
        setElapsedTime(calculateLiveElapsedWorkingTime(loginTime));
      }
    }, 15000); // 15 sec refresh
    return () => clearInterval(timer);
  }, [loginTime, logoutTime]);

  // Recalculate working time or elapsed time whenever login/logout times change
  useEffect(() => {
    if (loginTime && logoutTime) {
      const calc = calculateWorkingTime(loginTime, logoutTime);
      if (calc) {
        queueMicrotask(() => setTotalHours(calc.decimalHours.toFixed(2)));
      }
      queueMicrotask(() => setElapsedTime(null));
    } else if (loginTime && !logoutTime) {
      queueMicrotask(() => setElapsedTime(calculateLiveElapsedWorkingTime(loginTime)));
    } else {
      queueMicrotask(() => setElapsedTime(null));
    }
  }, [loginTime, logoutTime]);

  // Load from API and localStorage
  const loadSession = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // 1. Check local cache first for instant rendering
    if (storageKey && typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.explicitPunch && parsed.loginTime) {
            setLoginTime(parsed.loginTime);
            setIsPunchedIn(true);
          } else {
            setLoginTime('');
            setIsPunchedIn(false);
          }
          if (parsed.explicitPunch && parsed.logoutTime) {
            setLogoutTime(parsed.logoutTime);
            setIsPunchedOut(true);
          }
          if (Array.isArray(parsed.plannedTasks)) setPlannedTasks(parsed.plannedTasks);
          if (Array.isArray(parsed.completedTasks)) setCompletedTasks(parsed.completedTasks);
          if (parsed.incompleteReason) setIncompleteReason(parsed.incompleteReason);
          if (parsed.totalHours) setTotalHours(parsed.totalHours);
        } catch {
          // ignore cache parse error
        }
      }
    }

    // 2. Fetch authoritative state from /api/worklogs
    try {
      const res = await fetch(`/api/worklogs?today=true&targetUserId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.todayLog) {
          const log = data.todayLog;
          const parsedPlanned = parseTasks(log.plannedTasks);
          const parsedCompleted = parseTasks(log.completedTasks);

          if (log.loginTime) {
            setLoginTime(log.loginTime);
            setIsPunchedIn(true);
          } else {
            setLoginTime('');
            setIsPunchedIn(false);
          }
          if (log.logoutTime) {
            setLogoutTime(log.logoutTime);
            setIsPunchedOut(true);
          } else {
            setLogoutTime('');
            setIsPunchedOut(false);
          }
          if (parsedPlanned.length > 0) setPlannedTasks(parsedPlanned);
          if (parsedCompleted.length > 0) setCompletedTasks(parsedCompleted);
          if (log.incompleteReason) setIncompleteReason(log.incompleteReason);
          if (log.totalHours) {
            setTotalHours(String(log.totalHours));
          } else if (log.hoursLogged) {
            setTotalHours(String(log.hoursLogged));
          }

          // Sync local storage
          if (storageKey && typeof window !== 'undefined') {
            localStorage.setItem(
              storageKey,
              JSON.stringify({
                loginTime: log.loginTime || '',
                logoutTime: log.logoutTime || '',
                plannedTasks: parsedPlanned,
                completedTasks: parsedCompleted,
                incompleteReason: log.incompleteReason || '',
                totalHours: String(log.totalHours || log.hoursLogged || ''),
                explicitPunch: !!log.loginTime,
              })
            );
          }
        } else {
          // Do NOT auto-punch on login. Staff will explicitly click the Punch In button to start work.
          setIsPunchedIn(false);
          setLoginTime('');
          setLogoutTime('');
          setIsPunchedOut(false);
        }
      }
    } catch (err) {
      console.warn('[useDailySession] API fetch note:', err);
    } finally {
      setLoading(false);
    }
  }, [user, storageKey]);

  // Initial load
  useEffect(() => {
    void Promise.resolve().then(loadSession);
  }, [loadSession]);

  // Listen for sync events from other components / pages
  useEffect(() => {
    const handleSyncEvent = (e: Event) => {
      const custom = e as CustomEvent<Partial<DailySessionState>>;
      if (custom.detail) {
        const d = custom.detail;
        if (d.loginTime !== undefined) {
          setLoginTime(d.loginTime);
          setIsPunchedIn(!!d.loginTime);
        }
        if (d.logoutTime !== undefined) {
          setLogoutTime(d.logoutTime);
          setIsPunchedOut(!!d.logoutTime);
        }
        if (d.plannedTasks !== undefined) setPlannedTasks(d.plannedTasks);
        if (d.completedTasks !== undefined) setCompletedTasks(d.completedTasks);
        if (d.incompleteReason !== undefined) setIncompleteReason(d.incompleteReason);
        if (d.totalHours !== undefined) setTotalHours(d.totalHours);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(SYNC_EVENT_NAME, handleSyncEvent);
      return () => window.removeEventListener(SYNC_EVENT_NAME, handleSyncEvent);
    }
  }, []);

  // Update localStorage when state changes
  const updateLocalStorage = useCallback(
    (updates: {
      loginTime?: string;
      logoutTime?: string;
      plannedTasks?: string[];
      completedTasks?: string[];
      incompleteReason?: string;
      totalHours?: string;
      explicitPunch?: boolean;
    }) => {
      if (storageKey && typeof window !== 'undefined') {
        const current = localStorage.getItem(storageKey);
        const parsed = current ? JSON.parse(current) : {};
        const merged = { ...parsed, ...updates };
        localStorage.setItem(storageKey, JSON.stringify(merged));
      }
    },
    [storageKey]
  );

  // ── Action: Punch In / Log In (Start Day) ──────────────────────────────────
  const punchIn = useCallback(
    async (customTime?: string): Promise<boolean> => {
      const validPlanned = plannedTasks.map((t) => t.trim()).filter(Boolean);
      if (validPlanned.length === 0) {
        setError('At least one planned task must be entered before logging in.');
        return false;
      }

      const nowInfo = getLiveDateInfo();
      const timeToSet = customTime || nowInfo.currentTime;

      setError(null);

      try {
        const res = await fetch('/api/worklogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'punchIn',
            loginTime: timeToSet,
            date: nowInfo.isoDate,
            plannedTasks: validPlanned,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to record login in database.');
          return false;
        }

        const recordedLoginTime = data.entry?.loginTime || timeToSet;
        setLoginTime(recordedLoginTime);
        setIsPunchedIn(true);
        setSuccess(`Logged in successfully at ${recordedLoginTime}. Planned tasks saved.`);

        updateLocalStorage({ loginTime: recordedLoginTime, plannedTasks: validPlanned, explicitPunch: true });
        broadcastSync({ loginTime: recordedLoginTime, isPunchedIn: true, plannedTasks: validPlanned });
        return true;
      } catch (e) {
        console.error('[punchIn] Error:', e);
        setError('Network error: Unable to record login to database.');
        return false;
      }
    },
    [plannedTasks, updateLocalStorage, broadcastSync]
  );

  // ── Action: Punch Out / Log Out (End Day) ──────────────────────────────────
  const punchOut = useCallback(
    async (customTime?: string): Promise<boolean> => {
      const validCompleted = completedTasks.map((t) => t.trim()).filter(Boolean);
      if (validCompleted.length === 0) {
        setError('At least one completed task must be entered before logging out.');
        return false;
      }

      const validPlanned = plannedTasks.map((t) => t.trim()).filter(Boolean);
      if (validCompleted.length < validPlanned.length) {
        if (!incompleteReason.trim()) {
          setError(
            `Completed tasks (${validCompleted.length}) are fewer than planned tasks (${validPlanned.length}). Please provide the reason for incomplete tasks before logging out.`
          );
          return false;
        }
      }

      const nowInfo = getLiveDateInfo();
      const timeToSet = customTime || nowInfo.currentTime;
      setError(null);

      try {
        const res = await fetch('/api/worklogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'punchOut',
            loginTime,
            logoutTime: timeToSet,
            date: nowInfo.isoDate,
            plannedTasks: validPlanned,
            completedTasks: validCompleted,
            incompleteReason: incompleteReason.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to record logout in database.');
          return false;
        }

        const recordedLogoutTime = data.entry?.logoutTime || timeToSet;
        const workingCalc = data.workingCalc || calculateWorkingTime(loginTime, recordedLogoutTime);
        const formattedTotal = workingCalc ? workingCalc.formatted : 'Unavailable';

        setLogoutTime(recordedLogoutTime);
        setIsPunchedOut(true);
        setTotalHours(formattedTotal);
        setSuccess(`Logged out successfully at ${timeToSet}. Total work duration: ${formattedTotal}`);

        updateLocalStorage({
          logoutTime: recordedLogoutTime,
          completedTasks: validCompleted,
          incompleteReason: incompleteReason.trim(),
          totalHours: formattedTotal,
        });
        broadcastSync({
          logoutTime: recordedLogoutTime,
          isPunchedOut: true,
          completedTasks: validCompleted,
          incompleteReason: incompleteReason.trim(),
          totalHours: formattedTotal,
        });
        return true;
      } catch (e) {
        console.error('[punchOut] Error:', e);
        setError('Network error: Unable to record logout to database.');
        return false;
      }
    },
    [loginTime, plannedTasks, completedTasks, incompleteReason, updateLocalStorage, broadcastSync]
  );

  // ── Step 1 of 2: Request Punch Out (Validates and opens confirmation modal) ─
  const requestPunchOut = useCallback((): boolean => {
    const validCompleted = completedTasks.map((t) => t.trim()).filter(Boolean);
    if (validCompleted.length === 0) {
      setError('At least one completed task must be entered before logging out.');
      return false;
    }

    const validPlanned = plannedTasks.map((t) => t.trim()).filter(Boolean);
    if (validCompleted.length < validPlanned.length) {
      if (!incompleteReason.trim()) {
        setError(
          `Completed tasks (${validCompleted.length}) are fewer than planned tasks (${validPlanned.length}). Please provide the reason for incomplete tasks before logging out.`
        );
        return false;
      }
    }

    setError(null);
    setIsPunchOutModalOpen(true);
    return true;
  }, [completedTasks, plannedTasks, incompleteReason]);

  // Cancel Punch Out (closes modal)
  const cancelPunchOut = useCallback(() => {
    setIsPunchOutModalOpen(false);
  }, []);

  // Step 2 of 2: Confirmed Punch Out (closes modal and saves to database)
  const confirmPunchOut = useCallback(
    async (customTime?: string): Promise<boolean> => {
      setIsPunchOutModalOpen(false);
      return await punchOut(customTime);
    },
    [punchOut]
  );

  const clearPunch = useCallback(async () => {
    setLoginTime('');
    setLogoutTime('');
    setIsPunchedIn(false);
    setIsPunchedOut(false);
    setTotalHours('');
    setElapsedTime(null);

    if (storageKey && typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    broadcastSync({
      loginTime: '',
      logoutTime: '',
      isPunchedIn: false,
      isPunchedOut: false,
      totalHours: '',
    });

    setSuccess('Local worklog display cleared. The recorded attendance was not changed.');
  }, [storageKey, broadcastSync]);

  // ── Action: Save Worklog ──────────────────────────────────────────────────
  const saveSession = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const validPlanned = plannedTasks.map((t) => t.trim()).filter(Boolean);
    const validCompleted = completedTasks.map((t) => t.trim()).filter(Boolean);

    if (loginTime && validPlanned.length === 0) {
      setError('At least one planned task must be entered before saving worklog.');
      setSaving(false);
      return;
    }

    if (logoutTime && validCompleted.length === 0) {
      setError('At least one completed task must be entered before saving worklog.');
      setSaving(false);
      return;
    }

    if (logoutTime && validCompleted.length < validPlanned.length && !incompleteReason.trim()) {
      setError(
        `Completed tasks (${validCompleted.length}) are fewer than planned tasks (${validPlanned.length}). Please provide the reason for incomplete tasks.`
      );
      setSaving(false);
      return;
    }

    const workingCalc = calculateWorkingTime(loginTime, logoutTime);
    const computedHours = workingCalc ? workingCalc.decimalHours.toFixed(2) : totalHours || '8.5';

    updateLocalStorage({
      loginTime,
      logoutTime,
      plannedTasks: validPlanned,
      completedTasks: validCompleted,
      incompleteReason,
      totalHours: computedHours,
    });

    broadcastSync({
      loginTime,
      logoutTime,
      plannedTasks: validPlanned,
      completedTasks: validCompleted,
      incompleteReason,
      totalHours: computedHours,
    });

    try {
      if (loginTime && !logoutTime) {
        const res = await fetch('/api/worklogs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', plannedTasks: validPlanned }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save worklog.');
        setSuccess('Worklog changes saved to the daily record.');
      } else if (!loginTime) {
        setSuccess('Draft saved on this device. The daily record is created when you punch in.');
      } else {
        setSuccess('This worklog is closed. Its recorded values were not changed.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save worklog.');
    } finally {
      setSaving(false);
    }
  }, [user, loginTime, logoutTime, plannedTasks, completedTasks, incompleteReason, totalHours, updateLocalStorage, broadcastSync]);

  // Task Point Mutators
  const updatePlannedTasks = useCallback(
    (newTasks: string[]) => {
      setPlannedTasks(newTasks);
      updateLocalStorage({ plannedTasks: newTasks });
      broadcastSync({ plannedTasks: newTasks });
    },
    [updateLocalStorage, broadcastSync]
  );

  const updateCompletedTasks = useCallback(
    (newTasks: string[]) => {
      setCompletedTasks(newTasks);
      updateLocalStorage({ completedTasks: newTasks });
      broadcastSync({ completedTasks: newTasks });
    },
    [updateLocalStorage, broadcastSync]
  );

  const workingCalc = calculateWorkingTime(loginTime, logoutTime);

  return {
    liveDate,
    loginTime,
    setLoginTime: (t: string) => {
      setLoginTime(t);
      updateLocalStorage({ loginTime: t });
      broadcastSync({ loginTime: t });
    },
    logoutTime,
    setLogoutTime: (t: string) => {
      setLogoutTime(t);
      updateLocalStorage({ logoutTime: t });
      broadcastSync({ logoutTime: t });
    },
    isPunchedIn,
    isPunchedOut,
    plannedTasks,
    setPlannedTasks: updatePlannedTasks,
    completedTasks,
    setCompletedTasks: updateCompletedTasks,
    incompleteReason,
    setIncompleteReason,
    totalHours,
    workingCalc,
    elapsedTime,
    punchIn,
    punchOut,
    isPunchOutModalOpen,
    requestPunchOut,
    cancelPunchOut,
    confirmPunchOut,
    clearPunch,
    saveSession,
    refreshSession: loadSession,
    loading,
    saving,
    error,
    setError,
    success,
    setSuccess,
  };
}
