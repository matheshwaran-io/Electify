"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { getReplayEvents } from "@/app/actions/replay";
import { SeatAllocationChart } from "./seat-allocation-chart";
import { EventFeed } from "./event-feed";
import { TimelineSlider } from "./timeline-slider";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, FastForward, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function ReplayEngine({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      const res = await getReplayEvents(eventId);
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  const events = data?.events || [];
  const electives = data?.electives || [];
  const eventDetails = data?.eventDetails;

  // Derive current state up to currentIndex
  const currentState = useMemo(() => {
    const seatMap = new Map<string, number>();
    // initialize all with maxSeats
    electives.forEach((el: any) => {
      seatMap.set(el.id, el.maxSeats);
    });

    let registrationsCount = 0;
    
    // Apply events sequentially up to the current index
    for (let i = 0; i <= currentIndex; i++) {
      const ev = events[i];
      if (!ev) continue;
      
      if (ev.subjectId && ev.seatAfter !== null) {
        seatMap.set(ev.subjectId, ev.seatAfter);
      }

      if (ev.eventType === "STUDENT_REGISTERED") registrationsCount++;
      if (ev.eventType === "REGISTRATION_RESET") {
        if (ev.metadata?.countRefunded) {
          registrationsCount -= ev.metadata.countRefunded;
        }
      }
    }

    return { seatMap, registrationsCount };
  }, [events, electives, currentIndex]);

  useEffect(() => {
    if (isPlaying) {
      if (currentIndex >= events.length - 1) {
        setIsPlaying(false);
        return;
      }
      playTimerRef.current = setTimeout(() => {
        setCurrentIndex(prev => Math.min(prev + 1, events.length - 1));
      }, 1000 / speedMultiplier);
    }
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentIndex, events.length, speedMultiplier]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        No events recorded for this registration session yet.
      </div>
    );
  }

  const currentEvent = events[currentIndex];
  const progress = events.length > 1 ? (currentIndex / (events.length - 1)) * 100 : 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Hero */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Registration Replay</h2>
          <p className="text-sm text-[var(--muted-foreground)]">{eventDetails?.name}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Total Events</p>
            <p className="text-2xl font-mono text-[var(--foreground)]">{events.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Registrations</p>
            <p className="text-2xl font-mono text-[var(--foreground)]">{currentState.registrationsCount}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Panel - Feed */}
        <div className="w-1/3 bg-[var(--card)] border border-[var(--border)] rounded-2xl flex flex-col min-h-0 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background)]/50 shrink-0">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--muted-foreground)]">Live Event Feed</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
            <EventFeed events={events} currentIndex={currentIndex} />
          </div>
        </div>

        {/* Right Panel - Visualization */}
        <div className="w-2/3 bg-[var(--card)] border border-[var(--border)] rounded-2xl flex flex-col min-h-0 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background)]/50 shrink-0">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--muted-foreground)]">Seat Allocation</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <SeatAllocationChart electives={electives} seatMap={currentState.seatMap} currentEventId={currentEvent?.subjectId} />
          </div>
        </div>
      </div>

      {/* Playback Controls & Slider */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentIndex(0)}
              className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-colors shadow-md"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <button 
              onClick={() => setCurrentIndex(events.length - 1)}
              className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 4, 8].map(speed => (
              <button
                key={speed}
                onClick={() => setSpeedMultiplier(speed)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  speedMultiplier === speed 
                    ? "bg-indigo-500/20 text-indigo-500" 
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-[var(--muted-foreground)] w-20 text-right">
            {currentEvent?.timestamp ? format(new Date(currentEvent.timestamp), "HH:mm:ss") : "00:00:00"}
          </span>
          <TimelineSlider 
            progress={progress} 
            max={events.length > 0 ? events.length - 1 : 0} 
            value={currentIndex} 
            onChange={(val) => {
              setCurrentIndex(val);
              setIsPlaying(false);
            }} 
          />
          <span className="text-xs font-mono text-[var(--muted-foreground)] w-20">
            {events.length > 0 ? format(new Date(events[events.length - 1].timestamp), "HH:mm:ss") : "00:00:00"}
          </span>
        </div>
      </div>
    </div>
  );
}
