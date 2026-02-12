const SCHEDULE_STORAGE_KEY = 'workout-schedules-2026-v6';
const YEARS = [2026, 2027, 2028, 2029, 2030];
const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

const navButtons = document.querySelectorAll('.nav-button');
const screens = document.querySelectorAll('.screen');

const calendarYearTitle = document.getElementById('calendar-year-title');
const prevYearBtn = document.getElementById('prev-year-btn');
const nextYearBtn = document.getElementById('next-year-btn');
const calendarEl = document.getElementById('calendar');

const entryModal = document.getElementById('entry-modal');
const entryTitle = document.getElementById('entry-title');
const schedulerForm = document.getElementById('scheduler-form');
const bodyPartInput = document.getElementById('body-part');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const sendPlanBtn = document.getElementById('send-plan-btn');
const importPlanBtn = document.getElementById('import-plan-btn');
const closeEntryBtn = document.getElementById('close-entry-btn');
const exerciseRows = document.getElementById('exercise-rows');
const rowTemplate = document.getElementById('exercise-row-template');

const transferPanel = document.getElementById('transfer-panel');
const transferHelp = document.getElementById('transfer-help');
const transferCalendar = document.getElementById('transfer-calendar');

const stopwatchCard = document.querySelector('.stopwatch-card');
const stopwatchBodypartEl = document.getElementById('stopwatch-bodypart');
const stopwatchExerciseEl = document.getElementById('stopwatch-exercise');
const timerMetaEl = document.getElementById('timer-meta');
const timerEl = document.getElementById('timer');
const restLabelEl = document.getElementById('rest-label');
const timerFlashEl = document.getElementById('timer-flash');
const queueListEl = document.getElementById('queue-list');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');

const restSettingBtn = document.getElementById('rest-setting-btn');
const restSettingModal = document.getElementById('rest-setting-modal');
const restSecondsInput = document.getElementById('rest-seconds-input');
const restSaveBtn = document.getElementById('rest-save-btn');
const restClearBtn = document.getElementById('rest-clear-btn');
const restCloseBtn = document.getElementById('rest-close-btn');

const statsCard = document.getElementById('stats-card');
const statsSummary = document.getElementById('stats-summary');
const statsDetailBtn = document.getElementById('stats-detail-btn');
const statsDetailModal = document.getElementById('stats-detail-modal');
const statsDetailList = document.getElementById('stats-detail-list');
const statsDetailCloseBtn = document.getElementById('stats-detail-close-btn');

const statusModal = document.getElementById('status-modal');
const modalMessageEl = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

let schedules = loadSchedules();
let selectedYear = 2026;
let selectedDateKey = null;
let transferMode = null;

let planForStopwatch = null;
let queue = [];
let currentIndex = 0;
let mode = 'idle';
let elapsedMs = 0;
let tickerId = null;
let timerStartedAt = 0;
let infoTimeoutId = null;
let infoVisible = false;
let autoCloseTimeoutId = null;
let touchStartX = 0;

let restLimitSeconds = null;
let workoutDurations = [];
let restDurations = [];
let actionLogs = [];

function loadSchedules() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSchedules() {
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
}

function showModal(message, autoCloseMs = 0) {
  if (autoCloseTimeoutId) clearTimeout(autoCloseTimeoutId);
  modalMessageEl.textContent = message;
  if (!statusModal.open) statusModal.showModal();
  if (autoCloseMs > 0) {
    autoCloseTimeoutId = setTimeout(() => {
      if (statusModal.open) statusModal.close();
      autoCloseTimeoutId = null;
    }, autoCloseMs);
  }
}

