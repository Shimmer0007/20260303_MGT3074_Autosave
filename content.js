/* ============================================================
   MGT 3074 Auto-Save — Content Script  v2
   Lightweight localStorage-based auto-save for worksheets
   ============================================================ */
(() => {
  'use strict';

  const PREFIX = 'mgt3074_';
  const DEBOUNCE_MS = 600;
  const LOG = (...args) => console.log('[MGT AutoSave]', ...args);

  // ── State ──────────────────────────────────────────────────
  let currentWeekId = null;
  let debounceTimers = new Map();
  let boundElements = new WeakSet();
  let observer = null;
  let panelOpen = false;
  let restoreScheduled = false;

  // ── Utility ────────────────────────────────────────────────

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }

  function cleanText(txt) {
    return txt.replace(/\s+/g, ' ').trim().substring(0, 120);
  }

  // ── Week Detection ─────────────────────────────────────────
  // The active worksheet is inside a card with bg-indigo-600 header.
  // Inside that header is a small badge with "Week N" text.

  function detectWeek() {
    // Strategy 1: Find the indigo card header → badge with "Week N"
    const indigoHeader = document.querySelector('[class*="bg-indigo-600"][class*="rounded-t"]');
    if (indigoHeader) {
      const badges = indigoHeader.querySelectorAll('[class*="rounded-md"]');
      for (const badge of badges) {
        const m = badge.textContent.trim().match(/^Week\s+(\d+)$/i);
        if (m) {
          LOG('Detected week (indigo header):', m[1]);
          return 'week' + m[1];
        }
      }
      // Fallback: any text in the header containing "Week N"
      const headerText = indigoHeader.textContent;
      const m2 = headerText.match(/Week\s+(\d+)/i);
      if (m2) {
        LOG('Detected week (header text):', m2[1]);
        return 'week' + m2[1];
      }
    }

    // Strategy 2: Look for the active worksheet card (any card with a "Week" badge in its header)
    const allCards = document.querySelectorAll('[class*="rounded-xl"][class*="shadow"]');
    for (const card of allCards) {
      const header = card.querySelector('[class*="rounded-t"]');
      if (!header) continue;
      // Only consider colored headers (not slate/white generic ones)
      if (header.className.includes('bg-indigo') || header.className.includes('bg-purple') || header.className.includes('bg-blue')) {
        const m = header.textContent.match(/Week\s+(\d+)/i);
        if (m) {
          LOG('Detected week (card scan):', m[1]);
          return 'week' + m[1];
        }
      }
    }

    // Strategy 3: look for tracking-tight title element near worksheets
    const titles = document.querySelectorAll('.tracking-tight, [class*="tracking-tight"]');
    for (const t of titles) {
      const m = t.closest('[class*="bg-indigo"], [class*="bg-purple"]')?.textContent.match(/Week\s+(\d+)/i);
      if (m) {
        LOG('Detected week (title scan):', m[1]);
        return 'week' + m[1];
      }
    }

    LOG('Could not detect week');
    return null;
  }

  // ── Key Generation ─────────────────────────────────────────

  function getFieldKey(weekId, el) {
    if (!weekId && el.tagName === 'TEXTAREA') return null;

    // For textareas: use the question text from parent container
    if (el.tagName === 'TEXTAREA') {
      // Walk up to find the question wrapper (.bg-white container with a <p> question)
      const container = el.closest('[class*="bg-white"][class*="border"][class*="rounded"]');
      if (container) {
        const questionP = container.querySelector('p[class*="font-medium"]');
        if (questionP) {
          const qText = cleanText(questionP.textContent);
          const key = PREFIX + weekId + '_' + hashStr(qText);
          return key;
        }
      }
      // Fallback: use index within the page
      const allTa = Array.from(document.querySelectorAll('textarea'));
      const idx = allTa.indexOf(el);
      return PREFIX + weekId + '_ta_' + idx;
    }

    // Name input — global (shared across all weeks)
    if (el.tagName === 'INPUT' && el.type === 'text') {
      const label = el.closest('div')?.querySelector('label');
      if (label && label.textContent.includes('Name')) {
        return PREFIX + 'global_name';
      }
      return PREFIX + 'global_input_' + hashStr(el.placeholder || 'unknown');
    }

    // Select — global
    if (el.tagName === 'SELECT') {
      return PREFIX + 'global_section';
    }

    return null;
  }

  // ── Save / Load ────────────────────────────────────────────

  function saveField(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() }));
    } catch (e) {
      LOG('Save error:', e);
    }
  }

  function loadField(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw).v ?? null;
    } catch { return null; }
  }

  // ── Restore ────────────────────────────────────────────────

  function restoreAllFields() {
    const weekId = detectWeek();
    currentWeekId = weekId;
    LOG('Restoring fields for', weekId || '(no week detected)');

    const fields = document.querySelectorAll('textarea, input[type="text"], select');
    let count = 0;

    fields.forEach(el => {
      if (!el.closest('#root')) return;
      if (el.closest('#mgt-autosave-panel')) return;

      const key = getFieldKey(weekId, el);
      if (!key) return;

      const saved = loadField(key);
      if (saved !== null && saved !== '') {
        setValueSafely(el, saved);
        count++;
      } else if (el.tagName === 'TEXTAREA') {
        // Clear stale content from previous week (React reuses DOM elements)
        setValueSafely(el, '');
      }
    });

    if (count > 0) {
      LOG('Restored', count, 'fields');
      showToast(`✓ Restored ${count} field${count > 1 ? 's' : ''}`);
    }

    // Also bind listeners to any new elements
    attachListeners();
    updatePanel();
  }

  /** Set value while trying to be React-compatible */
  function setValueSafely(el, value) {
    // Use native setter to bypass React's synthetic events
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
                : el.tagName === 'SELECT' ? HTMLSelectElement.prototype
                : HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }

    // Fire events so React can (optionally) pick up the change
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── Attach Listeners ──────────────────────────────────────

  function attachListeners() {
    const fields = document.querySelectorAll('textarea, input[type="text"], select');

    fields.forEach(el => {
      if (!el.closest('#root')) return;
      if (el.closest('#mgt-autosave-panel')) return;
      if (boundElements.has(el)) return;

      boundElements.add(el);

      const handler = () => debouncedSave(el);
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  function debouncedSave(el) {
    const weekId = detectWeek() || currentWeekId;
    const key = getFieldKey(weekId, el);
    if (!key) return;

    if (debounceTimers.has(el)) clearTimeout(debounceTimers.get(el));

    updateFabState('saving');

    debounceTimers.set(el, setTimeout(() => {
      saveField(key, el.value);
      debounceTimers.delete(el);
      updateFabState('saved');
      showToast('✓ Saved');
      LOG('Saved', key.substring(PREFIX.length), '→', el.value.substring(0, 40) + '…');
      updatePanel();
    }, DEBOUNCE_MS));
  }

  // ── MutationObserver ───────────────────────────────────────
  // Detects SPA week switches by watching for textareas appearing

  function startObserver() {
    const root = document.querySelector('#root');
    if (!root) {
      setTimeout(startObserver, 500);
      return;
    }

    observer = new MutationObserver(() => {
      // Schedule a restore check — debounced to avoid rapid fire during React renders
      if (!restoreScheduled) {
        restoreScheduled = true;
        setTimeout(() => {
          restoreScheduled = false;

          // Check if we have textareas on the page
          const textareas = document.querySelectorAll('textarea');
          if (textareas.length === 0) return;

          // Check if week changed or if there are unbound textareas
          const newWeek = detectWeek();
          let hasNewElements = false;
          textareas.forEach(el => {
            if (!boundElements.has(el)) hasNewElements = true;
          });

          if (newWeek !== currentWeekId || hasNewElements) {
            LOG('DOM change detected — week:', currentWeekId, '→', newWeek, ', new elements:', hasNewElements);
            restoreAllFields();
          }
        }, 400);
      }
    });

    observer.observe(root, { childList: true, subtree: true });
    LOG('MutationObserver started');
  }

  // ── UI: Floating Ball ──────────────────────────────────────

  function createFab() {
    if (document.getElementById('mgt-autosave-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'mgt-autosave-fab';
    fab.innerHTML = '💾';
    fab.title = 'MGT 3074 Auto-Save';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);
  }

  function updateFabState(state) {
    const fab = document.getElementById('mgt-autosave-fab');
    if (!fab) return;
    fab.classList.remove('saving', 'saved', 'pulse');

    if (state === 'saving') {
      fab.innerHTML = '⏳';
      fab.classList.add('saving');
    } else if (state === 'saved') {
      fab.innerHTML = '✅';
      fab.classList.add('saved', 'pulse');
      setTimeout(() => {
        fab.innerHTML = '💾';
        fab.classList.remove('saving', 'saved', 'pulse');
      }, 2000);
    } else {
      fab.innerHTML = '💾';
    }
  }

  // ── UI: Toast ──────────────────────────────────────────────

  function createToast() {
    if (document.getElementById('mgt-save-toast')) return;
    const t = document.createElement('div');
    t.id = 'mgt-save-toast';
    document.body.appendChild(t);
  }

  function showToast(msg) {
    const t = document.getElementById('mgt-save-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 1800);
  }

  // ── UI: Panel ──────────────────────────────────────────────

  function createPanel() {
    if (document.getElementById('mgt-autosave-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'mgt-autosave-panel';
    panel.innerHTML = `
      <div class="mgt-panel-header">
        <div>📦 Auto-Save Data</div>
        <span id="mgt-panel-total"></span>
      </div>
      <div class="mgt-panel-body" id="mgt-panel-body"></div>
      <div class="mgt-panel-footer">
        <button class="mgt-btn mgt-btn-export" id="mgt-btn-export">📥 Export</button>
        <button class="mgt-btn mgt-btn-clear" id="mgt-btn-clear">🗑️ Clear All</button>
      </div>
      <div class="mgt-panel-credit">Developed by Shimmer</div>
    `;
    document.body.appendChild(panel);

    document.getElementById('mgt-btn-export').addEventListener('click', exportData);
    document.getElementById('mgt-btn-clear').addEventListener('click', clearAllData);
  }

  function togglePanel() {
    const panel = document.getElementById('mgt-autosave-panel');
    if (!panel) return;
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) updatePanel();
  }

  function updatePanel() {
    const body = document.getElementById('mgt-panel-body');
    const totalEl = document.getElementById('mgt-panel-total');
    if (!body) return;

    const weeks = {};
    let total = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(PREFIX)) continue;
      const rest = key.substring(PREFIX.length);
      const match = rest.match(/^(week\d+|global)_/);
      if (!match) continue;
      const w = match[1];
      weeks[w] = (weeks[w] || 0) + 1;
      total++;
    }

    if (totalEl) totalEl.textContent = `${total} items`;

    if (total === 0) {
      body.innerHTML = '<div class="mgt-no-data">No saved data yet.<br>Start typing to auto-save!</div>';
      return;
    }

    const sorted = Object.keys(weeks).sort((a, b) => {
      if (a === 'global') return -1;
      if (b === 'global') return 1;
      return parseInt(a.replace('week', '')) - parseInt(b.replace('week', ''));
    });

    body.innerHTML = sorted.map(w => {
      const label = w === 'global' ? '🔧 Name / Section' : '📄 ' + w.replace('week', 'Week ');
      const active = w === currentWeekId ? ' ← current' : '';
      return `<div class="mgt-week-item">
        <span class="mgt-week-name">${label}${active}</span>
        <div class="mgt-week-actions">
          <span class="mgt-week-count">${weeks[w]} field${weeks[w] > 1 ? 's' : ''}</span>
          <button class="mgt-btn-del" data-week="${w}" title="Delete ${label}">🗑</button>
        </div>
      </div>`;
    }).join('');

    // Wire up per-week delete buttons
    body.querySelectorAll('.mgt-btn-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearWeekData(btn.dataset.week);
      });
    });
  }

  // ── Actions ────────────────────────────────────────────────

  function exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(PREFIX)) continue;
      try { data[key] = JSON.parse(localStorage.getItem(key)); }
      catch { data[key] = localStorage.getItem(key); }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mgt3074_autosave_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Exported!');
  }

  function clearWeekData(weekKey) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX + weekKey + '_')) keys.push(k);
    }
    if (keys.length === 0) { showToast('Nothing to clear'); return; }
    const label = weekKey === 'global' ? 'Name/Section' : weekKey.replace('week', 'Week ');
    if (!confirm(`Delete ${keys.length} saved field(s) for ${label}?`)) return;
    keys.forEach(k => localStorage.removeItem(k));
    updatePanel();
    showToast(`🗑️ ${label} cleared`);
    LOG('Cleared', keys.length, 'fields for', weekKey);
  }

  function clearAllData() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX)) keys.push(k);
    }
    if (keys.length === 0) { showToast('Nothing to clear'); return; }
    if (!confirm(`Delete all ${keys.length} saved fields? This cannot be undone.`)) return;
    keys.forEach(k => localStorage.removeItem(k));
    updatePanel();
    showToast('🗑️ All data cleared');
  }

  // ── Init ───────────────────────────────────────────────────

  function init() {
    LOG('Initializing v2');
    createFab();
    createToast();
    createPanel();

    // Initial restore after React has likely rendered
    setTimeout(() => {
      restoreAllFields();
      startObserver();
    }, 1000);

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(restoreAllFields, 600);
    });

    LOG('Ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
