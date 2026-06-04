'use client';
// components/schedule/ScheduleBoard.tsx
import { motion } from 'framer-motion';
import { useRadioStore, ScheduleSlot } from '@/store/radioStore';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isCurrentSlot(slot: ScheduleSlot): boolean {
  const now = new Date();
  const day = now.getDay();
  if (slot.dayOfWeek !== day) return false;

  const [h, m] = slot.startTime.split(':').map(Number);
  const slotStart = h * 60 + m;
  const slotEnd = slotStart + slot.durationMin;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return nowMin >= slotStart && nowMin < slotEnd;
}

function getNextShowIn(slot: ScheduleSlot): string | null {
  const now = new Date();
  const day = now.getDay();
  const [h, m] = slot.startTime.split(':').map(Number);
  let daysUntil = ((slot.dayOfWeek - day + 7) % 7);
  if (daysUntil === 0) {
    const slotStart = h * 60 + m;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= slotStart + slot.durationMin) daysUntil = 7;
  }
  if (daysUntil === 0) return 'Now';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

export function ScheduleBoard() {
  const schedule = useRadioStore((s) => s.schedule);

  if (schedule.length === 0) {
    return (
      <div className="glass p-6 text-center">
        <p className="mono text-xs text-white/20 tracking-wider">No shows scheduled yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase mb-1">
        Schedule
      </span>
      {schedule.map((slot, i) => {
        const current = isCurrentSlot(slot);
        const nextIn = getNextShowIn(slot);

        return (
          <motion.div
            key={slot.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-start gap-4 p-4 border-l-2 ${
              current
                ? 'border-amber-400 bg-amber-500/5'
                : 'border-white/10 hover:border-white/20'
            } transition-colors`}
          >
            <div className="flex flex-col items-center w-10 flex-shrink-0">
              <span className="mono text-[10px] text-white/40 uppercase">
                {DAYS[slot.dayOfWeek]}
              </span>
              <span className="mono text-sm font-bold text-white/70">
                {slot.startTime}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {current && (
                  <span className="mono text-[9px] text-amber-400 tracking-widest uppercase">
                    ● Live now
                  </span>
                )}
                <span className="text-sm font-semibold text-white truncate">
                  {slot.showName}
                </span>
              </div>
              <span className="mono text-[11px] text-white/40">
                {slot.hostName} · {slot.durationMin}min
              </span>
              {slot.description && (
                <p className="text-xs text-white/30 mt-1 line-clamp-2">
                  {slot.description}
                </p>
              )}
            </div>

            {!current && (
              <span className="mono text-[10px] text-white/25 flex-shrink-0 pt-1">
                {nextIn}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
