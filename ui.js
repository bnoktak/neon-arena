// ============================================================
// UI — all HTML overlay panels.
// Reads CONFIG for data, calls back into Game for actions.
// No canvas drawing. No game state mutation (uses callbacks).
// ============================================================

import { CONFIG }  from './config.js';
import { BALANCE } from './balance.js';
import { esc }    from './utils.js';
import { UpgradeSystem } from './systems.js';

// Human-readable passive bonus display for element cards
function _formatPassive(passive) {
  const labels = {
    baseDamage:     v => `+${v} Damage`,
    maxHpFlat:      v => `+${v} Max HP`,
    speedFlat:      v => `+${(v / 4.5).toFixed(1)} Speed`,
    critChanceFlat: v => `+${v}% Crit Chance`,
    critDmgPctFlat: v => `+${v}% Crit Damage`,
    luckFlat:       v => `+${v} Luck`,
  };
  return Object.entries(passive)
    .map(([k, v]) => labels[k] ? labels[k](v) : `${k}: ${v}`)
    .join(' · ') || '—';
}

// ---- Base overlay styles injected once ----
const BASE_CSS = `
  .na-overlay {
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: rgba(8,6,20,0.88);
    backdrop-filter: blur(6px);
    z-index: 1000; padding: 20px;
    font-family: 'Courier New', monospace;
    color: #d8e6ff;
  }
  .na-overlay.hidden { display: none !important; }
  .na-title {
    font-size: clamp(22px,4vw,40px);
    font-weight: 900; letter-spacing: 4px;
    background: linear-gradient(90deg,#00f0ff,#ff00d4);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    margin-bottom: 18px;
  }
  .na-panel {
    background: rgba(12,10,30,0.9);
    border: 1px solid rgba(0,240,255,0.25);
    border-radius: 8px; padding: 18px 22px;
    max-width: 680px; width: 100%;
    max-height: 72vh; overflow-y: auto;
    margin-bottom: 14px;
  }
  .na-btn {
    font-family: inherit; font-weight: 700;
    letter-spacing: 2px; cursor: pointer;
    border: none; border-radius: 4px;
    transition: transform .1s, box-shadow .1s;
  }
  .na-btn:hover { transform: translateY(-2px); }
  .na-btn-cyan  { background:#00f0ff; color:#050312; padding:12px 30px; font-size:15px; box-shadow:0 0 20px rgba(0,240,255,0.5); }
  .na-btn-magenta { background:#ff00d4; color:#fff; padding:12px 30px; font-size:15px; box-shadow:0 0 20px rgba(255,0,212,0.5); }
  .na-btn-ghost { background:transparent; color:#00f0ff; border:1px solid #00f0ff; padding:10px 22px; font-size:13px; }
  .na-btn-red   { background:#ff3355; color:#fff; padding:12px 30px; font-size:15px; }
  .na-btn-sm    { padding:6px 14px; font-size:12px; background:#00f0ff; color:#050312; }
  .na-btn-sm.cant { background:#223; color:#556; cursor:not-allowed; }
  .na-card {
    display:flex; align-items:center; gap:12px;
    background:#0e0c22; border:1px solid rgba(255,255,255,0.1);
    border-radius:6px; padding:12px 14px; margin-bottom:8px;
    transition: border-color .12s;
  }
  .na-card.clickable:hover { border-color:#00f0ff; cursor:pointer; }
  .na-card.locked { opacity:.4; }
  .na-card.maxed  { border-color:rgba(0,255,136,0.4); opacity:.75; }
  .na-icon { font-size:22px; flex:0 0 28px; }
  .na-label { font-weight:bold; font-size:13px; letter-spacing:1px; }
  .na-sub   { color:#7a8aaa; font-size:11px; line-height:1.4; margin-top:2px; }
  .na-gold  { color:#ffcc33; font-weight:bold; font-size:14px; }
  .na-row   { display:flex; justify-content:space-between; align-items:center; width:100%; }
  .na-pips  { display:flex; gap:3px; }
  .na-pip   { width:16px; height:5px; border-radius:2px; background:rgba(255,255,255,0.12); }
  .na-pip.on { background:#00f0ff; box-shadow:0 0 5px #00f0ff; }
  .na-section-title {
    font-size:11px; letter-spacing:3px; color:#556;
    text-transform:uppercase; margin:14px 0 8px;
  }
  .na-hub-row { display:flex; gap:16px; margin:8px 0; }

  .na-levelup-card {
    flex: 1; min-width: 200px; max-width: 240px;
    flex-direction: column; align-items: flex-start;
    gap: 10px; padding: 22px 18px;
    cursor: pointer;
    position: relative; overflow: hidden;
  }
  .na-levelup-card::before {
    content: '';
    position: absolute; inset: 0;
    opacity: 0; transition: opacity .2s;
    pointer-events: none;
  }
  .na-levelup-card:hover::before { opacity: 1; }
  .na-category-badge {
    font-size: 10px; letter-spacing: 3px;
    text-transform: uppercase; font-weight: bold;
    padding: 3px 8px; border-radius: 20px;
    background: rgba(255,255,255,0.06);
  }
  .na-card-icon { font-size: 36px; margin: 4px 0; }
  .na-card-name { font-size: 16px; font-weight: bold; letter-spacing: 1px; color: #d8e6ff; }
  .na-card-desc { font-size: 12px; line-height: 1.5; }
`;

