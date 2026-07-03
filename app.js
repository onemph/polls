// app.js - Firebase 制御 + 共通ロジック
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, child }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================================
// Firebase 設定 (YOUR_* の部分をご自身の値に置き換えてください)
// ============================================================
const firebaseConfig = {
  apiKey:      "YOUR_API_KEY",
  authDomain:  "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:   "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:       "YOUR_APP_ID",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ============================================================
// 参加者 ID (LocalStorage で管理する一時的な匿名 ID)
// ============================================================
function getParticipantId() {
  let id = localStorage.getItem("polls_participant_id");
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2, 11);
    localStorage.setItem("polls_participant_id", id);
  }
  return id;
}

// ============================================================
// アンケートデータの読み込み
// ============================================================
async function loadQuestions() {
  const res = await fetch("questions.json");
  return res.json();
}

// ============================================================
// 司会者用: 現在の設問インデックスを更新する
// ============================================================
async function setCurrentIndex(index) {
  await set(ref(db, "session/currentIndex"), index);
}

// ============================================================
// 司会者用: 現在の設問インデックスを取得する
// ============================================================
async function getCurrentIndex() {
  const snap = await get(ref(db, "session/currentIndex"));
  return snap.exists() ? snap.val() : 0;
}

// ============================================================
// 参加者用: 投票を送信する
//   questionId: 設問の id (questions.json の id フィールド)
//   choices   : 選択した選択肢インデックスの配列 (例: [0, 2])
// ============================================================
async function submitVote(questionId, choices) {
  const participantId = getParticipantId();

  // 以前の投票をまず削除してから新しい投票を書き込む (再投票対応)
  const prev = await get(ref(db, `votes/${questionId}/${participantId}`));
  if (prev.exists()) {
    const prevChoices = prev.val(); // { "0": true, "2": true } 形式
    const removes = {};
    Object.keys(prevChoices).forEach(c => {
      removes[`voteCounts/${questionId}/${c}/${participantId}`] = null;
    });
    await update(ref(db), removes);
  }

  // 新しい選択肢を書き込む
  const updates = {};
  const choiceMap = {};
  choices.forEach(c => {
    choiceMap[c] = true;
    updates[`voteCounts/${questionId}/${c}/${participantId}`] = true;
  });
  updates[`votes/${questionId}/${participantId}`] = choiceMap;
  await update(ref(db), updates);
}

// ============================================================
// 司会者用: 設問の投票結果をリアルタイムで監視する
//   questionId: 設問の id
//   optionCount: 選択肢の総数
//   callback(results): results は各選択肢の得票数の配列
// ============================================================
function watchResults(questionId, optionCount, callback) {
  return onValue(ref(db, `voteCounts/${questionId}`), snap => {
    const data = snap.val() || {};
    const counts = Array.from({ length: optionCount }, (_, i) => {
      return data[i] ? Object.keys(data[i]).length : 0;
    });
    callback(counts);
  });
}

// ============================================================
// 参加者用: 現在の設問インデックスをリアルタイムで監視する
//   callback(index): 設問インデックスが変わるたびに呼ばれる
// ============================================================
function watchCurrentIndex(callback) {
  return onValue(ref(db, "session/currentIndex"), snap => {
    callback(snap.exists() ? snap.val() : 0);
  });
}

// ============================================================
// 参加者用: 自分の投票済み選択肢を取得する
// ============================================================
async function getMyVotes(questionId) {
  const participantId = getParticipantId();
  const snap = await get(ref(db, `votes/${questionId}/${participantId}`));
  if (!snap.exists()) return [];
  return Object.keys(snap.val()).map(Number);
}

// ============================================================
// エクスポート
// ============================================================
export {
  loadQuestions,
  setCurrentIndex,
  getCurrentIndex,
  submitVote,
  watchResults,
  watchCurrentIndex,
  getMyVotes,
};
