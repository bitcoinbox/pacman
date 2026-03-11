import Game from './Game.js';
import HeroScene from './hero/HeroScene.js';
import Wallet from './wallet.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ── Game init ──────────────────────────────────────────
const container = document.getElementById('game-container');
const game = new Game(container);
game.init().catch(err => {
  console.error('Failed to initialize game:', err);
});

// ── 3D Hero Scene ──────────────────────────────────────
const heroCanvas = document.getElementById('hero-canvas');
if (heroCanvas) {
  new HeroScene(heroCanvas);
}

// ── Wallet Connect ───────────────────────────────────────
const walletBtn = document.getElementById('wallet-btn');
let wallet = null;
if (walletBtn) {
  wallet = new Wallet(walletBtn);
  game.setWallet(wallet);
}

// ── Leaderboard ─────────────────────────────────────────
const lbTable = document.getElementById('lb-table');
const lbMyRank = document.getElementById('lb-my-rank');
let lbPeriod = 'alltime';

async function loadLeaderboard() {
  if (!lbTable) return;
  const walletAddr = wallet?.getAddress() || '';
  try {
    const res = await fetch(`/api/leaderboard?period=${lbPeriod}&limit=20&wallet=${walletAddr}`);
    const data = await res.json();

    // Render table
    let html = `<div class="lb-row header">
      <div class="lb-rank">#</div>
      <div class="lb-player">PLAYER</div>
      <div class="lb-score">SCORE</div>
    </div>`;

    if (data.entries.length === 0) {
      html += '<div class="lb-empty">No scores yet. Be the first!</div>';
    } else {
      data.entries.forEach((e, i) => {
        const name = e.nickname || 'ANON';
        const shortAddr = e.wallet.slice(0, 4) + '...' + e.wallet.slice(-4);
        html += `<div class="lb-row animate" style="animation-delay:${i * 0.05}s">
          <div class="lb-rank">${e.rank}</div>
          <div class="lb-player">
            <span class="lb-player-name">${name}</span>
            <span class="lb-player-addr">${shortAddr}</span>
          </div>
          <div class="lb-score">${e.score.toLocaleString()}</div>
        </div>`;
      });
    }

    lbTable.innerHTML = html;

    // My rank
    if (data.myRank && lbMyRank) {
      lbMyRank.classList.add('visible');
      document.getElementById('lb-my-name').textContent = data.myRank.nickname || 'ANON';
      document.getElementById('lb-my-pos').textContent = `#${data.myRank.rank}`;
      document.getElementById('lb-my-score').textContent = data.myRank.score.toLocaleString();
    } else if (lbMyRank) {
      lbMyRank.classList.remove('visible');
    }
  } catch {
    if (lbTable) lbTable.innerHTML = '<div class="lb-empty">Failed to load leaderboard</div>';
  }
}

// Tab switching
document.querySelectorAll('.lb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    lbPeriod = tab.dataset.period;
    loadLeaderboard();
  });
});

// Load on page load
loadLeaderboard();

// Refresh after score submission
window.addEventListener('pacman:scoreSubmitted', () => {
  setTimeout(loadLeaderboard, 500);
});

// Refresh when wallet connects
if (wallet) {
  wallet.onAuth(() => loadLeaderboard());
}

// ── Daily Challenge ──────────────────────────────────────
const dailyDesc = document.getElementById('daily-desc');
const dailyStreak = document.getElementById('daily-streak');

async function loadDailyChallenge() {
  if (!dailyDesc) return;
  try {
    const walletAddr = wallet?.getAddress() || '';
    const res = await fetch(`/api/daily?wallet=${walletAddr}`);
    const data = await res.json();
    if (data.challenge) {
      const c = data.challenge;
      const typeNames = {
        target_score: `Score ${c.target?.toLocaleString()} points`,
        speed_run: `Clear level in ${c.target}s`,
        ghost_hunter: `Eat ${c.target} ghosts`,
        dot_collector: 'Eat all dots without dying'
      };
      dailyDesc.textContent = typeNames[c.type] || c.type;
      if (c.specialRule === 'speed_mode') dailyDesc.textContent += ' (SPEED MODE)';
      if (c.specialRule === 'no_power_pills') dailyDesc.textContent += ' (NO POWER PILLS)';
    }
    if (data.streak > 0) {
      dailyStreak.textContent = `STREAK: ${data.streak}`;
    }
  } catch {
    if (dailyDesc) dailyDesc.textContent = 'Connect wallet to play';
  }
}
loadDailyChallenge();

// ── Sound toggle ──────────────────────────────────────────
const soundToggle = document.getElementById('sound-toggle');
if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    const muted = game.audio.toggle();
    soundToggle.classList.toggle('muted', muted);
    soundToggle.querySelector('.sound-icon.on').style.display = muted ? 'none' : 'block';
    soundToggle.querySelector('.sound-icon.off').style.display = muted ? 'block' : 'none';
  });
}

// ── D-Pad (mobile) ───────────────────────────────────────
const dpad = document.getElementById('dpad');
if (dpad) {
  dpad.querySelectorAll('.dpad-btn').forEach(btn => {
    const dir = btn.dataset.dir;
    const sendDir = () => {
      if (game.input) {
        game.input._lastDirection = dir;
        game.input._directionBuffer = dir;
      }
    };
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      sendDir();
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
    }, { passive: false });
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      sendDir();
    });
    btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
    btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
  });
}

// ── Navbar scroll effect ─────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  let scrolled = false;
  window.addEventListener('scroll', () => {
    const shouldScroll = window.scrollY > 40;
    if (shouldScroll !== scrolled) {
      scrolled = shouldScroll;
      navbar.classList.toggle('scrolled', scrolled);
    }
  }, { passive: true });
}

