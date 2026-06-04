'use client';
// components/polls/PollWidget.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useRadioStore } from '@/store/radioStore';
import { getSocket } from '@/lib/socket-client';

export function PollWidget() {
  const poll = useRadioStore((s) => s.activePoll);
  const hasVoted = useRadioStore((s) => s.hasVoted);
  const setHasVoted = useRadioStore((s) => s.setHasVoted);
  const role = useRadioStore((s) => s.myRole);

  const totalVotes = poll?.options.reduce((a, o) => a + o.votes, 0) ?? 0;

  const vote = (optionId: string) => {
    if (!poll || hasVoted) return;
    getSocket().emit('VOTE_POLL', { pollId: poll.id, optionId });
    setHasVoted(true);
  };

  const closePoll = () => {
    if (!poll) return;
    getSocket().emit('CLOSE_POLL', { pollId: poll.id });
  };

  return (
    <AnimatePresence>
      {poll && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="glass w-full p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="mono text-[10px] text-amber-400 tracking-[0.2em] uppercase">
              ◆ Live Poll
            </span>
            <span className="mono text-[10px] text-white/30">
              {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-white font-semibold text-base mb-4 leading-snug">
            {poll.question}
          </p>

          <div className="flex flex-col gap-2">
            {poll.options.map((option) => {
              const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;

              return (
                <button
                  key={option.id}
                  onClick={() => vote(option.id)}
                  disabled={hasVoted || !!poll.closedAt}
                  className="relative overflow-hidden text-left w-full border border-white/10 p-3 disabled:cursor-default group hover:border-amber-500/40 transition-colors"
                >
                  {/* Progress bar */}
                  <motion.div
                    className="absolute inset-0 bg-amber-500/10 origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: pct / 100 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                  <div className="relative flex justify-between items-center">
                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                      {option.label}
                    </span>
                    {hasVoted && (
                      <span className="mono text-xs text-amber-400">{pct}%</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {(role === 'host' || role === 'cohost') && !poll.closedAt && (
            <button
              onClick={closePoll}
              className="mt-4 w-full mono text-xs text-white/30 hover:text-white/60 transition-colors py-2 border border-white/10 hover:border-white/20"
            >
              Close Poll
            </button>
          )}

          {poll.closedAt && (
            <p className="mono text-[10px] text-white/30 mt-3 text-center">
              Poll closed — final results
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