function pulseFade(el) {
  el.classList.remove('fade-in');
  void el.offsetWidth;
  el.classList.add('fade-in');
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getCurrentMonthForYear(year) {
  const now = new Date();
  return now.getFullYear() === year ? now.getMonth() + 1 : 1;
}

function monthOrder(year) {
  const start = getCurrentMonthForYear(year);
  const after = [];
  const before = [];
  for (let m = 1; m <= 12; m += 1) {
    if (m >= start) after.push(m);
    else before.push(m);
  }
  return [...after, ...before];
}

function renderCalendar() {
  calendarYearTitle.textContent = `${selectedYear}년 운동 달력`;
  calendarEl.innerHTML = '';

  monthOrder(selectedYear).forEach((month) => {
    const block = document.createElement('section');
    block.className = 'month-block';

    const title = document.createElement('h3');
    title.className = 'month-title';
    title.textContent = `${selectedYear}년 ${month}월`;

    const grid = document.createElement('div');
    grid.className = 'days-grid';

    weekDays.forEach((day) => {
      const label = document.createElement('div');
      label.className = 'day-label';
      label.textContent = day;
      grid.appendChild(label);
    });

    const firstDay = new Date(selectedYear, month - 1, 1).getDay();
    const lastDate = new Date(selectedYear, month, 0).getDate();

    for (let i = 0; i < firstDay; i += 1) {
      const empty = document.createElement('div');
      empty.className = 'day-empty';
      grid.appendChild(empty);
    }

    for (let day = 1; day <= lastDate; day += 1) {
      const dateKey = formatDateKey(selectedYear, month, day);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day-button';
      if (selectedDateKey === dateKey) btn.classList.add('selected');

      const dateNum = document.createElement('span');
      dateNum.className = 'date-num';
      dateNum.textContent = String(day);
      btn.appendChild(dateNum);

      const saved = schedules[dateKey];
      if (saved?.bodyPart) {
        const tag = document.createElement('span');
        tag.className = 'bodypart-tag';
        tag.textContent = saved.bodyPart;
        btn.appendChild(tag);
      }

      btn.addEventListener('click', () => openEntryModal(dateKey));
      grid.appendChild(btn);
    }

    block.append(title, grid);
    calendarEl.appendChild(block);
  });
}

function createExerciseRow(initial = { exerciseName: '', sets: '', reps: '' }) {
  const fragment = rowTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.exercise-row');
  const [nameInput, setsInput, repsInput] = row.querySelectorAll('input');
  const removeBtn = row.querySelector('.remove-row');

  nameInput.value = initial.exerciseName || '';
  setsInput.value = initial.sets || '';
  repsInput.value = initial.reps || '';

  removeBtn.addEventListener('click', () => {
    row.remove();
    if (exerciseRows.children.length === 0) createExerciseRow();
  });

  exerciseRows.appendChild(row);
}

function collectExercises() {
  return [...exerciseRows.querySelectorAll('.exercise-row')]
    .map((row) => ({
      exerciseName: row.querySelector('input[name="exerciseName"]').value.trim(),
      sets: Number(row.querySelector('input[name="sets"]').value),
      reps: Number(row.querySelector('input[name="reps"]').value)
    }))
    .filter((e) => e.exerciseName && e.sets > 0 && e.reps > 0);
}

function setExercisesToForm(exercises) {
  exerciseRows.innerHTML = '';
  if (!exercises?.length) {
    createExerciseRow();
    return;
  }
  exercises.forEach((exercise) => createExerciseRow(exercise));
}

function openEntryModal(dateKey) {
  selectedDateKey = dateKey;
  entryTitle.textContent = `${dateKey} 운동 입력`;

  const saved = schedules[dateKey];
  bodyPartInput.value = saved?.bodyPart || '';
  setExercisesToForm(saved?.exercises || []);

  hideTransferPanel();
  renderCalendar();
  entryModal.showModal();
  pulseFade(entryModal.querySelector('.entry-card'));
}

function closeEntryModal() {
  entryModal.close();
  hideTransferPanel();
}

function hideTransferPanel() {
  transferMode = null;
  transferPanel.hidden = true;
  transferCalendar.innerHTML = '';
  transferPanel.classList.remove('fade-in');
}

function selectedFormPlan() {
  const bodyPart = bodyPartInput.value.trim();
  const exercises = collectExercises();
  if (!bodyPart || exercises.length === 0) return null;
  return { bodyPart, exercises };
}

function renderTransferCalendar(modeValue) {
  transferCalendar.innerHTML = '';
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  weekDays.forEach((label) => {
    const head = document.createElement('div');
    head.className = 'transfer-day-head';
    head.textContent = label;
    transferCalendar.appendChild(head);
  });

  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();

  for (let i = 0; i < firstDay; i += 1) {
    const empty = document.createElement('div');
    empty.className = 'transfer-day transfer-empty';
    transferCalendar.appendChild(empty);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const dateKey = formatDateKey(year, month, day);
    const dayBtn = document.createElement('button');
    dayBtn.type = 'button';
    dayBtn.className = 'transfer-day';

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(day);
    dayBtn.appendChild(num);

    if (modeValue === 'import') {
      const mini = document.createElement('div');
      mini.className = 'mini-list';
      const plan = schedules[dateKey];
      mini.innerHTML = plan?.exercises?.length ? plan.exercises.map((e) => e.exerciseName).join('<br />') : '-';
      dayBtn.appendChild(mini);
    }

    dayBtn.addEventListener('click', () => {
      if (modeValue === 'send') {
        const currentPlan = selectedFormPlan();
        if (!currentPlan) {
          showModal('운동스케줄이 없습니다.', 2000);
          hideTransferPanel();
          return;
        }
        schedules[dateKey] = JSON.parse(JSON.stringify(currentPlan));
        saveSchedules();
        renderCalendar();
        showModal('완료되었습니다.', 2000);
        hideTransferPanel();
        return;
      }

      const sourcePlan = schedules[dateKey];
      if (!sourcePlan) {
        showModal('선택한 날짜에 운동 스케줄이 없습니다.', 2000);
        return;
      }

      bodyPartInput.value = sourcePlan.bodyPart;
      setExercisesToForm(sourcePlan.exercises);
      showModal(`${dateKey}일자의 운동 스케줄을 가져왔습니다.`, 2000);
    });

    transferCalendar.appendChild(dayBtn);
  }
}

function showTransferPanel(modeValue) {
  const isSameOpen = !transferPanel.hidden && transferMode === modeValue;
  if (isSameOpen) {
    hideTransferPanel();
    return;
  }

  const currentPlan = selectedFormPlan();
  if (modeValue === 'send' && !currentPlan) {
    showModal('운동스케줄이 없습니다.', 2000);
    return;
  }

  transferMode = modeValue;
  transferPanel.hidden = false;
  transferHelp.textContent = modeValue === 'send' ? '해당 운동스케줄을 보낼 날짜를 선택해주세요.' : '가져올 날짜를 선택해주세요.';
  renderTransferCalendar(modeValue);
  pulseFade(transferPanel);
}

function getTodayPlan() {
  const now = new Date();
  const key = formatDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return schedules[key] || null;
}

function resetStats() {
  workoutDurations = [];
  restDurations = [];
  actionLogs = [];
  statsCard.hidden = true;
  statsSummary.textContent = '';
  statsDetailList.innerHTML = '';
}

function buildQueueFromPlan(plan) {
  planForStopwatch = plan;
  resetStats();

  if (!plan || !plan.exercises?.length) {
    queue = [];
    currentIndex = 0;
    mode = 'idle';
    renderStopwatchHead();
    renderQueue();
    resetTimerOnly();
    return;
  }

  queue = plan.exercises.map((e) => ({ ...e, setsRemaining: e.sets }));
  currentIndex = 0;
  mode = 'idle';
  stopTicker();
  resetTimerOnly();
  renderStopwatchHead();
  renderQueue();
}

function renderStopwatchHead() {
  stopwatchCard.classList.toggle('resting', mode === 'rest');
  restLabelEl.hidden = mode !== 'rest';

  if (!planForStopwatch || !queue.length) {
    stopwatchBodypartEl.textContent = '운동스케줄 없음';
    stopwatchExerciseEl.textContent = '오늘 일정이 없습니다.';
    return;
  }

  stopwatchBodypartEl.textContent = planForStopwatch.bodyPart;
  const current = queue[currentIndex];
  stopwatchExerciseEl.textContent = !current || mode === 'finished' ? '모든 운동 완료' : `${current.exerciseName} · ${current.reps}회`;
}

function renderQueue() {
  queueListEl.innerHTML = '';

  if (!planForStopwatch || !queue.length) {
    const li = document.createElement('li');
    li.className = 'plan-item';
    li.textContent = '당일 운동 스케줄이 없습니다.';
    queueListEl.appendChild(li);
    return;
  }

  queue.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'plan-item';
    if (item.setsRemaining <= 0) li.classList.add('done');
    if ((mode === 'workout' || mode === 'rest') && index === currentIndex && item.setsRemaining > 0) li.classList.add('running');
    li.textContent = `[${planForStopwatch.bodyPart}] ${item.exerciseName} / ${item.reps}회 / 남은 세트 ${item.setsRemaining}`;
    queueListEl.appendChild(li);
  });
}

