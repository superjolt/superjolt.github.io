// Check for MediaRecorder support
if (!navigator.mediaDevices || !window.MediaRecorder) {
  alert('MediaRecorder is not supported in this browser.');
}

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const saveBtn = document.getElementById('saveBtn');
const audio = document.getElementById('audio');
const sruthiAudio = document.getElementById('sruthiAudio');
const ratingDisplay = document.getElementById('ratingDisplay');
const ratingInputs = document.querySelectorAll('.rating input');
const recordingsGrid = document.getElementById('recordingsGrid');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const pieceSelect = document.getElementById('pieceSelect');
const sruthiSelect = document.getElementById('sruthiSelect');
const accuracyDisplay = document.getElementById('accuracyDisplay');

// Variables for recording
let stream;
let mediaRecorder;
let recordedChunks = [];
let currentBlob = null;
let selectedPiece;
let selectedSruthi;
const audioSources = new Map(); // To store sources for audio elements

// AudioContext and Analyser for visualization
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
let animationFrameId;

// Define ragas and pieces
const ragas = {
  mayamalavagowla: {
    arohanam: { 's': 1, 'r': 256 / 243, 'g': 32 / 27, 'm': 4 / 3, 'p': 3 / 2, 'd': 128 / 81, 'n': 16 / 9, 'S': 2 },
    avarohanam: { 'S': 2, 'n': 16 / 9, 'd': 128 / 81, 'p': 3 / 2, 'm': 4 / 3, 'g': 32 / 27, 'r': 256 / 243, 's': 1 }
  }
  // Add more ragas like 'kamas' later when you provide their sequences
};

const pieces = {
  sarali1: { raga: 'mayamalavagowla', sequence: ['s', 'r', 'g', 'm', 'p', 'd', 'n', 'S', 'S', 'n', 'd', 'p', 'm', 'g', 'r', 's'] },
  sarali2: { raga: 'mayamalavagowla', sequence: ['s', 'r', 's', 'r', 's', 'r', 'g', 'm', 's', 'r', 'g', 'm', 'p', 'd', 'n', 'S', 'S', 'n', 'S', 'n', 'S', 'n', 'd', 'p', 'S', 'n', 'd', 'p', 'm', 'g', 'r', 's'] }
  // Add more pieces with their ragas later
};

const noteFrequencies = {
  'G#3': 207.65,
  'A3': 220.00,
  'A#3': 233.08,
  'B3': 246.94,
  'C4': 261.63,
  'C#4': 277.18,
  'D4': 293.66,
  'D#4': 311.13,
  'E4': 329.63,
  'F4': 349.23,
  'F#4': 369.99,
  'G4': 392.00,
  'G#4': 415.30,
  'A4': 440.00,
  'A#4': 466.16,
  'B4': 493.88,
  'C5': 523.25,
  'C#5': 554.37,
  'D5': 587.33,
  'D#5': 622.25,
  'E5': 659.25,
  'F5': 698.46,
  'F#5': 739.99,
  'G5': 783.99,
  'G#5': 830.61
};

// Start recording
startBtn.addEventListener('click', async () => {
  if (!pieceSelect.value) {
    alert('Please select a piece');
    return;
  }
  if (!sruthiSelect.value) {
    alert('Please select sruthi');
    return;
  }
  selectedPiece = pieceSelect.value;
  selectedSruthi = sruthiSelect.value;

  // Play sruthi sound
  const sruthiFrequency = noteFrequencies[selectedSruthi];
  const baseFrequency = noteFrequencies['G#4']; // Assuming sruthi.mp3 is G#4
  const playbackRate = sruthiFrequency / baseFrequency;
  sruthiAudio.playbackRate = playbackRate;
  sruthiAudio.play();

  // Start recording after a short delay
  setTimeout(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.addEventListener('error', (e) => console.error('Main audio playback error:', e));
        currentBlob = blob;
        recordedChunks = [];
        saveBtn.disabled = false;

        const sruthiFrequency = noteFrequencies[selectedSruthi];
        const raga = pieces[selectedPiece].raga;
        const detectedSequence = await detectNoteSequence(blob, sruthiFrequency, raga);
        const expectedSequence = pieces[selectedPiece].sequence;
        let correctCount = 0;
        const minLength = Math.min(detectedSequence.length, expectedSequence.length);
        for (let i = 0; i < minLength; i++) {
          if (detectedSequence[i] === expectedSequence[i]) {
            correctCount++;
          }
        }
        const accuracy = (correctCount / expectedSequence.length * 100).toFixed(2);
        accuracyDisplay.textContent = `Alignment Accuracy: ${accuracy}%`;
      };
      mediaRecorder.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please allow microphone access.');
    }
  }, 2000); // 2-second delay for sruthi sound
});