export function injectStyles() {
  if (document.getElementById('na-styles')) return;
  const style = document.createElement('style');
  style.id = 'na-styles';
  style.textContent = BASE_CSS;
  document.head.appendChild(style);
}

function makeOverlay(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'na-overlay hidden';
    document.body.appendChild(el);
  }
  return el;
}

// ============================================================
// ELEMENT SELECTOR
// ============================================================
export const ElementSelectorUI = {
  show(onSelect) {
    injectStyles();
    const el = makeOverlay('na-element-select');
    el.innerHTML = `
      <div class="na-title">NEON ARENA</div>
      <div style="color:#556;letter-spacing:2px;font-size:11px;margin-bottom:20px;">
        CHOOSE YOUR ELEMENT — Q ability comes with your element
      </div>
      <div class="na-panel" style="display:flex;flex-direction:column;gap:12px;">
        ${Object.entries(CONFIG.elements).map(([id, el]) => `
          <div class="na-card clickable" data-el="${id}"
               style="border-color:${el.color}20;flex-direction:column;align-items:flex-start;gap:6px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:32px;">${el.icon}</span>
              <span class="na-label" style="color:${el.color};font-size:18px;">${el.name}</span>
            </div>
            <div class="na-sub">${el.qAbility?.name ?? 'Q ability'}</div>
          </div>
        `).join('')}
      </div>
    `;
    el.classList.remove('hidden');
    el.querySelectorAll('[data-el]').forEach(card => {
      card.onclick = () => { el.classList.add('hidden'); onSelect(card.dataset.el); };
    });
  },
};