function formatTime(ms) {
  const totalCentiseconds = Math.floor(ms / 10);
  const cs = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
}

function renderTimer() {
  timerEl.textContent = formatTime(elapsedMs);
}

function resetTimerOnly() {
  elapsedMs = 0;
  renderTimer();
  if (!infoVisible) timerEl.hidden = false;
  timerFlashEl.hidden = true;
}

function startTicker() {
  if (tickerId) return;
  timerStartedAt = Date.now() - elapsedMs;
  tickerId = setInterval(() => {
    elapsedMs = Date.now() - timerStartedAt;
    renderTimer();

    if (mode === 'rest' && restLimitSeconds !== null && elapsedMs >= restLimitSeconds * 1000) {
      restDurations.push(elapsedMs);
      actionLogs.push(`[${new Date().toLocaleTimeString()}] 자동 재시작 (쉬는시간 ${formatTime(elapsedMs)})`);
      handleStart();
    }
  }, 10);
}

function stopTicker() {
  if (!tickerId) return;
  clearInterval(tickerId);
  tickerId = null;
}

function showInfoOverlay(text) {
  if (infoTimeoutId) clearTimeout(infoTimeoutId);
  infoVisible = true;
  timerMetaEl.hidden = false;
  timerMetaEl.textContent = text;
  pulseFade(timerMetaEl);
  timerEl.hidden = true;

  infoTimeoutId = setTimeout(() => {
    timerMetaEl.hidden = true;
    timerMetaEl.textContent = '';
    timerEl.hidden = false;
    infoVisible = false;
    infoTimeoutId = null;
  }, 2000);
}

