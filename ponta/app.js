const params = new URLSearchParams(window.location.search);
const riveFilename = params.get("file") || "ponta-face.riv";
const assetVersion = params.get("v") || "1";
const RIVE_FILE = `./assets/${riveFilename}?v=${encodeURIComponent(assetVersion)}`;
const ARTBOARD = params.get("artboard") || "Artboard";
const STATE_MACHINE = "State Machine 1";
const BLINK_TRIGGER = "blinkNow";
const TALK_BOOLEAN = "isTalk";
const OPENMOJI_BASE = "https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg";

const SPECIAL_DAILY_ITEMS = {
  "01-01": { h: "1F38D", n: "門松" },
  "02-03": { h: "1F479", n: "鬼" },
  "03-03": { h: "1F38E", n: "ひな祭り" },
  "04-01": { h: "1F338", n: "桜" },
  "05-05": { h: "1F38F", n: "こいのぼり" },
  "07-07": { h: "1F38B", n: "七夕" },
  "08-01": { h: "1F386", n: "花火" },
  "10-31": { h: "1F383", n: "ハロウィーンのかぼちゃ" },
  "12-25": { h: "1F384", n: "クリスマスツリー" },
};

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
const talkButton = document.querySelector("#talk-button");
const status = document.querySelector("#status");
const missingFile = document.querySelector("#missing-file");
const stageShell = document.querySelector("#stage-shell");
const speechBubble = document.querySelector("#speech-bubble");
const effectLayer = document.querySelector("#effect-layer");
const callCountElement = document.querySelector("#call-count");
const dailyItemElement = document.querySelector("#daily-item");

const SPARK_COLORS = ["#ffd65a", "#ef754c", "#78a94b", "#61aee8"];
const RESPONSE_MIN_MS = 1900;
const RESPONSE_MAX_MS = 2600;

let blinkTrigger = null;
let isTalk = null;
let boundViewModelInstance = null;
let blinkTimer = null;
let secondBlinkTimer = null;
let talkTimer = null;
let responseTimer = null;
let sparkTimer = null;
let isTalking = false;
let callCount = 0;

function selectDailyItem(date = new Date()) {
  const dateKey = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const specialItem = SPECIAL_DAILY_ITEMS[dateKey];
  if (specialItem) return specialItem;

  const items = window.PONTA_DAILY_ITEMS ?? [];
  if (!items.length) return { h: "1F342", n: "落ち葉" };

  // UTC conversion makes the same local calendar date select the same item
  // regardless of daylight-saving or timezone offset changes.
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  return items[Math.abs(dayNumber) % items.length];
}

const dailyItem = selectDailyItem();
dailyItemElement.src = `${OPENMOJI_BASE}/${dailyItem.h}.svg`;
dailyItemElement.alt = `ぽんたが頭にのせている${dailyItem.n}`;
dailyItemElement.title = dailyItem.n;

function japaneseVoice() {
  if (typeof window.speechSynthesis?.getVoices !== "function") return null;

  const voices = window.speechSynthesis.getVoices();
  const japaneseVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("ja"),
  );

  return japaneseVoices.find((voice) => voice.localService) ?? japaneseVoices[0] ?? null;
}

function speakPhrase(phrase) {
  if (
    typeof window.speechSynthesis?.speak !== "function" ||
    typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    return;
  }

  // A new call replaces the previous reply instead of building up a queue.
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(phrase);
  utterance.lang = "ja-JP";
  utterance.rate = 0.92;
  utterance.pitch = 1.2;
  utterance.volume = 1;

  const voice = japaneseVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

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

    talkButton.disabled = !isTalk;
    if (!isTalk) {
      talkButton.querySelector("span").textContent = "ぽんたは おやすみ中";
      talkButton.title = "RiveのViewModel1にisTalk Booleanを作り、.rivを再出力してください";
    }
    setTalk(false);
    status.textContent = "スペースキーで きいてみよう！";
    scheduleBlink();
  },
  onLoadError: () => {
    status.textContent = "Riveファイルを読み込めません";
    missingFile.hidden = false;
  },
});

// Handy for inspecting the exported file from the browser console.
window.pontaPreview = ponta;

function replayClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function createSparkBurst(isMilestone) {
  const amount = isMilestone ? 24 : 13;
  window.clearTimeout(sparkTimer);
  effectLayer.replaceChildren();

  for (let index = 0; index < amount; index += 1) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * index) / amount + Math.random() * 0.35;
    const distance = randomBetween(isMilestone ? 150 : 110, isMilestone ? 260 : 205);
    spark.className = "spark";
    spark.textContent = index % 3 === 0 ? "★" : index % 3 === 1 ? "●" : "✦";
    spark.style.setProperty("--spark-x", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--spark-y", `${Math.sin(angle) * distance}px`);
    spark.style.setProperty("--spark-rotate", `${randomBetween(-140, 140)}deg`);
    spark.style.setProperty("--spark-size", `${randomBetween(16, isMilestone ? 34 : 27)}px`);
    spark.style.setProperty("--spark-delay", `${randomBetween(0, 90)}ms`);
    spark.style.setProperty(
      "--spark-color",
      SPARK_COLORS[index % SPARK_COLORS.length],
    );
    effectLayer.append(spark);
  }

  sparkTimer = window.setTimeout(() => effectLayer.replaceChildren(), 1050);
}

function callPonta() {
  if (!isTalk) return;

  window.clearTimeout(responseTimer);
  stopTalking();
  callCount += 1;
  callCountElement.textContent = String(callCount);

  const phrase =
    callCount % 5 === 0
      ? `${dailyItem.n}だよ！ すてきだね！`
      : `${dailyItem.n}だよ！`;
  speechBubble.textContent = phrase;
  speakPhrase(phrase);
  replayClass(speechBubble, "pop");
  replayClass(stageShell, "is-responding");
  replayClass(dailyItemElement, "bounce");
  window.setTimeout(() => stageShell.classList.remove("is-responding"), 520);
  replayClass(talkButton, "is-pressed");
  window.setTimeout(() => talkButton.classList.remove("is-pressed"), 180);
  createSparkBurst(callCount % 5 === 0);

  isTalking = true;
  status.textContent = `${callCount}かいめの おへんじ！`;
  scheduleTalking(true);
  responseTimer = window.setTimeout(() => {
    stopTalking();
    status.textContent = "もういっかい きいてみよう！";
  }, randomBetween(RESPONSE_MIN_MS, RESPONSE_MAX_MS));
}

talkButton.addEventListener("click", callPonta);

document.addEventListener("keydown", (event) => {
  if (event.repeat || (event.code !== "Space" && event.key !== "Enter")) return;
  if (event.target.closest?.("button, input, select, textarea, a")) return;

  event.preventDefault();
  callPonta();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearBlinkTimers();
    if (isTalking) stopTalking();
    window.clearTimeout(responseTimer);
    window.speechSynthesis?.cancel();
  } else {
    scheduleBlink();
  }
});

window.addEventListener("resize", () => ponta.resizeDrawingSurfaceToCanvas());
window.addEventListener("beforeunload", () => {
  clearBlinkTimers();
  window.clearTimeout(talkTimer);
  window.clearTimeout(responseTimer);
  window.clearTimeout(sparkTimer);
  window.speechSynthesis?.cancel();
  ponta.cleanup();
});