// ── Mobile nav toggle ────────────────────────────────────
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
  // Close menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// ── GSAP Hero Entrance ─────────────────────────────────
// Set initial states
gsap.set('.hero-scoreboard', { y: 20 });
gsap.set('.hero-label', { y: 30, letterSpacing: '20px' });
gsap.set('.hero-token', { y: 25 });
gsap.set('.hero-tagline', { y: 30 });
gsap.set('.hero-cta', { y: 30 });
gsap.set('.hero-pacman', { scale: 0.8 });
gsap.set('.hero-pellets', { });

const heroTl = gsap.timeline({ delay: 0.4 });

heroTl
  // Scoreboard fades in first
  .to('.hero-scoreboard', {
    opacity: 1, y: 0, duration: 0.6, ease: 'power3.out'
  })
  // Label
  .to('.hero-label', {
    opacity: 1, y: 0, letterSpacing: '8px',
    duration: 1.0, ease: 'power3.out'
  }, '-=0.3')
  // Title — big entrance
  .fromTo('.hero-title',
    { opacity: 0, scale: 0.7, y: 30 },
    { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: 'power4.out' },
    '-=0.5'
  )
  // Pac-Man appears
  .to('.hero-pacman', {
    opacity: 0.18, scale: 1, duration: 1.0, ease: 'power3.out'
  }, '-=0.8')
  // Pellet trail
  .to('.hero-pellets', {
    opacity: 1, duration: 0.6, ease: 'power2.out'
  }, '-=0.5')
  // Token
  .to('.hero-token', {
    opacity: 1, y: 0, duration: 0.8, ease: 'power3.out'
  }, '-=0.4')
  // Tagline
  .to('.hero-tagline', {
    opacity: 1, y: 0, duration: 0.8, ease: 'power3.out'
  }, '-=0.3')
  // CTAs
  .to('.hero-cta', {
    opacity: 1, y: 0, duration: 0.8, ease: 'power3.out'
  }, '-=0.2');

// Add glow pulse to title after entrance
heroTl.call(() => {
  const title = document.querySelector('.hero-title');
  if (title) title.style.animation = 'glowPulse 3s ease-in-out infinite';
});

// ── Score counter animation ─────────────────────────────
heroTl.call(() => {
  const scoreEl = document.querySelector('.hero-score-value');
  if (!scoreEl) return;
  const chars = '$PACMAN';
  let frame = 0;
  const totalFrames = 30;
  const interval = setInterval(() => {
    frame++;
    if (frame >= totalFrames) {
      scoreEl.textContent = chars;
      clearInterval(interval);
      return;
    }
    // Show random digits, progressively reveal final text
    const revealed = Math.floor((frame / totalFrames) * chars.length);
    let display = '';
    for (let i = 0; i < chars.length; i++) {
      if (i < revealed) {
        display += chars[i];
      } else {
        display += Math.floor(Math.random() * 10);
      }
    }
    scoreEl.textContent = display;
  }, 50);
}, '-=1.5');

// ── Mouse parallax on HTML layers ────────────────────────
const heroPacman = document.querySelector('.hero-pacman');
const heroContent = document.querySelector('.hero-content');
const heroPellets = document.querySelector('.hero-pellets');

if (heroPacman && heroContent) {
  window.addEventListener('mousemove', (e) => {
    const mx = (e.clientX / window.innerWidth - 0.5) * 2;
    const my = (e.clientY / window.innerHeight - 0.5) * 2;

    // Pac-Man moves more (deeper layer feel)
    gsap.to(heroPacman, {
      x: mx * -15,
      y: my * -10,
      duration: 0.8,
      ease: 'power2.out',
      overwrite: 'auto'
    });

    // Pellets move with pac-man
    if (heroPellets) {
      gsap.to(heroPellets, {
        x: mx * -12,
        y: my * -8,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    }

    // Content moves less (foreground)
    gsap.to(heroContent, {
      x: mx * 5,
      y: my * 3,
      duration: 1.0,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }, { passive: true });
}

// ── GSAP Scroll Parallax ───────────────────────────────
ScrollTrigger.create({
  trigger: '#hero',
  start: 'top top',
  end: 'bottom top',
  scrub: 0.5,
  onUpdate: (self) => {
    const p = self.progress;
    gsap.set('.hero-content', {
      y: p * -120,
      opacity: 1 - p * 2
    });
    gsap.set('.hero-pacman', {
      y: p * -60,
      opacity: 0.18 * (1 - p * 1.5)
    });
    gsap.set('.hero-pellets', {
      opacity: 1 - p * 2
    });
  }
});

// ── Smooth scroll for all internal anchors ──────────────
document.querySelectorAll('a[href^="#"]').forEach(el => {
  el.addEventListener('click', (e) => {
    const target = document.querySelector(el.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ── Fade scroll arrow ──────────────────────────────────
const scrollArrow = document.querySelector('.scroll-arrow');
if (scrollArrow) {
  let faded = false;
  window.addEventListener('scroll', () => {
    if (!faded && window.scrollY > 80) {
      scrollArrow.style.opacity = '0';
      scrollArrow.style.transition = 'opacity 0.6s';
      faded = true;
    }
  }, { passive: true });
}

// ── Section fade-in on scroll ──────────────────────────
document.querySelectorAll('#leaderboard, #about, #chart, #how, #links').forEach(section => {
  gsap.from(section, {
    opacity: 0, y: 40,
    duration: 0.9, ease: 'power3.out',
    scrollTrigger: {
      trigger: section,
      start: 'top 85%',
      once: true
    }
  });
});