// ============================================================
// WAVE HUB (between waves) — stats summary + embedded market
// ============================================================
export const WaveHubUI = {
  show({ player, world, onContinue, waveStats, onBuy }) {
    injectStyles();
    const el = makeOverlay('na-hub');
    this._render(el, player, world, onContinue, waveStats, onBuy);
    el.classList.remove('hidden');
  },

  // Satın alım sonrası sadece değişen node'ları günceller — innerHTML dokunulmaz
  _refreshAfterBuy(el, player) {
    el.querySelector('.na-gold').textContent = `⬢ ${player.gold} GOLD`;

    el.querySelectorAll('[data-idx]').forEach(btn => {
      const item  = CONFIG.shop.items[+btn.dataset.idx];
      const price = UpgradeSystem.getPrice(item, player);
      const maxed = price == null;
      const afford= price != null && player.gold >= price;
      btn.textContent = maxed ? 'MAX' : `⬢ ${price}`;
      btn.className   = `na-btn na-btn-sm${afford ? '' : ' cant'}`;
      btn.disabled    = !afford;
      if (item.maxLevel) {
        const pips = btn.closest('.na-card')?.querySelector('.na-pips');
        if (pips) {
          const lvl = player.shopUpgrades[item.id] ?? 0;
          pips.innerHTML = Array.from({length: item.maxLevel}, (_, i) =>
            `<span class="na-pip${i < lvl ? ' on' : ''}"></span>`
          ).join('');
        }
      }
    });

    el.querySelectorAll('[data-buy-ability]').forEach(btn => {
      const ab    = CONFIG.abilities[btn.dataset.buyAbility];
      const owned = Object.values(player.abilitySlots).some(a => a?.id === btn.dataset.buyAbility);
      const afford= !owned && player.gold >= ab.marketPrice;
      btn.className = `na-btn na-btn-sm${afford ? '' : ' cant'}`;
      btn.disabled  = !afford;
    });
  },

  _render(el, player, world, onContinue, waveStats, onBuy) {
    const items = CONFIG.shop.items;

    const statsHtml = waveStats ? `
      <div class="na-panel" style="margin-bottom:10px;padding:12px 16px;">
        <div class="na-section-title" style="margin-top:0;">// WAVE ${waveStats.wave} COMPLETE</div>
        <div style="display:flex;gap:22px;flex-wrap:wrap;font-size:13px;padding-top:2px;">
          <span>💀 <strong>${waveStats.kills}</strong> kills</span>
          <span style="color:#ffcc33">⬢ +<strong>${waveStats.goldEarned}</strong> gold</span>
          <span style="color:#c9a3ff">Lv <strong>${waveStats.levelReached}</strong></span>
          <span style="color:#7a8aaa">⏱ <strong>${waveStats.timeSec}s</strong></span>
        </div>
      </div>
    ` : '';

    el.innerHTML = `
      <div class="na-title" style="font-size:22px;">BETWEEN WAVES</div>
      <div style="display:flex;gap:24px;margin-bottom:10px;">
        <span class="na-gold">⬢ ${player.gold} GOLD</span>
        <span style="color:#9fb4d6;font-size:13px;">×${world.difficulty.toFixed(2)} DIFFICULTY</span>
      </div>
      ${statsHtml}
      <div class="na-panel" id="hub-market-panel">
        <div class="na-section-title" style="margin-top:0;">// SHOP</div>
        ${(() => {
          const catMeta = {
            offense: { label: '⚔ Offense', color: '#00f0ff' },
            defense: { label: '🛡 Defense', color: '#00ff88' },
            ability: { label: '✨ Ability', color: '#c9a3ff' },
            global:  { label: '💰 Global',  color: '#ffcc33' },
            utility: { label: '⚙ Utility',  color: '#aaaaaa' },
          };
          const grouped = {};
          items.forEach((item, idx) => {
            const cat = item.category ?? 'utility';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ item, idx });
          });
          const renderCard = ({ item, idx }) => {
            const price = UpgradeSystem.getPrice(item, player);
            const lvl   = player.shopUpgrades[item.id] ?? 0;
            const maxed = price == null;
            const afford= price != null && player.gold >= price;
            const pips  = item.maxLevel
              ? `<div class="na-pips">${Array.from({length:item.maxLevel},(_,i)=>`<span class="na-pip${i<lvl?' on':''}"></span>`).join('')}</div>`
              : '';
            return `
              <div class="na-card">
                <span class="na-icon" style="color:${item.color}">${item.icon}</span>
                <div style="flex:1">
                  <div class="na-label" style="color:${item.color}">${item.name}</div>
                  <div class="na-sub">${item.desc}</div>
                  ${pips}
                </div>
                <button class="na-btn na-btn-sm ${afford?'':'cant'}" data-idx="${idx}" ${afford?'':'disabled'}>
                  ${maxed ? 'MAX' : `⬢ ${price}`}
                </button>
              </div>
            `;
          };
          return Object.entries(catMeta)
            .filter(([cat]) => grouped[cat])
            .map(([cat, meta]) => `
              <div class="na-section-title" style="color:${meta.color};border-color:${meta.color}33;margin-top:10px;">${meta.label}</div>
              ${grouped[cat].map(renderCard).join('')}
            `).join('');
        })()}
        <div class="na-section-title">// Abilities (E / R / Shift Slot)</div>
        ${Object.entries(CONFIG.abilities).map(([id, ab]) => {
          const owned  = Object.values(player.abilitySlots).some(a => a?.id === id);
          const afford = !owned && player.gold >= ab.marketPrice;
          const slotBtns = ['e','r','shift'].map(slot => {
            const label = slot === 'shift' ? 'SH' : slot.toUpperCase();
            return `<button class="na-btn na-btn-sm ${afford?'':'cant'}" data-buy-ability="${id}" data-slot="${slot}" ${afford?'':'disabled'}>${label} ⬢${ab.marketPrice}</button>`;
          }).join('');
          return `
            <div class="na-card">
              <span class="na-icon" style="color:${ab.color}">${ab.icon}</span>
              <div style="flex:1">
                <div class="na-label" style="color:${ab.color}">${ab.name}</div>
                <div class="na-sub">CD: ${(ab.cooldown/60).toFixed(1)}s</div>
              </div>
              ${owned ? `<span style="color:#00ff88;font-size:11px;">OWNED</span>` : `<span style="display:flex;gap:4px;">${slotBtns}</span>`}
            </div>
          `;
        }).join('')}
      </div>
      <div class="na-hub-row" style="margin-top:4px;">
        <button class="na-btn na-btn-cyan" id="hub-continue">CONTINUE ›</button>
      </div>
    `;

    el.querySelectorAll('[data-idx]').forEach(btn => {
      btn.onclick = () => {
        const item = CONFIG.shop.items[+btn.dataset.idx];
        if (UpgradeSystem.buy(item, player)) {
          onBuy?.();
          this._refreshAfterBuy(el, player);
        }
      };
    });
    el.querySelectorAll('[data-buy-ability]').forEach(btn => {
      btn.onclick = () => {
        if (UpgradeSystem.buyAbility(btn.dataset.buyAbility, btn.dataset.slot, player)) {
          onBuy?.();
          this._refreshAfterBuy(el, player);
        }
      };
    });
    el.querySelector('#hub-continue').onclick = () => { el.classList.add('hidden'); onContinue(); };
  },

  hide() { document.getElementById('na-hub')?.classList.add('hidden'); },
};

