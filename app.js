/**
 * Phoenix-4 echo-mode emotions
 * https://docs.tavus.io/sections/conversational-video-interface/quickstart/emotional-expression
 */
const EMOTIONS = [
  'neutral',
  'angry',
  'excited',
  'elated',
  'content',
  'sad',
  'dejected',
  'scared',
  'contempt',
  'disgusted',
  'surprised',
];

const DEFAULT_PHRASES = {
  neutral:
    'Let me walk you through what happened step by step, without leaning one way or the other. ' +
    'The timeline matters here, and I want you to have the full picture before you decide what to do next. ' +
    'If anything is unclear, stop me and I will slow down and explain that part again.',
  angry:
    'I have heard your explanation, and frankly it does not hold up against what we already know. ' +
    'You had every chance to fix this before it became a problem for everyone else in the room. ' +
    'That is completely unacceptable, and we are not moving forward until there is a real plan to make it right.',
  excited:
    "I'm so glad you asked about that, because this is exactly the kind of question that opens up the whole conversation. " +
    'There is a lot of momentum behind this right now, and I think you are going to love where it leads. ' +
    'Stay with me for a minute and I will show you why this could be a genuine turning point for you.',
  elated:
    'This is absolutely wonderful news, and I mean that in the fullest sense of the word. ' +
    'You have earned every bit of this moment, and it is a joy to be the one telling you how well it turned out. ' +
    'Take it in, celebrate it, and know that people who care about you are cheering right along with you.',
  content:
    'That sounds like a solid plan, and I appreciate how thoughtfully you have laid it out. ' +
    'Nothing about this feels rushed or reckless; it reads like something you can actually stand behind. ' +
    'I am comfortable moving ahead on that basis, and I think the rest of the team will be too.',
  sad:
    "I'm sorry to hear that happened, and I can hear how much it has taken out of you. " +
    'Nobody should have to carry that alone, especially when it was not something you could have prevented. ' +
    'If you want to talk it through, I am here, and we can figure out the next gentle step together.',
  dejected:
    'I wish things had turned out differently, and I know you put real effort into making this work. ' +
    'It is hard when the outcome does not match the hope you started with, no matter how hard you tried. ' +
    'That weight is real, and it is okay to need a moment before you pick yourself up again.',
  scared:
    "I'm not sure we should go down that path, and I want to be honest about why that makes me uneasy. " +
    'There are too many unknowns still, and one wrong move could make this much harder to recover from. ' +
    'Can we slow down, look at the risks together, and choose something that does not keep me up at night?',
  contempt:
    'I find that hard to take seriously, given how little thought seems to have gone into it. ' +
    'You are asking people to commit time and trust to something that does not survive basic scrutiny. ' +
    'If you want respect in this room, come back with work that shows you actually understand the stakes.',
  disgusted:
    'That idea makes me uncomfortable, and not in a mild or abstract way. ' +
    'It crosses a line I am not willing to pretend is negotiable just to keep the conversation polite. ' +
    'We need to step back, name what is wrong with it plainly, and choose a direction that does not compromise on that.',
  surprised:
    'I did not see that coming, and I mean that literally—I had a completely different read on where this was headed. ' +
    'You will need to give me a second to recalibrate, because everything I prepared for just shifted under my feet. ' +
    'All right, walk me through it again from the top, because I want to understand how we got here.',
};

let call = null;
let joinState = 'idle';
const eventLog = [];

function createCallObject() {
  return window.Daily.createCallObject({
    subscribeToTracksAutomatically: true,
    videoSource: false,
    audioSource: false,
  });
}

function isInMeeting() {
  return call && call.meetingState() === 'joined-meeting';
}

function markConnected() {
  if (!call || joinState === 'joined') return;

  const hasRemote = Object.keys(getRemoteParticipants()).length > 0;
  if (!isInMeeting() && !hasRemote) return;

  call.setLocalVideo(false);
  call.setLocalAudio(false);
  updateRemoteParticipants();
  setJoinState('joined');
  logEvent('Joined meeting');
}

function bindCallEvents() {
  call.on('joined-meeting', markConnected);

  call.on('left-meeting', () => {
    clearReplicaMedia();
    setJoinState('idle');
    logEvent('Left meeting');
  });

  call.on('error', (ev) => {
    const msg = ev?.errorMsg || 'Daily error';
    setJoinState('error');
    showError(msg);
    logEvent(`Error: ${msg}`);
  });

  const onParticipantChange = () => {
    updateRemoteParticipants();
    if (joinState === 'joining') markConnected();
  };

  call.on('participant-joined', onParticipantChange);
  call.on('participant-updated', onParticipantChange);
  call.on('participant-left', onParticipantChange);
  call.on('track-started', onParticipantChange);

  call.on('app-message', (ev) => {
    const data = ev?.data;
    if (data && typeof data === 'object' && data.event_type) {
      logEvent(`← ${data.event_type}`);
    }
  });
}

