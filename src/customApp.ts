import options from './options';
import { Roulette } from './roulette';

type GamePanel = {
  key: 'numbers' | 'humans';
  root: HTMLElement;
  roulette: Roulette;
  winner: string | null;
};

type GoalDetail = {
  winner: string;
};

const HUMAN_FILE_URL = new URL('../human.txt', import.meta.url).toString();
const POT_OF_GREED_MAP_INDEX = 2;
const MARBLES_PER_HUMAN = 7;
const COUNTDOWN_STEPS = ['3', '2', '1', '개봉'];

let panels: GamePanel[] = [];
let humanNames: string[] = [];
let isRunning = false;
let finishedCount = 0;
let isSyncingScroll = false;

document.addEventListener('DOMContentLoaded', () => {
  void bootstrap();
});

async function bootstrap() {
  options.useSkills = false;

  const startButton = getElement<HTMLButtonElement>('#btnStart');
  const countdown = getElement<HTMLElement>('#countdown');

  countdown.hidden = true;
  startButton.disabled = true;

  panels = [createPanel('numbers', '#numbers-panel'), createPanel('humans', '#humans-panel')];
  attachScrollSync();
  attachPanelEvents(startButton);

  await Promise.all(panels.map((panel) => waitForReady(panel.roulette)));
  panels.forEach((panel) => {
    panel.roulette.setTheme('pot');
    panel.roulette.setAutoRecording(false);
    panel.roulette.setWinningRank(0);
    panel.roulette.setMap(POT_OF_GREED_MAP_INDEX);
    panel.roulette.setFixedCameraProgress(0);
  });

  try {
    humanNames = await loadHumanNames();
  } catch (error) {
    console.error(error);
    startButton.textContent = 'human.txt 오류';
    return;
  }

  prepareRound();
  startButton.disabled = false;

  startButton.addEventListener('click', async () => {
    if (isRunning || humanNames.length === 0) {
      return;
    }

    prepareRound();
    startButton.disabled = true;

    await runCountdown(countdown);

    isRunning = true;
    panels.forEach((panel) => {
      panel.root.dataset.state = 'running';
      panel.roulette.start();
    });
  });
}

function createPanel(key: GamePanel['key'], rootSelector: string): GamePanel {
  const root = getElement<HTMLElement>(rootSelector);
  const mount = getElement<HTMLElement>(`${rootSelector} .stage-shell`);

  const roulette = new Roulette({
    mount,
    cameraMode: 'fixed',
    showBuiltinUi: false,
    showWinnerBanner: false,
    canvasClassName: 'roulette-canvas',
    initialTheme: 'pot',
  });

  roulette.setAutoRecording(false);
  roulette.setWinningRank(0);

  return {
    key,
    root,
    roulette,
    winner: null,
  };
}

function attachPanelEvents(startButton: HTMLButtonElement) {
  panels.forEach((panel) => {
    panel.roulette.addEventListener('goal', (event) => {
      const winner = (event as CustomEvent<GoalDetail>).detail.winner;
      panel.winner = winner;
      panel.root.dataset.state = 'done';

      finishedCount += 1;
      if (finishedCount === panels.length) {
        isRunning = false;
        startButton.disabled = humanNames.length === 0;
      }
    });
  });
}

function attachScrollSync() {
  panels.forEach((panel) => {
    panel.root.addEventListener('scroll', () => {
      if (isSyncingScroll) {
        return;
      }

      const progress = getScrollProgress(panel.root);
      panels.forEach((targetPanel) => {
        targetPanel.roulette.setFixedCameraProgress(progress);
      });

      isSyncingScroll = true;
      panels.forEach((otherPanel) => {
        if (otherPanel === panel) {
          return;
        }
        otherPanel.root.scrollTop = panel.root.scrollTop;
      });
      isSyncingScroll = false;
    });
  });
}

function prepareRound() {
  finishedCount = 0;
  isRunning = false;

  const numberEntries = Array.from({ length: 51 }, (_, index) => `${index}`);
  const humanEntries = humanNames.map((name) => `${name}*${MARBLES_PER_HUMAN}`);

  panels.forEach((panel) => {
    panel.winner = null;
    panel.root.dataset.state = 'idle';
    panel.root.scrollTop = 0;
  });

  const numbersPanel = panels.find((panel) => panel.key === 'numbers');
  const humansPanel = panels.find((panel) => panel.key === 'humans');

  if (!numbersPanel || !humansPanel) {
    return;
  }

  numbersPanel.roulette.setMarbles(numberEntries);
  humansPanel.roulette.setMarbles(humanEntries);
  numbersPanel.roulette.setWinningRank(numbersPanel.roulette.getCount() - 1);
  humansPanel.roulette.setWinningRank(humansPanel.roulette.getCount() - 1);
  numbersPanel.roulette.setFixedCameraProgress(0);
  humansPanel.roulette.setFixedCameraProgress(0);
}

async function runCountdown(countdown: HTMLElement) {
  countdown.hidden = false;
  countdown.textContent = COUNTDOWN_STEPS[0];
  countdown.classList.remove('is-active');

  for (const step of COUNTDOWN_STEPS) {
    countdown.textContent = step;
    countdown.classList.remove('is-active');
    void countdown.offsetWidth;
    countdown.classList.add('is-active');
    await wait(550);
  }

  countdown.hidden = true;
}

async function loadHumanNames(): Promise<string[]> {
  const response = await fetch(`${HUMAN_FILE_URL}?v=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('human.txt 를 읽지 못했다.');
  }

  const content = await response.text();
  const names = content
    .split(/\r?\n/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !value.startsWith('#'));

  if (names.length === 0) {
    throw new Error('human.txt 가 비어 있다.');
  }

  return names;
}

function waitForReady(roulette: Roulette): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (roulette.isReady) {
        resolve();
        return;
      }
      window.setTimeout(check, 50);
    };

    check();
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getScrollProgress(element: HTMLElement) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 0) {
    return 0;
  }
  return element.scrollTop / maxScroll;
}

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`${selector} 요소를 찾지 못했다.`);
  }
  return element;
}
