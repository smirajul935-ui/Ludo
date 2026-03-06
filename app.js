import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// 1. Firebase Configuration (আপনার দেওয়া config)
const firebaseConfig = {
    apiKey: "AIzaSyD_Iemm6LKNcaNjESV4ynfXRJ2_7jgxmc0",
    authDomain: "ludo-online-7c05a.firebaseapp.com",
    databaseURL: "https://ludo-online-7c05a-default-rtdb.firebaseio.com",
    projectId: "ludo-online-7c05a",
    storageBucket: "ludo-online-7c05a.firebasestorage.app",
    messagingSenderId: "980294399932",
    appId: "1:980294399932:web:3a14f36905e1a138fe9db9",
    measurementId: "G-Q4WLBDDX4J"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Game Variables
let myPlayerId = Math.random().toString(36).substr(2, 9);
let myColor = null;
let currentRoom = null;
let roomData = null;

const COLORS =['red', 'green', 'yellow', 'blue'];

// Coordinate logic for 15x15 Ludo Board
// Coordinates are [row, col] from 0 to 14
const PATH = [[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6]];
const HOME_PATHS = {
    red: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
    green: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    yellow: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    blue: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]]
};
const BASES = {
    red: [[11,2],[11,3],[12,2],[12,3]],
    green: [[2,2],[2,3],[3,2],[3,3]],
    yellow: [[2,11],[2,12],[3,11],[3,12]],
    blue: [[11,11],[11,12],[12,11],[12,12]]
};
const OFFSETS = { red: 0, green: 13, yellow: 26, blue: 39 };

// DOM Elements
const screens = { setup: document.getElementById('setup-screen'), lobby: document.getElementById('lobby-screen'), game: document.getElementById('game-screen') };
const btnCreate = document.getElementById('create-btn');
const btnJoin = document.getElementById('join-btn');
const btnStart = document.getElementById('start-btn');
const btnRoll = document.getElementById('roll-btn');

// Events
btnCreate.addEventListener('click', createRoom);
btnJoin.addEventListener('click', joinRoom);
btnStart.addEventListener('click', startGame);
btnRoll.addEventListener('click', rollDice);

// Initialize Ludo Board UI
function initBoardUI() {
    const board = document.getElementById('ludo-board');
    board.innerHTML = '';
    for(let r=0; r<15; r++) {
        for(let c=0; c<15; c++) {
            let div = document.createElement('div');
            div.className = 'cell';
            // Base colors
            if(r<6 && c<6) div.classList.add('bg-green');
            if(r<6 && c>8) div.classList.add('bg-yellow');
            if(r>8 && c<6) div.classList.add('bg-red');
            if(r>8 && c>8) div.classList.add('bg-blue');
            // Center
            if(r>=6 && r<=8 && c>=6 && c<=8) div.style.background = '#333';
            // Safe stars map
            const safePoints =['13,6','8,2','6,1','2,6','1,8','6,12','8,13','12,8'];
            if(safePoints.includes(`${r},${c}`)) div.classList.add('bg-safe');
            
            board.appendChild(div);
        }
    }
}
initBoardUI();

// 1. Create Room
async function createRoom() {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const roomRef = ref(db, `rooms/${code}`);
    await set(roomRef, {
        status: 'waiting',
        players: { red: myPlayerId },
        turn: 'red',
        dice: 1,
        diceRolled: false,
        tokens: {
            red: [-1,-1,-1,-1], green: [-1,-1,-1,-1],
            yellow:[-1,-1,-1,-1], blue: [-1,-1,-1,-1]
        },
        winner: null,
        activePlayers: ['red']
    });
    myColor = 'red';
    currentRoom = code;
    listenToRoom();
    showScreen('lobby');
}

// 2. Join Room
async function joinRoom() {
    const code = document.getElementById('room-code-input').value;
    if(code.length !== 4) return alert("Enter 4-digit code");
    
    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    if(snapshot.exists()) {
        const data = snapshot.val();
        if(data.status !== 'waiting') return alert("Game already started!");
        
        let joinedColor = null;
        for(let color of COLORS) {
            if(!data.players[color]) {
                joinedColor = color;
                break;
            }
        }
        
        if(!joinedColor) return alert("Room is full!");
        
        const updates = {};
        updates[`rooms/${code}/players/${joinedColor}`] = myPlayerId;
        updates[`rooms/${code}/activePlayers`] =[...data.activePlayers, joinedColor];
        await update(ref(db), updates);
        
        myColor = joinedColor;
        currentRoom = code;
        listenToRoom();
        showScreen('lobby');
    } else {
        alert("Room not found!");
    }
}

// 3. Listen to Room Data live
function listenToRoom() {
    onValue(ref(db, `rooms/${currentRoom}`), (snapshot) => {
        roomData = snapshot.val();
        if(!roomData) return;

        // Update Lobby UI
        document.getElementById('display-room-code').innerText = currentRoom;
        const list = document.getElementById('player-list');
        list.innerHTML = '';
        Object.keys(roomData.players).forEach(pColor => {
            let li = document.createElement('li');
            li.innerHTML = `<span style="color:${pColor}">${pColor.toUpperCase()}</span> ${roomData.players[pColor] === myPlayerId ? '(You)' : ''}`;
            list.appendChild(li);
        });

        // Show Start Button for host
        if(myColor === 'red' && Object.keys(roomData.players).length >= 2) {
            btnStart.style.display = 'block';
        }

        // Switch to Game Screen
        if(roomData.status === 'playing' || roomData.status === 'finished') {
            showScreen('game');
            updateGameUI();
        }
    });
}

