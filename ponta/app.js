const params = new URLSearchParams(window.location.search);
const riveFilename = params.get("file") || "ponta-face.riv";
const assetVersion = params.get("v") || "1";
const RIVE_FILE = `./assets/${riveFilename}?v=${encodeURIComponent(assetVersion)}`;
const ARTBOARD = params.get("artboard") || "Artboard";
const STATE_MACHINE = "State Machine 1";
const BLINK_TRIGGER = "blinkNow";
const TALK_BOOLEAN = "isTalk";

const MIN_WAIT_MS = 2200;
const MAX_WAIT_MS = 5800;
const DOUBLE_BLINK_CHANCE = 0.16;
const DOUBLE_BLINK_GAP_MS = 280;

// A talking burst plays the Rive mouth loop. Short false intervals create
// natural word breaks without baking pauses into the Rive timeline.
const TALK_BURST_MIN_MS = 520;
const TALK_BURST_MAX_MS = 1250;
// The mouth animation is 10 frames (about 167ms at 60fps). Keep false long
// enough for it to finish closing, followed by a visible random word break.
const TALK_PAUSE_MIN_MS = 260;
const TALK_PAUSE_MAX_MS = 520;

const canvas = document.querySelector("#rive-canvas");
const blinkButton = document.querySelector("#blink-button");
const talkButton = document.querySelector("#talk-button");
const status = document.querySelector("#status");
const missingFile = document.querySelector("#missing-file");

let blinkTrigger = null;
let isTalk = null;
let boundViewModelInstance = null;
let blinkTimer = null;
let secondBlinkTimer = null;
let talkTimer = null;
let isTalking = false;

function randomWait() {
  return Math.round(MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS));
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function clearBlinkTimers() {
  window.clearTimeout(blinkTimer);
  window.clearTimeout(secondBlinkTimer);
}

function setTalk(value) {
  if (isTalk) isTalk.value = value;
}

function scheduleTalking(talking = true) {
  if (!isTalking) return;

  setTalk(talking);
  const duration = talking
    ? randomBetween(TALK_BURST_MIN_MS, TALK_BURST_MAX_MS)
    : randomBetween(TALK_PAUSE_MIN_MS, TALK_PAUSE_MAX_MS);

  talkTimer = window.setTimeout(
    () => scheduleTalking(!talking),
    duration,
  );
}

function stopTalking() {
  isTalking = false;
  window.clearTimeout(talkTimer);
  setTalk(false);
  talkButton.textContent = "話してみる";
  talkButton.setAttribute("aria-pressed", "false");
}

function fireBlink() {
  if (!blinkTrigger || document.hidden) return;

  blinkTrigger.trigger();

  if (Math.random() < DOUBLE_BLINK_CHANCE) {
    secondBlinkTimer = window.setTimeout(() => {
      blinkTrigger.trigger();
    }, DOUBLE_BLINK_GAP_MS);
  }
}

function scheduleBlink() {
  window.clearTimeout(blinkTimer);
  if (!blinkTrigger || document.hidden) return;

  const wait = randomWait();
  status.textContent = `次のまばたきまで約${(wait / 1000).toFixed(1)}秒`;
  blinkTimer = window.setTimeout(() => {
    fireBlink();
    scheduleBlink();
  }, wait);
}

const ponta = new rive.Rive({
  src: RIVE_FILE,
  canvas,
  artboard: ARTBOARD,
  autoplay: true,
  autoBind: false,
  stateMachine: STATE_MACHINE,
  layout: new rive.Layout({
    fit: rive.Fit.Contain,
    alignment: rive.Alignment.Center,
  }),
  onLoad: () => {
    ponta.resizeDrawingSurfaceToCanvas();
    const viewModel = ponta.defaultViewModel() ?? ponta.viewModelByName("ViewModel1");
    boundViewModelInstance =
      viewModel?.defaultInstance() ??
      (viewModel?.instanceCount ? viewModel.instanceByIndex(0) : null);

    if (boundViewModelInstance) {
      ponta.bindViewModelInstance(boundViewModelInstance);
    }

    blinkTrigger = boundViewModelInstance?.trigger(BLINK_TRIGGER) ?? null;
    isTalk = boundViewModelInstance?.boolean(TALK_BOOLEAN) ?? null;

    if (!isTalk) {
      isTalk =
        ponta
          .stateMachineInputs(STATE_MACHINE)
          ?.find((input) => input.name === TALK_BOOLEAN) ?? null;
    }

    if (!blinkTrigger) {
      status.textContent = "blinkNowが見つかりません";
      missingFile.hidden = false;
      missingFile.querySelector("strong").textContent = "blinkNowを確認してください";
      missingFile.querySelector("span").textContent =
        "DefaultのView Model InstanceにblinkNowがあり、State Machine 1の遷移条件になっている必要があります。";
      return;
    }

    blinkButton.disabled = false;
    talkButton.disabled = !isTalk;
    if (!isTalk) {
      talkButton.textContent = "口パク未接続";
      talkButton.title = "RiveのViewModel1にisTalk Booleanを作り、.rivを再出力してください";
    }
    setTalk(false);
    status.textContent = "自然なまばたきを開始しました";
    scheduleBlink();
  },
  onLoadError: () => {
    status.textContent = "Riveファイルを読み込めません";
    missingFile.hidden = false;
  },
});

// Handy for inspecting the exported file from the browser console.
window.pontaPreview = ponta;

blinkButton.addEventListener("click", () => {
  fireBlink();
  scheduleBlink();
});

talkButton.addEventListener("click", () => {
  if (isTalking) {
    stopTalking();
    status.textContent = "口パクを停止しました";
    return;
  }

  isTalking = true;
  talkButton.textContent = "話すのを止める";
  talkButton.setAttribute("aria-pressed", "true");
  status.textContent = "ぽんたがお話し中…";
  scheduleTalking(true);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearBlinkTimers();
    if (isTalking) stopTalking();
  } else {
    scheduleBlink();
  }
});

window.addEventListener("resize", () => ponta.resizeDrawingSurfaceToCanvas());
window.addEventListener("beforeunload", () => {
  clearBlinkTimers();
  window.clearTimeout(talkTimer);
  ponta.cleanup();
});