// Stop recording
stopBtn.addEventListener('click', () => {
  mediaRecorder.stop();
  stream.getTracks().forEach(track => track.stop());
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

// Update rating display
ratingInputs.forEach(input => {
  input.addEventListener('change', () => {
    ratingDisplay.textContent = `You rated ${input.value} stars`;
  });
});

// Save recording
saveBtn.addEventListener('click', () => {
  const selectedRating = document.querySelector('input[name="star-radio"]:checked');
  if (!selectedRating) {
    alert('Please select a rating before saving.');
    return;
  }
  const rating = selectedRating.value;
  if (!currentBlob) {
    alert('No recording to save.');
    return;
  }
  const reader = new FileReader();
  reader.readAsDataURL(currentBlob);
  reader.onloadend = function() {
    const base64data = reader.result;
    const timestamp = new Date().toISOString();
    const accuracy = accuracyDisplay.textContent.split(': ')[1] || 'Not calculated';
    let recordings = JSON.parse(localStorage.getItem('recordings')) || [];
    recordings.push({ timestamp, audio: base64data, rating, piece: selectedPiece, sruthi: selectedSruthi, accuracy });
    localStorage.setItem('recordings', JSON.stringify(recordings));
    alert('Recording saved!');
    renderRecordings();
  };
});

// Render saved recordings
function renderRecordings() {
  const recordings = JSON.parse(localStorage.getItem('recordings')) || [];
  recordingsGrid.innerHTML = '';
  recordings.forEach(rec => {
    const div = document.createElement('div');
    div.classList.add('recording-item');
    const titleEl = document.createElement('h3');
    titleEl.textContent = rec.timestamp;
    const audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.src = rec.audio;
    audioEl.addEventListener('error', (e) => console.error('Saved audio playback error:', e));
    const infoEl = document.createElement('p');
    const rating = parseInt(rec.rating);
    infoEl.textContent = `Piece: ${rec.piece}, Sruthi: ${rec.sruthi}, Rating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}, Accuracy: ${rec.accuracy}`;
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = rec.audio;
      a.download = `recording_${rec.timestamp}.webm`;
      a.click();
    });
    div.appendChild(titleEl);
    div.appendChild(audioEl);
    div.appendChild(infoEl);
    div.appendChild(downloadBtn);
    recordingsGrid.appendChild(div);

    // Visualization for saved recordings
    audioEl.addEventListener('play', () => {
      let source = audioSources.get(audioEl);
      if (!source) {
        source = audioCtx.createMediaElementSource(audioEl);
        audioSources.set(audioEl, source);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
      visualize();
    });
    audioEl.addEventListener('pause', () => cancelAnimationFrame(animationFrameId));
    audioEl.addEventListener('ended', () => cancelAnimationFrame(animationFrameId));
  });
}

// Visualize frequency data
function visualize() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  const barWidth = (canvas.width / bufferLength) * 2.5;
  let barHeight;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    barHeight = dataArray[i];
    canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
    canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
    x += barWidth + 1;
  }
  animationFrameId = requestAnimationFrame(visualize);
}

// Visualization for main audio
audio.addEventListener('play', () => {
  let source = audioSources.get(audio);
  if (!source) {
    source = audioCtx.createMediaElementSource(audio);
    audioSources.set(audio, source);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  visualize();
});
audio.addEventListener('pause', () => cancelAnimationFrame(animationFrameId));
audio.addEventListener('ended', () => cancelAnimationFrame(animationFrameId));

// Pitch detection functions
async function detectNoteSequence(blob, sruthiFrequency, raga) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  const chunkSize = 2048;
  const detectedPitches = [];
  for (let i = 0; i < channelData.length; i += chunkSize) {
    const chunk = channelData.slice(i, i + chunkSize);
    if (chunk.length < chunkSize) break;
    const [frequency, clarity] = pitchy.findPitch(chunk, sampleRate);
    if (clarity > 0.9) {
      detectedPitches.push(frequency);
    }
  }
  const noteSequence = [];
  let currentNote = null;
  detectedPitches.forEach(freq => {
    const note = getNote(freq, sruthiFrequency, raga);
    if (note && note !== currentNote) {
      noteSequence.push(note);
      currentNote = note;
    }
  });
  return noteSequence;
}

function getNote(frequency, sruthiFrequency, raga) {
  const noteRatios = { ...ragas[raga].arohanam, ...ragas[raga].avarohanam };
  let minDistance = Infinity;
  let closestNote = null;
  for (const [note, ratio] of Object.entries(noteRatios)) {
    const noteFrequency = sruthiFrequency * ratio;
    const distance = Math.abs(frequency - noteFrequency);
    if (distance < minDistance) {
      minDistance = distance;
      closestNote = note;
    }
  }
  return closestNote;
}

// Initial render of saved recordings
renderRecordings();