// 4. Start Game
async function startGame() {
    await update(ref(db, `rooms/${currentRoom}`), { status: 'playing' });
}

// 5. Update Game Board & Logic
function updateGameUI() {
    document.getElementById('my-color-text').innerText = myColor.toUpperCase();
    document.getElementById('my-color-text').style.color = myColor;
    document.getElementById('current-turn-text').innerText = roomData.turn.toUpperCase();
    document.getElementById('current-turn-text').style.color = roomData.turn;
    document.getElementById('dice-value').innerText = roomData.dice;

    // Dice Button logic
    if(roomData.turn === myColor && !roomData.diceRolled && roomData.status !== 'finished') {
        btnRoll.disabled = false;
    } else {
        btnRoll.disabled = true;
    }

    renderTokens();

    if(roomData.winner) {
        document.getElementById('winner-modal').style.display = 'flex';
        document.getElementById('winner-text').innerText = `${roomData.winner.toUpperCase()} WINS! 🎉`;
    }
}

// Draw tokens based on positions
function renderTokens() {
    const container = document.getElementById('tokens-container');
    container.innerHTML = '';

    COLORS.forEach(color => {
        if(!roomData.players[color]) return;
        
        roomData.tokens[color].forEach((pos, index) => {
            const coords = getCoordinates(color, pos, index);
            const tokenEl = document.createElement('div');
            tokenEl.className = `token ${color}`;
            
            // Calculate absolute position % based on 15x15 grid
            tokenEl.style.left = `${(coords[1] / 15) * 100}%`;
            tokenEl.style.top = `${(coords[0] / 15) * 100}%`;

            // Active Highlight
            if(roomData.turn === myColor && color === myColor && roomData.diceRolled) {
                if(isValidMove(pos, roomData.dice)) {
                    tokenEl.classList.add('active');
                    tokenEl.onclick = () => moveToken(index, pos);
                }
            }
            container.appendChild(tokenEl);
        });
    });
}

function getCoordinates(color, position, tokenIndex) {
    if (position === -1) return BASES[color][tokenIndex];
    if (position >= 0 && position <= 50) {
        let globalIndex = (position + OFFSETS[color]) % 52;
        return PATH[globalIndex];
    }
    if (position >= 51 && position <= 56) {
        let homeIndex = position - 51;
        return HOME_PATHS[color][homeIndex];
    }
    return [7,7]; // Reached Finish
}

// 6. Dice Logic
async function rollDice() {
    btnRoll.disabled = true;
    let diceVal = Math.floor(Math.random() * 6) + 1;
    
    // Dice Animation
    let counter = 0;
    let interval = setInterval(() => {
        document.getElementById('dice-value').innerText = Math.floor(Math.random() * 6) + 1;
        counter++;
        if(counter > 10) {
            clearInterval(interval);
            processDiceResult(diceVal);
        }
    }, 50);
}

async function processDiceResult(diceVal) {
    let hasValidMove = roomData.tokens[myColor].some(pos => isValidMove(pos, diceVal));
    
    let updates = { dice: diceVal, diceRolled: true };
    await update(ref(db, `rooms/${currentRoom}`), updates);

    // If no moves, switch turn automatically
    if(!hasValidMove) {
        setTimeout(() => switchTurn(diceVal === 6), 1000);
    }
}

function isValidMove(currentPos, dice) {
    if(currentPos === -1 && dice === 6) return true;
    if(currentPos !== -1 && currentPos + dice <= 56) return true;
    return false;
}

// 7. Token Move Logic
async function moveToken(tokenIndex, currentPos) {
    const dice = roomData.dice;
    let newPos = currentPos === -1 ? 0 : currentPos + dice;
    
    let updates = {};
    updates[`rooms/${currentRoom}/tokens/${myColor}/${tokenIndex}`] = newPos;

    // Check Capture Logic
    let isCapture = false;
    if(newPos >= 0 && newPos <= 50) {
        let globalIndex = (newPos + OFFSETS[myColor]) % 52;
        const safeIndices =[0, 8, 13, 21, 26, 34, 39, 47]; // Safe zones on global track
        
        if(!safeIndices.includes(globalIndex)) {
            // Check enemies
            COLORS.forEach(enemyColor => {
                if(enemyColor !== myColor && roomData.players[enemyColor]) {
                    roomData.tokens[enemyColor].forEach((ePos, eIdx) => {
                        if(ePos >= 0 && ePos <= 50) {
                            let eGlobal = (ePos + OFFSETS[enemyColor]) % 52;
                            if(eGlobal === globalIndex) {
                                isCapture = true;
                                updates[`rooms/${currentRoom}/tokens/${enemyColor}/${eIdx}`] = -1; // Send enemy home
                            }
                        }
                    });
                }
            });
        }
    }

    await update(ref(db), updates);

    // Check Winner
    roomData.tokens[myColor][tokenIndex] = newPos; // temporary local update
    if(roomData.tokens[myColor].every(p => p === 56)) {
        await update(ref(db, `rooms/${currentRoom}`), { winner: myColor, status: 'finished' });
        return;
    }

    // Switch Turn
    switchTurn(dice === 6 || isCapture);
}

async function switchTurn(extraTurn) {
    let updates = { diceRolled: false };
    if(!extraTurn) {
        const active = roomData.activePlayers;
        let currentIndex = active.indexOf(myColor);
        let nextIndex = (currentIndex + 1) % active.length;
        updates.turn = active[nextIndex];
    }
    await update(ref(db, `rooms/${currentRoom}`), updates);
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.style.display = 'none');
    screens[screenName].style.display = 'flex';
                                       }
