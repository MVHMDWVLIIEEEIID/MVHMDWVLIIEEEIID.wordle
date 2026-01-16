import data from './data.js';

const wordBoxElem = document.querySelector('.js-word-box');
const settingBtnElem = document.querySelector('.js-setting-btn');
const keyboardElem = document.querySelector('.js-keyboard-box');

// --- 1. STATE MANAGEMENT ---
let allStates = JSON.parse(localStorage.getItem('wordle_state_multi')) || {
  0: null, 1: null, 2: null
};

let streaks = JSON.parse(localStorage.getItem('wordle_streaks')) || {
  0: 0, 1: 0, 2: 0
};

let diff = parseInt(localStorage.getItem('wordle_current_diff')) || 0;

let GOAL_WORD, result, won, currentRow, letterStatus;

const keys = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace']
];

// --- 2. POPUP CONFIGURATIONS ---
const myPopup2 = new Popup({
  title: "Game Over",
  content: `
    <div class="streak-display"></div>
    <div class="buttons-container">
        <div class="share-btn btn">Share Result</div>
        <div class="restart-btn btn">New Game</div>
    </div>
    `,
});

function showEndGamePopup() {
  const titleText = won ? 'You Won!' : `You Lost! (Word: ${GOAL_WORD.toUpperCase()})`;
  const popupTitleElem = document.querySelector('.popup-title');
  if (popupTitleElem) popupTitleElem.textContent = titleText;

  const streakElem = document.querySelector('.streak-display');
  if (streakElem) {
    streakElem.textContent = `Current Streak: ${streaks[diff]}`;
  }

  myPopup2.show();

  document.querySelector('.share-btn').onclick = () => shareGame();
  document.querySelector('.restart-btn').onclick = () => {
    myPopup2.hide();
    NewGameData();
  };
}

// --- 3. CORE LOGIC ---
function loadGameMode(modeIndex) {
  diff = modeIndex;
  // Save the current difficulty index so it persists on refresh
  localStorage.setItem('wordle_current_diff', diff);

  const saved = allStates[diff];

  if (!saved) {
    GOAL_WORD = getRandomWord();
    result = Array.from({ length: 6 }, () => ({ won: false, letters: [] }));
    won = false;
    currentRow = 0;
    letterStatus = {}; // Ensure the keyboard tracking is reset here too
  } else {
    GOAL_WORD = saved.goalWord;
    result = saved.result;
    won = saved.won;
    currentRow = saved.currentRow;
    letterStatus = saved.letterStatus || {};
  }

  document.querySelector('.diff').innerHTML = `${data[diff].diff} Mode`;
  generateWordBox();
  updateKeyboardStatus();
  saveToLocalStorage();

  if (won || currentRow >= 6) {
    setTimeout(showEndGamePopup, 500);
  }
}

function getRandomWord() {
  if (data && data[diff] && data[diff].words) {
    const randomIndex = Math.floor(Math.random() * data[diff].words.length);
    return data[diff].words[randomIndex].toLowerCase();
  }
}

function generateWordBox() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  let temp = '';

  for (let i = 0; i < 6; i++) {
    let tilesHTML = '';
    for (let j = 0; j < 5; j++) {
      const letterData = result[i]?.letters?.[j];
      const isActiveRow = i === currentRow;
      const isFilled = letterData?.color !== undefined;
      const shouldBeDisabled = isFilled || !isActiveRow || won;
      const mobileAttr = isMobile ? 'readonly inputmode="none"' : '';

      tilesHTML += `
                <input type="text" 
                    maxlength="1" 
                    class="tile ${letterData?.color || ''} ${shouldBeDisabled ? 'disabled' : ''}" 
                    value="${letterData?.letter || ''}" 
                    ${shouldBeDisabled ? 'disabled' : ''}
                    ${mobileAttr}
                >`;
    }
    temp += `<div class="wordle-row">${tilesHTML}</div>`;
  }
  wordBoxElem.innerHTML = temp;
  if (!isMobile) addTilesEvent();
}

