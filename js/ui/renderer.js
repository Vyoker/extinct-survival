/**
 * Renderer
 * Bertanggung jawab menyinkronkan gameState -> DOM (HUD).
 */
const Renderer = (function () {
  'use strict';

  function renderHUD() {
    const p = GameState.get().player;

    document.getElementById('hud-player-name').textContent = p.name;
    document.getElementById('hud-player-level').textContent = `Lv.${p.level}`;

    const expPct = Math.min(100, (p.exp / p.expToNext) * 100);
    document.getElementById('bar-exp').style.width = expPct + '%';

    document.getElementById('stat-health').textContent = p.survival.health;
    document.getElementById('stat-hunger').textContent = p.survival.hunger;
    document.getElementById('stat-thirst').textContent = p.survival.thirst;
    document.getElementById('stat-sanity').textContent = p.survival.sanity;

    const energyPct = Math.min(100, (p.energy / p.maxEnergy) * 100);
    document.getElementById('bar-energy').style.width = energyPct + '%';
    document.getElementById('text-energy').textContent = `${p.energy}/${p.maxEnergy}`;
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  return { renderHUD, showScreen };
})();

window.Renderer = Renderer;