function moveToNextExerciseIfNeeded() {
  while (queue[currentIndex] && queue[currentIndex].setsRemaining <= 0) currentIndex += 1;
  if (!queue[currentIndex]) mode = 'finished';
}

function buildStats() {
  const totalRest = restDurations.reduce((a, b) => a + b, 0);
  const avgRest = restDurations.length ? totalRest / restDurations.length : 0;
  const totalWorkout = workoutDurations.reduce((a, b) => a + b.duration, 0);
  const avgWorkoutByExercise = queue.length ? totalWorkout / queue.length : 0;

  statsSummary.textContent = `평균 쉬는시간: ${formatTime(avgRest)} / 1종목 당 평균 운동시간: ${formatTime(avgWorkoutByExercise)}`;
  statsCard.hidden = false;

  statsDetailList.innerHTML = '';
  workoutDurations.forEach((entry, idx) => {
    const li = document.createElement('li');
    li.className = 'plan-item';
    li.textContent = `${idx + 1}. ${entry.type} · ${entry.name} · ${entry.note} · ${formatTime(entry.duration)} · ${entry.time}`;
    statsDetailList.appendChild(li);
  });

  actionLogs.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'plan-item';
    li.textContent = entry;
    statsDetailList.appendChild(li);
  });
}

function handleStart() {
  if (!queue.length || mode === 'finished') return;

  if (mode === 'rest') {
    stopTicker();
    if (elapsedMs > 0) restDurations.push(elapsedMs);
    resetTimerOnly();
    mode = 'workout';
    renderStopwatchHead();
    renderQueue();
    const current = queue[currentIndex];
    if (current) {
      const currentSet = current.sets - current.setsRemaining + 1;
      showInfoOverlay(`${current.exerciseName} • 현재세트 ${currentSet}세트 • 개수 ${current.reps}회`);
      actionLogs.push(`[${new Date().toLocaleTimeString()}] START · ${current.exerciseName} · 현재세트 ${currentSet}`);
    }
    startTicker();
    return;
  }

  if (mode === 'idle') {
    mode = 'workout';
    resetTimerOnly();
    renderStopwatchHead();
    renderQueue();
    const current = queue[currentIndex];
    if (current) {
      const currentSet = current.sets - current.setsRemaining + 1;
      showInfoOverlay(`${current.exerciseName} • 현재세트 ${currentSet}세트 • 개수 ${current.reps}회`);
      actionLogs.push(`[${new Date().toLocaleTimeString()}] START · ${current.exerciseName} · 현재세트 ${currentSet}`);
    }
    startTicker();
    return;
  }

  if (mode === 'workout' && !tickerId) startTicker();
}