// ============================================================
// MARKET UI
// ============================================================
export const MarketUI = {
  show({ player, world, onBack }) {
    injectStyles();
    const el = makeOverlay('na-market');
    this._render(el, player, onBack);
    el.classList.remove('hidden');
  },

  _render(el, player, onBack) {
    const items = CONFIG.shop.items;
    el.innerHTML = `
      <div class="na-title" style="font-size:24px;">MARKET</div>
      <div class="na-gold" style="margin-bottom:12px;">⬢ ${player.gold} GOLD</div>
      <div class="na-panel">
        ${items.map((item, idx) => {
          const price  = UpgradeSystem.getPrice(item, player);
          const lvl    = player.shopUpgrades[item.id] ?? 0;
          const maxed  = price == null;
          const afford = price != null && player.gold >= price;
          const pips   = item.maxLevel
            ? `<div class="na-pips">${Array.from({length:item.maxLevel},(_,i)=>`<span class="na-pip${i<lvl?' on':''}"></span>`).join('')}</div>`
            : '';
          return `
            <div class="na-card">
              <span class="na-icon" style="color:${item.color}">${item.icon}</span>
              <div style="flex:1">
                <div class="na-label" style="color:${item.color}">${item.name}</div>
                <div class="na-sub">${item.desc}</div>
                ${pips}
              </div>
              <button class="na-btn na-btn-sm ${afford ? '' : 'cant'}" data-idx="${idx}" ${afford?'':' disabled'}>
                ${maxed ? 'MAX' : `⬢ ${price}`}
              </button>
            </div>
          `;
        }).join('')}

        <div class="na-section-title">// Abilities (E / R / Shift Slot)</div>
        ${Object.entries(CONFIG.abilities).map(([id, ab]) => {
          const owned  = Object.values(player.abilitySlots).some(a => a?.id === id);
          const afford = !owned && player.gold >= ab.marketPrice;
          const slotBtns = ['e','r','shift'].map(slot => {
            const label = slot === 'shift' ? 'SH' : slot.toUpperCase();
            return `<button class="na-btn na-btn-sm ${afford?'':'cant'}" data-buy-ability="${id}" data-slot="${slot}" ${afford?'':'disabled'}>${label} ⬢${ab.marketPrice}</button>`;
          }).join('');
          return `
            <div class="na-card">
              <span class="na-icon" style="color:${ab.color}">${ab.icon}</span>
              <div style="flex:1">
                <div class="na-label" style="color:${ab.color}">${ab.name}</div>
                <div class="na-sub">CD: ${(ab.cooldown/60).toFixed(1)}s</div>
              </div>
              ${owned ? `<span style="color:#00ff88;font-size:11px;">OWNED</span>` : `<span style="display:flex;gap:4px;">${slotBtns}</span>`}
            </div>
          `;
        }).join('')}
      </div>
      <button class="na-btn na-btn-ghost" id="market-back">‹ BACK</button>
    `;

    // Wire shop item buttons
    el.querySelectorAll('[data-idx]').forEach(btn => {
      btn.onclick = () => {
        const item = CONFIG.shop.items[+btn.dataset.idx];
        if (UpgradeSystem.buy(item, player)) this._render(el, player, onBack);
      };
    });
    // Wire ability buttons
    el.querySelectorAll('[data-buy-ability]').forEach(btn => {
      btn.onclick = () => {
        if (UpgradeSystem.buyAbility(btn.dataset.buyAbility, btn.dataset.slot, player))
          this._render(el, player, onBack);
      };
    });
    el.querySelector('#market-back').onclick = () => {
      el.classList.add('hidden');
      onBack();
    };
  },
};

// ============================================================
// GAME OVER UI
// ============================================================
export const GameOverUI = {
  _lbKey: 'neonArenaLB',

  show({ player, world, onRetry, onMenu }) {
    injectStyles();
    const el = makeOverlay('na-gameover');
    const lb = this._loadLB();

    el.innerHTML = `
      <div style="font-size:40px;font-weight:900;color:#ff3355;letter-spacing:4px;margin-bottom:8px;">GAME OVER</div>
      <div class="na-gold" style="font-size:36px;margin-bottom:6px;">${Math.floor(player.score)}</div>
      <div style="color:#7a8aaa;font-size:12px;margin-bottom:18px;">
        Wave ${world.wave} · ${world.kills} kills · LV ${player.level}
      </div>
      <div class="na-panel" id="go-name-panel">
        <div style="margin-bottom:8px;letter-spacing:2px;color:#00f0ff;">SAVE SCORE</div>
        <input id="go-name" maxlength="8" placeholder="YOUR NAME"
          style="background:#0a0818;border:1px solid #00f0ff;color:#00f0ff;
                 font-family:inherit;font-size:16px;letter-spacing:3px;text-transform:uppercase;
                 padding:8px;width:160px;text-align:center;border-radius:4px;outline:none;">
        <button class="na-btn na-btn-cyan" id="go-save" style="margin-left:10px;">SAVE</button>
      </div>
      <div class="na-panel hidden" id="go-lb-panel">
        <div class="na-section-title">// TOP 5</div>
        <div id="go-lb-content"></div>
      </div>
      <div class="na-hub-row">
        <button class="na-btn na-btn-magenta" id="go-retry">PLAY AGAIN</button>
        <button class="na-btn na-btn-ghost"   id="go-menu">MAIN MENU</button>
      </div>
    `;
    el.classList.remove('hidden');

    el.querySelector('#go-save').onclick = () => {
      const name = (el.querySelector('#go-name').value.trim().toUpperCase() || 'ANON').slice(0, 8);
      let list = this._loadLB();
      list.push({ name, score: Math.floor(player.score) });
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, 5);
      this._saveLB(list);
      const idx = list.findIndex(r => r.name === name && r.score === Math.floor(player.score));
      el.querySelector('#go-name-panel').classList.add('hidden');
      const lbPanel = el.querySelector('#go-lb-panel');
      lbPanel.classList.remove('hidden');
      lbPanel.querySelector('#go-lb-content').innerHTML = list.map((r, i) =>
        `<div class="na-card" style="${i===idx?'border-color:#00ff88;':''}">`+
        `<span style="color:#ff00d4;width:20px;">${i+1}</span>`+
        `<span style="flex:1">${esc(r.name)}</span>`+
        `<span class="na-gold">${r.score}</span></div>`
      ).join('');
    };
    el.querySelector('#go-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#go-save').click();
    });
    el.querySelector('#go-retry').onclick = () => { el.classList.add('hidden'); onRetry(); };
    el.querySelector('#go-menu').onclick  = () => { el.classList.add('hidden'); onMenu();  };
  },

  _loadLB() { try { return JSON.parse(localStorage.getItem(this._lbKey)) || []; } catch { return []; } },
  _saveLB(list) { try { localStorage.setItem(this._lbKey, JSON.stringify(list)); } catch {} },
};