function getRemoteParticipants() {
  if (!call) return {};
  const remote = {};
  for (const [id, participant] of Object.entries(call.participants())) {
    if (!participant.local) remote[id] = participant;
  }
  return remote;
}

function attachParticipantTracks(id, participant) {
  const videoEl = document.getElementById(`remote-video-${id}`);
  const videoTrack = participant.tracks?.video;
  if (
    videoEl &&
    videoTrack?.state === 'playable' &&
    videoTrack.persistentTrack
  ) {
    videoEl.srcObject = new MediaStream([videoTrack.persistentTrack]);
  }

  const audioEl = document.getElementById(`remote-audio-${id}`);
  const audioTrack = participant.tracks?.audio;
  if (
    audioEl &&
    audioTrack?.state === 'playable' &&
    audioTrack.persistentTrack
  ) {
    audioEl.srcObject = new MediaStream([audioTrack.persistentTrack]);
  }
}

function clearReplicaMedia() {
  const host = $('replicas-host');
  host.innerHTML = '';
  host.classList.add('hidden');
}

function syncReplicaMedia() {
  const host = $('replicas-host');
  const remote = getRemoteParticipants();
  const remoteIds = new Set(Object.keys(remote));

  host.querySelectorAll('.replica-stream').forEach((el) => {
    if (!remoteIds.has(el.dataset.participantId)) el.remove();
  });

  for (const [id, participant] of Object.entries(remote)) {
    let streamEl = host.querySelector(`[data-participant-id="${id}"]`);
    if (!streamEl) {
      streamEl = document.createElement('div');
      streamEl.className = 'replica-stream';
      streamEl.dataset.participantId = id;

      const video = document.createElement('video');
      video.id = `remote-video-${id}`;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      const audio = document.createElement('audio');
      audio.id = `remote-audio-${id}`;
      audio.autoplay = true;

      streamEl.appendChild(video);
      streamEl.appendChild(audio);
      host.appendChild(streamEl);
    }
    attachParticipantTracks(id, participant);
  }

  const hasReplica = remoteIds.size > 0;
  host.classList.toggle('hidden', !hasReplica);
  if (hasReplica && (joinState === 'joined' || joinState === 'joining')) {
    $('video-placeholder').classList.add('hidden');
  }
}

function updateRemoteParticipants() {
  syncReplicaMedia();
}

const $ = (id) => document.getElementById(id);

function conversationUrlFromId(conversationId) {
  return `https://tavus.daily.co/${conversationId.trim()}`;
}

function buildEchoText(emotion, phrase) {
  const trimmed = (phrase || '').trim();
  const body = trimmed || DEFAULT_PHRASES[emotion];
  return `<emotion value="${emotion}"/> ${body}`;
}

function setJoinState(state) {
  joinState = state;
  $('join-status').textContent = state;

  const joined = state === 'joined';
  const joining = state === 'joining';

  $('conversation-id').disabled = joined || joining;

  $('btn-join').classList.toggle('hidden', joined);
  $('btn-leave').classList.toggle('hidden', !joined);
  $('btn-interrupt').classList.toggle('hidden', !joined);
  $('btn-join').textContent = joining ? 'Joining…' : 'Join conversation';
  $('btn-join').disabled = joining;

  document.querySelectorAll('.emotion-btn').forEach((btn) => {
    btn.disabled = !joined;
  });

  if (!joined) {
    $('video-placeholder').classList.remove('hidden');
  }
  updateResolvedUrl();
}

function showError(msg) {
  const el = $('join-error');
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.classList.remove('hidden');
}

function logEvent(line) {
  eventLog.unshift(line);
  if (eventLog.length > 30) eventLog.length = 30;

  const ul = $('event-log');
  ul.innerHTML = '';
  if (eventLog.length === 0) {
    ul.innerHTML = '<li class="muted">No events yet</li>';
    return;
  }
  for (const entry of eventLog) {
    const li = document.createElement('li');
    li.textContent = entry;
    ul.appendChild(li);
  }
}

function getResolvedUrl() {
  const id = $('conversation-id').value.trim();
  return id ? conversationUrlFromId(id) : '';
}

