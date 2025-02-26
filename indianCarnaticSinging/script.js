// Check for MediaRecorder support
if (!navigator.mediaDevices || !window.MediaRecorder) {
  alert('MediaRecorder is not supported in this browser.');
}

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const saveBtn = document.getElementById('saveBtn');
const audio = document.getElementById('audio');
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

// AudioContext and Analyser for visualization
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
let animationFrameId;

// Define pieces and note mappings
const pieces = {
  sarali1: ['s', 'r', 'g', 'm', 'p', 'd', 'n', 'S', 'S', 'n', 'd', 'p', 'm', 'g', 'r', 's'],
  sarali2: ['s', 'r', 's', 'r', 's', 'r', 'g', 'm', 's', 'r', 'g', 'm', 'p', 'd', 'n', 'S', 'S', 'n', 'S', 'n', 'S', 'n', 'd', 'p', 'S', 'n', 'd', 'p', 'm', 'g', 'r', 's'],
  // Add more Sarali Varishais (3-9) or geetams here based on your notation
};

const noteFrequencies = {
  'C4': 261.63,
  'C#4': 277.18,
  'D4': 293.66,
  // Add more notes (e.g., 'E4': 329.63, etc.) as needed
};

const noteRatios = {
  's': 1,
  'r': 256 / 243,  // Ri1 in Mayamalavagowla raga
  'g': 32 / 27,    // Ga3
  'm': 4 / 3,      // Ma1
  'p': 3 / 2,      // Pa
  'd': 128 / 81,   // Da1
  'n': 16 / 9,     // Ni3
  'S': 2,          // Upper Sa
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

      // Compute note sequence and accuracy
      const sruthiFrequency = noteFrequencies[selectedSruthi];
      const detectedSequence = await detectNoteSequence(blob, sruthiFrequency);
      const expectedSequence = pieces[selectedPiece];
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
      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      visualize();
    });
    audioEl.addEventListener('pause', () => cancelAnimationFrame(animationFrameId));
    audioEl.addEventListener('ended', () => cancelAnimationFrame(animationFrameId));
  });
}

// Visualize frequency data
function visualize() {
  console.log('visualizing'); // Check if this appears in the console when playing audio
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
  const source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  visualize();
});
audio.addEventListener('pause', () => cancelAnimationFrame(animationFrameId));
audio.addEventListener('ended', () => cancelAnimationFrame(animationFrameId));

// Pitch detection functions
async function detectNoteSequence(blob, sruthiFrequency) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Mono audio

  const chunkSize = 2048;
  const detectedPitches = [];
  for (let i = 0; i < channelData.length; i += chunkSize) {
    const chunk = channelData.slice(i, i + chunkSize);
    if (chunk.length < chunkSize) break;
    const frequency = getPitch(chunk, sampleRate);
    if (frequency) detectedPitches.push(frequency);
  }
  // Group consecutive similar pitches into notes
  const noteSequence = [];
  let currentNote = null;
  detectedPitches.forEach(freq => {
    const note = getNote(freq, sruthiFrequency);
    if (note && note !== currentNote) {
      noteSequence.push(note);
      currentNote = note;
    }
  });
  return noteSequence;
}

function getPitch(samples, sampleRate) {
  // Basic autocorrelation for pitch detection
  let maxCorr = 0;
  let bestLag = 0;
  for (let lag = 20; lag < 1000; lag++) { // Limit range for human voice frequencies
    let corr = 0;
    for (let i = 0; i < samples.length - lag; i++) {
      corr += samples[i] * samples[i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }
  if (maxCorr > 0.1) { // Threshold to filter out noise
    return sampleRate / bestLag;
  }
  return null;
}

function getNote(frequency, sruthiFrequency) {
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