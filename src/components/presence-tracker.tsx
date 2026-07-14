"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function PresenceTracker({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      // We don't need to do anything locally, just tracking
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      channel.untrack().then(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [userId]);

  return null;
}