function handleKeyPress(key) {
  if (won || currentRow >= 6) return;

  const tiles = document.querySelectorAll('.tile');
  const rowStarting = currentRow * 5;
  const rowEnding = rowStarting + 4;

  let currentTileIndex = -1;
  for (let i = rowStarting; i <= rowEnding; i++) {
    if (!tiles[i].value) {
      currentTileIndex = i;
      break;
    }
  }

  if (key.toLowerCase() === 'enter') {
    const isRowFilled = Array.from({ length: 5 }, (_, k) => tiles[rowStarting + k].value).every(v => v !== "");
    if (isRowFilled) checkWord(tiles);
  } else if (key.toLowerCase() === 'backspace') {
    for (let i = rowEnding; i >= rowStarting; i--) {
      if (tiles[i].value) {
        tiles[i].value = '';
        break;
      }
    }
  } else if (/^[a-zA-Z]$/.test(key)) {
    if (currentTileIndex !== -1) {
      tiles[currentTileIndex].value = key.toUpperCase();
    }
  }
}

function checkWord(currentTiles) {
  const startIndex = currentRow * 5;
  const guessArray = [];
  for (let i = 0; i < 5; i++) {
    guessArray.push(currentTiles[startIndex + i].value.toLowerCase());
  }
  const currentGuess = guessArray.join('');
  const allWords = data.flatMap(item => item.words);
  const isWordValid = allWords.some(word => word.toLowerCase() === currentGuess);

  if (!isWordValid) {
    const activeRow = wordBoxElem.querySelectorAll('.wordle-row')[currentRow];
    if (activeRow) {
      activeRow.classList.add('shake');
      setTimeout(() => activeRow.classList.remove('shake'), 500);
    }
    return;
  }

  const goalLetters = GOAL_WORD.toLowerCase().split('');
  const letterCounts = {};
  for (const char of goalLetters) letterCounts[char] = (letterCounts[char] || 0) + 1;

  const rowResults = new Array(5).fill(null);
  for (let i = 0; i < 5; i++) {
    if (guessArray[i] === goalLetters[i]) {
      rowResults[i] = { letter: guessArray[i], color: 'green' };
      letterCounts[guessArray[i]]--;
    }
  }

  let correctCount = 0;
  for (let i = 0; i < 5; i++) {
    if (!rowResults[i]) {
      if (letterCounts[guessArray[i]] > 0) {
        rowResults[i] = { letter: guessArray[i], color: 'yellow' };
        letterCounts[guessArray[i]]--;
      } else {
        rowResults[i] = { letter: guessArray[i], color: 'grey' };
      }
    }
    result[currentRow].letters[i] = rowResults[i];
    if (rowResults[i].color === 'green') correctCount++;
  }

  if (correctCount === 5) {
    won = true;
    result[currentRow].won = true;
    streaks[diff]++;
    saveStreaks();
    saveToLocalStorage();
    generateWordBox();
    showEndGamePopup();
  } else {
    currentRow++;
    if (currentRow === 6) {
      streaks[diff] = 0;
      saveStreaks();
      saveToLocalStorage();
      generateWordBox();
      showEndGamePopup();
    } else {
      saveToLocalStorage();
      generateWordBox();
      wordBoxElem.querySelectorAll('.tile')[currentRow * 5].focus();
    }
  }
  updateKeyboardStatus();
}

function addTilesEvent() {
  const tiles = document.querySelectorAll('.tile');
  const rowStarting = currentRow * 5;
  const rowEnding = rowStarting + 4;

  tiles.forEach((tile, index) => {
    if (tile.disabled) return;
    tile.onfocus = () => tile.select();
    tile.oninput = (e) => {
      e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      if (e.target.value.length === 1 && index < rowEnding) tiles[index + 1].focus();
    };
    tile.onkeydown = (e) => {
      const isLetter = /^[a-zA-Z]$/.test(e.key);
      const isControl = ['Backspace', 'Enter', 'Tab'].includes(e.key);
      if (!isLetter && !isControl) {
        e.preventDefault();
        tile.classList.add('shake');
        setTimeout(() => tile.classList.remove('shake'), 300);
        return;
      }
      if (e.key === 'Backspace' && !e.target.value && index > rowStarting) tiles[index - 1].focus();
      if (e.key === 'Enter' && index === rowEnding) handleKeyPress('enter');
    };
  });
}

// --- 4. UTILS & PERSISTENCE ---

function shareGame() {
  let shareText = `MVHMDWVLIIEEEIID™.Wordle - ${data[diff].diff} Mode\nStreak: ${streaks[diff]}\n`;
  result.slice(0, won ? currentRow + 1 : 6).forEach(row => {
    if (!row.letters.length) return;
    shareText += row.letters.map(i => i.color === 'green' ? '🟩' : i.color === 'yellow' ? '🟨' : '⬛').join('') + '\n';
  });
  navigator.clipboard.writeText(shareText).then(() => {
    const btn = document.querySelector('.share-btn');
    btn.textContent = "Copied! ✅";
    setTimeout(() => btn.textContent = "Share Result", 2000);
  });
}

