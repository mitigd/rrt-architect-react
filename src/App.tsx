import React, { useState, useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';

// --- Theme Constants ---
export const THEME = {
    light: {
        bg: "#f8fafc",       // slate-50
        text: "#1e293b",     // slate-800
        grid: "#cbd5e1",     // slate-300
        ballFill: "#ffffff",
        ballStroke: "#94a3b8",
        ripple: "rgba(0,0,0,0.5)",
        chartBorder: "#1e293b",
        chartBg: "rgba(30, 41, 59, 0.1)"
    },
    dark: {
        bg: "#0f172a",       // slate-900
        text: "#f8fafc",     // slate-50
        grid: "#334155",     // slate-700
        ballFill: "#1e293b",
        ballStroke: "#475569",
        ripple: "rgba(255,255,255,0.5)",
        chartBorder: "#00ff9d",
        chartBg: "rgba(0, 255, 157, 0.1)"
    }
};

export const COMMON = {
    target: "#22c55e",   // green-500
    wrong: "#ef4444",    // red-500
    selected: "#eab308", // yellow-500
    dim: "#64748b",      // slate-500
    accent: "#00f2ff",
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
    return `<span class="px-1 rounded border font-mono font-bold text-sm tracking-wider inline-block" style="background-color: ${THEME.light.bg}; border-color: ${COMMON.dim}; color: ${COMMON.accent}">${c1}${v1}${c2}${v2}</span>`;
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
    const [isDark, setIsDark] = useState(true);
    const [phase, setPhase] = useState<GamePhase>("SETUP");

    const [activeCipherKeys, setActiveCipherKeys] = useState<string[]>([]); 

    const [settings, setSettings] = useState<GameSettings>(() => {
        if (typeof window === 'undefined') return DEFAULT_SETTINGS;

        const stored = localStorage.getItem("rft_architect_settings");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Deep merge to ensure new settings keys don't break old saves
                return {
                    ...DEFAULT_SETTINGS,
                    ...parsed,
                    activeModes: { ...DEFAULT_SETTINGS.activeModes, ...(parsed.activeModes || {}) }
                };
            } catch (e) {
                console.error("Failed to parse settings", e);
                return DEFAULT_SETTINGS;
            }
        }
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
    const currentStreak = useRef(0);
    const sessionTimerRef = useRef(0);

    // --- Effects ---

    useEffect(() => {
        const storedHist = localStorage.getItem("rft_architect_history");
        if (storedHist) try { setHistory(JSON.parse(storedHist)); } catch (e) { console.error(e); }

        const storedSettings = localStorage.getItem("rft_architect_settings");
        if (storedSettings) {
            try {
                const parsed = JSON.parse(storedSettings);
                setSettings(s => ({ ...s, ...parsed, activeModes: { ...s.activeModes, ...(parsed.activeModes || {}) } }));
            } catch (e) { console.error(e); }
        }
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
                            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.2)',
                            tension: 0.3,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Score',
                            data: chartData.map(h => h.totalScore),
                            borderColor: COMMON.accent,
                            backgroundColor: isDark ? 'rgba(0, 242, 255, 0.1)' : 'rgba(0, 242, 255, 0.2)',
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

    const generateLogic = useCallback((mode: RftMode, num: number, cipherMap: Record<string, string>) => {
        let newPremises: string[] = [];
        let newQuestion = "";
        let newAnswer = false;
        let modifiers: string[] = [];
        let visualNodes: VisualNode[] = [];
        
        // Track which cipher keys are actually used in this round
        const usedKeys = new Set<string>();

        // Helper to safely get display text and track usage
        const getTerm = (key: string) => {
            if (settings.enableCipher && cipherMap[key]) {
                usedKeys.add(key);
                return `<b style="color: ${COMMON.accent}">${cipherMap[key]}</b>`;
            }
            return key;
        };

        // Helper for premises that adds to usedKeys
        const createPremise = (a: string, rawRel: string, b: string) => {
            // Check if rawRel is a known key (like "NORTH") or a sentence
            // For Spatial, rawRel is usually just "NORTH", "WEST", etc.
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
            // For Question phrasing
            let qText = getTerm(qType);
            if (!settings.enableCipher) qText = qType === "SAME" ? "the SAME as" : "DIFFERENT from";
            
            newQuestion = `Is ${items[idxA]} ${qText} ${items[idxB]}?`;
            newAnswer = qType === "SAME" ? (values[idxA] === values[idxB]) : (values[idxA] !== values[idxB]);
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
        }
        else if (mode.includes("SPATIAL")) {
            const is3D = mode === "SPATIAL_3D";
            const items = generateSymbols(num + 1, settings.symbolMode);
            const positions: { x: number, y: number, z: number }[] = [{ x: 0, y: 0, z: 0 }];
            let cx = 0, cy = 0, cz = 0;
            visualNodes.push({ id: items[0], x: 0, y: 0, z: 0, label: items[0] });

            // 1. GENERATE PREMISES
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
                visualNodes.push({ id: items[i+1], x: cx, y: cy, z: cz, label: items[i+1] });
            }

            // 2. DETERMINE SUB-MODE
            let availableTypes = ["STANDARD"]; 
            if (settings.enableDeictic) availableTypes.push("DEICTIC");
            if (settings.enableMovement && !is3D) availableTypes.push("MOVEMENT");
            if (availableTypes.length > 1) availableTypes = availableTypes.filter(t => t !== "STANDARD");

            const selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

            // === A. DEICTIC ===
            if (selectedType === "DEICTIC") {
                modifiers.push("DEICTIC");
                const [idxMe, idxTarget] = getDistinctRandomIndices(items.length);
                const diffX = positions[idxTarget].x - positions[idxMe].x;
                const diffY = positions[idxTarget].y - positions[idxMe].y;
                
                // Static Facing
                const facingDir = Math.floor(Math.random() * 4); // 0=N, 1=E, 2=S, 3=W
                const facingNames = ["NORTH", "EAST", "SOUTH", "WEST"];
                const myFacing = facingNames[facingDir];

                // Calculate Rotation
                let localX = 0, localY = 0;
                if (facingDir === 0) { localX = diffX; localY = diffY; } 
                else if (facingDir === 1) { localX = -diffY; localY = diffX; } 
                else if (facingDir === 2) { localX = -diffX; localY = -diffY; } 
                else if (facingDir === 3) { localX = diffY; localY = -diffX; } 

                let trueLocalRel = "";
                if (localY > 0 && Math.abs(localX) <= localY) trueLocalRel = "FRONT";
                else if (localY < 0 && Math.abs(localX) <= Math.abs(localY)) trueLocalRel = "BEHIND";
                else if (localX > 0) trueLocalRel = "RIGHT";
                else if (localX < 0) trueLocalRel = "LEFT";
                if (!trueLocalRel) trueLocalRel = "SAME LOCATION";

                const displayFacing = getTerm(myFacing);

                if (Math.random() > 0.5) {
                    newQuestion = `You are at ${items[idxMe]} facing ${displayFacing}.<br/>Is ${items[idxTarget]} to your ${getTerm(trueLocalRel)}?`;
                    newAnswer = true;
                } else {
                    const possibleDirs = ["FRONT", "BEHIND", "LEFT", "RIGHT"];
                    let fakeRaw = possibleDirs[Math.floor(Math.random() * 4)];
                    while (fakeRaw === trueLocalRel) fakeRaw = possibleDirs[Math.floor(Math.random() * 4)];
                    
                    newQuestion = `You are at ${items[idxMe]} facing ${displayFacing}.<br/>Is ${items[idxTarget]} to your ${getTerm(fakeRaw)}?`;
                    newAnswer = false;
                }
            }

            // === B. MOVEMENT ===
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

                // Ensure target is distinct
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

                const possibleDirs = ["FRONT", "BEHIND", "LEFT", "RIGHT"];
                const qRaw = possibleDirs[Math.floor(Math.random() * 4)];
                newQuestion = `${instructions.join(" ")} <br/><br/> Is ${items[targetIdx]} to your ${getTerm(qRaw)}?`;
                newAnswer = (trueRel === qRaw);
            }

            // === C. STANDARD ===
            else {
                const [idxA, idxB] = getDistinctRandomIndices(items.length);
                const diffX = positions[idxB].x - positions[idxA].x;
                const diffY = positions[idxB].y - positions[idxA].y;
                const diffZ = positions[idxB].z - positions[idxA].z;

                let parts = [];
                if (is3D) { if (diffZ > 0) parts.push("ABOVE"); else if (diffZ < 0) parts.push("BELOW"); }
                
                if (diffY > 0) parts.push("NORTH"); else if (diffY < 0) parts.push("SOUTH");
                if (diffX > 0) parts.push("EAST"); else if (diffX < 0) parts.push("WEST");
                

                let trueRel = "at the SAME LOCATION as";
                if (parts.length > 0) {
                   // Translate combined directions independently
                    trueRel = parts.map(p => getTerm(p)).join(" and ");
                }

                if (Math.random() > 0.5) {
                    newQuestion = `Is ${items[idxB]} ${trueRel} ${items[idxA]}?`;
                    newAnswer = true;
                } else {
                    const allDirs = is3D ? ["NORTH", "SOUTH", "EAST", "WEST", "ABOVE", "BELOW"] : ["NORTH", "SOUTH", "EAST", "WEST"];
                    let fakeRaw = allDirs[Math.floor(Math.random() * allDirs.length)];
                    while (parts.includes(fakeRaw)) fakeRaw = allDirs[Math.floor(Math.random() * allDirs.length)];
                    
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
        currentStreak.current = 0;
        setQuestionsAttempted(0);
        setMaxDepthReached(settings.numPremises);
        setSessionLog([]);
        totalReactionTime.current = 0;

        setSessionSecondsElapsed(0);

        // Fix: Sync State AND Ref immediately
        const duration = settings.sessionLengthMinutes * 60;
        setSessionSecondsRemaining(duration);
        sessionTimerRef.current = duration;

        setCurrentCipherMap(generateCipherKey());

        if (sessionInterval.current) clearInterval(sessionInterval.current);
        sessionInterval.current = setInterval(() => {
            setSessionSecondsElapsed(s => s + 1);
            if (!settings.disableSessionTimer) {
                // Fix: Decrement Ref for logic, update State for UI
                sessionTimerRef.current -= 1;
                setSessionSecondsRemaining(sessionTimerRef.current);

                if (sessionTimerRef.current <= 0) {
                    endSession();
                }
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
            accuracy: questionsAttempted > 0 ? Math.round((questionsAttempted - (questionsAttempted - questionsAttempted)) / questionsAttempted * 100) : 0,
            questionsAnswered: questionsAttempted,
            highestDepth: maxDepthReached,
            avgReactionTime: avgRT,
            activeModes: activeM,
            activeModifiers: activeModifiers
        };

        setHistory(prev => [...prev, histRecord]);
        localStorage.setItem("rft_architect_history", JSON.stringify([...history, histRecord]));
        setPhase("SESSION_END");
    }, [currentScore, questionsAttempted, maxDepthReached, sessionSecondsElapsed, settings.activeModes, activeModifiers, history]);

    const startRound = () => {
        if (!settings.disableSessionTimer && sessionTimerRef.current <= 0) { endSession(); return; }

        const enabledModes = (Object.keys(settings.activeModes) as RftMode[]).filter((k) => settings.activeModes[k]);
        if (enabledModes.length === 0) { alert("Enable a logic module."); return; }

        const nextMode = enabledModes[Math.floor(Math.random() * enabledModes.length)];
        setCurrentRoundMode(nextMode);

        let roundCipherMap = currentCipherMap;
        let roundCipherChanged = false;

        // Ensure key exists if cipher enabled
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

        const logicData = generateLogic(nextMode, settings.numPremises, roundCipherMap);
        
        // --- FIX: Update Active Keys ---
        setActiveCipherKeys(logicData.usedCipherKeys);
        
        setPremises(logicData.premises);
        setCurrentQuestion(logicData.question);
        setCurrentVisualMap(logicData.visualMap);
        
        expectedAnswerRef.current = logicData.answer;
        let mods = [...logicData.modifiers];
        if (roundCipherChanged) mods.push("KEY_CHANGE");

        let isNight = false;
        if (settings.enableTransformation) {
            mods.push("TRANSFORM");
            isNight = Math.random() > 0.5;
            setContextIsNight(isNight);
            if (isNight) expectedAnswerRef.current = !expectedAnswerRef.current;
        } else {
            setContextIsNight(false);
        }
        setActiveModifiers(mods);

        setIsYesRight(Math.random() > 0.5);
        setQuestionSecondsRemaining(settings.questionTimeLimit);

        if (settings.blindMode || roundCipherChanged) {
            setPhase("PREMISE_MEMORIZE");
        } else {
            if (settings.enableInterference) startInterference();
            else startQuestionPhase();
        }
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
                        handleAnswer(null); // Timeout
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    // 1. Wrap handleAnswer in useCallback to prevent stale state issues
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
            currentStreak.current += 1;
            if (settings.autoProgress && currentStreak.current > 0 && currentStreak.current % 3 === 0) {
                setSettings(s => ({ ...s, numPremises: s.numPremises + 1 }));
                setMaxDepthReached(d => Math.max(d, settings.numPremises + 1));
                setFeedbackMsg(prev => prev + " | DEPTH +");
            }
        } else {
            setCurrentScore(s => Math.max(0, s - 20));
            currentStreak.current = 0;
            if (settings.autoProgress && settings.numPremises > 2) {
                setSettings(s => ({ ...s, numPremises: s.numPremises - 1 }));
                setFeedbackMsg(prev => prev + " | DEPTH -");
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
    }, [settings, contextIsNight, activeModifiers, premises, currentQuestion, currentRoundMode]);


    // 2. KEYBOARD LISTENER - Strictly depends on [isYesRight] to sync keys with buttons
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (phase === "QUESTION") {
                // LOGIC:
                // If isYesRight is TRUE: Left Button is NO, Right Button is YES
                // If isYesRight is FALSE: Left Button is YES, Right Button is NO

                if (e.code === "ArrowLeft" || e.code === "KeyD") {
                    // Left Key triggers whatever the Left Button is currently doing
                    handleAnswer(!isYesRight);
                }
                if (e.code === "ArrowRight" || e.code === "KeyJ") {
                    // Right Key triggers whatever the Right Button is currently doing
                    handleAnswer(isYesRight);
                }
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [phase, isYesRight, handleAnswer]); // <--- CRITICAL DEPENDENCIES

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
    }, [phase, isYesRight]);

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
        return Object.entries(currentCipherMap).filter(([k, v]) => activeCipherKeys.includes(k));
    };

    return (
        // 1. ROOT: Fixed to viewport, Flex Column to stack Header + Main
        <div className="fixed inset-0 w-full h-full max-w-[90vw] bg-slate-100 dark:bg-slate-950 transition-colors duration-300 font-sans selection:bg-blue-500/30 flex flex-col overflow-hidden">

            {/* 1. INSERT THIS STYLE TAG FOR DYNAMIC SCROLLBARS */}
            <style>{`
                .custom-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: ${isDark ? '#475569 transparent' : '#cbd5e1 transparent'};
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: ${isDark ? '#475569' : '#cbd5e1'};
                    border-radius: 20px;
                }
            `}</style>

            {/* 2. HEADER: Fixed height, shrink-0 prevents it from being squashed */}
            <header
                className="shrink-0 w-full max-w-4xl mx-auto p-4 flex justify-between items-center border-b z-20 relative"
                style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid }}
            >
                <div className="flex items-center gap-4">
                    <div className="text-sm font-mono tracking-wider">
                        {phase === "SETUP" ? "READY" :
                            phase === "SESSION_END" ? "COMPLETE" :
                                settings.disableSessionTimer ?
                                    `DURATION: ${formatTime(sessionSecondsElapsed)}` :
                                    `REMAINING: ${formatTime(sessionSecondsRemaining)}`
                        }
                    </div>
                    {phase === "QUESTION" && settings.useQuestionTimer && (
                        <div className="text-sm font-mono font-bold" style={{ color: questionSecondsRemaining < 5 ? COMMON.wrong : COMMON.accent }}>
                            Q-TIMER: {questionSecondsRemaining}s
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {phase !== "SETUP" && phase !== "SESSION_END" ? (
                        <button
                            onClick={() => setPhase("SETUP")}
                            className="px-3 py-1 text-xs font-bold border rounded"
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: COMMON.wrong, borderColor: COMMON.wrong }}
                        >ABORT</button>
                    ) : (
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="px-3 py-1 text-xs font-bold border rounded hover:opacity-80"
                            style={{ backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderColor: isDark ? THEME.dark.grid : THEME.light.grid }}
                        >STATS</button>
                    )}
                    <button
                        onClick={() => setShowReviewModal(true)}
                        className="px-3 py-1 text-xs font-bold border rounded hover:opacity-80"
                        style={{ backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderColor: isDark ? THEME.dark.grid : THEME.light.grid }}
                    >LOG</button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="px-3 py-1 text-xs font-bold border rounded hover:opacity-80"
                        style={{
                            backgroundColor: 'rgba(0, 242, 255, 0.1)',
                            color: COMMON.accent,
                            borderColor: COMMON.accent
                        }}
                    >CONFIG</button>
                </div>
            </header>

            {/* 3. MAIN STAGE: Fills remaining space, centers the card */}
            <main className="flex-1 w-full min-h-0 flex items-center justify-center p-4 relative z-10 lg:max-w-[700px] lg:mx-auto">


                <div
                    // 4. THE CARD: The Aspect Ratio logic lives here
                    // w-full + max-h-full + aspect-square = Perfect responsive box
                    className="
                        h-full max-h-full w-auto max-w-[90vw] lg:max-w-[1200px]
                        aspect-square lg:aspect-[5/4]
                        shadow-xl rounded-xl border flex flex-col relative overflow-hidden transition-colors duration-300"                    style={{
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderColor: isDark ? THEME.dark.grid : THEME.light.grid
                    }}
                >
                    {/* 5. CARD CONTENT WRAPPER: Handles internal scrolling if text is too big */}
                    <div className="flex-1 flex flex-col w-full h-full p-6 overflow-y-auto custom-scrollbar">

                        {/* Header Stats */}
                        <div
                            className="flex justify-between items-center text-xs font-mono mb-4 border-b pb-2 shrink-0"
                            style={{
                                color: COMMON.dim,
                                borderColor: isDark ? THEME.dark.grid : THEME.light.grid
                            }}
                        >
                            <span>SCORE: {currentScore}</span>
                            <span>DEPTH: {settings.numPremises}</span>
                            {settings.enableTransformation && (phase === "QUESTION" || phase === "RESULT") && (
                                <span
                                    className="px-2 py-0.5 rounded border"
                                    style={{
                                        backgroundColor: contextIsNight ? 'rgba(79, 70, 229, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                        color: contextIsNight ? '#818cf8' : '#fbbf24',
                                        borderColor: contextIsNight ? '#4338ca' : '#d97706'
                                    }}
                                >
                                    {contextIsNight ? "🌙 INVERT" : "☀ STANDARD"}
                                </span>
                            )}
                        </div>

                        <div className="flex-grow flex flex-col items-center justify-center text-center w-full relative">

                            {/* PERSISTENT CIPHER KEY DISPLAY */}
                            {settings.enableCipher && phase !== "SETUP" && phase !== "SESSION_END" && (
                                <div className="w-full mb-4 animate-in slide-in-from-top-2 fade-in">
                                    {cipherHasChanged && (
                                        <div className="text-white font-bold p-2 rounded text-center mb-2 shadow-md animate-pulse" style={{ backgroundColor: COMMON.wrong }}>
                                            ⚠️ CIPHER KEY CHANGED
                                        </div>
                                    )}

                                    <div className="text-xs font-bold opacity-50 mb-1 uppercase tracking-wider">Cipher Reference</div>
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-xs p-3 rounded border shadow-inner"
                                        style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? THEME.dark.grid : THEME.light.grid }}>
                                        {getCipherList().map(([k, v]) => (
                                            <div key={k} className="flex justify-between items-center bg-white/5 p-1 rounded">
                                                <span className="font-bold mr-2 truncate" style={{ color: COMMON.accent }}>{v}</span>
                                                <span className="opacity-50">=</span>
                                                <span className="ml-2 opacity-70 truncate">{k}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Setup Phase */}
                            {phase === "SETUP" && (
                                <div className="space-y-6">
                                    <h1 className="text-4xl font-black tracking-tighter" style={{ color: isDark ? THEME.dark.text : THEME.light.text }}>RFT ARCHITECT</h1>
                                    <p style={{ color: COMMON.dim }}>Logic Training System</p>
                                    <button
                                        onClick={startSession}
                                        className="px-8 py-4 font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all text-white"
                                        style={{ backgroundColor: COMMON.target }}
                                    >
                                        START SESSION
                                    </button>
                                    <p className="text-xs opacity-50">Press Enter</p>
                                </div>
                            )}

                            {/* Interference Phase */}
                            {phase === "INTERFERENCE" && (
                                <div className={`w-full h-full flex flex-col items-center justify-center ${interferenceStatus === "MISS" ? "animate-bounce" : ""}`}>
                                    <h3 className="text-xl font-bold mb-8" style={{ color: COMMON.wrong }}>ACTIVE INTERFERENCE</h3>
                                    <div
                                        className="w-32 h-32 rounded-full border-4 border-white shadow-2xl transition-colors duration-75"
                                        style={{ backgroundColor: interferenceCurrentColor }}
                                    />
                                    <p className="mt-8 text-lg">
                                        Press SPACE when color is <span style={{ color: interferenceTargetColor, fontWeight: 'bold', textTransform: 'uppercase' }}>{interferenceTargetColor}</span>
                                    </p>
                                    {interferenceStatus === "MISS" && <div className="font-bold text-2xl mt-4" style={{ color: COMMON.wrong }}>MISSED!</div>}
                                </div>
                            )}



                            {/* Memorize Phase */}
                            {phase === "PREMISE_MEMORIZE" && (
                                <div className="w-full space-y-4">
                                    {cipherHasChanged && (
                                        <div className="text-white font-bold p-2 rounded animate-pulse" style={{ backgroundColor: COMMON.wrong }}>
                                            ⚠️ CIPHER KEY CHANGED
                                        </div>
                                    )}
                                    <div className="text-xs font-mono inline-block px-2 py-1 rounded" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>{currentRoundMode}</div>

                                    <div className="space-y-4 my-8">
                                        {premises.map((p, i) => (
                                            <div key={i} className="text-xl md:text-2xl font-medium" dangerouslySetInnerHTML={{ __html: p }} />
                                        ))}
                                    </div>

                                    <div className="text-sm animate-pulse" style={{ color: COMMON.dim }}>Memorize structure... Press Space</div>
                                    <button
                                        onClick={() => settings.enableInterference ? startInterference() : startQuestionPhase()}
                                        className="mt-4 px-6 py-2 text-white rounded font-bold"
                                        style={{ backgroundColor: COMMON.dim }}
                                    >READY</button>
                                </div>
                            )}

                            {/* Question Phase */}
                            {phase === "QUESTION" && (
                                <div className="w-full flex flex-col h-full">
                                    {!settings.blindMode && (
                                        <div className="p-3 rounded mb-6 text-sm" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)' }}>
                                            {premises.map((p, i) => (
                                                <div key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: p }} />
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex-grow flex flex-col justify-center">
                                        <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-8" dangerouslySetInnerHTML={{ __html: currentQuestion }} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-auto">
                                        <button
                                            onClick={() => handleAnswer(!isYesRight)}
                                            className="h-20 md:h-24 rounded-lg text-xl md:text-2xl font-black shadow-lg transition-transform active:scale-95 flex flex-col items-center justify-center"
                                            style={{
                                                backgroundColor: isYesRight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                color: isYesRight ? COMMON.wrong : COMMON.target
                                            }}
                                        >
                                            {isYesRight ? "NO" : "YES"}
                                            <span className="text-xs font-normal opacity-50 mt-1">Key: D / ←</span>
                                        </button>
                                        <button
                                            onClick={() => handleAnswer(isYesRight)}
                                            className="h-20 md:h-24 rounded-lg text-xl md:text-2xl font-black shadow-lg transition-transform active:scale-95 flex flex-col items-center justify-center"
                                            style={{
                                                backgroundColor: isYesRight ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: isYesRight ? COMMON.target : COMMON.wrong
                                            }}
                                        >
                                            {isYesRight ? "YES" : "NO"}
                                            <span className="text-xs font-normal opacity-50 mt-1">Key: J / →</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Result Phase */}
                            {/* --- Result Phase Update --- */}
                            {phase === "RESULT" && (
                                <div className="w-full flex flex-col items-center justify-center h-full space-y-3">
                                    <h2 className="text-3xl font-black shrink-0" style={{ color: (feedbackMsg.includes("VERIFIED") || feedbackMsg.includes("SUCCESS")) ? COMMON.target : COMMON.wrong }}>
                                        {feedbackMsg}
                                    </h2>

                                    {/* --- VISUALIZER --- */}
                                    {currentRoundMode.includes("SPATIAL") && currentVisualMap.length > 0 && (
                                        <div className="h-48 md:h-64 aspect-square rounded-xl border relative overflow-hidden shrink-0 bg-slate-50 dark:bg-slate-900" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid }}>
                                            <div className="absolute top-2 left-2 text-[10px] font-bold opacity-50 z-10">SPATIAL MAP</div>

                                            {/* SVG Container */}
                                            <div className="w-full h-full p-4 flex items-center justify-center">
                                                <svg viewBox="-55 -55 110 110" className="w-full h-full overflow-visible">
                                                    {/* Background Grid */}
                                                    <defs>
                                                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="0.5" />
                                                        </pattern>
                                                    </defs>
                                                    <rect x="-55" y="-55" width="110" height="110" fill="url(#grid)" opacity="0.3" />

                                                    {/* Draw Logic */}
                                                    {(() => {
                                                        // 1. Auto-Scale the map to fit the 100x100 box
                                                        const maxCoord = Math.max(...currentVisualMap.map(n => Math.max(Math.abs(n.x), Math.abs(n.y)))) || 1;
                                                        const scale = 40 / maxCoord; // 40 allows padding

                                                        return (
                                                            <>
                                                                {/* Path Line */}
                                                                <polyline
                                                                    points={currentVisualMap.map(n => `${n.x * scale},${-n.y * scale}`).join(" ")}
                                                                    fill="none"
                                                                    stroke={COMMON.dim}
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    opacity="0.4"
                                                                />

                                                                {/* Nodes */}
                                                                {currentVisualMap.map((node, i) => (
                                                                    <g key={i}>
                                                                        {/* Circle */}
                                                                        <circle
                                                                            cx={node.x * scale}
                                                                            cy={-node.y * scale}
                                                                            r="6"
                                                                            fill={isDark ? THEME.dark.bg : THEME.light.bg}
                                                                            stroke={i === 0 ? COMMON.accent : (i === currentVisualMap.length - 1 ? COMMON.target : COMMON.text)}
                                                                            strokeWidth="2"
                                                                        />

                                                                        {/* Label (Using foreignObject for emoji support) */}
                                                                        <foreignObject x={(node.x * scale) - 10} y={(-node.y * scale) - 10} width="20" height="20" style={{ pointerEvents: 'none' }}>
                                                                            <div className="flex items-center justify-center w-full h-full text-[10px] leading-none text-center">
                                                                                {/* Strip HTML tags if present (e.g. for Words mode) */}
                                                                                <span dangerouslySetInnerHTML={{ __html: node.label.replace(/<[^>]*>?/gm, '') }} />
                                                                            </div>
                                                                        </foreignObject>

                                                                        {/* Z-Index Label (For 3D) */}
                                                                        {node.z !== 0 && (
                                                                            <text x={(node.x * scale) + 6} y={(-node.y * scale) - 5} fontSize="6" fill={COMMON.dim} fontWeight="bold">
                                                                                {node.z > 0 ? `+${node.z}` : node.z}
                                                                            </text>
                                                                        )}
                                                                    </g>
                                                                ))}
                                                            </>
                                                        );
                                                    })()}
                                                </svg>
                                            </div>
                                        </div>
                                    )}


                                    <div className="w-full p-4 rounded text-left space-y-1 shrink-0" style={{ backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }}>
                                        <div className="text-[10px] mb-1" style={{ color: COMMON.dim }}>RECAP</div>
                                        {premises.map((p, i) => (
                                            <div key={i} className="text-xs border-b pb-1 last:border-0" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid }} dangerouslySetInnerHTML={{ __html: p }} />
                                        ))}
                                        <div className="text-sm font-bold mt-2" style={{ color: COMMON.accent }} dangerouslySetInnerHTML={{ __html: "Q: " + currentQuestion }} />
                                        <div className="font-mono text-xs">A: {expectedAnswerRef.current ? "YES" : "NO"}</div>
                                    </div>

                                    <button
                                        onClick={startRound}
                                        className="w-full py-3 font-bold rounded shadow hover:opacity-90 shrink-0"
                                        style={{ backgroundColor: isDark ? '#ffffff' : '#1e293b', color: isDark ? '#000000' : '#ffffff' }}
                                    >
                                        NEXT (Enter)
                                    </button>
                                </div>
                            )}

                            {/* Session End */}
                            {phase === "SESSION_END" && (
                                <div className="space-y-8">
                                    <h2 className="text-3xl font-bold" style={{ color: COMMON.target }}>SESSION COMPLETE</h2>
                                    <div className="grid grid-cols-2 gap-4 text-left p-6 rounded" style={{ backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }}>
                                        <div>Total Score</div><div className="font-mono font-bold">{currentScore}</div>
                                        <div>Avg Reaction</div><div className="font-mono font-bold">{questionsAttempted > 0 ? Math.round(totalReactionTime.current / questionsAttempted) : 0}ms</div>
                                        <div>Max Depth</div><div className="font-mono font-bold">{maxDepthReached}</div>
                                        <div>Accuracy</div><div className="font-mono font-bold">{questionsAttempted > 0 ? Math.round((sessionLog.filter(l => l.isCorrect).length / questionsAttempted) * 100) : 0}%</div>
                                    </div>
                                    <button
                                        onClick={() => setPhase("SETUP")}
                                        className="px-8 py-3 text-white font-bold rounded hover:opacity-90"
                                        style={{ backgroundColor: COMMON.dim }}
                                    >RETURN TO MENU</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* --- MODALS (Settings, History, Log) --- */}
            {/* These sit outside the Main flow but inside fixed root */}

            {/* Config Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
                    <div
                        className="w-full max-w-md max-h-[90vh] rounded-xl overflow-hidden flex flex-col shadow-2xl"
                        onClick={e => e.stopPropagation()}
                        style={{
                            backgroundColor: isDark ? THEME.dark.bg : THEME.light.bg,
                            borderColor: isDark ? THEME.dark.grid : THEME.light.grid,
                            borderWidth: '1px'
                        }}
                    >
                        {/* Fixed Header */}
                        <div className="p-4 border-b flex justify-between items-center shrink-0" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                            <h2 className="font-bold">CONFIGURATION</h2>
                            <button onClick={() => setShowSettings(false)} className="text-xl font-bold hover:opacity-50" style={{ color: COMMON.wrong }}>×</button>
                        </div>

                        {/* Scrollable Body - NOW WITH FLEX-1 AND MIN-H-0 */}
                        <div className="p-6 space-y-8 overflow-y-auto flex-1 min-h-0 custom-scrollbar">

                            {/* Modes */}

                            {/* --- Insert this SECTION inside the Config Modal --- */}

                            <section>
                                <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: COMMON.accent }}>Timer Controls</h3>

                                {/* Session Settings Box */}
                                <div className="p-3 rounded border mb-3" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>

                                    {/* Session Mode Toggle */}
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold">Session Mode</span>
                                        <div className="flex rounded-lg p-1" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
                                            <button
                                                onClick={() => setSettings({ ...settings, disableSessionTimer: true })}
                                                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${settings.disableSessionTimer ? 'shadow-sm text-black dark:text-white bg-white dark:bg-slate-600' : 'opacity-50'}`}
                                            >
                                                INFINITE
                                            </button>
                                            <button
                                                onClick={() => setSettings({ ...settings, disableSessionTimer: false })}
                                                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${!settings.disableSessionTimer ? 'shadow-sm text-black dark:text-white bg-white dark:bg-slate-600' : 'opacity-50'}`}
                                            >
                                                TIMED
                                            </button>
                                        </div>
                                    </div>

                                    {/* Minutes Input (Hidden if Infinite) */}
                                    {!settings.disableSessionTimer && (
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t animate-in slide-in-from-top-1" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                            <span className="text-sm opacity-80">Session Minutes</span>
                                            <div className="flex items-center gap-2 bg-slate-500/10 rounded px-1">
                                                <button onClick={() => setSettings(s => ({ ...s, sessionLengthMinutes: Math.max(1, s.sessionLengthMinutes - 1) }))} className="w-8 h-8 font-bold hover:bg-black/5 rounded">-</button>
                                                <span className="font-mono w-8 text-center font-bold">{settings.sessionLengthMinutes}</span>
                                                <button onClick={() => setSettings(s => ({ ...s, sessionLengthMinutes: s.sessionLengthMinutes + 1 }))} className="w-8 h-8 font-bold hover:bg-black/5 rounded">+</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Question Timer Box */}
                                <div className="p-3 rounded border" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                                    <label className="flex items-center justify-between cursor-pointer mb-1">
                                        <span className="text-sm font-bold">Enable Question Timer</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.useQuestionTimer}
                                            onChange={e => setSettings({ ...settings, useQuestionTimer: e.target.checked })}
                                            className="w-5 h-5 rounded accent-blue-500"
                                        />
                                    </label>

                                    {settings.useQuestionTimer && (
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t animate-in slide-in-from-top-1" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                            <span className="text-sm opacity-80">Seconds per Question</span>
                                            <div className="flex items-center gap-2 bg-slate-500/10 rounded px-1">
                                                <button onClick={() => setSettings(s => ({ ...s, questionTimeLimit: Math.max(3, s.questionTimeLimit - 1) }))} className="w-8 h-8 font-bold hover:bg-black/5 rounded">-</button>
                                                <span className="font-mono w-8 text-center font-bold">{settings.questionTimeLimit}</span>
                                                <button onClick={() => setSettings(s => ({ ...s, questionTimeLimit: s.questionTimeLimit + 1 }))} className="w-8 h-8 font-bold hover:bg-black/5 rounded">+</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: COMMON.accent }}>Logic Modules</h3>
                                <div className="space-y-2">
                                    {(Object.keys(settings.activeModes) as RftMode[]).map(m => (
                                        <label key={m} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:opacity-80" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                                            <input type="checkbox" checked={settings.activeModes[m]} onChange={e => setSettings({ ...settings, activeModes: { ...settings.activeModes, [m]: e.target.checked } })} className="rounded" />
                                            <span className="text-sm">{m.replace("_", " ")}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-4 p-3 rounded border" style={{ borderColor: COMMON.accent, backgroundColor: 'rgba(0, 242, 255, 0.05)' }}>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={settings.enableCipher} onChange={e => setSettings({ ...settings, enableCipher: e.target.checked })} />
                                        <div>
                                            <div className="font-bold text-sm">Cipher Mode</div>
                                            <div className="text-xs opacity-70">Uses nonsense words</div>
                                        </div>
                                    </label>
                                </div>
                            </section>

                            {/* Wall Breakers */}
                            <section>
                                <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: '#a855f7' }}>Wall Breakers</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={settings.enableDeictic} onChange={e => setSettings({ ...settings, enableDeictic: e.target.checked })} /><span className="text-sm">Deictic (Perspective)</span></label>
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={settings.enableMovement} onChange={e => setSettings({ ...settings, enableMovement: e.target.checked })} /><span className="text-sm">Path Integration</span></label>
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={settings.enableTransformation} onChange={e => setSettings({ ...settings, enableTransformation: e.target.checked })} /><span className="text-sm">Transformation (Inv)</span></label>
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={settings.enableInterference} onChange={e => setSettings({ ...settings, enableInterference: e.target.checked })} /><span className="text-sm">Interference Task</span></label>
                                </div>
                            </section>

                            {/* Difficulty */}
                            <section>
                                <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: COMMON.target }}>Complexity</h3>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm">Premises</span>
                                    <div className="flex items-center gap-2 rounded px-1" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
                                        <button onClick={() => setSettings(s => ({ ...s, numPremises: Math.max(2, s.numPremises - 1) }))} className="w-8 h-8 font-bold">-</button>
                                        <span className="font-mono">{settings.numPremises}</span>
                                        <button onClick={() => setSettings(s => ({ ...s, numPremises: s.numPremises + 1 }))} className="w-8 h-8 font-bold">+</button>
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer mb-2"><input type="checkbox" checked={settings.autoProgress} onChange={e => setSettings({ ...settings, autoProgress: e.target.checked })} /><span className="text-sm">Auto-Progress</span></label>
                                <label className="flex items-center gap-3 cursor-pointer mb-4"><input type="checkbox" checked={settings.blindMode} onChange={e => setSettings({ ...settings, blindMode: e.target.checked })} /><span className="text-sm">Blind Mode (Memory)</span></label>

                                <div className="flex flex-col gap-1">
                                    <span className="text-xs opacity-70">Symbol Type</span>
                                    <select value={settings.symbolMode} onChange={(e) => setSettings({ ...settings, symbolMode: e.target.value as SymbolMode })} className="p-2 rounded text-sm" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
                                        <option value="EMOJI">Emoji</option>
                                        <option value="WORDS">Nonsense Words</option>
                                        <option value="VORONOI">Voronoi Shapes</option>
                                        <option value="MIXED">Mixed Chaos</option>
                                    </select>
                                </div>
                            </section>

                            {/* Spacer to ensure last item isn't cut off by footer */}
                            <div className="h-4"></div>
                        </div>

                        {/* Fixed Footer with Save Button */}
                        <div className="p-4 border-t shrink-0" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid, backgroundColor: isDark ? THEME.dark.bg : THEME.light.bg }}>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full py-3 font-bold rounded shadow-lg"
                                style={{ backgroundColor: isDark ? '#ffffff' : '#1e293b', color: isDark ? '#000000' : '#ffffff' }}
                            >SAVE & CLOSE</button>
                        </div>

                    </div>
                </div>
            )}

            {/* --- History Modal --- */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowHistoryModal(false)}>
                    <div
                        className="w-full max-w-2xl max-h-[85vh] rounded-xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95"
                        onClick={e => e.stopPropagation()}
                        style={{ backgroundColor: isDark ? THEME.dark.bg : THEME.light.bg }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center shrink-0" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                            <h2 className="font-bold">STATS & HISTORY</h2>
                            <button onClick={() => { setHistory([]); localStorage.removeItem("rft_architect_history"); }} className="text-xs font-bold mr-4 px-2 py-1 rounded hover:bg-red-500/10" style={{ color: COMMON.wrong }}>CLEAR DATA</button>
                            <button onClick={() => setShowHistoryModal(false)} className="text-xl font-bold hover:opacity-50" style={{ color: COMMON.wrong }}>×</button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                            <div className="h-64 w-full rounded mb-6 relative border" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', borderColor: isDark ? THEME.dark.grid : THEME.light.grid }}>
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>

                            <h3 className="text-xs font-bold mb-3 uppercase opacity-50 tracking-wider">Recent Sessions</h3>
                            <div className="space-y-2">
                                {history.length === 0 ? <div className="text-center opacity-50 py-8">No sessions recorded.</div> :
                                    [...history].reverse().map((h, i) => (
                                        <div key={i} className="p-3 rounded border flex justify-between items-center" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', borderColor: isDark ? THEME.dark.grid : THEME.light.grid }}>
                                            <div>
                                                <div className="text-xs opacity-50">{h.date}</div>
                                                <div className="font-bold">{h.totalScore} pts <span className="text-xs font-normal opacity-70">({h.accuracy}% Acc)</span></div>
                                            </div>
                                            <div className="flex gap-1">
                                                {h.activeModifiers && h.activeModifiers.map(m => (
                                                    <span key={m} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>{m}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Review Log Modal --- */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowReviewModal(false)}>
                    <div
                        className="w-full max-w-2xl max-h-[85vh] rounded-xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95"
                        onClick={e => e.stopPropagation()}
                        style={{ backgroundColor: isDark ? THEME.dark.bg : THEME.light.bg }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center shrink-0" style={{ borderColor: isDark ? THEME.dark.grid : THEME.light.grid, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                            <h2 className="font-bold">SESSION LOG</h2>
                            <button onClick={() => setShowReviewModal(false)} className="text-xl font-bold hover:opacity-50" style={{ color: COMMON.wrong }}>×</button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar space-y-3">
                            {sessionLog.length === 0 ? <div className="text-center opacity-50 py-8">No questions answered yet.</div> :
                                sessionLog.map(log => (
                                    <div key={log.id} className="p-3 rounded border-l-4 shadow-sm" style={{
                                        backgroundColor: log.isCorrect ? (isDark ? 'rgba(34, 197, 94, 0.05)' : '#f0fdf4') : (isDark ? 'rgba(239, 68, 68, 0.05)' : '#fef2f2'),
                                        borderColor: log.isCorrect ? COMMON.target : COMMON.wrong
                                    }}>
                                        <div className="flex justify-between text-xs opacity-70 mb-2">
                                            <span className="font-mono uppercase">{log.mode.replace("_", " ")}</span>
                                            <span className="font-mono">{log.reactionTimeMs}ms</span>
                                        </div>
                                        <div className="space-y-1 mb-2 p-2 rounded text-sm opacity-90" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
                                            {log.premises.map((p, i) => <div key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
                                        </div>
                                        <div className="font-bold text-sm mb-2" dangerouslySetInnerHTML={{ __html: "Q: " + log.question }} />
                                        <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                            <span>You: <b>{log.userAnswer}</b></span>
                                            <span>Correct: <b>{log.correctAnswer}</b></span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}