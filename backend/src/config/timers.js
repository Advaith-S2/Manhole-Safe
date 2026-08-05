// Single source of truth for the entry/escalation/confirmation timer
// durations, so the polling job, the permit-open/-exit service, and any
// API response that needs to tell a client "here is the deadline" all agree
// on the same numbers instead of each guessing/duplicating them.
const DEMO_L1_TIMER_MS = 2 * 60 * 1000;
const DEMO_L2_TIMER_MS = 1 * 60 * 1000;
const PROD_L1_TIMER_MS = 45 * 60 * 1000;
const PROD_L2_TIMER_MS = 10 * 60 * 1000;

const DEMO_CONFIRM_WINDOW_SECONDS = 180;
const PROD_CONFIRM_WINDOW_SECONDS = 1800;

const isDemoMode = () => process.env.DEMO_MODE === 'true';

const getL1TimerMs = () => (isDemoMode() ? DEMO_L1_TIMER_MS : PROD_L1_TIMER_MS);
const getL2TimerMs = () => (isDemoMode() ? DEMO_L2_TIMER_MS : PROD_L2_TIMER_MS);

const getConfirmWindowSeconds = () => {
  const defaultWindow = isDemoMode() ? DEMO_CONFIRM_WINDOW_SECONDS : PROD_CONFIRM_WINDOW_SECONDS;
  return Number(process.env.CONFIRM_WINDOW_SECONDS) || defaultWindow;
};

module.exports = {
  isDemoMode,
  getL1TimerMs,
  getL2TimerMs,
  getConfirmWindowSeconds,
};
