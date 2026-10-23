// ===== TRACKING AUTOMATION PRO - QUICK-FILTER.JS =====
// نافذة تصفية ياليدين العائمة: تظهر فوق أي صفحة باختصار Ctrl+Shift+S
// تبني النموذج من filter-core.js (نفس وظائف التصفية) وتفتح النتيجة في تبويب جديد

(() => {
  'use strict';
  if (window.__tapQuickFilterLoaded) return;
  window.__tapQuickFilterLoaded = true;

  const isTopFrame = window.top === window.self;

  let host = null;
  let overlay = null;
  let isOpen = false;
  let lastFocus = null;
  let uiReady = null;

  function localFontCss() {
    try {
      const cairo = chrome.runtime.getURL('fonts/Cairo.ttf');
      const mono = chrome.runtime.getURL('fonts/IBMPlexMono-Var.ttf');
      return `
        @font-face{font-family:'Cairo';font-style:normal;font-weight:200 1000;font-display:swap;src:url('${cairo}') format('truetype');}
        @font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:100 700;font-display:swap;src:url('${mono}') format('truetype');}`;
    } catch (_) {
      return `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Cairo:wght@400;500;600;700&display=swap');`;
    }
  }

  function ensureUI() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'tap-ys-quick-filter-host';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        ${localFontCss()}
        .overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483647;
          display: none; justify-content: center; padding-top: 6vh;
          background: rgba(30,41,59,0.45);
          font-family: 'Cairo','Segoe UI',Tahoma,Arial,sans-serif;
        }
        .overlay.show { display: flex; }
        .box {
          width: min(460px, calc(100vw - 32px)); max-height: 88vh;
          background: #ffffff; border: 1px solid #d5dae3; border-radius: 8px; overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 20px 60px rgba(0,0,0,0.22);
          direction: rtl;
          display: flex; flex-direction: column;
          animation: tapPop 0.15s ease;
        }
        @keyframes tapPop { from { opacity: 0; transform: translateY(-8px) scale(0.99); } to { opacity: 1; transform: none; } }
        .head {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 14px 16px; background: #ffffff; border-bottom: 1px solid #d5dae3;
          flex: none;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .logo {
          width: 34px; height: 34px; flex: none;
          background: #dc3545; border-radius: 5px;
          display: flex; align-items: center; justify-content: center; color: #ffffff;
          box-shadow: 0 0 16px rgba(220,53,69,0.25);
        }
        .logo svg { width: 18px; height: 18px; }
        .title { font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: 0.3px; }
        .kbd {
          flex: none; direction: ltr;
          font-family: 'IBM Plex Mono',ui-monospace,Consolas,monospace; font-size: 10px; font-weight: 600;
          background: #eef1f6; border: 1px solid #c8cfd9; border-radius: 4px;
          padding: 2px 8px; color: #475569; white-space: nowrap;
        }
        .body {
          padding: 14px 16px; overflow-y: auto; background: #ffffff;
          scrollbar-width: thin; scrollbar-color: #c8cfd9 transparent;
        }
        .body::-webkit-scrollbar { width: 5px; }
        .body::-webkit-scrollbar-track { background: transparent; }
        .body::-webkit-scrollbar-thumb { background: #c8cfd9; border-radius: 3px; }

        .yf-form { display: flex; flex-direction: column; gap: 12px; }
        .yf-field { display: flex; flex-direction: column; gap: 6px; }
        .yf-field > label { font-size: 11.5px; color: #475569; font-weight: 600; }
        .yf-input {
          width: 100%; background: #f5f7fa; border: 1px solid #d5dae3; border-radius: 5px;
          color: #1e293b; font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; font-size: 12.5px;
          padding: 8px 10px; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .yf-input:focus { border-color: #dc3545; box-shadow: 0 0 0 3px rgba(220,53,69,0.1); }
        .yf-date { direction: ltr; text-align: left; font-family: 'IBM Plex Mono',ui-monospace,Consolas,monospace; }
        .yf-date::-webkit-calendar-picker-indicator { display: none; opacity: 0; pointer-events: none; }
        .yf-date-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
        .yf-date-row .yf-input,
        .yf-date {
          min-width: 0; width: 100%; font-size: 11.5px; padding: 8px 6px;
        }
        .yf-date-row[hidden], .yf-date[hidden] { display: none; }
        /* ---------- كالندار التاريخ ---------- */
        .yf-cal-backdrop { position: fixed; inset: 0; z-index: 2147483647; }
        .yf-cal {
          position: fixed; z-index: 2147483647; width: 262px;
          background: #fff; border: 1px solid #d5dae3; border-radius: 10px;
          box-shadow: 0 16px 48px rgba(15,23,42,0.22); padding: 10px; direction: rtl;
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif;
          animation: yfCalPop 0.14s ease;
        }
        @keyframes yfCalPop {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .yf-cal-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px; }
        .yf-cal-title { font-size: 12.5px; font-weight: 700; color: #1e293b; }
        .yf-cal-nav {
          width: 26px; height: 26px; border: 1px solid #d5dae3; border-radius: 7px;
          background: #f5f7fa; color: #475569; font-size: 15px; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.15s;
        }
        .yf-cal-nav:hover { border-color: #dc3545; color: #dc3545; }
        .yf-cal-dows { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; }
        .yf-cal-dow { font-size: 9.5px; font-weight: 700; color: #8b95a5; text-align: center; padding: 2px 0; }
        .yf-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .yf-cal-day {
          border: 0; background: transparent; height: 30px; border-radius: 7px;
          font-family: 'IBM Plex Mono',ui-monospace,Consolas,monospace; font-size: 11.5px;
          color: #1e293b; cursor: pointer; transition: background 0.12s, color 0.12s;
        }
        .yf-cal-day:hover { background: #eef1f6; }
        .yf-cal-day.today { color: #dc3545; font-weight: 700; box-shadow: inset 0 0 0 1px #dc3545; }
        .yf-cal-day.selected { background: #dc3545; color: #fff; font-weight: 700; }
        .yf-cal-day.selected:hover { background: #dc3545; }
        .yf-cal-day.empty { visibility: hidden; pointer-events: none; }
        .yf-cal-foot { display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #d5dae3; }
        .yf-cal-foot button {
          flex: 1; border: 1px solid #d5dae3; border-radius: 7px; background: #f5f7fa;
          color: #475569; font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; font-size: 11px;
          padding: 6px 4px; cursor: pointer; transition: all 0.15s;
        }
        .yf-cal-foot button:hover { border-color: #dc3545; color: #dc3545; }
        .yf-date-mode { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .yf-dm {
          border: 1px solid #d5dae3; border-radius: 5px; background: #eef1f6; color: #475569;
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; font-size: 12px; padding: 7px; cursor: pointer;
          transition: all 0.15s;
        }
        .yf-dm.active { border-color: rgba(220,53,69,0.5); background: rgba(220,53,69,0.1); color: #dc3545; font-weight: 700; }
        .yf-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .yf-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .yf-action {
          border: 0; background: none; color: #dc3545; font-family: 'Cairo','Segoe UI',Tahoma,sans-serif;
          font-size: 11px; padding: 2px 4px; cursor: pointer; border-radius: 4px; transition: background 0.15s;
        }
        .yf-action:hover { background: rgba(220,53,69,0.1); }
        .yf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .yf-chip {
          position: relative; border: 1px solid #d5dae3; border-radius: 5px; background: #eef1f6;
          color: #475569; font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; font-size: 12px;
          padding: 6px 10px; cursor: pointer; user-select: none;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .yf-chip.selected { background: rgba(220,53,69,0.1); border-color: rgba(220,53,69,0.5); color: #dc3545; font-weight: 700; }
        .yf-status { padding-left: 24px; }
        .yf-status.yf-fav { border-color: rgba(37,99,235,0.38); }
        .yf-status.yf-fav.selected { background: rgba(37,99,235,0.12); border-color: rgba(37,99,235,0.5); color: #2563eb; }
        .yf-star {
          position: absolute; left: 3px; top: 50%; transform: translateY(-50%);
          width: 20px; height: 20px; border: 0; border-radius: 4px; background: transparent;
          color: #94a3b8; opacity: 0; cursor: pointer; font-size: 14px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
        }
        .yf-chip:hover .yf-star, .yf-star:focus-visible, .yf-star.active { opacity: 1; }
        .yf-star.active { color: #d97706; }
        .yf-heading { color: #94a3b8; font-size: 11px; font-weight: 700; }
        .yf-empty { color: #94a3b8; font-size: 11.5px; }
        .yf-details {
          border: 1px solid #d5dae3; border-radius: 5px; background: #f5f7fa; padding: 8px 10px;
        }
        .yf-details summary { color: #475569; cursor: pointer; font-size: 11.5px; font-weight: 700; }
        .yf-details[open] summary { margin-bottom: 8px; }
        .yf-details .yf-chips { max-height: 160px; overflow-y: auto; scrollbar-width: thin; }
        .yf-actions-row { display: flex; gap: 8px; }
        .yf-primary {
          flex: 1; border: 0; border-radius: 5px; background: #dc3545; color: #ffffff;
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; font-size: 13px; font-weight: 700;
          padding: 10px; cursor: pointer; box-shadow: 0 2px 12px rgba(220,53,69,0.25);
          transition: background 0.2s, transform 0.15s;
        }
        .yf-primary:hover { background: #bb2d3b; transform: translateY(-1px); }
        .yf-secondary {
          border: 1px solid #d5dae3; border-radius: 5px; background: #eef1f6; color: #475569;
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; font-size: 13px; font-weight: 600;
          padding: 10px 16px; cursor: pointer; transition: all 0.2s;
        }
        .yf-secondary:hover { background: #e2e6ed; border-color: #c8cfd9; color: #1e293b; }
        .yf-note { font-size: 11.5px; color: #dc2626; }
        .yf-note:empty { display: none; }
        .yf-confirm, .yf-dialog {
          position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
          background: rgba(30,41,59,0.45); padding: 16px;
        }
        .yf-confirm[hidden], .yf-dialog[hidden] { display: none; }
        .yf-confirm-box, .yf-dialog-box {
          width: 100%; max-width: 300px; background: #ffffff; border: 1px solid #d5dae3;
          border-radius: 8px; padding: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .yf-confirm-box h3, .yf-dialog-box h3 {
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; font-size: 13.5px; color: #1e293b; margin-bottom: 8px;
        }
        .yf-confirm-box p { font-size: 12px; color: #475569; margin-bottom: 12px; }
        .yf-dialog-box label { display: block; font-size: 11px; color: #475569; margin: 8px 0 4px; }
        .yf-dialog-err { min-height: 16px; font-size: 11px; color: #dc2626; margin-top: 6px; }
        .yf-dialog-actions { display: flex; gap: 8px; margin-top: 12px; }
        .yf-dialog-actions > * { flex: 1; }
      </style>
      <div class="overlay">
        <div class="box" role="dialog" aria-label="تصفية ياليدين">
          <div class="head">
            <div class="brand">
              <span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg></span>
              <span class="title">تصفية ياليدين</span>
            </div>
            <span class="kbd">Ctrl + Shift + S</span>
          </div>
          <div class="body"></div>
        </div>
      </div>`;
    document.documentElement.appendChild(host);

    overlay = root.querySelector('.overlay');
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (window.TAP_FILTER && window.TAP_FILTER.isCalendarOpen && window.TAP_FILTER.isCalendarOpen()) return;
        close();
      }
      else e.stopPropagation();
    }, false);

    const body = root.querySelector('.body');
    if (window.TAP_FILTER) {
      uiReady = window.TAP_FILTER.createUI(body, {
        open: url => {
          try {
            chrome.runtime.sendMessage({ type: 'OPEN_TABS', urls: [url] }, resp => {
              if (chrome.runtime.lastError || !resp || !resp.success) {
                try { window.open(url, '_blank', 'noopener'); } catch (_) { /* تجاهل */ }
              }
            });
          } catch (_) {
            try { window.open(url, '_blank', 'noopener'); } catch (_) { /* تجاهل */ }
          }
          close();
        },
      });
    }
  }

  function open() {
    ensureUI();
    lastFocus = document.activeElement;
    overlay.classList.add('show');
    isOpen = true;
  }

  function close() {
    if (!host) return;
    overlay.classList.remove('show');
    isOpen = false;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (_) {}
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && (e.code === 'KeyS' || e.key?.toLowerCase() === 's')) {
      if (!isTopFrame) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    } else if (e.key === 'Escape' && isOpen) {
      if (window.TAP_FILTER && window.TAP_FILTER.isCalendarOpen && window.TAP_FILTER.isCalendarOpen()) return;
      close();
    }
  }, true);

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'TOGGLE_FILTER') {
        if (!isTopFrame) return false;
        ensureUI();
        toggle();
        sendResponse({ success: true, open: isOpen });
      }
      return false;
    });
  } catch (_) { /* خارج سياق الإضافة */ }
})();