function saveToLocalStorage() {
  allStates[diff] = { result, won, currentRow, goalWord: GOAL_WORD, letterStatus };
  localStorage.setItem('wordle_state_multi', JSON.stringify(allStates));
}

function saveStreaks() {
  localStorage.setItem('wordle_streaks', JSON.stringify(streaks));
}

function clearGameData() {
  if (confirm(`Reset ${data[diff].diff} mode? This also resets your streak.`)) {
    // Reset state for the current difficulty
    allStates[diff] = null;
    streaks[diff] = 0;

    // Reset global letter status tracking for the keyboard
    letterStatus = {};

    saveStreaks();
    localStorage.setItem('wordle_state_multi', JSON.stringify(allStates));

    // Re-initialize the game logic without reloading the page
    loadGameMode(diff);
  }
}

function NewGameData() {
  // Clear the state for the current difficulty
  allStates[diff] = null;

  // Reset global letter status tracking for the keyboard
  letterStatus = {};

  localStorage.setItem('wordle_state_multi', JSON.stringify(allStates));

  // Re-initialize the game logic without reloading the page
  loadGameMode(diff);
}

function updateKeyboardStatus() {
  result.forEach(row => {
    row.letters.forEach(item => {
      const char = item.letter, col = item.color;
      if (col === 'green') letterStatus[char] = 'green';
      else if (col === 'yellow' && letterStatus[char] !== 'green') letterStatus[char] = 'yellow';
      else if (col === 'grey' && !letterStatus[char]) letterStatus[char] = 'grey';
    });
  });
  generateKeyboard();
}

function generateKeyboard() {
  keyboardElem.innerHTML = '';
  keys.forEach(row => {
    const rowElem = document.createElement('div');
    rowElem.className = 'keyboard-row';
    row.forEach(key => {
      const button = document.createElement('button');
      button.className = `key ${letterStatus[key] || ''}`;

      if (key === 'Enter' || key === 'Backspace') {
        button.classList.add('wide-key');
        button.innerHTML = key === 'Enter' ? 'ENT' : 'BACK';
      } else {
        button.innerHTML = key.toUpperCase();
      }

      button.onclick = () => handleKeyPress(key.toLowerCase());
      rowElem.appendChild(button);
    });
    keyboardElem.appendChild(rowElem);
  });
}

// Settings Popup
const myPopup = new Popup({
  title: "Settings",
  content: `<div class="buttons-container">
        <div class="easy-btn btn">Easy</div>
        <div class="medium-btn btn">Medium</div>
        <div class="hard-btn btn">Hard</div>
        <div class="reset-btn btn">Reset Mode</div>
    </div>`,
});

settingBtnElem.onclick = () => {
  myPopup.show();
  const allTitles = document.querySelectorAll('.popup-title');
  allTitles.forEach(title => {
    if (title.textContent.includes('Settings')) {
      title.innerHTML = `Settings<br>(Streak in Current Mode: ${streaks[diff]})`;
    }
  });
  document.querySelector('.easy-btn').onclick = () => { loadGameMode(0); myPopup.hide(); };
  document.querySelector('.medium-btn').onclick = () => { loadGameMode(1); myPopup.hide(); };
  document.querySelector('.hard-btn').onclick = () => { loadGameMode(2); myPopup.hide(); };
  document.querySelector('.reset-btn').onclick = () => { clearGameData(); myPopup.hide(); };
};

loadGameMode(diff);

// Cleaning Data

// function getCleanedDataForWordle() {
//   const seenWords = new Set();

//   return data.map(level => {
//     const processedWords = level.words.filter(word => {
//       const cleanWord = word.toLowerCase().trim();

//       // Rule 1: Must be exactly 5 letters (or less, per your request)
//       if (cleanWord.length != 5) return false;

//       // Rule 2: Must not have been seen in an easier difficulty
//       if (seenWords.has(cleanWord)) {
//         return false;
//       } else {
//         seenWords.add(cleanWord);
//         return true;
//       }
//     });

//     return {
//       diff: level.diff,
//       words: processedWords
//     };
//   });
// }

// // Export the data to console for copying
// const cleaned = getCleanedDataForWordle();
// console.log(cleaned.flatMap(item => item.words).length)
// console.log(cleaned);