// ============================================================
// PAUSE UI (game pause overlay)
// ============================================================
export const PauseUI = {
  show({ player, world, onResume, onSettings, onQuit }) {
    injectStyles();
    const el = makeOverlay('na-pause');
    el.innerHTML = `
      <div class="na-title" style="font-size:32px;">PAUSED</div>
      <div class="na-panel" style="max-width:320px;gap:10px;display:flex;flex-direction:column;">
        <div class="na-section-title">// STATS</div>
        ${[
          ['Element',      `${player.elementDef.icon} ${player.elementDef.name}`, player.elementDef.color],
          ['Level',        player.level,                                          '#c9a3ff'],
          ['HP',           `${Math.ceil(player.hp)} / ${player.maxHp}`,           '#ff3355'],
          ['Damage',       player.damage.toFixed(1),                              '#00f0ff'],
          ['Crit Chance',  `${player.critChance.toFixed(1)}%`,                    '#ff9500'],
          ['Crit Damage',  `+${player.critDamagePct.toFixed(1)}%`,                '#ff3355'],
          ['Speed',        (player.speed / 4.5).toFixed(2) + ' u',               '#00ff88'],
          ['Luck',         player.luck.toFixed(3),                                '#ffe600'],
          ['Gold Mul',     '×' + player.goldMul.toFixed(2),                      '#ffcc33'],
          ['EXP Mul',      '×' + player.expMul.toFixed(2),                       '#b366ff'],
          ['Pierce',       player.pierce,                                         '#00f0ff'],
          ['Life Steal',   (player.lifeSteal * 100).toFixed(1) + '%',             '#ff3355'],
          ['Bullets',      player.bulletCount,                                    '#ffe600'],
          ['Difficulty',   '×' + world.difficulty.toFixed(2),                    '#ff2d6f'],
          ['Gold',         player.gold,                                           '#ffcc33'],
          ['SP',           player.sp,                                             '#c9a3ff'],
        ].map(([k, v, c]) => `
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid #111;">
            <span style="color:#556;">${k}</span>
            <span style="color:${c ?? '#fff'};font-weight:bold;">${v}</span>
          </div>
        `).join('')}
        <div class="na-section-title" style="margin-top:10px;">// SHOP PURCHASES</div>
        ${Object.keys(player.shopUpgrades ?? {}).length === 0
          ? '<div class="na-sub">No purchases yet</div>'
          : Object.entries(player.shopUpgrades).map(([id, lv]) => {
              const item = CONFIG.shop.items.find(i => i.id === id);
              return item
                ? `<div class="na-sub" style="color:${item.color};">${item.icon} ${item.name} ×${lv}</div>`
                : '';
            }).join('')}
      </div>
      <div class="na-hub-row">
        <button class="na-btn na-btn-cyan"  id="pause-resume">RESUME</button>
        <button class="na-btn na-btn-ghost" id="pause-quit">MAIN MENU</button>
      </div>
      <div style="color:#334;font-size:11px;margin-top:8px;">P or ESC — resume</div>
    `;
    el.classList.remove('hidden');
    el.querySelector('#pause-resume').onclick = () => { el.classList.add('hidden'); onResume(); };
    el.querySelector('#pause-quit').onclick   = () => { el.classList.add('hidden'); onQuit();   };
  },
  hide() { document.getElementById('na-pause')?.classList.add('hidden'); },
};

