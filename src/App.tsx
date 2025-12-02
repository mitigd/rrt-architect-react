import { useState, useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';

// --- Theme Constants ---
export const THEME = {
  light: {
    bg: "#f8fafc",       // slate-50
    text: "#0f172a",     // slate-900
    grid: "#cbd5e1",     // slate-300
    ballFill: "#e2e8f0",
    ballStroke: "#64748b",
    ripple: "rgba(0,0,0,0.1)",
  },
  dark: {
    bg: "#0f172a",       // slate-900
    text: "#f8fafc",     // slate-50
    grid: "#334155",     // slate-700
    ballFill: "#1e293b",
    ballStroke: "#475569",
    ripple: "rgba(255,255,255,0.1)",
  }
};

export const COMMON = {
  target: "#22c55e",   // green-500
  wrong: "#ef4444",    // red-500
  selected: "#eab308", // yellow-500
  dim: "#64748b",      // slate-500
  accent: "#06b6d4",   // cyan-500
};

// --- Types ---
type GamePhase =
  | "SETUP"
  | "PREMISE_MEMORIZE"
  | "INTERFERENCE"
  | "QUESTION"
  | "RESULT"
  | "SESSION_END";

type RftMode = "LINEAR" | "SPATIAL_2D" | "SPATIAL_3D" | "HIERARCHY" | "DISTINCTION";
type SymbolMode = "EMOJI" | "WORDS" | "VORONOI" | "MIXED";

interface GameSettings {
  activeModes: Record<RftMode, boolean>;
  numPremises: number;
  autoProgress: boolean;
  useQuestionTimer: boolean;
  questionTimeLimit: number;
  sessionLengthMinutes: number;
  disableSessionTimer: boolean;
  blindMode: boolean;
  symbolMode: SymbolMode;
  enableDeictic: boolean;
  enableTransformation: boolean;
  enableInterference: boolean;
  enableCipher: boolean;
  enableMovement: boolean;
}

interface GameHistory {
  date: string;
  timestamp: number;
  totalScore: number;
  accuracy: number;
  questionsAnswered: number;
  highestDepth: number;
  avgReactionTime: number;
  activeModes: string[];
  activeModifiers: string[];
}

interface SessionRecord {
  id: number;
  mode: string;
  premises: string[];
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  reactionTimeMs: number;
  modifiers: string[];
}

// --- Constants ---
const EMOJIS = ["🚀", "💎", "🔥", "🌊", "⚡", "🍄", "👁️", "🎲", "🧬", "🔮", "⚓", "🪐", "🌋", "🦠", "🌌", "💊", "🧿", "🧩", "🧸", "💣"];
const NONSENSE_CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";
const NONSENSE_VOWELS = "AEIOU";
const CIPHER_WORDS = [
  "ZAX", "JOP", "KIV", "LUZ", "MEC", "VEX", "QOD", "WIB", "HAF", "GUK",
  "YIN", "BEX", "DUB", "ROZ", "NIX", "POK", "VOM", "JEX", "KAZ", "QUZ",
  "YEP", "WUX", "FIP", "GOZ"
];

// --- Helper Functions ---
function shuffleArray<T>(array: T[]): T[] { return [...array].sort(() => Math.random() - 0.5); }

function invertSpatial(rel: string): string {
  const map: Record<string, string> = {
    "NORTH": "SOUTH", "SOUTH": "NORTH",
    "EAST": "WEST", "WEST": "EAST",
    "ABOVE": "BELOW", "BELOW": "ABOVE",
    "LEFT": "RIGHT", "RIGHT": "LEFT",
    "FRONT": "BEHIND", "BEHIND": "FRONT",
    "SAME LOCATION": "SAME LOCATION"
  };
  // Handle combined strings like "NORTH and WEST"
  if (rel.includes(" and ")) return rel.split(" and ").map(p => map[p] || p).join(" and ");
  return map[rel] || rel;
}

function getDistinctRandomIndices(count: number): [number, number] {
  let a = Math.floor(Math.random() * count);
  let b = Math.floor(Math.random() * count);
  while (a === b) b = Math.floor(Math.random() * count);
  return [a, b];
}

function generateWord(): string {
  const c1 = NONSENSE_CONSONANTS[Math.floor(Math.random() * NONSENSE_CONSONANTS.length)];
  const v1 = NONSENSE_VOWELS[Math.floor(Math.random() * NONSENSE_VOWELS.length)];
  const c2 = NONSENSE_CONSONANTS[Math.floor(Math.random() * NONSENSE_CONSONANTS.length)];
  const v2 = NONSENSE_VOWELS[Math.floor(Math.random() * NONSENSE_VOWELS.length)];
  return `<span class="px-1 rounded border font-mono font-bold text-sm tracking-wider inline-block" style="background-color: ${THEME.dark.bg}; border-color: ${COMMON.dim}; color: ${COMMON.accent}">${c1}${v1}${c2}${v2}</span>`;
}

function generateVoronoi(): string {
  const hue = Math.floor(Math.random() * 360);
  const points = [];
  const numPoints = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const r = 30 + Math.random() * 20;
    const x = 50 + Math.cos(angle) * r;
    const y = 50 + Math.sin(angle) * r;
    points.push(`${x},${y}`);
  }
  return `<span class="inline-block align-middle"><svg viewBox="0 0 100 100" class="w-8 h-8"><polygon points="${points.join(" ")}" fill="hsl(${hue}, 70%, 60%)" stroke="white" stroke-width="2"/></svg></span>`;
}

function generateSymbols(count: number, mode: SymbolMode): string[] {
  const symbols: string[] = [];
  const shuffledEmojis = [...EMOJIS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    let currentMode = mode;
    if (currentMode === "MIXED") {
      const roll = Math.random();
      if (roll < 0.33) currentMode = "EMOJI"; else if (roll < 0.66) currentMode = "WORDS"; else currentMode = "VORONOI";
    }
    if (currentMode === "WORDS") symbols.push(generateWord());
    else if (currentMode === "VORONOI") symbols.push(generateVoronoi());
    else symbols.push(`<span class="text-2xl align-middle">${shuffledEmojis[i % shuffledEmojis.length]}</span>`);
  }
  return symbols;
}

const DEFAULT_SETTINGS: GameSettings = {
  activeModes: { LINEAR: true, DISTINCTION: true, SPATIAL_2D: true, SPATIAL_3D: false, HIERARCHY: true },
  numPremises: 2,
  autoProgress: true,
  useQuestionTimer: true,
  questionTimeLimit: 15,
  sessionLengthMinutes: 5,
  disableSessionTimer: false,
  blindMode: false,
  symbolMode: "EMOJI",
  enableDeictic: false,
  enableTransformation: false,
  enableInterference: false,
  enableCipher: false,
  enableMovement: false
};

interface VisualNode { id: string; x: number; y: number; z: number; label: string; }

