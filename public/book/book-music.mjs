const audio = document.getElementById('bg-music');
const toggle = document.getElementById('music-toggle');

if (audio && toggle) {
  let isPlaying = false;
  let userPaused = false;
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
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isPlaying = true;
        userPaused = false;
        toggle.setAttribute('aria-pressed', 'true');
        toggle.textContent = 'Tắt nhạc ♫';
        fadeAudio(0.35, 1200);
      }).catch(() => {
        isPlaying = false;
        toggle.setAttribute('aria-pressed', 'false');
        toggle.textContent = 'Bật nhạc ♫';
      });
    }
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
    window.removeEventListener('click', onFirstInteraction);
    window.removeEventListener('scroll', onFirstInteraction);
    window.removeEventListener('keydown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
  }

  window.addEventListener('click', onFirstInteraction, { passive: true });
  window.addEventListener('scroll', onFirstInteraction, { passive: true });
  window.addEventListener('keydown', onFirstInteraction, { passive: true });
  window.addEventListener('touchstart', onFirstInteraction, { passive: true });

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
