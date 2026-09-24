import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { NO_UNREAD, NoticeArea, UnreadByArea, fetchUnreadByArea, markAreaRead } from './academyNotices';
import { useAuth } from './auth';
import { supabase } from './supabase';

type AcademyRealtimeValue = {
  /** Unread notices per tab, for the bell drawn on each one. */
  unread: UnreadByArea;
  /** Bumps when an enrolment is requested, approved or withdrawn. */
  enrolmentsVersion: number;
  /** Bumps on any new message or new thread. */
  messagesVersion: number;
  /** Clears one tab's bell. Called when the owner opens that tab. */
  markRead: (area: NoticeArea) => void;
  refresh: () => void;
};

const AcademyRealtimeContext = createContext<AcademyRealtimeValue>({
  unread: NO_UNREAD,
  enrolmentsVersion: 0,
  messagesVersion: 0,
  markRead: () => {},
  refresh: () => {},
});

export function AcademyRealtimeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [unread, setUnread] = useState<UnreadByArea>(NO_UNREAD);
  const [enrolmentsVersion, setEnrolmentsVersion] = useState(0);
  const [messagesVersion, setMessagesVersion] = useState(0);

  const userId = session?.user?.id ?? null;

  const refresh = useCallback(() => {
    if (!userId) {
      setUnread(NO_UNREAD);
      return;
    }

    // RLS narrows this to the owner's own staff row, so no filter is needed.
    fetchUnreadByArea().then(setUnread);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    // One channel for everything the Academy tab needs live. Realtime cannot
    // apply an RLS-derived filter, so changes arrive unfiltered and the counts
    // are re-read, which RLS narrows.
    const channel = supabase
      .channel(`owner-academy-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'academy', table: 'notifications' }, () =>
        refresh()
      )
      .on('postgres_changes', { event: '*', schema: 'academy', table: 'enrolments' }, () =>
        setEnrolmentsVersion((value) => value + 1)
      )
      .on('postgres_changes', { event: '*', schema: 'academy', table: 'messages' }, () =>
        setMessagesVersion((value) => value + 1)
      )
      .on('postgres_changes', { event: '*', schema: 'academy', table: 'conversations' }, () =>
        setMessagesVersion((value) => value + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markRead = useCallback(
    (area: NoticeArea) => {
      // Cleared here first so the bell goes out the moment the tab opens,
      // rather than after a round trip.
      setUnread((current) => ({ ...current, [area]: 0 }));
      markAreaRead(area).then(() => refresh());
    },
    [refresh]
  );

  const value = useMemo<AcademyRealtimeValue>(
    () => ({ unread, enrolmentsVersion, messagesVersion, markRead, refresh }),
    [unread, enrolmentsVersion, messagesVersion, markRead, refresh]
  );

  return (
    <AcademyRealtimeContext.Provider value={value}>{children}</AcademyRealtimeContext.Provider>
  );
}

export function useAcademyRealtime() {
  return useContext(AcademyRealtimeContext);
}
