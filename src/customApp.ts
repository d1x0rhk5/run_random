import options from './options';
import { Roulette } from './roulette';

type GamePanel = {
  key: 'numbers' | 'humans';
  label: string;
  root: HTMLElement;
  result: HTMLElement;
  meta: HTMLElement;
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
const OMENS = [
  '오늘의 공은 끝까지 사람을 속인다.',
  '기회는 두 번 오지 않지만 공은 두 트랙을 돈다.',
  '가장 느린 공이 마지막에 판을 뒤집을 수도 있다.',
  '욕망은 흔들리고, 결과만 남는다.',
];

let panels: GamePanel[] = [];
let humanNames: string[] = [];
let isRunning = false;
let finishedCount = 0;
let round = 1;

document.addEventListener('DOMContentLoaded', () => {
  void bootstrap();
});

async function bootstrap() {
  options.useSkills = false;

  const startButton = getElement<HTMLButtonElement>('#btnStart');
  const reloadButton = getElement<HTMLButtonElement>('#btnReloadHumans');
  const countdown = getElement<HTMLElement>('#countdown');
  const status = getElement<HTMLElement>('#appStatus');
  const summary = getElement<HTMLElement>('#roundSummary');
  const omen = getElement<HTMLElement>('#omenLine');
  const humanFileNote = getElement<HTMLElement>('#humanFileNote');

  summary.hidden = true;
  countdown.hidden = true;
  setStatus(status, '룰렛 엔진을 깨우는 중...');

  panels = [
    createPanel('numbers', '0-50 숫자', '#numbers-panel', '#numbers-result', '#numbers-meta'),
    createPanel('humans', 'human.txt 명단', '#humans-panel', '#humans-result', '#humans-meta'),
  ];

  attachPanelEvents(status, summary);

  startButton.disabled = true;
  reloadButton.disabled = true;

  await Promise.all(panels.map((panel) => waitForReady(panel.roulette)));
  panels.forEach((panel) => {
    panel.roulette.setTheme('pot');
    panel.roulette.setAutoRecording(false);
    panel.roulette.setWinningRank(0);
    panel.roulette.setMap(POT_OF_GREED_MAP_INDEX);
  });

  try {
    humanNames = await loadHumanNames();
    humanFileNote.textContent = `${humanNames.length}명 로드 완료`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'human.txt 를 읽지 못했다.';
    humanFileNote.textContent = message;
    setStatus(status, message);
  }

  prepareRound(summary);
  rotateOmen(omen);
  if (humanNames.length > 0) {
    setStatus(status, '두 개의 항아리가 준비됐다. 봉인을 열면 동시에 달린다.');
  }

  startButton.disabled = humanNames.length === 0;
  reloadButton.disabled = false;

  startButton.addEventListener('click', async () => {
    if (isRunning) {
      return;
    }

    prepareRound(summary);
    rotateOmen(omen);
    setStatus(status, `Round ${round} 의식을 시작한다.`);
    startButton.disabled = true;
    reloadButton.disabled = true;

    await runCountdown(countdown);

    isRunning = true;
    panels.forEach((panel) => {
      panel.root.dataset.state = 'running';
      panel.roulette.start();
    });
  });

  reloadButton.addEventListener('click', async () => {
    if (isRunning) {
      return;
    }

    reloadButton.disabled = true;
    setStatus(status, 'human.txt 를 다시 읽는 중...');
    try {
      const refreshedNames = await loadHumanNames();
      humanNames = refreshedNames;
      humanFileNote.textContent = `${humanNames.length}명 로드 완료`;
      prepareRound(summary);
      setStatus(status, `${humanNames.length}명의 이름을 다시 장전했다.`);
      startButton.disabled = humanNames.length === 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : '명단을 읽지 못했다.';
      humanFileNote.textContent = message;
      setStatus(status, message);
      startButton.disabled = humanNames.length === 0;
    } finally {
      reloadButton.disabled = false;
    }
  });
}

function createPanel(
  key: GamePanel['key'],
  label: string,
  rootSelector: string,
  resultSelector: string,
  metaSelector: string
): GamePanel {
  const root = getElement<HTMLElement>(rootSelector);
  const mount = getElement<HTMLElement>(`${rootSelector} .stage-shell`);
  const result = getElement<HTMLElement>(resultSelector);
  const meta = getElement<HTMLElement>(metaSelector);

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
    label,
    root,
    result,
    meta,
    roulette,
    winner: null,
  };
}

function attachPanelEvents(status: HTMLElement, summary: HTMLElement) {
  panels.forEach((panel) => {
    panel.roulette.addEventListener('goal', (event) => {
      const winner = (event as CustomEvent<GoalDetail>).detail.winner;
      panel.winner = winner;
      panel.result.textContent = winner;
      panel.root.dataset.state = 'done';

      finishedCount += 1;
      if (finishedCount === 1) {
        setStatus(status, `${panel.label} 결과 확정: ${winner}. 다른 항아리도 곧 따라온다.`);
      }

      if (finishedCount === panels.length) {
        isRunning = false;
        setStatus(status, `Round ${round} 종료. 다시 열면 새로 섞는다.`);
        revealSummary(summary);
        round += 1;
        getElement<HTMLButtonElement>('#btnStart').disabled = humanNames.length === 0;
        getElement<HTMLButtonElement>('#btnReloadHumans').disabled = false;
      }
    });
  });
}

function prepareRound(summary: HTMLElement) {
  finishedCount = 0;
  isRunning = false;
  summary.hidden = true;

  const numberEntries = Array.from({ length: 51 }, (_, index) => `${index}`);
  const humanEntries = humanNames.map((name) => `${name}*${MARBLES_PER_HUMAN}`);

  panels.forEach((panel) => {
    panel.winner = null;
    panel.result.textContent = '???';
    panel.root.dataset.state = 'idle';
  });

  const numbersPanel = panels.find((panel) => panel.key === 'numbers');
  const humansPanel = panels.find((panel) => panel.key === 'humans');

  if (!numbersPanel || !humansPanel) {
    return;
  }

  numbersPanel.roulette.setMarbles(numberEntries);
  humansPanel.roulette.setMarbles(humanEntries);

  numbersPanel.meta.textContent = `51개의 공 / 0부터 50까지`;
  humansPanel.meta.textContent = `${humanNames.length}명 / 총 ${humanEntries.length * MARBLES_PER_HUMAN}개의 공`;
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

function revealSummary(summary: HTMLElement) {
  const numberWinner = panels.find((panel) => panel.key === 'numbers')?.winner ?? '미정';
  const humanWinner = panels.find((panel) => panel.key === 'humans')?.winner ?? '미정';

  summary.hidden = false;
  summary.replaceChildren();

  const roundLabel = document.createElement('strong');
  roundLabel.textContent = `Round ${round}`;

  const numberLabel = document.createElement('span');
  numberLabel.textContent = `숫자 항아리: ${numberWinner}`;

  const humanLabel = document.createElement('span');
  humanLabel.textContent = `인간 항아리: ${humanWinner}`;

  summary.append(roundLabel, numberLabel, humanLabel);
}

function rotateOmen(omen: HTMLElement) {
  omen.textContent = OMENS[(round - 1) % OMENS.length];
}

function setStatus(element: HTMLElement, message: string) {
  element.textContent = message;
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

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`${selector} 요소를 찾지 못했다.`);
  }
  return element;
}