function updateResolvedUrl() {
  const el = $('resolved-url');
  const url = getResolvedUrl();
  const show = url && joinState === 'idle';
  if (show) {
    el.textContent = `Will join: ${url}`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

async function destroyCall() {
  if (!call) return;
  const toDestroy = call;
  call = null;
  clearReplicaMedia();
  try {
    await toDestroy.leave();
  } catch {
    /* already left */
  }
  try {
    await toDestroy.destroy();
  } catch {
    /* already destroyed */
  }
}

async function handleJoin() {
  const id = $('conversation-id').value.trim();
  const url = getResolvedUrl();

  if (!id) {
    showError('Enter a conversation ID (e.g. c477c9dd7aa6e4fe).');
    return;
  }
  if (!url) {
    showError('Could not resolve a conversation URL.');
    return;
  }

  showError(null);
  setJoinState('joining');
  $('last-echo-section').classList.add('hidden');

  try {
    await destroyCall();
    clearReplicaMedia();

    call = createCallObject();
    bindCallEvents();

    await call.join({
      url,
      startVideoOff: true,
      startAudioOff: true,
    });

    markConnected();
  } catch (err) {
    setJoinState('error');
    const msg = err instanceof Error ? err.message : 'Failed to join';
    showError(msg);
    logEvent(`Join failed: ${msg}`);
    await destroyCall();
  }
}

async function handleLeave() {
  await destroyCall();
  setJoinState('idle');
  showError(null);
  logEvent('Disconnected');
}

function sendEcho(emotion) {
  if (!call || joinState !== 'joined') return;

  const id = $('conversation-id').value.trim();
  if (!id) return;

  const textarea = document.querySelector(`[data-emotion="${emotion}"]`);
  const phrase = textarea ? textarea.value : '';
  const text = buildEchoText(emotion, phrase);

  $('last-echo').textContent = text;
  $('last-echo-section').classList.remove('hidden');

  call.sendAppMessage(
    {
      message_type: 'conversation',
      event_type: 'conversation.echo',
      conversation_id: id,
      properties: {
        modality: 'text',
        text,
        done: true,
      },
    },
    '*',
  );

  logEvent(`→ echo [${emotion}]`);
}

function sendInterrupt() {
  if (!call || joinState !== 'joined') return;
  const id = $('conversation-id').value.trim();
  if (!id) return;

  call.sendAppMessage(
    {
      message_type: 'conversation',
      event_type: 'conversation.interrupt',
      conversation_id: id,
    },
    '*',
  );
  logEvent('→ interrupt');
}

const PHRASE_COLLAPSED_ROWS = 1;

function resizePhraseExpanded(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function collapsePhrase(textarea) {
  textarea.readOnly = true;
  textarea.classList.remove('is-editing');
  textarea.classList.add('is-collapsed');
  textarea.rows = PHRASE_COLLAPSED_ROWS;
  textarea.style.height = '';
  textarea.title = 'Click to edit';
}

function expandPhrase(textarea) {
  textarea.readOnly = false;
  textarea.classList.remove('is-collapsed');
  textarea.classList.add('is-editing');
  textarea.title = '';
  textarea.rows = 6;
  resizePhraseExpanded(textarea);
  textarea.focus();
  const len = textarea.value.length;
  textarea.setSelectionRange(len, len);
}

function bindPhraseInput(textarea) {
  collapsePhrase(textarea);

  textarea.addEventListener('click', () => {
    if (textarea.readOnly) expandPhrase(textarea);
  });

  textarea.addEventListener('input', () => {
    if (!textarea.readOnly) resizePhraseExpanded(textarea);
  });

  textarea.addEventListener('blur', () => {
    collapsePhrase(textarea);
  });
}

function renderEmotionList() {
  const list = $('emotion-list');
  list.innerHTML = '';

  for (const emotion of EMOTIONS) {
    const card = document.createElement('div');
    card.className = 'emotion-card';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `emotion-btn emotion-${emotion}`;
    btn.textContent = emotion;
    btn.title = `Send echo with ${emotion}`;
    btn.disabled = true;
    btn.addEventListener('click', () => sendEcho(emotion));

    const wrap = document.createElement('div');
    wrap.className = 'phrase-wrap';

    const textarea = document.createElement('textarea');
    textarea.className = 'phrase-input';
    textarea.dataset.emotion = emotion;
    textarea.value = DEFAULT_PHRASES[emotion];
    textarea.placeholder = 'Click to edit phrase…';

    const hint = document.createElement('span');
    hint.className = 'phrase-edit-hint';
    hint.textContent = 'Click to edit';
    hint.setAttribute('aria-hidden', 'true');

    bindPhraseInput(textarea);

    wrap.appendChild(textarea);
    wrap.appendChild(hint);
    card.appendChild(btn);
    card.appendChild(wrap);
    list.appendChild(card);
  }
}

function init() {
  renderEmotionList();

  $('btn-join').addEventListener('click', handleJoin);
  $('btn-leave').addEventListener('click', handleLeave);
  $('btn-interrupt').addEventListener('click', sendInterrupt);

  $('conversation-id').addEventListener('input', updateResolvedUrl);

  const params = new URLSearchParams(window.location.search);
  const idFromQuery = params.get('conversation_id') || params.get('c');
  if (idFromQuery) {
    $('conversation-id').value = idFromQuery;
    updateResolvedUrl();
  }

  window.addEventListener('beforeunload', () => {
    destroyCall();
  });
}

init();