function handleStop() {
  if (!queue.length || mode === 'finished') return;

  if (mode === 'rest') {
    stopTicker();
    actionLogs.push(`[${new Date().toLocaleTimeString()}] STOP · 쉬는시간 일시정지 · ${formatTime(elapsedMs)}`);
    return;
  }

  if (mode !== 'workout') return;

  const current = queue[currentIndex];
  if (!current) return;

  stopTicker();
  workoutDurations.push({
    type: 'WORKOUT',
    name: current.exerciseName,
    note: `개수 ${current.reps}회`,
    duration: elapsedMs,
    time: new Date().toLocaleTimeString()
  });

  current.setsRemaining -= 1;
  showInfoOverlay(`${current.exerciseName} • 남은세트 ${Math.max(current.setsRemaining, 0)}세트 • 개수 ${current.reps}회`);
  actionLogs.push(`[${new Date().toLocaleTimeString()}] STOP · ${current.exerciseName} · 남은세트 ${Math.max(current.setsRemaining, 0)}`);

  moveToNextExerciseIfNeeded();
  if (mode === 'finished') {
    resetTimerOnly();
    renderStopwatchHead();
    renderQueue();
    buildStats();
    return;
  }

  mode = 'rest';
  resetTimerOnly();
  renderStopwatchHead();
  renderQueue();
  startTicker();
}

function handleReset() {
  stopTicker();
  if (infoTimeoutId) {
    clearTimeout(infoTimeoutId);
    infoTimeoutId = null;
  }
  infoVisible = false;
  timerMetaEl.hidden = true;
  timerMetaEl.textContent = '';
  buildQueueFromPlan(getTodayPlan());
}

function goPrevYear() {
  const idx = YEARS.indexOf(selectedYear);
  selectedYear = YEARS[(idx - 1 + YEARS.length) % YEARS.length];
  renderCalendar();
  calendarEl.scrollTo({ top: 0 });
}

function goNextYear() {
  const idx = YEARS.indexOf(selectedYear);
  selectedYear = YEARS[(idx + 1) % YEARS.length];
  renderCalendar();
  calendarEl.scrollTo({ top: 0 });
}

function attachSwipeForYear() {
  calendarEl.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
  });

  calendarEl.addEventListener('touchend', (event) => {
    const endX = event.changedTouches[0].clientX;
    const diff = touchStartX - endX;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) goNextYear();
    else goPrevYear();
  });
}

function switchTab(targetId) {
  screens.forEach((screen) => {
    const active = screen.id === targetId;
    screen.classList.toggle('active', active);
    screen.hidden = !active;
  });

  navButtons.forEach((button) => {
    const active = button.dataset.target === targetId;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (targetId === 'stopwatch-screen') buildQueueFromPlan(getTodayPlan());
}

schedulerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!selectedDateKey) return;

  const bodyPart = bodyPartInput.value.trim();
  const exercises = collectExercises();
  if (!bodyPart || exercises.length === 0) return;

  schedules[selectedDateKey] = { bodyPart, exercises };
  saveSchedules();
  renderCalendar();
  showModal('저장이 완료되었습니다.', 2000);
  closeEntryModal();
});

sendPlanBtn.addEventListener('click', () => showTransferPanel('send'));
importPlanBtn.addEventListener('click', () => showTransferPanel('import'));
addExerciseBtn.addEventListener('click', () => createExerciseRow());
closeEntryBtn.addEventListener('click', closeEntryModal);

startBtn.addEventListener('click', handleStart);
stopBtn.addEventListener('click', handleStop);
resetBtn.addEventListener('click', handleReset);

restSettingBtn.addEventListener('click', () => {
  restSecondsInput.value = restLimitSeconds === null ? '' : String(restLimitSeconds);
  restSettingModal.showModal();
});
restSaveBtn.addEventListener('click', () => {
  const v = Number(restSecondsInput.value);
  restLimitSeconds = Number.isFinite(v) && v > 0 ? v : null;
  restSettingModal.close();
  showModal(restLimitSeconds === null ? '쉬는시간이 무제한으로 설정되었습니다.' : `쉬는시간 ${restLimitSeconds}초로 설정되었습니다.`, 2000);
});
restClearBtn.addEventListener('click', () => {
  restLimitSeconds = null;
  restSecondsInput.value = '';
  showModal('쉬는시간 설정이 초기화되었습니다.', 2000);
});
restCloseBtn.addEventListener('click', () => restSettingModal.close());

statsDetailBtn.addEventListener('click', () => statsDetailModal.showModal());
statsDetailCloseBtn.addEventListener('click', () => statsDetailModal.close());

prevYearBtn.addEventListener('click', goPrevYear);
nextYearBtn.addEventListener('click', goNextYear);
modalCloseBtn.addEventListener('click', () => statusModal.close());

navButtons.forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.target));
});

function bootstrap() {
  renderCalendar();
  attachSwipeForYear();
  buildQueueFromPlan(getTodayPlan());
}

bootstrap();
