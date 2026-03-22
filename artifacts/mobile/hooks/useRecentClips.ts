import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import type { MusicAttachment } from "@/context/MessagingContext";

const STORAGE_KEY = "vibeMsg_recentClips";
const MAX_CLIPS = 12;

function clipKey(c: MusicAttachment) {
  return `${c.id}|${c.clipStart ?? 0}|${c.clipEnd ?? c.duration}|${c.playMode}|${c.delaySeconds ?? 0}`;
}

export function useRecentClips() {
  const [recentClips, setRecentClips] = useState<MusicAttachment[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setRecentClips(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const saveClip = useCallback((clip: MusicAttachment) => {
    setRecentClips((prev) => {
      const deduped = prev.filter((c) => clipKey(c) !== clipKey(clip));
      const next = [clip, ...deduped].slice(0, MAX_CLIPS);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeClip = useCallback((clip: MusicAttachment) => {
    setRecentClips((prev) => {
      const next = prev.filter((c) => clipKey(c) !== clipKey(clip));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setRecentClips([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return { recentClips, saveClip, removeClip, clearAll };
}
