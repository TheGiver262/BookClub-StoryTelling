const audio = document.getElementById('bg-music');
const toggle = document.getElementById('music-toggle');

if (audio && toggle) {
  let isPlaying = false;
  let userPaused = false;
  let pending = false;
  const interactions = ['click', 'scroll', 'wheel', 'keydown', 'touchstart'];
  function stopAutomaticPlay() {
    for (const event of interactions) window.removeEventListener(event, onFirstInteraction, true);
  }
  let fadeInterval = null;

  function fadeAudio(targetVolume, duration = 800) {
    clearInterval(fadeInterval);
    const startVolume = audio.volume;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;

    fadeInterval = setInterval(() => {
      currentStep++;
      const nextVolume = Math.max(0, Math.min(1, startVolume + volumeStep * currentStep));
      audio.volume = nextVolume;
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        if (targetVolume === 0) {
          audio.pause();
        }
      }
    }, stepTime);
  }

  function playMusic() {
    if (pending) return;
    pending = true;
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        pending = false;
        stopAutomaticPlay();
        isPlaying = true;
        userPaused = false;
        toggle.setAttribute('aria-pressed', 'true');
        toggle.textContent = 'Tắt nhạc ♫';
        fadeAudio(0.35, 1200);
      }).catch(() => {
        pending = false;
        isPlaying = false;
        toggle.setAttribute('aria-pressed', 'false');
        toggle.textContent = 'Bật nhạc ♫';
      });
    } else { pending = false; }
  }

  function pauseMusic() {
    fadeAudio(0, 600);
    isPlaying = false;
    toggle.setAttribute('aria-pressed', 'false');
    toggle.textContent = 'Bật nhạc ♫';
  }

  toggle.addEventListener('click', () => {
    if (isPlaying) {
      userPaused = true;
      pauseMusic();
    } else {
      userPaused = false;
      playMusic();
    }
  });

  function onFirstInteraction() {
    if (!isPlaying && !userPaused) {
      playMusic();
    }
  }

  for (const event of interactions) window.addEventListener(event, onFirstInteraction, { passive: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isPlaying) {
        audio.pause();
      }
    } else {
      if (isPlaying && !userPaused) {
        audio.play().catch(() => {});
      }
    }
  });

  window.addEventListener('pagehide', () => {
    audio.pause();
  });
}