export default function RftArchitect() {
  // --- State ---
  const isDark = true;
  const [phase, setPhase] = useState<GamePhase>("SETUP");
  const [activeCipherKeys, setActiveCipherKeys] = useState<string[]>([]);
  const [settings, setSettings] = useState<GameSettings>(() => {
      try {
        const stored = localStorage.getItem("rft_architect_settings");
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                activeModes: { ...DEFAULT_SETTINGS.activeModes, ...(parsed.activeModes || {}) }
            };
        }
      } catch (e) {}
      return DEFAULT_SETTINGS;
  });

  const [history, setHistory] = useState<GameHistory[]>([]);
  const [sessionLog, setSessionLog] = useState<SessionRecord[]>([]);

  // Round State
  const [premises, setPremises] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const expectedAnswerRef = useRef(false);
  const [currentRoundMode, setCurrentRoundMode] = useState<RftMode>("LINEAR");
  const [contextIsNight, setContextIsNight] = useState(false);
  const [activeModifiers, setActiveModifiers] = useState<string[]>([]);

  // Cipher State
  const [currentCipherMap, setCurrentCipherMap] = useState<Record<string, string>>({});
  const [cipherHasChanged, setCipherHasChanged] = useState(false);

  // Scoring & Stats
  const [currentScore, setCurrentScore] = useState(0);
  const [questionsAttempted, setQuestionsAttempted] = useState(0);
  const [maxDepthReached, setMaxDepthReached] = useState(2);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [isYesRight, setIsYesRight] = useState(true);

  // Adaptive Progress State
  const [progressCount, setProgressCount] = useState(0); // Counts consecutive correct
  const [mistakeCount, setMistakeCount] = useState(0);   // Counts consecutive mistakes

  // Timers
  const [sessionSecondsElapsed, setSessionSecondsElapsed] = useState(0);
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState(0);
  const [questionSecondsRemaining, setQuestionSecondsRemaining] = useState(0);

  // Interference
  const [interferenceTargetColor, setInterferenceTargetColor] = useState("");
  const [interferenceCurrentColor, setInterferenceCurrentColor] = useState("");
  const [interferenceStatus, setInterferenceStatus] = useState("WAIT");

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Refs
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const sessionInterval = useRef<any>(null);
  const questionInterval = useRef<any>(null);
  const interferenceInterval = useRef<any>(null);
  const questionStartTime = useRef(0);
  const totalReactionTime = useRef(0);
  const sessionTimerRef = useRef(0);

  // --- Effects ---
  useEffect(() => {
    const storedHist = localStorage.getItem("rft_architect_history");
    if (storedHist) try { setHistory(JSON.parse(storedHist)); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    localStorage.setItem("rft_architect_settings", JSON.stringify(settings));
  }, [settings]);

  // Chart Rendering
  useEffect(() => {
    if (showHistoryModal && chartCanvasRef.current && history.length > 0) {
      if (chartInstance.current) chartInstance.current.destroy();

      const sortedHistory = [...history].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const chartData = sortedHistory.slice(-20);
      const themeColors = isDark ? THEME.dark : THEME.light;

      chartInstance.current = new Chart(chartCanvasRef.current, {
        type: 'line',
        data: {
          labels: chartData.map(h => h.date.split(" ")[0]),
          datasets: [
            {
              label: 'Accuracy (%)',
              data: chartData.map(h => h.accuracy),
              borderColor: COMMON.target,
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.3,
              yAxisID: 'y'
            },
            {
              label: 'Score',
              data: chartData.map(h => h.totalScore),
              borderColor: COMMON.accent,
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderDash: [5, 5],
              tension: 0.3,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: themeColors.text } }
          },
          scales: {
            x: { grid: { color: themeColors.grid }, ticks: { color: themeColors.text } },
            y: { type: 'linear', position: 'left', min: 0, max: 100, grid: { color: themeColors.grid }, ticks: { color: themeColors.text } },
            y1: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: themeColors.text } }
          }
        }
      });
    }
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [showHistoryModal, history, isDark]);

  // --- Logic Generators ---
  const generateCipherKey = useCallback(() => {
    const relations = [
      "GREATER", "LESS", "SAME", "DIFFERENT", "CONTAINS", "INSIDE",
      "NORTH", "SOUTH", "EAST", "WEST", "ABOVE", "BELOW",
      "LEFT", "RIGHT", "FRONT", "BEHIND", "START", "FACE", "WALK", "TURN"
    ];
    const shuffledWords = shuffleArray([...CIPHER_WORDS]);
    const newMap: Record<string, string> = {};
    relations.forEach((rel, i) => { newMap[rel] = shuffledWords[i % shuffledWords.length]; });
    return newMap;
  }, []);

  const [currentVisualMap, setCurrentVisualMap] = useState<VisualNode[]>([]);

  const generateLogic = useCallback((mode: RftMode, num: number, cipherMap: Record<string, string>, isNight: boolean) => {
    let newPremises: string[] = [];
    let newQuestion = "";
    let newAnswer = false;
    let modifiers: string[] = [];
    let visualNodes: VisualNode[] = [];
    const usedKeys = new Set<string>();

    const getTerm = (key: string) => {
      if (settings.enableCipher && cipherMap[key]) {
        usedKeys.add(key);
        return `<b style="color: ${COMMON.accent}">${cipherMap[key]}</b>`;
      }
      return key;
    };

    const createPremise = (a: string, rawRel: string, b: string) => {
      const cleanRel = rawRel.replace("is ", "").replace(" than", "").replace(" of", "").replace("the ", "").trim();
      if (settings.enableCipher && cipherMap[cleanRel]) {
        usedKeys.add(cleanRel);
        return `${a} <b style="color: ${COMMON.accent}">${cipherMap[cleanRel]}</b> ${b}`;
      }
      return `${a} ${rawRel} ${b}`;
    };

    if (mode === "LINEAR") {
      const items = generateSymbols(num + 1, settings.symbolMode);
      for (let i = 0; i < num; i++) {
        const a = items[i], b = items[i + 1];
        const rel = Math.random() > 0.5 ? "GREATER" : "LESS";
        newPremises.push(createPremise(a, `is ${rel} than`, b));
      }
      const [idxA, idxB] = getDistinctRandomIndices(num + 1);
      const qType = Math.random() > 0.5 ? "GREATER" : "LESS";
      const qText = getTerm(qType);
      newQuestion = `Is ${items[idxA]} ${qText} ${settings.enableCipher ? '' : 'than'} ${items[idxB]}?`;
      newAnswer = qType === "GREATER" ? (idxA < idxB) : (idxA > idxB);
      if (isNight) newAnswer = !newAnswer; // Binary flip safe for Linear
    }
    else if (mode === "DISTINCTION") {
      const items = generateSymbols(num + 1, settings.symbolMode);
      const values = [Math.random() > 0.5 ? 1 : 0];
      for (let i = 0; i < num; i++) {
        const isSame = Math.random() > 0.5;
        values.push(isSame ? values[i] : 1 - values[i]);
        const rel = isSame ? "SAME" : "DIFFERENT";
        newPremises.push(createPremise(items[i], rel, items[i + 1]));
      }
      const [idxA, idxB] = getDistinctRandomIndices(num + 1);
      const qType = Math.random() > 0.5 ? "SAME" : "DIFFERENT";
      let qText = getTerm(qType);
      if (!settings.enableCipher) qText = qType === "SAME" ? "the SAME as" : "DIFFERENT from";
      newQuestion = `Is ${items[idxA]} ${qText} ${items[idxB]}?`;
      newAnswer = qType === "SAME" ? (values[idxA] === values[idxB]) : (values[idxA] !== values[idxB]);
      if (isNight) newAnswer = !newAnswer; // Binary flip safe for Distinction
    }
    else if (mode === "HIERARCHY") {
      const items = generateSymbols(num + 1, settings.symbolMode);
      for (let i = 0; i < num; i++) newPremises.push(createPremise(items[i], "CONTAINS", items[i + 1]));
      const [idxA, idxB] = getDistinctRandomIndices(num + 1);
      if (Math.random() > 0.5) {
        newQuestion = `Is ${items[idxA]} ${getTerm("INSIDE")} ${items[idxB]}?`;
        newAnswer = idxA > idxB;
      } else {
        newQuestion = `Does ${items[idxA]} ${getTerm("CONTAINS")} ${items[idxB]}?`;
        newAnswer = idxA < idxB;
      }
      if (isNight) newAnswer = !newAnswer; // Binary flip safe for Hierarchy
    }
    else if (mode.includes("SPATIAL")) {
      const is3D = mode === "SPATIAL_3D";
      const items = generateSymbols(num + 1, settings.symbolMode);
      const positions: { x: number, y: number, z: number }[] = [{ x: 0, y: 0, z: 0 }];
      let cx = 0, cy = 0, cz = 0;
      visualNodes.push({ id: items[0], x: 0, y: 0, z: 0, label: items[0] });

      for (let i = 0; i < num; i++) {
        const dir = Math.floor(Math.random() * (is3D ? 6 : 4));
        let dx = 0, dy = 0, dz = 0, text = "";
        switch (dir) {
          case 0: dy = 1; text = "NORTH"; break;
          case 1: dy = -1; text = "SOUTH"; break;
          case 2: dx = 1; text = "EAST"; break;
          case 3: dx = -1; text = "WEST"; break;
          case 4: dz = 1; text = "ABOVE"; break;
          case 5: dz = -1; text = "BELOW"; break;
        }
        newPremises.push(createPremise(items[i + 1], text, items[i]));
        cx += dx; cy += dy; cz += dz;
        positions.push({ x: cx, y: cy, z: cz });
        visualNodes.push({ id: items[i + 1], x: cx, y: cy, z: cz, label: items[i + 1] });
      }

      let availableTypes = ["STANDARD"];
      if (settings.enableDeictic) availableTypes.push("DEICTIC");
      if (settings.enableMovement && !is3D) availableTypes.push("MOVEMENT");
      if (availableTypes.length > 1) availableTypes = availableTypes.filter(t => t !== "STANDARD");
      const selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

      if (selectedType === "DEICTIC") {
        modifiers.push("DEICTIC");
        const [idxMe, idxTarget] = getDistinctRandomIndices(items.length);
        const diffX = positions[idxTarget].x - positions[idxMe].x;
        const diffY = positions[idxTarget].y - positions[idxMe].y;
        const facingDir = Math.floor(Math.random() * 4);
        const facingNames = ["NORTH", "EAST", "SOUTH", "WEST"];
        const myFacing = facingNames[facingDir];
        let localX = 0, localY = 0;
        if (facingDir === 0) { localX = diffX; localY = diffY; }
        else if (facingDir === 1) { localX = -diffY; localY = diffX; } // East: x=dy, y=-dx? wait. standard: y+ is N. facing E (x+). local front is x+.
            // If facing East (1): Real (1,0) should be Front. Diff(1,0). 
            // My formula: localX = -0 = 0. localY = 1. -> Front. Correct.
        else if (facingDir === 2) { localX = -diffX; localY = -diffY; } // South
        else if (facingDir === 3) { localX = diffY; localY = -diffX; } // West

        let trueLocalRel = "";
        if (localY > 0 && Math.abs(localX) <= localY) trueLocalRel = "FRONT";
        else if (localY < 0 && Math.abs(localX) <= Math.abs(localY)) trueLocalRel = "BEHIND";
        else if (localX > 0) trueLocalRel = "RIGHT";
        else if (localX < 0) trueLocalRel = "LEFT";
        if (!trueLocalRel) trueLocalRel = "SAME LOCATION";

        // --- SPATIAL INVERSION FIX ---
        // If Night mode, we invert the REALITY, not just the boolean answer.
        // If reality is BEHIND, Inversion makes effective reality FRONT.
        const effectiveRel = isNight ? invertSpatial(trueLocalRel) : trueLocalRel;
        
        const possibleDirs = ["FRONT", "BEHIND", "LEFT", "RIGHT"];

        if (Math.random() > 0.5) {
          // ASK THE TRUTH (of the current context)
          newQuestion = `You are at ${items[idxMe]} facing ${getTerm(myFacing)}.<br/>Is ${items[idxTarget]} to your ${getTerm(effectiveRel)}?`;
          newAnswer = true;
        } else {
          // ASK A LIE (of the current context)
          let fakeRaw = possibleDirs[Math.floor(Math.random() * 4)];
          // It must not be the effective relation
          while (fakeRaw === effectiveRel) fakeRaw = possibleDirs[Math.floor(Math.random() * 4)];
          newQuestion = `You are at ${items[idxMe]} facing ${getTerm(myFacing)}.<br/>Is ${items[idxTarget]} to your ${getTerm(fakeRaw)}?`;
          newAnswer = false;
        }
      }
      else if (selectedType === "MOVEMENT") {
        modifiers.push("MOVEMENT");
        const startIdx = Math.floor(Math.random() * items.length);
        let curX = positions[startIdx].x, curY = positions[startIdx].y;
        let heading = Math.floor(Math.random() * 4);
        const headingNames = ["NORTH", "EAST", "SOUTH", "WEST"];
        const instructions = [];
        instructions.push(`${getTerm("START")} ${items[startIdx]}.`);
        instructions.push(`${getTerm("FACE")} ${getTerm(headingNames[heading])}.`);
        const moves = 2 + Math.floor(Math.random() * 2);
        for (let m = 0; m < moves; m++) {
          if (Math.random() < 0.5) {
            if (heading === 0) curY++; else if (heading === 1) curX++; else if (heading === 2) curY--; else if (heading === 3) curX--;
            instructions.push(`${getTerm("WALK")} 1.`);
          } else {
            if (Math.random() > 0.5) {
              heading = (heading + 1) % 4;
              instructions.push(`${getTerm("TURN")} ${getTerm("RIGHT")}.`);
            } else {
              heading = (heading + 3) % 4;
              instructions.push(`${getTerm("TURN")} ${getTerm("LEFT")}.`);
            }
          }
        }
        let targetIdx = Math.floor(Math.random() * items.length);
        let attempts = 0;
        while ((targetIdx === startIdx || (positions[targetIdx].x === curX && positions[targetIdx].y === curY)) && attempts < 50) {
          targetIdx = Math.floor(Math.random() * items.length);
          attempts++;
        }
        const tPos = positions[targetIdx];
        const relX = tPos.x - curX;
        const relY = tPos.y - curY;
        let localX = 0, localY = 0;
        if (heading === 0) { localX = relX; localY = relY; }
        else if (heading === 1) { localX = relY; localY = -relX; }
        else if (heading === 2) { localX = -relX; localY = -relY; }
        else if (heading === 3) { localX = -relY; localY = relX; }
        
        let trueRel = "";
        if (localY > 0 && Math.abs(localX) <= localY) trueRel = "FRONT";
        else if (localY < 0 && Math.abs(localX) <= Math.abs(localY)) trueRel = "BEHIND";
        else if (localX > 0) trueRel = "RIGHT";
        else if (localX < 0) trueRel = "LEFT";
        if (!trueRel) trueRel = "SAME LOCATION";

        // --- SPATIAL INVERSION FIX ---
        const effectiveRel = isNight ? invertSpatial(trueRel) : trueRel;
        const possibleDirs = ["FRONT", "BEHIND", "LEFT", "RIGHT"];

        if (Math.random() > 0.5) {
             newQuestion = `${instructions.join(" ")} <br/><br/> Is ${items[targetIdx]} to your ${getTerm(effectiveRel)}?`;
             newAnswer = true;
        } else {
             let qRaw = possibleDirs[Math.floor(Math.random() * 4)];
             while(qRaw === effectiveRel) qRaw = possibleDirs[Math.floor(Math.random() * 4)];
             newQuestion = `${instructions.join(" ")} <br/><br/> Is ${items[targetIdx]} to your ${getTerm(qRaw)}?`;
             newAnswer = false;
        }
      }
      else {
        // STANDARD SPATIAL
        const [idxA, idxB] = getDistinctRandomIndices(items.length);
        const diffX = positions[idxB].x - positions[idxA].x;
        const diffY = positions[idxB].y - positions[idxA].y;
        const diffZ = positions[idxB].z - positions[idxA].z;
        let parts = [];
        if (is3D) { if (diffZ > 0) parts.push("ABOVE"); else if (diffZ < 0) parts.push("BELOW"); }
        if (diffY > 0) parts.push("NORTH"); else if (diffY < 0) parts.push("SOUTH");
        if (diffX > 0) parts.push("EAST"); else if (diffX < 0) parts.push("WEST");
        
        let rawTrueRel = "SAME LOCATION";
        if (parts.length > 0) rawTrueRel = parts.join(" and ");

        // --- SPATIAL INVERSION FIX ---
        // If night, we act as if the object is in the opposite direction
        const effectiveParts = isNight ? parts.map(invertSpatial) : parts;
        const allDirs = is3D ? ["NORTH", "SOUTH", "EAST", "WEST", "ABOVE", "BELOW"] : ["NORTH", "SOUTH", "EAST", "WEST"];
        
        // Strategy: 
        // 50% ask about a direction that is TRUE in the effective context
        // 50% ask about a direction that is FALSE in the effective context
        
        if (effectiveParts.length > 0 && Math.random() > 0.5) {
            // Pick one of the effective true directions to ask about
            const partToAsk = effectiveParts[Math.floor(Math.random() * effectiveParts.length)];
            newQuestion = `Is ${items[idxB]} ${getTerm(partToAsk)} ${items[idxA]}?`;
            newAnswer = true;
        } else {
            // Pick a direction that is NOT in effective parts
            let fakeRaw = allDirs[Math.floor(Math.random() * allDirs.length)];
            while (effectiveParts.includes(fakeRaw)) fakeRaw = allDirs[Math.floor(Math.random() * allDirs.length)];
            newQuestion = `Is ${items[idxB]} ${getTerm(fakeRaw)} ${items[idxA]}?`;
            newAnswer = false;
        }
      }
    }

    return {
      premises: shuffleArray(newPremises),
      question: newQuestion,
      answer: newAnswer,
      modifiers,
      visualMap: visualNodes,
      usedCipherKeys: Array.from(usedKeys)
    };
  }, [settings, generateCipherKey]);

  // --- Game Loop Control ---
  const startSession = () => {
    setCurrentScore(0);
    setProgressCount(0);
    setMistakeCount(0);
    setQuestionsAttempted(0);
    setMaxDepthReached(settings.numPremises);
    setSessionLog([]);
    totalReactionTime.current = 0;
    setSessionSecondsElapsed(0);

    const duration = settings.sessionLengthMinutes * 60;
    setSessionSecondsRemaining(duration);
    sessionTimerRef.current = duration;

    setCurrentCipherMap(generateCipherKey());

    if (sessionInterval.current) clearInterval(sessionInterval.current);
    sessionInterval.current = setInterval(() => {
      setSessionSecondsElapsed(s => s + 1);
      if (!settings.disableSessionTimer) {
        sessionTimerRef.current -= 1;
        setSessionSecondsRemaining(sessionTimerRef.current);
        if (sessionTimerRef.current <= 0) endSession();
      }
    }, 1000);

    startRound();
  };

  const endSession = useCallback(() => {
    clearInterval(sessionInterval.current);
    clearInterval(questionInterval.current);
    clearInterval(interferenceInterval.current);

    const avgRT = questionsAttempted > 0 ? Math.round(totalReactionTime.current / questionsAttempted) : 0;
    const activeM = Object.keys(settings.activeModes).filter(k => settings.activeModes[k as RftMode]);

    const histRecord: GameHistory = {
      date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      totalScore: currentScore,
      accuracy: questionsAttempted > 0 ? Math.round((sessionLog.filter(l => l.isCorrect).length / questionsAttempted) * 100) : 0,
      questionsAnswered: questionsAttempted,
      highestDepth: maxDepthReached,
      avgReactionTime: avgRT,
      activeModes: activeM,
      activeModifiers: activeModifiers
    };

    setHistory(prev => [...prev, histRecord]);
    localStorage.setItem("rft_architect_history", JSON.stringify([...history, histRecord]));
    setPhase("SESSION_END");
  }, [currentScore, questionsAttempted, maxDepthReached, sessionSecondsElapsed, settings.activeModes, activeModifiers, history, sessionLog]);

  const startRound = () => {
    if (!settings.disableSessionTimer && sessionTimerRef.current <= 0) { endSession(); return; }

    const enabledModes = (Object.keys(settings.activeModes) as RftMode[]).filter((k) => settings.activeModes[k]);
    if (enabledModes.length === 0) { alert("Enable a logic module."); return; }

    const nextMode = enabledModes[Math.floor(Math.random() * enabledModes.length)];
    setCurrentRoundMode(nextMode);

    let roundCipherMap = currentCipherMap;
    let roundCipherChanged = false;

    if (settings.enableCipher && Object.keys(roundCipherMap).length === 0) {
      roundCipherMap = generateCipherKey();
      setCurrentCipherMap(roundCipherMap);
    }
    else if (settings.enableCipher && questionsAttempted > 0 && Math.random() < 0.15) {
      roundCipherMap = generateCipherKey();
      setCurrentCipherMap(roundCipherMap);
      roundCipherChanged = true;
    }
    setCipherHasChanged(roundCipherChanged);

    // DETERMINE NIGHT MODE HERE (Before logic gen)
    let isNight = false;
    if (settings.enableTransformation) {
       isNight = Math.random() > 0.5;
    }
    setContextIsNight(isNight);

    // PASS isNight TO LOGIC GENERATOR
    const logicData = generateLogic(nextMode, settings.numPremises, roundCipherMap, isNight);
    
    setActiveCipherKeys(logicData.usedCipherKeys);
    setPremises(logicData.premises);
    setCurrentQuestion(logicData.question);
    setCurrentVisualMap(logicData.visualMap);

    expectedAnswerRef.current = logicData.answer; // NO EXTRA FLIP HERE
    
    let mods = [...logicData.modifiers];
    if (roundCipherChanged) mods.push("KEY_CHANGE");
    if (isNight) mods.push("TRANSFORM");

    setActiveModifiers(mods);
    setIsYesRight(Math.random() > 0.5);
    setQuestionSecondsRemaining(settings.questionTimeLimit);

    if (settings.blindMode || roundCipherChanged) setPhase("PREMISE_MEMORIZE");
    else if (settings.enableInterference) startInterference();
    else startQuestionPhase();
  };

  const startInterference = () => {
    setPhase("INTERFERENCE");
    setActiveModifiers(m => [...m, "INTERFERENCE"]);
    setInterferenceStatus("WAIT");
    const colors = ["red", "blue", "green", "yellow"];
    setInterferenceTargetColor(colors[Math.floor(Math.random() * colors.length)]);

    if (interferenceInterval.current) clearInterval(interferenceInterval.current);
    interferenceInterval.current = setInterval(() => {
      setInterferenceCurrentColor(colors[Math.floor(Math.random() * colors.length)]);
      setInterferenceStatus("WAIT");
    }, 300);
  };

  const startQuestionPhase = () => {
    setPhase("QUESTION");
    questionStartTime.current = Date.now();
    if (settings.useQuestionTimer) {
      if (questionInterval.current) clearInterval(questionInterval.current);
      setQuestionSecondsRemaining(settings.questionTimeLimit);
      questionInterval.current = setInterval(() => {
        setQuestionSecondsRemaining(prev => {
          if (prev <= 1) {
            handleAnswer(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // --- ADAPTIVE LOGIC ---
  const handleAnswer = useCallback((userAnswer: boolean | null) => {
    clearInterval(questionInterval.current);
    const rt = Date.now() - questionStartTime.current;
    const correct = userAnswer === expectedAnswerRef.current;
    let msg = "";

    if (userAnswer === null) msg = "TIMEOUT";
    else if (correct) msg = settings.enableTransformation && contextIsNight ? "INVERSION SUCCESSFUL" : "VERIFIED";
    else msg = settings.enableTransformation && contextIsNight ? "FAILED TO INVERT" : "COLLAPSE";

    setFeedbackMsg(msg);
    setQuestionsAttempted(prev => prev + 1);

    let finalAnswerStr = userAnswer === null ? "TIMEOUT" : (userAnswer ? "YES" : "NO");
    let correctStr = expectedAnswerRef.current ? "YES" : "NO";

    if (correct) {
      setCurrentScore(s => s + settings.numPremises * 10);
      setMistakeCount(0); // Reset mistake buffer
      
      // Adaptive Progress: Need 3 consecutive corrects to level up
      if (settings.autoProgress) {
         if (progressCount >= 2) {
             setSettings(s => ({ ...s, numPremises: s.numPremises + 1 }));
             setMaxDepthReached(d => Math.max(d, settings.numPremises + 1));
             setFeedbackMsg(prev => prev + " | DEPTH INCREASED");
             setProgressCount(0);
         } else {
             setProgressCount(prev => prev + 1);
         }
      }
    } else {
      setCurrentScore(s => Math.max(0, s - 20));
      setProgressCount(0); // Reset progress streak

      // Adaptive Fallback: Need 2 consecutive mistakes to level down
      if (settings.autoProgress && settings.numPremises > 2) {
        if (mistakeCount >= 1) {
            setSettings(s => ({ ...s, numPremises: s.numPremises - 1 }));
            setFeedbackMsg(prev => prev + " | DEPTH DECREASED");
            setMistakeCount(0);
        } else {
            setMistakeCount(prev => prev + 1);
        }
      }
    }

    totalReactionTime.current += rt;

    const newLog: SessionRecord = {
      id: Date.now(),
      mode: currentRoundMode,
      premises: [...premises],
      question: currentQuestion,
      userAnswer: finalAnswerStr,
      correctAnswer: correctStr,
      isCorrect: correct,
      reactionTimeMs: rt,
      modifiers: [...activeModifiers, ...(contextIsNight ? ['NIGHT'] : []), ...(settings.enableCipher ? ['CIPHER'] : [])]
    };
    setSessionLog(prev => [newLog, ...prev]);
    setPhase("RESULT");
  }, [settings, contextIsNight, activeModifiers, premises, currentQuestion, currentRoundMode, progressCount, mistakeCount]);

  // --- Input Handlers ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showSettings || showReviewModal || showHistoryModal) {
      if (e.code === "Escape") { setShowSettings(false); setShowReviewModal(false); setShowHistoryModal(false); }
      return;
    }
    if (phase === "SETUP" && e.code === "Enter") startSession();
    if (phase === "RESULT" && (e.code === "Enter" || e.code === "Space")) startRound();
    if (phase === "SESSION_END" && e.code === "Enter") setPhase("SETUP");
    if (phase === "PREMISE_MEMORIZE" && (e.code === "Space" || e.code === "Enter")) {
      if (settings.enableInterference) startInterference();
      else startQuestionPhase();
    }
  }, [phase, settings, showSettings, showReviewModal, showHistoryModal]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase === "QUESTION") {
        if (e.code === "ArrowLeft" || e.code === "KeyD") handleAnswer(!isYesRight);
        if (e.code === "ArrowRight" || e.code === "KeyJ") handleAnswer(isYesRight);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, isYesRight, handleAnswer]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const intColorRef = useRef("");
  const intTargetRef = useRef("");
  useEffect(() => { intColorRef.current = interferenceCurrentColor; }, [interferenceCurrentColor]);
  useEffect(() => { intTargetRef.current = interferenceTargetColor; }, [interferenceTargetColor]);

  useEffect(() => {
    if (phase !== "INTERFERENCE") return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (intColorRef.current === intTargetRef.current) {
          clearInterval(interferenceInterval.current);
          setInterferenceStatus("HIT");
          setTimeout(startQuestionPhase, 200);
        } else {
          setInterferenceStatus("MISS");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const getCipherList = () => {
    if (!settings.enableCipher) return [];
    return Object.entries(currentCipherMap).filter(([k]) => activeCipherKeys.includes(k));
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 text-slate-50 font-sans selection:bg-cyan-500/30">
      
      <style>{`
          .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #475569 transparent; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; }
      `}</style>

      {/* Main Container - Responsive Width & Height */}
      <div className="w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden relative" 
           style={{ minHeight: '85vh', maxHeight: '95vh' }}>
        
        {/* Header */}
        <header className="p-3 sm:p-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/90 backdrop-blur shrink-0 z-20">
            <div className="flex items-center gap-4">
                <div className="text-xs sm:text-sm font-mono tracking-wider text-slate-400">
                    {phase === "SETUP" ? "READY" : phase === "SESSION_END" ? "DONE" :
                        settings.disableSessionTimer ? formatTime(sessionSecondsElapsed) : formatTime(sessionSecondsRemaining)}
                </div>
                {phase === "QUESTION" && settings.useQuestionTimer && (
                    <div className={`text-xs sm:text-sm font-mono font-bold ${questionSecondsRemaining < 5 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {questionSecondsRemaining}s
                    </div>
                )}
            </div>
            
            <div className="flex gap-2">
                 {phase !== "SETUP" && phase !== "SESSION_END" ? (
                    <button onClick={() => setPhase("SETUP")} className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold border border-red-900/50 bg-red-900/20 text-red-500 rounded">ABORT</button>
                 ) : (
                    <button onClick={() => setShowHistoryModal(true)} className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded transition">STATS</button>
                 )}
                 <button onClick={() => setShowReviewModal(true)} className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded transition">LOG</button>
                 <button onClick={() => setShowSettings(!showSettings)} className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 rounded transition">CONFIG</button>
            </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 flex flex-col">
                
                {/* Stats Bar (In-Game) */}
                <div className="flex justify-between items-start text-xs font-mono text-slate-500 mb-6 shrink-0 border-b border-slate-800 pb-2">
                    <div className="flex flex-col sm:flex-row sm:gap-4">
                        <span>SCORE: <span className="text-slate-200">{currentScore}</span></span>
                        <div className="flex items-center gap-1">
                          <span>DEPTH: <span className="text-slate-200">{settings.numPremises}</span></span>
                          {/* Adaptive Progress Indicator */}
                          {settings.autoProgress && (
                            <div className="flex gap-0.5 ml-1">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < progressCount ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                                ))}
                            </div>
                          )}
                        </div>
                    </div>
                    {settings.enableTransformation && (phase === "QUESTION" || phase === "RESULT") && (
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${contextIsNight ? 'bg-indigo-500/20 text-indigo-400 border-indigo-900' : 'bg-amber-500/20 text-amber-400 border-amber-900'}`}>
                            {contextIsNight ? "🌙 INVERT" : "☀ STANDARD"}
                        </span>
                    )}
                </div>

                {/* --- PHASES --- */}
                <div className="flex-grow flex flex-col items-center justify-center text-center w-full relative">

                    {/* SETUP */}
                    {phase === "SETUP" && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500">RFT ARCHITECT</h1>
                            <p className="text-slate-400">Logic Training System</p>
                            <button onClick={startSession} className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-900/20 transform hover:scale-105 transition-all">
                                START SESSION
                            </button>
                            <p className="text-xs text-slate-600">Press Enter</p>
                        </div>
                    )}

                    {/* INTERFERENCE */}
                    {phase === "INTERFERENCE" && (
                        <div className={`flex flex-col items-center justify-center gap-8 ${interferenceStatus === "MISS" ? "animate-bounce" : ""}`}>
                            <h3 className="text-xl font-bold text-red-500 tracking-widest">INTERFERENCE</h3>
                            <div className="w-24 h-24 md:w-40 md:h-40 rounded-full border-4 border-slate-200 shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-colors duration-75" 
                                 style={{ backgroundColor: interferenceCurrentColor }} />
                            <p className="text-lg md:text-2xl">
                                Press SPACE when color is <span style={{ color: interferenceTargetColor, fontWeight: 'bold', textTransform: 'uppercase' }}>{interferenceTargetColor}</span>
                            </p>
                        </div>
                    )}

                    {/* MEMORIZE */}
                    {phase === "PREMISE_MEMORIZE" && (
                        <div className="w-full max-w-lg space-y-6 animate-in slide-in-from-bottom-4">
                            {cipherHasChanged && <div className="text-white font-bold p-2 bg-red-500/80 rounded animate-pulse">⚠️ CIPHER KEY CHANGED</div>}
                            
                            <div className="flex justify-between items-end">
                                <div className="inline-block px-3 py-1 rounded bg-slate-800 text-xs font-mono text-cyan-400 uppercase tracking-widest">{currentRoundMode.replace("_", " ")}</div>
                                {/* Visual Indicator for Memorize Phase */}
                                {settings.enableTransformation && (
                                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${contextIsNight ? 'bg-indigo-500/20 text-indigo-400 border-indigo-900' : 'bg-amber-500/20 text-amber-400 border-amber-900'}`}>
                                        {contextIsNight ? "🌙 INVERT ACTIVE" : "☀ STANDARD MODE"}
                                    </span>
                                )}
                            </div>

                            {/* Premise Box - Blue tint if Night/Invert */}
                            <div className={`space-y-4 text-center p-6 rounded-xl border transition-all duration-500 ${
                                contextIsNight 
                                ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]" 
                                : "bg-slate-800/50 border-slate-700"
                            }`}>
                                {premises.map((p, i) => (
                                    <div key={i} className="text-lg md:text-2xl font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: p }} />
                                ))}
                            </div>
                            <button onClick={() => settings.enableInterference ? startInterference() : startQuestionPhase()} className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded font-bold transition-colors">READY (Space)</button>
                        </div>
                    )}

                    {/* QUESTION */}
                    {phase === "QUESTION" && (
                        <div className="w-full h-full flex flex-col">
                            {/* Premises (Visible if not blind) - Styles match Inversion State */}
                            {!settings.blindMode && (
                                <div className={`p-3 md:p-4 rounded-lg text-center text-sm md:text-base text-slate-300 mb-4 md:mb-8 border transition-colors duration-500 ${
                                    contextIsNight 
                                    ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]" 
                                    : "bg-slate-800/30 border-slate-700/50"
                                }`}>
                                    {premises.map((p, i) => <div key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: p }} />)}
                                </div>
                            )}
                            
                            {/* Question Text */}
                            <div className="flex-grow flex items-center justify-center py-4 md:py-8">
                                <h2 className="text-2xl md:text-4xl font-bold leading-tight" dangerouslySetInnerHTML={{ __html: currentQuestion }} />
                            </div>

                            {/* Cipher Legend (if active) */}
                            {settings.enableCipher && getCipherList().length > 0 && (
                                <div className="flex flex-wrap justify-center gap-2 mb-4 p-2 border-t border-slate-800 shrink-0">
                                    {getCipherList().map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded border border-slate-700 shadow-sm">
                                            <span className="text-cyan-400 font-bold text-xs">{v}</span>
                                            <span className="text-slate-500 text-[10px]">=</span>
                                            <span className="text-slate-300 font-mono text-xs">{k}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="grid grid-cols-2 gap-3 md:gap-6 mt-auto">
                                <button onClick={() => handleAnswer(!isYesRight)} className={`h-20 md:h-32 rounded-xl text-2xl md:text-4xl font-black transition-all active:scale-95 flex flex-col items-center justify-center ${isYesRight ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20'}`}>
                                    {isYesRight ? "NO" : "YES"}
                                    <span className="text-[10px] font-normal opacity-50 mt-1 tracking-widest">LEFT ARROW</span>
                                </button>
                                <button onClick={() => handleAnswer(isYesRight)} className={`h-20 md:h-32 rounded-xl text-2xl md:text-4xl font-black transition-all active:scale-95 flex flex-col items-center justify-center ${isYesRight ? 'bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20'}`}>
                                    {isYesRight ? "YES" : "NO"}
                                    <span className="text-[10px] font-normal opacity-50 mt-1 tracking-widest">RIGHT ARROW</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* RESULT */}
                    {phase === "RESULT" && (
                        <div className="w-full h-full flex flex-col items-center justify-between gap-2 overflow-hidden pb-1">
                            {/* Feedback Header */}
                            <h2 className={`shrink-0 text-3xl md:text-5xl font-black tracking-tight text-center ${feedbackMsg.includes("VERIFIED") || feedbackMsg.includes("SUCCESS") ? "text-green-500" : "text-red-500"}`}>
                                {feedbackMsg}
                            </h2>

                            {/* Visualizer - Strictly limited to 35% of view height to prevent scrolling */}
                            {currentRoundMode.includes("SPATIAL") && currentVisualMap.length > 0 && (
                                <div className="w-full h-[35vh] min-h-[150px] shrink-0 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden shadow-inner">
                                     <div className="absolute top-2 left-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest z-10">Spatial Map</div>
                                     <div className="w-full h-full p-4 flex items-center justify-center">
                                        <svg 
                                            viewBox={(() => {
                                                const GRID_STEP = 80; // Increased spacing
                                                const PADDING = 100;
                                                const MIN_DIM = 500; 
                                                const xs = currentVisualMap.map(n => n.x * GRID_STEP);
                                                const ys = currentVisualMap.map(n => -n.y * GRID_STEP);
                                                let minX = Math.min(...xs);
                                                let maxX = Math.max(...xs);
                                                let minY = Math.min(...ys);
                                                let maxY = Math.max(...ys);
                                                
                                                let w = maxX - minX + (PADDING * 2);
                                                let h = maxY - minY + (PADDING * 2);
                                                
                                                // Center and enforce min size
                                                if (w < MIN_DIM) {
                                                    const d = MIN_DIM - w;
                                                    minX -= d/2;
                                                    w = MIN_DIM;
                                                }
                                                if (h < MIN_DIM) {
                                                    const d = MIN_DIM - h;
                                                    minY -= d/2;
                                                    h = MIN_DIM;
                                                }
                                                
                                                return `${minX - PADDING} ${minY - PADDING} ${w} ${h}`;
                                            })()}
                                            className="w-full h-full"
                                            preserveAspectRatio="xMidYMid meet"
                                        >
                                            <defs>
                                                <pattern id="grid-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
                                                    <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#334155" strokeWidth="0.5" />
                                                </pattern>
                                            </defs>
                                            <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid-pattern)" opacity="0.2" />
                                            {
                                                (() => {
                                                    const GRID_STEP = 80; // Match ViewBox logic
                                                    return (
                                                        <>
                                                            <polyline 
                                                                points={currentVisualMap.map(n => `${n.x * GRID_STEP},${-n.y * GRID_STEP}`).join(" ")} 
                                                                fill="none" 
                                                                stroke="#64748b" 
                                                                strokeWidth="4" 
                                                                strokeLinecap="round" 
                                                                opacity="0.4" 
                                                            />
                                                            {currentVisualMap.map((node, i) => (
                                                                <g key={i}>
                                                                    {/* Background Circle */}
                                                                    <circle 
                                                                        cx={node.x * GRID_STEP} 
                                                                        cy={-node.y * GRID_STEP} 
                                                                        r="30" 
                                                                        fill="#0f172a" 
                                                                        stroke={i === 0 ? COMMON.accent : (i === currentVisualMap.length - 1 ? COMMON.target : "#64748b")} 
                                                                        strokeWidth="3" 
                                                                    />
                                                                    
                                                                    {/* Rich HTML Content (Voronoi/Emoji) via foreignObject */}
                                                                    <foreignObject 
                                                                        x={(node.x * GRID_STEP) - 25} 
                                                                        y={(-node.y * GRID_STEP) - 25} 
                                                                        width="50" 
                                                                        height="50"
                                                                        style={{ overflow: 'visible' }}
                                                                    >
                                                                        <div 
                                                                            xmlns="http://www.w3.org/1999/xhtml" 
                                                                            className="w-full h-full flex items-center justify-center scale-125 text-white"
                                                                            dangerouslySetInnerHTML={{ __html: node.label }}
                                                                        />
                                                                    </foreignObject>

                                                                    {/* Z-Axis Label */}
                                                                    {node.z !== 0 && (
                                                                        <text 
                                                                            x={(node.x * GRID_STEP) + 25} 
                                                                            y={(-node.y * GRID_STEP) - 25} 
                                                                            fontSize="14" 
                                                                            fill="#94a3b8" 
                                                                            fontWeight="bold"
                                                                        >
                                                                            {node.z > 0 ? `+${node.z}` : node.z}
                                                                        </text>
                                                                    )}
                                                                </g>
                                                            ))}
                                                        </>
                                                    );
                                                })()
                                            }
                                        </svg>
                                     </div>
                                </div>
                            )}

                            {/* Recap Box - Centered Text, Flexible Height */}
                            <div className="flex-1 min-h-0 w-full p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center text-center">
                                <div className="text-[10px] text-slate-500 font-bold mb-2 uppercase tracking-widest">Recap</div>
                                <div className="space-y-1 mb-3 text-sm text-slate-300 w-full flex flex-col items-center">
                                    {premises.map((p, i) => <div key={i} className="border-b border-slate-700/50 pb-1 last:border-0 w-fit" dangerouslySetInnerHTML={{ __html: p }} />)}
                                </div>
                                <div className="text-sm font-bold text-cyan-400 mb-1 px-4" dangerouslySetInnerHTML={{ __html: "Q: " + currentQuestion }} />
                                <div className="mt-2 text-xs font-mono inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
                                    Correct Answer: <span className={expectedAnswerRef.current ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{expectedAnswerRef.current ? "YES" : "NO"}</span>
                                </div>
                            </div>

                            <button onClick={startRound} className="shrink-0 w-full py-4 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-200 transition-colors shadow-lg">NEXT (Enter)</button>
                        </div>
                    )}

                    {/* END */}
                    {phase === "SESSION_END" && (
                        <div className="space-y-8 animate-in zoom-in-95">
                            <h2 className="text-3xl font-bold text-green-500">SESSION COMPLETE</h2>
                            <div className="grid grid-cols-2 gap-4 text-left p-6 bg-slate-800 rounded-xl border border-slate-700">
                                <div className="text-slate-400">Total Score</div><div className="font-mono font-bold text-xl">{currentScore}</div>
                                <div className="text-slate-400">Avg Reaction</div><div className="font-mono font-bold text-xl">{questionsAttempted > 0 ? Math.round(totalReactionTime.current / questionsAttempted) : 0}ms</div>
                                <div className="text-slate-400">Max Depth</div><div className="font-mono font-bold text-xl">{maxDepthReached}</div>
                                <div className="text-slate-400">Accuracy</div><div className="font-mono font-bold text-xl">{questionsAttempted > 0 ? Math.round((sessionLog.filter(l => l.isCorrect).length / questionsAttempted) * 100) : 0}%</div>
                            </div>
                            <button onClick={() => setPhase("SETUP")} className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors">RETURN TO MENU</button>
                        </div>
                    )}
                </div>
            </div>
        </main>
      </div>

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-xl">
                 <h2 className="font-bold">CONFIGURATION</h2>
                 <button onClick={() => setShowSettings(false)} className="text-xl text-slate-500 hover:text-white">×</button>
             </div>
             <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                 
                 {/* Timer Controls */}
                 <section>
                    <h3 className="text-xs font-bold text-cyan-500 mb-3 uppercase tracking-wider">Timer Controls</h3>
                    
                    {/* Session Timer */}
                    <div className="p-3 bg-slate-800/30 rounded mb-3 border border-transparent hover:border-slate-700 transition">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-slate-300">Session Duration</span>
                            <div className="flex bg-slate-900 rounded p-1">
                                <button 
                                    onClick={() => setSettings({...settings, disableSessionTimer: true})}
                                    className={`px-3 py-1 text-[10px] rounded font-bold transition-all ${settings.disableSessionTimer ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    ∞
                                </button>
                                <button 
                                    onClick={() => setSettings({...settings, disableSessionTimer: false})}
                                    className={`px-3 py-1 text-[10px] rounded font-bold transition-all ${!settings.disableSessionTimer ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    TIMED
                                </button>
                            </div>
                        </div>
                        {!settings.disableSessionTimer && (
                             <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                                 <span className="text-xs text-slate-500">Minutes</span>
                                 <div className="flex items-center gap-2">
                                     <button onClick={() => setSettings(s => ({ ...s, sessionLengthMinutes: Math.max(1, s.sessionLengthMinutes - 1) }))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 font-bold flex items-center justify-center text-sm">-</button>
                                     <span className="font-mono w-6 text-center text-sm">{settings.sessionLengthMinutes}</span>
                                     <button onClick={() => setSettings(s => ({ ...s, sessionLengthMinutes: s.sessionLengthMinutes + 1 }))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 font-bold flex items-center justify-center text-sm">+</button>
                                 </div>
                             </div>
                        )}
                    </div>

                    {/* Question Timer */}
                    <div className="p-3 bg-slate-800/30 rounded border border-transparent hover:border-slate-700 transition">
                        <label className="flex items-center justify-between cursor-pointer mb-2">
                            <span className="text-sm font-bold text-slate-300">Question Timer</span>
                            <input type="checkbox" checked={settings.useQuestionTimer} onChange={e => setSettings({ ...settings, useQuestionTimer: e.target.checked })} className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-offset-slate-900" />
                        </label>
                        {settings.useQuestionTimer && (
                             <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                                 <span className="text-xs text-slate-500">Seconds per Question</span>
                                 <div className="flex items-center gap-2">
                                     <button onClick={() => setSettings(s => ({ ...s, questionTimeLimit: Math.max(3, s.questionTimeLimit - 1) }))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 font-bold flex items-center justify-center text-sm">-</button>
                                     <span className="font-mono w-6 text-center text-sm">{settings.questionTimeLimit}</span>
                                     <button onClick={() => setSettings(s => ({ ...s, questionTimeLimit: s.questionTimeLimit + 1 }))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 font-bold flex items-center justify-center text-sm">+</button>
                                 </div>
                             </div>
                        )}
                    </div>
                 </section>

                 {/* Logic Modules */}
                 <section>
                     <h3 className="text-xs font-bold text-cyan-500 mb-3 uppercase tracking-wider">Logic Modules</h3>
                     <div className="space-y-2">
                        {(Object.keys(settings.activeModes) as RftMode[]).map(m => (
                            <label key={m} className="flex items-center gap-3 p-2 rounded bg-slate-800/50 hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-700 transition">
                                <input type="checkbox" checked={settings.activeModes[m]} onChange={e => setSettings({ ...settings, activeModes: { ...settings.activeModes, [m]: e.target.checked } })} className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-offset-slate-900" />
                                <span className="text-sm">{m.replace("_", " ")}</span>
                            </label>
                        ))}
                     </div>
                 </section>

                 {/* Visual Style */}
                 <section>
                    <h3 className="text-xs font-bold text-pink-500 mb-3 uppercase tracking-wider">Visual Style</h3>
                    <div className="p-3 bg-slate-800/30 rounded border border-transparent hover:border-slate-700 transition">
                        <label className="text-sm font-bold text-slate-300 block mb-2">Symbol Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(["EMOJI", "WORDS", "VORONOI", "MIXED"] as SymbolMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setSettings({ ...settings, symbolMode: mode })}
                                    className={`px-3 py-2 rounded text-xs font-bold transition-all border ${
                                        settings.symbolMode === mode
                                            ? "bg-pink-500/20 text-pink-400 border-pink-500/50"
                                            : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
                                    }`}
                                >
                                    {mode === "EMOJI" && "EMOJIS 🚀"}
                                    {mode === "WORDS" && "WORDS (KIV)"}
                                    {mode === "VORONOI" && "SHAPES ⬡"}
                                    {mode === "MIXED" && "MIXED 🎲"}
                                </button>
                            ))}
                        </div>
                    </div>
                 </section>

                 {/* Modifiers */}
                 <section>
                    <h3 className="text-xs font-bold text-purple-500 mb-3 uppercase tracking-wider">Advanced Modifiers</h3>
                    <div className="space-y-2">
                         <label className="flex items-center gap-3 p-2 bg-slate-800/30 rounded cursor-pointer hover:bg-slate-800/50 transition">
                            <input type="checkbox" checked={settings.enableDeictic} onChange={e => setSettings({ ...settings, enableDeictic: e.target.checked })} className="rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-offset-slate-900" />
                            <span className="text-sm">Deictic Framing (Perspective Taking)</span>
                         </label>
                         <label className="flex items-center gap-3 p-2 bg-slate-800/30 rounded cursor-pointer hover:bg-slate-800/50 transition">
                            <input type="checkbox" checked={settings.enableMovement} onChange={e => setSettings({ ...settings, enableMovement: e.target.checked })} className="rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-offset-slate-900" />
                            <span className="text-sm">Path Integration (Movement)</span>
                         </label>
                         <label className="flex items-center gap-3 p-2 bg-slate-800/30 rounded cursor-pointer hover:bg-slate-800/50 transition">
                            <input type="checkbox" checked={settings.enableTransformation} onChange={e => setSettings({ ...settings, enableTransformation: e.target.checked })} className="rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-offset-slate-900" />
                            <span className="text-sm">Transformation of Function (Inversion)</span>
                         </label>
                         <label className="flex items-center gap-3 p-2 bg-slate-800/30 rounded cursor-pointer hover:bg-slate-800/50 transition">
                            <input type="checkbox" checked={settings.enableCipher} onChange={e => setSettings({ ...settings, enableCipher: e.target.checked })} className="rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-offset-slate-900" />
                            <span className="text-sm">Cipher Mode (Nonsense Words)</span>
                         </label>
                         <label className="flex items-center gap-3 p-2 bg-slate-800/30 rounded cursor-pointer hover:bg-slate-800/50 transition">
                            <input type="checkbox" checked={settings.enableInterference} onChange={e => setSettings({ ...settings, enableInterference: e.target.checked })} className="rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-offset-slate-900" />
                            <span className="text-sm">Interference Task</span>
                         </label>
                    </div>
                 </section>

                 {/* Difficulty */}
                 <section>
                     <h3 className="text-xs font-bold text-green-500 mb-3 uppercase tracking-wider">Difficulty</h3>
                     <div className="flex justify-between items-center mb-4 p-2 bg-slate-800 rounded">
                         <span className="text-sm">Starting Depth</span>
                         <div className="flex items-center gap-3">
                             <button onClick={() => setSettings(s => ({ ...s, numPremises: Math.max(2, s.numPremises - 1) }))} className="w-8 h-8 bg-slate-700 rounded hover:bg-slate-600 font-bold">-</button>
                             <span className="font-mono w-4 text-center">{settings.numPremises}</span>
                             <button onClick={() => setSettings(s => ({ ...s, numPremises: s.numPremises + 1 }))} className="w-8 h-8 bg-slate-700 rounded hover:bg-slate-600 font-bold">+</button>
                         </div>
                     </div>
                     <label className="flex items-center justify-between mb-2 cursor-pointer"><span className="text-sm">Auto-Progress (Adaptive)</span><input type="checkbox" checked={settings.autoProgress} onChange={e => setSettings({ ...settings, autoProgress: e.target.checked })} /></label>
                     <label className="flex items-center justify-between cursor-pointer"><span className="text-sm">Blind Mode (Memory)</span><input type="checkbox" checked={settings.blindMode} onChange={e => setSettings({ ...settings, blindMode: e.target.checked })} /></label>
                 </section>
             </div>
             <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-xl">
                 <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-white text-slate-900 font-bold rounded hover:bg-slate-200">SAVE & CLOSE</button>
             </div>
          </div>
        </div>
      )}

      {/* --- HISTORY & LOG MODALS --- */}
      {(showHistoryModal || showReviewModal) && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => { setShowHistoryModal(false); setShowReviewModal(false); }}>
           <div className="w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-xl">
                    <h2 className="font-bold">{showHistoryModal ? "STATS & HISTORY" : "SESSION LOG"}</h2>
                    <button onClick={() => { setShowHistoryModal(false); setShowReviewModal(false); }} className="text-xl text-slate-500 hover:text-white">×</button>
               </div>
               <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                   {showHistoryModal ? (
                       <div className="space-y-6">
                           <div className="h-64 bg-slate-800/50 rounded border border-slate-700 relative p-2"><canvas ref={chartCanvasRef} /></div>
                           <div className="space-y-2">
                               {[...history].reverse().map((h, i) => (
                                   <div key={i} className="p-3 bg-slate-800/30 rounded border border-slate-700/50 flex justify-between items-center">
                                       <div>
                                           <div className="text-xs text-slate-500">{h.date}</div>
                                           <div className="font-bold text-sm">{h.totalScore} pts <span className="text-slate-400">({h.accuracy}%)</span></div>
                                       </div>
                                       <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">{h.activeModifiers?.map(m => <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{m}</span>)}</div>
                                   </div>
                               ))}
                           </div>
                       </div>
                   ) : (
                       <div className="space-y-3">
                           {sessionLog.map(log => (
                               <div key={log.id} className={`p-3 rounded border-l-4 ${log.isCorrect ? 'bg-green-500/5 border-green-500' : 'bg-red-500/5 border-red-500'}`}>
                                   <div className="flex justify-between text-xs text-slate-500 mb-1"><span className="uppercase">{log.mode.replace("_", " ")}</span><span>{log.reactionTimeMs}ms</span></div>
                                   <div className="font-bold text-sm mb-1 text-slate-200" dangerouslySetInnerHTML={{ __html: log.question }} />
                                   <div className="flex justify-between text-xs pt-2 border-t border-slate-700/50">
                                       <span>Ans: <b className={log.isCorrect ? "text-green-400" : "text-red-400"}>{log.userAnswer}</b></span>
                                       <span className="opacity-50">Exp: {log.correctAnswer}</span>
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
           </div>
        </div>
      )}
    </div>
  );
}