// ============================================================
// MAIN MENU UI
// ============================================================
export const MainMenuUI = {
  show(callbacks) {
    injectStyles();
    const el = makeOverlay('na-mainmenu');
    el.innerHTML = `
      <div class="na-title" style="font-size:clamp(36px,8vw,72px);">NEON ARENA</div>
      <div style="color:#556;letter-spacing:3px;font-size:12px;margin-bottom:32px;">
        SURVIVE · SHOOT · ASCEND
      </div>
      <div style="display:flex;gap:14px;align-items:center;">
        <button class="na-btn na-btn-cyan" id="menu-play" style="font-size:20px;padding:16px 50px;">PLAY</button>
        <button class="na-btn na-btn-ghost" id="menu-info" style="font-size:14px;padding:14px 22px;">INFO</button>
        <button class="na-btn na-btn-ghost" id="menu-admin" style="font-size:14px;padding:14px 22px;border-color:#ff2d6f;color:#ff2d6f;">ADMIN</button>
      </div>
      <div id="admin-status" style="
        margin-top:12px; font-size:11px; letter-spacing:2px;
        color:#334; font-family:'Courier New',monospace;
      ">MODE: NORMAL</div>
      <div style="display:flex; gap:18px; justify-content:center; margin-top:28px;">
        ${Object.entries(CONFIG.elements).map(([id, el]) => `
          <div class="na-el-icon" data-name="${el.name}" title="${el.name}"
            style="font-size:28px; cursor:default; opacity:0.7; transition:opacity .2s, transform .2s;"
            onmouseenter="this.style.opacity='1'; this.style.transform='scale(1.25)'"
            onmouseleave="this.style.opacity='0.7'; this.style.transform='scale(1)'"
          >${el.icon}</div>
        `).join('')}
      </div>
      <div id="na-el-label" style="
        height:20px; text-align:center; margin-top:10px;
        font-size:12px; letter-spacing:3px; color:#00f0ff;
        font-family:'Courier New',monospace; opacity:0;
        transition: opacity .2s;
      "></div>
      <div id="na-slogan" style="
        margin-top:32px; text-align:center;
        font-size:13px; letter-spacing:2px;
        color:#556; font-family:'Courier New',monospace;
        min-height:20px; transition: opacity .5s;
      "></div>
    `;
    el.classList.remove('hidden');

    const elIcons = el.querySelectorAll('.na-el-icon');
    elIcons.forEach(icon => {
      icon.addEventListener('mouseenter', () => {
        const label = el.querySelector('#na-el-label');
        label.textContent = icon.dataset.name.toUpperCase();
        label.style.opacity = '1';
      });
      icon.addEventListener('mouseleave', () => {
        const label = el.querySelector('#na-el-label');
        label.style.opacity = '0';
      });
    });

    const slogans = [
      'Survive. Evolve. Conquer.',
      'Every wave harder. Every choice matters.',
      'Burn. Freeze. Shatter.',
      'Hoard gold. Master your abilities.',
      'No two runs are the same.',
    ];
    let sloganIdx = 0;
    const sloganEl = el.querySelector('#na-slogan');

    const showSlogan = () => {
      sloganEl.style.opacity = '0';
      setTimeout(() => {
        sloganEl.textContent = slogans[sloganIdx % slogans.length];
        sloganEl.style.opacity = '1';
        sloganIdx++;
      }, 500);
    };

    showSlogan();
    const sloganInterval = setInterval(showSlogan, 3000);

    const origOnPlay = callbacks.onPlay;
    callbacks.onPlay = () => { clearInterval(sloganInterval); origOnPlay(); };
    const origOnInfo = callbacks.onInfo;
    callbacks.onInfo = () => { clearInterval(sloganInterval); origOnInfo(); };

    el.querySelector('#menu-play').onclick = () => { el.classList.add('hidden'); callbacks.onPlay(); };
    el.querySelector('#menu-info').onclick = () => { el.classList.add('hidden'); callbacks.onInfo(); };

    let adminActive = false;
    const adminBtn    = el.querySelector('#menu-admin');
    const adminStatus = el.querySelector('#admin-status');

    adminBtn.onclick = () => {
      adminActive = !adminActive;
      adminBtn.style.background = adminActive ? '#ff2d6f' : 'transparent';
      adminBtn.style.color      = adminActive ? '#fff'    : '#ff2d6f';
      adminStatus.style.color   = adminActive ? '#ff2d6f' : '#334';
      adminStatus.textContent   = adminActive
        ? '⚠ ADMIN MODE — 15s waves · ×100 EXP/Gold'
        : 'MODE: NORMAL';
      callbacks.adminMode = adminActive;
    };
  },
};

// ============================================================
// INFO MENU UI
// ============================================================
export const InfoMenuUI = {
  show(onBack) {
    injectStyles();
    const el = makeOverlay('na-info');

    // ---- Düşman satırları — config + balance'dan ----
    const enemyRows = Object.entries(CONFIG.shapes).map(([id, sh]) => {
      const b = BALANCE.enemies[id] ?? {};
      const behaviors = {
        chase:    'Charges directly at the player.',
        turret:   'Stops when in range and opens fire.',
        kamikaze: 'Lights a fuse when close, then self-destructs.',
      };
      const behaviorDesc = behaviors[sh.behavior?.id] ?? sh.behavior?.id ?? '—';
      const onDeathDesc  = sh.onDeath?.length
        ? sh.onDeath.map(d => d.effect === 'splitSpawn' ? `Spawns ${d.count} ${d.shape} on death` : d.effect).join(', ')
        : '—';
      return `
        <div class="na-card" style="flex-direction:column;align-items:flex-start;gap:4px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="na-label" style="font-size:18px;">${sh.label}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;width:100%;margin-top:4px;">
            ${[
              ['HP',          b.hp         ?? '—'],
              ['Speed',       b.speed      ?? '—'],
              ['Contact Dmg', b.contactDmg ?? '—'],
              ['EXP / Gold',  `${b.exp ?? '—'} / ${b.gold ?? '—'}`],
            ].map(([k,v]) => `
              <div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #111;">
                <span style="color:#445;">${k}</span>
                <span style="color:#9fb4d6;font-weight:bold;">${v}</span>
              </div>
            `).join('')}
          </div>
          <div class="na-sub" style="margin-top:4px;">
            <span style="color:#556;">Behavior:</span> ${behaviorDesc}
          </div>
          ${onDeathDesc !== '—' ? `<div class="na-sub"><span style="color:#556;">On Death:</span> ${onDeathDesc}</div>` : ''}
        </div>
      `;
    }).join('');

    // ---- Tier satırları ----
    const tierRows = BALANCE.tiers.map((t, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:5px 0;font-size:12px;border-bottom:1px solid #111;">
        <span style="color:${t.color};font-weight:bold;min-width:28px;">${t.label}</span>
        <span style="color:${t.color};flex:1;">Reward ×${t.rewardMul}</span>
        <span style="color:#445;font-size:11px;">Weight: ${t.minWeight}–${t.maxWeight}</span>
      </div>
    `).join('');

    // ---- Element satırları ----
    const qDescs = {
      fire_q:      'Creates a fire zone at player position. Deals 20 damage/s for 4s.',
      ice_q:       'Creates an ice zone at player position. Slows enemies, deals 10 damage/s.',
      lightning_q: 'Creates a lightning zone at cursor position. Stuns enemies, deals 15 damage/s.',
      stone_q:     'Spawns 5 orbiting rocks around the player. Rocks knock back and damage enemies on hit.',
      wind_q:      'Creates a vortex at cursor position. Pulls enemies in, deals 8 damage/s.',
      toxic_q:     'Creates a toxic zone at player position. Deals 25 damage/s for 4s.',
    };

    const elementRows = Object.entries(CONFIG.elements).map(([id, e]) => `
      <div class="na-card" style="border-color:${e.color}30;flex-direction:column;align-items:flex-start;gap:4px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:28px;">${e.icon}</span>
          <span class="na-label" style="color:${e.color};font-size:16px;">${e.name}</span>
        </div>
        <div class="na-sub">
          <strong style="color:${e.color};">Q — ${e.qAbility.name}:</strong>
          ${qDescs[e.qAbility.id] ?? '—'}
        </div>
        <div class="na-sub" style="color:#445;">
          Cooldown: ${Math.round(e.qAbility.cooldown / 60)}s
        </div>
      </div>
    `).join('');

    // ---- Stat açıklamaları ----
    const statRows = [
      ['⚔',  'Damage',        'Base damage dealt by each bullet.'],
      ['♥',  'Max HP',         'Maximum health points.'],
      ['➤',  'Speed',          'Movement speed multiplier.'],
      ['◈',  'Crit Chance',    'Chance for each shot to critically strike (%).'],
      ['◆',  'Crit Damage',    'Bonus damage multiplier on critical hits (%).'],
      ['🔥', 'Fire Rate',      'Bullet firing speed. Lower cooldown = faster fire.'],
      ['✦',  'Luck',           'Increases drop chance and odds of higher-tier enemies.'],
      ['🏹', 'Pierce',         'Number of enemies each bullet can pass through.'],
      ['🩸', 'Life Steal',     'Percentage of damage dealt converted to HP.'],
      ['🔫', 'Bullet Count',   'Bullets fired simultaneously (max 8).'],
      ['🛡',  'Armor',         'Flat damage reduction per hit. Max 90% reduction.'],
      ['💚', 'Regeneration',   'HP restored per second after 2s without damage.'],
      ['➶',  'Bullet Speed',   'Bullet flight speed multiplier.'],
      ['⟳',  'Ability CDR',   'Reduces cooldown of Q/E/R/Shift abilities (max 60%).'],
      ['⚔',  'Thorns',        'Percentage of incoming damage reflected to attacker.'],
      ['💥', 'AoE Size',       'Increases radius of all area effects.'],
      ['💰', 'Gold Interest',  'Bonus gold at wave end equal to a % of current gold.'],
      ['✦',  'Multicast',      'Chance for each bullet to fire a second copy.'],
    ].map(([icon, name, desc]) => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid #111;font-size:12px;">
        <span style="min-width:20px;text-align:center;">${icon}</span>
        <span style="color:#9fb4d6;font-weight:bold;min-width:120px;">${name}</span>
        <span style="color:#556;">${desc}</span>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="na-title" style="font-size:26px;">CODEX</div>
      <div class="na-panel" style="max-height:72vh;max-width:720px;">

        <div class="na-section-title">// HOW TO PLAY</div>
        <div class="na-card">
          <span class="na-icon">🎮</span>
          <div style="flex:1">
            <div class="na-label">Controls</div>
            <div class="na-sub">WASD — move &nbsp;·&nbsp; Mouse — aim &nbsp;·&nbsp; Auto-fire</div>
            <div class="na-sub">Q — element ability &nbsp;·&nbsp; E / R / Shift — extra ability</div>
            <div class="na-sub">Space — cycle aim mode (Mouse / Nearest / Strongest)</div>
            <div class="na-sub">P or ESC — pause &nbsp;·&nbsp; B — debug</div>
          </div>
        </div>
        <div class="na-card">
          <span class="na-icon">📈</span>
          <div style="flex:1">
            <div class="na-label">Progression</div>
            <div class="na-sub">Kill enemies → collect EXP / Gold → level up</div>
            <div class="na-sub">Shop opens between waves — spend gold to upgrade stats</div>
            <div class="na-sub">Every ${BALANCE.wave.bossEvery} waves a Boss arrives — kill it to end the wave</div>
          </div>
        </div>

        <div class="na-section-title">// ENEMY TYPES</div>
        ${enemyRows}

        <div class="na-section-title">// COLOR TIERS</div>
        <div class="na-card" style="flex-direction:column;align-items:flex-start;gap:0;">
          <div class="na-sub" style="margin-bottom:8px;">
            The same enemy can appear in different colors. Higher tier = more rewards. Higher luck = better tier chances.
          </div>
          ${tierRows}
        </div>

        <div class="na-section-title">// ELEMENTS & Q ABILITIES</div>
        ${elementRows}

        <div class="na-section-title">// CHARACTER STATS</div>
        <div class="na-card" style="flex-direction:column;align-items:flex-start;gap:0;padding:10px 14px;">
          ${statRows}
        </div>

      </div>
      <button class="na-btn na-btn-ghost" id="info-back">‹ BACK</button>
    `;

    el.classList.remove('hidden');
    el.querySelector('#info-back').onclick = () => { el.classList.add('hidden'); onBack(); };
  },
};

// ============================================================
// LEVEL UP CARD SELECTION
// ============================================================
export const LevelUpUI = {
  show(player, onSelect) {
    injectStyles();
    const el = makeOverlay('na-levelup');

    const pool     = BALANCE.levelUpCards.pool;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const cards    = shuffled.slice(0, 3);

    const categoryColors = {
      savunma: '#00ff88',
      saldiri: '#ff3355',
      yetenek: '#c9a3ff',
      global:  '#ffcc33',
    };
    const categoryLabels = {
      savunma: '🛡 Defense',
      saldiri: '⚔ Offense',
      yetenek: '✨ Ability',
      global:  '💰 Global',
    };

    el.innerHTML = `
      <div style="text-align:center;margin-bottom:6px;">
        <div class="na-title" style="font-size:28px;margin-bottom:4px;">
          LEVEL ${esc(String(player.level))}
        </div>
        <div style="
          color:#445; font-size:11px; letter-spacing:3px;
          font-family:'Courier New',monospace;
        ">CHOOSE AN UPGRADE</div>
      </div>

      <div style="
        display:flex; gap:20px; flex-wrap:wrap;
        justify-content:center; max-width:820px;
        margin-top:16px;
      ">
        ${cards.map((card, i) => {
          const col = categoryColors[card.category] ?? '#aaa';
          const cat = categoryLabels[card.category] ?? card.category;
          return `
            <div class="na-card na-levelup-card" data-idx="${i}"
              style="border-color:${col}30; background:rgba(10,8,28,0.95);"
              onmouseenter="
                this.style.borderColor='${col}';
                this.style.transform='translateY(-6px)';
                this.style.boxShadow='0 8px 32px ${col}33';
              "
              onmouseleave="
                this.style.borderColor='${col}30';
                this.style.transform='translateY(0)';
                this.style.boxShadow='none';
              "
            >
              <div class="na-category-badge" style="color:${col};border:1px solid ${col}44;">
                ${cat}
              </div>
              <div class="na-card-icon">${card.icon}</div>
              <div class="na-card-name">${esc(card.name)}</div>
              <div class="na-card-desc" style="color:${col}cc;">${esc(card.desc)}</div>

              <div style="
                margin-top:auto; padding-top:12px;
                border-top:1px solid ${col}22;
                width:100%; font-size:10px;
                letter-spacing:2px; color:#334;
              ">CLICK TO SELECT</div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="
        margin-top:20px; font-size:10px;
        letter-spacing:2px; color:#223;
        font-family:'Courier New',monospace;
      ">
        XP: ${esc(String(Math.round(player.exp)))} / ${esc(String(player.expReq))}
      </div>
    `;

    el.classList.remove('hidden');

    el.querySelectorAll('[data-idx]').forEach(card => {
      card.onclick = () => {
        el.classList.add('hidden');
        onSelect(cards[parseInt(card.dataset.idx)]);
      };
    });
  },

  hide() {
    document.getElementById('na-levelup')?.classList.add('hidden');
  },
};

