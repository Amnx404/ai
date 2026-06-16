"use strict";(()=>{var K=Object.defineProperty;var W=Object.getOwnPropertySymbols;var D=Object.prototype.hasOwnProperty,q=Object.prototype.propertyIsEnumerable;var A=(o,e,t)=>e in o?K(o,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[e]=t,U=(o,e)=>{for(var t in e||(e={}))D.call(e,t)&&A(o,t,e[t]);if(W)for(var t of W(e))q.call(e,t)&&A(o,t,e[t]);return o};var f=(o,e,t)=>A(o,typeof e!="symbol"?e+"":e,t);function _(o){return`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${o};
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --text: #111827;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --shadow: 0 24px 60px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08);
      --radius: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #nudge {
      position: fixed;
      right: 24px;
      bottom: 88px;
      z-index: 999998;
      display: flex;
      max-width: calc(100vw - 32px);
      align-items: center;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      color: var(--text);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
      padding: 10px 10px 10px 12px;
      font-size: 13px;
      font-weight: 650;
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    #nudge.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .nudge-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #close-nudge {
      display: flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }

    #close-nudge:hover {
      border-color: var(--border);
      background: var(--bg-secondary);
      color: var(--text);
    }

    #launcher {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999998;
      display: flex;
      width: 64px;
      height: 64px;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      outline: none;
      animation: float-orb 4s ease-in-out infinite;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      -webkit-tap-highlight-color: transparent;
    }

    @keyframes float-orb {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    #launcher::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -2;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #fff), color-mix(in srgb, var(--primary) 60%, #000), var(--primary));
      background-size: 300% 300%;
      box-shadow: 0 8px 32px color-mix(in srgb, var(--primary) 50%, transparent);
      animation: gradient-spin 6s ease infinite, morph-blob 8s ease-in-out infinite alternate;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    #launcher::after {
      content: '';
      position: absolute;
      inset: 2px;
      z-index: -1;
      border-radius: 50%;
      background: linear-gradient(to bottom right, rgba(255,255,255,0.4), rgba(255,255,255,0.05));
      box-shadow: inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -4px 10px rgba(0,0,0,0.15);
      animation: morph-blob 8s ease-in-out infinite alternate;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes gradient-spin {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes morph-blob {
      0% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
      33% { border-radius: 55% 45% 55% 45% / 45% 55% 45% 55%; }
      66% { border-radius: 45% 55% 45% 55% / 55% 45% 55% 45%; }
      100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
    }

    #launcher:hover {
      animation-play-state: paused;
      transform: scale(1.1) !important;
    }

    #launcher:hover::before,
    #launcher:hover::after {
      border-radius: 20px !important;
      animation-play-state: paused;
    }

    #launcher:hover::before {
      box-shadow: 0 12px 40px color-mix(in srgb, var(--primary) 70%, transparent);
    }

    #launcher:active { transform: scale(0.96) translateY(0) !important; }

    #launcher:focus-visible {
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent);
    }

    #launcher svg {
      width: 28px;
      height: 28px;
      z-index: 10;
      fill: #ffffff;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
    }

    #launcher .icon-chat {
      animation: sparkle-pulse 3s ease-in-out infinite alternate;
    }

    @keyframes sparkle-pulse {
      0% { transform: scale(0.95); filter: drop-shadow(0 0 4px rgba(255,255,255,0.4)); }
      100% { transform: scale(1.05); filter: drop-shadow(0 0 12px rgba(255,255,255,0.9)); }
    }

    #launcher .launcher-logo {
      position: absolute;
      z-index: 10;
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255,255,255,0.6);
      border-radius: 50%;
      background: rgba(255,255,255,0.95);
      object-fit: cover;
      box-shadow: 0 6px 14px rgba(0,0,0,0.18);
      opacity: 1;
      transition: opacity 0.2s ease;
    }

    #launcher .icon-close {
      position: absolute;
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }

    #launcher.open .launcher-logo,
    #launcher.open .icon-chat {
      opacity: 0;
    }

    #launcher.open .icon-chat {
      animation: none;
      transform: rotate(90deg) scale(0.5);
    }

    #launcher.open {
      animation: none !important;
      transform: scale(0.9) !important;
    }

    #launcher.open::before,
    #launcher.open::after {
      border-radius: 50% !important;
      background: var(--bg);
      box-shadow: var(--shadow) !important;
      animation: none !important;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    #launcher.open svg {
      fill: var(--text);
      filter: none;
    }

    #launcher.open .icon-close {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    #panel {
      position: fixed;
      right: 24px;
      bottom: 92px;
      z-index: 999997;
      display: flex;
      width: 392px;
      height: 600px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 116px);
      min-width: 340px;
      min-height: 460px;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(17, 24, 39, 0.1);
      border-radius: 16px;
      background: var(--bg);
      box-shadow: var(--shadow);
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
      transform-origin: bottom right;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    #resize-grip {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 10;
      width: 36px;
      height: 36px;
      border: none;
      border-top-left-radius: 16px;
      background: transparent;
      cursor: nwse-resize;
      opacity: 0.55;
      transition: background 0.2s ease, opacity 0.2s ease;
    }

    #resize-grip:hover {
      background: radial-gradient(circle at top left, rgba(17,24,39,0.08) 40%, transparent 70%);
      opacity: 1;
    }

    #resize-grip::before {
      content: "";
      position: absolute;
      top: 14px;
      left: 14px;
      width: 8px;
      height: 8px;
      border-top: 2px solid rgba(17,24,39,0.42);
      border-left: 2px solid rgba(17,24,39,0.42);
      border-top-left-radius: 2px;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    #resize-grip:hover::before {
      border-color: rgba(17,24,39,0.72);
      transform: translate(-1.5px, -1.5px);
    }

    #panel.open {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0);
    }

    #header {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      background: #ffffff;
      color: var(--text);
      padding: 16px;
    }

    #header-avatar {
      display: flex;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 10px;
      background: color-mix(in srgb, var(--primary) 12%, #ffffff);
      color: var(--primary);
    }

    #header-avatar svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #header-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    #header-info { min-width: 0; flex: 1; }

    #header-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 15px;
      font-weight: 750;
      line-height: 1.25;
      letter-spacing: 0;
    }

    #header-status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.3;
    }

    #status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      flex-shrink: 0;
      border-radius: 999px;
      background: #10b981;
    }

    #status-dot.muted {
      background: #f59e0b;
    }

    #close-btn, #reset-btn {
      display: flex;
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    #close-btn:hover, #reset-btn:hover {
      border-color: var(--border);
      background: var(--bg-secondary);
      color: var(--text);
    }

    #close-btn svg, #reset-btn svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      fill: none;
    }

    #mode-banner {
      display: grid;
      gap: 2px;
      border-bottom: 1px solid #fde68a;
      background: #fffbeb;
      color: #92400e;
      padding: 11px 16px;
      font-size: 12px;
      line-height: 1.45;
    }

    #mode-banner strong {
      color: #78350f;
      font-size: 12px;
    }

    #messages {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 14px;
      overflow-y: auto;
      background: #ffffff;
      padding: 18px;
      scroll-behavior: smooth;
    }

    #messages::-webkit-scrollbar { width: 6px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.16); border-radius: 10px; }
    #messages::-webkit-scrollbar-thumb:hover { background: rgba(17,24,39,0.26); }

    .message {
      display: flex;
      max-width: 86%;
      flex-direction: column;
      gap: 4px;
    }

    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.assistant { align-self: flex-start; align-items: flex-start; }

    .bubble {
      overflow-wrap: anywhere;
      border-radius: 14px;
      box-shadow: none;
      font-size: 14px;
      line-height: 1.55;
      padding: 11px 13px;
      white-space: pre-wrap;
      word-break: normal;
    }

    .message.user .bubble {
      border-bottom-right-radius: 5px;
      background: var(--primary);
      color: #ffffff;
    }

    .message.assistant .bubble {
      border: 1px solid var(--border);
      border-bottom-left-radius: 5px;
      background: var(--bg-secondary);
      color: var(--text);
    }

    .source-list {
      max-width: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      padding: 8px;
    }

    .source-list-title {
      color: var(--text-secondary);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.04em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .source-list-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 7px;
    }

    .source-chip {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 7%, #ffffff);
      color: color-mix(in srgb, var(--primary) 78%, #111827);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.2;
      overflow: hidden;
      padding: 5px 8px;
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-chip:hover {
      border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
      background: color-mix(in srgb, var(--primary) 12%, #ffffff);
      text-decoration: none;
    }

    .intext-source {
      color: var(--primary);
      font-weight: 650;
      text-decoration: none;
    }

    .intext-source:hover { text-decoration: underline; }

    .message-time {
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      padding: 0 4px;
    }

    .sources { display: none; }

    .typing-wrap {
      display: grid;
      gap: 6px;
    }

    .typing {
      display: flex;
      width: fit-content;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--border);
      border-radius: 14px;
      border-bottom-left-radius: 5px;
      background: var(--bg-secondary);
      padding: 12px 14px;
    }

    .typing-label {
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 650;
      padding-left: 4px;
    }

    .typing span {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      animation: bounce 1.4s ease-in-out infinite;
      background: var(--primary);
      opacity: 0.55;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.55; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    #greeting {
      border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
      border-radius: 14px;
      background: color-mix(in srgb, var(--primary) 8%, #ffffff);
      color: var(--text);
      font-size: 14px;
      line-height: 1.55;
      margin: 2px 0;
      padding: 13px 14px;
    }

    #starter-prompts {
      display: grid;
      gap: 8px;
      margin-top: -4px;
    }

    .starter-title {
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.04em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .starter-list {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .starter-prompt {
      max-width: 100%;
      border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
      border-radius: 999px;
      background: #ffffff;
      color: color-mix(in srgb, var(--primary) 76%, var(--text));
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.25;
      overflow: hidden;
      padding: 7px 10px;
      text-align: left;
      text-overflow: ellipsis;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      white-space: nowrap;
    }

    .starter-prompt:hover {
      border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
      background: color-mix(in srgb, var(--primary) 7%, #ffffff);
      color: color-mix(in srgb, var(--primary) 86%, var(--text));
    }

    .starter-prompt:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
    }

    #input-area {
      display: flex;
      flex-shrink: 0;
      align-items: flex-end;
      gap: 10px;
      border-top: 1px solid var(--border);
      background: #ffffff;
      padding: 14px 16px;
    }

    #input {
      flex: 1;
      min-height: 44px;
      max-height: 120px;
      resize: none;
      border: 1px solid var(--border);
      border-radius: 12px;
      outline: none;
      background: #ffffff;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      padding: 11px 12px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    #input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
    }

    #input:disabled {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: not-allowed;
    }

    #input::placeholder { color: var(--text-secondary); }

    #send-btn {
      display: flex;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border: 1px solid color-mix(in srgb, var(--primary) 76%, #000);
      border-radius: 12px;
      background: var(--primary);
      box-shadow: none;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease, opacity 0.15s ease;
    }

    #send-btn:hover {
      transform: translateY(-1px);
    }

    #send-btn:active { transform: translateY(0); }

    #send-btn:disabled {
      border-color: var(--border);
      background: var(--border);
      cursor: not-allowed;
      opacity: 0.72;
      transform: none;
    }

    #send-btn svg {
      width: 18px;
      height: 18px;
      margin-left: -2px;
      fill: none;
      stroke: #ffffff;
    }

    #powered-by {
      flex-shrink: 0;
      background: #ffffff;
      border-top: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      padding: 8px;
      text-align: center;
    }

    #powered-by a {
      color: var(--text-secondary);
      text-decoration: none;
    }

    #powered-by a:hover {
      color: var(--primary);
      text-decoration: underline;
    }

    @media (max-width: 480px) {
      #nudge {
        right: 16px;
        bottom: 80px;
      }

      #panel {
        top: 12px;
        right: 12px;
        bottom: 84px;
        left: 12px;
        width: auto;
        height: auto;
        min-width: 0;
        min-height: 0;
        max-width: none;
        max-height: none;
        border-radius: 16px;
      }

      #launcher {
        right: 16px;
        bottom: 16px;
      }

      #resize-grip {
        display: none;
      }

      .message {
        max-width: 92%;
      }
    }
  `}var L="rr_chat_session",C="rr_chat_messages";function G(o){var t,s;let e=document.querySelectorAll("script[src*='widget.js']");for(let r of e)try{return new URL(r.src).origin}catch(n){}return(s=(t=window.ChatWidget)==null?void 0:t.apiBase)!=null?s:""}function H(o){return new Date(o).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function p(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function R(o){var r;let e=o.trim().replace(/\s+/g," "),s=((r=e.split("|").map(n=>n.trim()).filter(Boolean)[0])!=null?r:e)||"Source";return s.length>32?`${s.slice(0,29)}\u2026`:s}function J(o){try{let e=new URL(o),s=e.pathname.replace(/\/$/,"").split("/").filter(Boolean).pop();return s?`${e.hostname.replace(/^www\./,"")}/${s}`:e.hostname.replace(/^www\./,"")}catch(e){return"Source"}}function X(o){var s;let e=new Set,t=[];for(let r of o!=null?o:[]){let n=(s=r==null?void 0:r.url)==null?void 0:s.trim();!n||e.has(n)||(e.add(n),t.push(r))}return t.slice(0,5)}function j(o){let e=X(o);return e.length?`
    <div class="source-list" aria-label="Pages cited">
      <div class="source-list-title">Pages cited</div>
      <div class="source-list-links">
        ${e.map(t=>{var r;let s=(r=t.title)!=null&&r.trim()?R(t.title):J(t.url);return`<a class="source-chip" href="${p(t.url)}" target="_blank" rel="noopener">${p(s)}</a>`}).join("")}
      </div>
    </div>
  `:""}function F(o){return o.trim().replace(/\s+/g," ").replace(/[?.!]+$/g,"")}function V(o){return o.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function N(o,e){var x;let t=[],s=`__LINK_${Math.random().toString(36).slice(2)}_`,r=i=>{let a=`${s}${t.length}__`;return t.push(i),a},n=o;if(n=n.replace(/\[\[([\s\S]{1,500}?)\]\]+/g,(i,a)=>{var m,w;let h=String(a).trim(),d=h.lastIndexOf("|");if(d<=0)return i;let c=h.slice(0,d).trim().replace(/\s*\|\s*/g," - "),u=h.slice(d+1).trim().match(/https?:\/\/[^\s<>"')\]]+/i),g=(w=(m=u==null?void 0:u[0])==null?void 0:m.trim())!=null?w:"";return!c||!g?"":r(`<a class="intext-source" href="${p(g)}" target="_blank" rel="noopener">${p(c)}</a>`)}),n=n.replace(/\[([^\]]{1,120})\]\(((?:https?):\/\/[^\s<>"')]{1,2048})\)/g,(i,a,h)=>{let d=String(a).trim(),c=String(h).trim();return!d||!c?"":r(`<a class="intext-source" href="${p(c)}" target="_blank" rel="noopener">${p(d)}</a>`)}),n=n.replace(/\bhttps?:\/\/[^\s<>"')]+/gi,i=>r(`<a class="intext-source" href="${p(i)}" target="_blank" rel="noopener">${p(i)}</a>`)),e!=null&&e.length)for(let i of e.slice(0,5)){if(!(i!=null&&i.url))continue;let a=(i.title||"").trim(),h=((x=a.split("|")[0])!=null?x:a).trim(),d=R(a||i.url||"Source"),c=Array.from(new Set([h,a,d].map(g=>g.trim()).filter(Boolean))),u=!1;for(let g of c){let m=new RegExp(`\\b${V(g)}\\b`,"i");if(m.test(n)){n=n.replace(m,r(`<a class="intext-source" href="${p(i.url)}" target="_blank" rel="noopener">${p(g)}</a>`)),u=!0;break}}}let l=p(n);for(let i=0;i<t.length;i++)l=l.replace(`${s}${i}__`,t[i]);return l}var z=class{constructor(e){f(this,"shadow");f(this,"host");f(this,"config",null);f(this,"messages",[]);f(this,"siteId");f(this,"baseUrl");f(this,"previewMode");f(this,"sessionId",null);f(this,"token",null);f(this,"sessionError",null);f(this,"isOpen",!1);f(this,"isStreaming",!1);var t;this.siteId=e,this.baseUrl=G(e),this.previewMode=((t=window.ChatWidget)==null?void 0:t.preview)===!0,this.host=document.createElement("div"),this.host.id="rr-chat-widget",this.host.style.cssText="position:fixed;z-index:999999;",document.body.appendChild(this.host),this.shadow=this.host.attachShadow({mode:"open"}),this.init()}async init(){var s,r;try{let n=new URLSearchParams({siteId:this.siteId});this.previewMode&&n.set("preview","1");let l=await fetch(`${this.baseUrl}/api/v1/widget-config?${n.toString()}`);if(!l.ok){this.host.remove();return}this.config=await l.json()}catch(n){this.config={id:this.siteId,primaryColor:"#6366f1",title:"Alt",greeting:"Hi! How can I help you today?",allowedTopics:[],preview:this.previewMode}}if(!this.host.isConnected)return;let e=(s=sessionStorage.getItem(this.storageKey(L)))!=null?s:this.previewMode?null:sessionStorage.getItem(`${L}:${this.siteId}`);if(e)try{let{sessionId:n,token:l}=JSON.parse(e);this.sessionId=n,this.token=l}catch(n){}let t=(r=sessionStorage.getItem(this.storageKey(C)))!=null?r:this.previewMode?null:sessionStorage.getItem(`${C}:${this.siteId}`);if(t)try{this.messages=JSON.parse(t)}catch(n){}this.render(),this.attachListeners()}storageKey(e){return`${e}:${this.siteId}:${this.previewMode?"preview":"live"}`}isPreviewOnly(){var e;return((e=this.config)==null?void 0:e.preview)===!0&&this.config.isActive===!1}previewBlockedCopy(){var t;let e=(t=this.config)==null?void 0:t.readiness;return e!=null&&e.hasWebsite?e!=null&&e.hasAllowedDomains?e!=null&&e.hasKnowledgeBase?{label:"Draft preview",body:"The widget is ready. Publish it from setup to enable live answer testing.",placeholder:"Publish widget to test answers"}:{label:"Knowledge needed",body:"Add knowledge in setup before this widget can answer questions.",placeholder:"Add knowledge to test answers"}:{label:"Allowed domains needed",body:"Add the website domain in setup before this widget can be published.",placeholder:"Add allowed domain to test answers"}:{label:"Website needed",body:"Set the website URL in setup before this widget can be published.",placeholder:"Set website URL to test answers"}}saveSession(){this.sessionId&&this.token&&sessionStorage.setItem(this.storageKey(L),JSON.stringify({sessionId:this.sessionId,token:this.token})),sessionStorage.setItem(this.storageKey(C),JSON.stringify(this.messages))}render(){var a,h,d,c,u,g,m,w,S,M,T,b;let e=(h=(a=this.config)==null?void 0:a.primaryColor)!=null?h:"#6366f1",t=(g=(u=(d=this.config)==null?void 0:d.logoUrl)!=null?u:(c=window.ChatWidget)==null?void 0:c.pageIconUrl)!=null?g:null,s=(w=(m=this.config)==null?void 0:m.title)!=null?w:"Alt",r=this.isPreviewOnly(),n=this.previewBlockedCopy(),l=r?"Preview only":(S=this.config)!=null&&S.preview?"Preview":"Online",x=r?"Preview widget":"Ask a question",i=r?n.placeholder:"Ask a question";this.shadow.innerHTML=`
      <style>${_(e)}</style>

      <div id="nudge">
        <div class="nudge-text">${p(x)}</div>
        <button id="close-nudge" aria-label="Close nudge">&times;</button>
      </div>

      <button id="launcher" aria-label="Open chat" title="Open chat">
        ${t?`<img class="launcher-logo" alt="" src="${p(t)}" onerror="this.remove()" />`:""}
        <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.053 2.524a1 1 0 0 1 1.894 0l2.06 6.513a1 1 0 0 0 .629.629l6.513 2.06a1 1 0 0 1 0 1.894l-6.513 2.06a1 1 0 0 0-.629.629l-2.06 6.513a1 1 0 0 1-1.894 0l-2.06-6.513a1 1 0 0 0-.629-.629l-6.513-2.06a1 1 0 0 1 0-1.894l6.513-2.06a1 1 0 0 0 .629-.629l2.06-6.513z"/>
          <path d="M19.553 1.524a.5.5 0 0 1 .894 0l.76 2.413a.5.5 0 0 0 .329.329l2.413.76a.5.5 0 0 1 0 .894l-2.413.76a.5.5 0 0 0-.329.329l-.76 2.413a.5.5 0 0 1-.894 0l-.76-2.413a.5.5 0 0 0-.329-.329l-2.413-.76a.5.5 0 0 1 0-.894l2.413-.76a.5.5 0 0 0 .329-.329l.76-2.413z"/>
        </svg>
        <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <div id="panel" role="dialog" aria-label="Chat window">
        <button id="resize-grip" aria-label="Resize chat window" title="Resize"></button>
        <div id="header">
          <div id="header-avatar">
            <svg class="header-default-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
            ${(M=this.config)!=null&&M.logoUrl?`<img alt="Logo" src="${p(this.config.logoUrl)}" onerror="this.remove()" />`:""}
          </div>
          <div id="header-info">
            <div id="header-title">${p(s)}</div>
            <div id="header-status">
              <span id="status-dot" class="${r?"muted":""}"></span>
              <span>${l}</span>
            </div>
          </div>
          <button id="reset-btn" aria-label="Reset chat" title="Reset chat">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
          <button id="close-btn" aria-label="Close chat">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        ${r?`<div id="mode-banner"><strong>${p(n.label)}</strong><span> ${p(n.body)}</span></div>`:""}

        <div id="messages" aria-live="polite" aria-atomic="false">
          ${this.renderGreeting()}
          ${this.renderStarterPrompts()}
          ${this.messages.map(v=>this.renderMessage(v)).join("")}
        </div>

        <div id="input-area">
          <textarea
            id="input"
            placeholder="${p(i)}"
            rows="1"
            aria-label="Message input"
            ${r?"disabled":""}
          ></textarea>
          <button id="send-btn" aria-label="Send message" ${r?"disabled":""}>
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div id="powered-by">
          <a href="${p((b=(T=this.config)==null?void 0:T.appUrl)!=null?b:this.baseUrl)}" target="_blank" rel="noopener">
            Powered by Alt Ego Labs
          </a>
        </div>
      </div>
    `}renderGreeting(){var e;return!((e=this.config)!=null&&e.greeting)||this.messages.length>0?"":`<div id="greeting">${p(this.config.greeting)}</div>`}starterPrompts(){var s,r;let e=((r=(s=this.config)==null?void 0:s.allowedTopics)!=null?r:[]).map(F).filter(Boolean).slice(0,3).map(n=>`What should I know about ${n}?`),t=["What can you help me with?","What are the most important details?","Where should I get started?"];return Array.from(new Set([...e,...t])).slice(0,3)}renderStarterPrompts(){if(this.messages.length>0||this.isPreviewOnly())return"";let e=this.starterPrompts();return e.length?`
      <div id="starter-prompts" aria-label="Suggested questions">
        <div class="starter-title">Try asking</div>
        <div class="starter-list">
          ${e.map(t=>`
                <button type="button" class="starter-prompt" data-starter-prompt="${p(t)}">
                  ${p(t)}
                </button>
              `).join("")}
        </div>
      </div>
    `:""}renderMessage(e){return`
      <div class="message ${e.role}">
        <div class="bubble">${e.role==="assistant"?N(e.content,e.sources):p(e.content)}</div>
        ${e.role==="assistant"?j(e.sources):""}
        <div class="message-time">${H(e.ts)}</div>
      </div>
    `}appendMessageToDOM(e,t){let s=document.createElement("div");s.className=`message ${e.role}`,t&&(s.id=t),s.innerHTML=`
      <div class="bubble">${p(e.content)}</div>
      <div class="message-time">${H(e.ts)}</div>
    `;let r=this.shadow.getElementById("messages");return r==null||r.appendChild(s),this.scrollToBottom(),s}showTyping(){var t;let e=document.createElement("div");return e.className="message assistant",e.id="typing-indicator",e.innerHTML=`
      <div class="typing-wrap">
        <div class="typing" aria-label="Assistant is checking knowledge">
          <span></span><span></span><span></span>
        </div>
        <div class="typing-label">Checking knowledge</div>
      </div>
    `,(t=this.shadow.getElementById("messages"))==null||t.appendChild(e),this.scrollToBottom(),e}scrollToBottom(){let e=this.shadow.getElementById("messages");e&&(e.scrollTop=e.scrollHeight)}attachListeners(){let e=this.shadow.getElementById("launcher"),t=this.shadow.getElementById("reset-btn"),s=this.shadow.getElementById("close-btn"),r=this.shadow.getElementById("panel"),n=this.shadow.getElementById("resize-grip"),l=this.shadow.getElementById("input"),x=this.shadow.getElementById("send-btn"),i=this.shadow.getElementById("nudge"),a=this.shadow.getElementById("close-nudge"),h=this.shadow.getElementById("messages");setTimeout(()=>{!this.isOpen&&i&&i.classList.add("visible")},3e3),a==null||a.addEventListener("click",d=>{d.stopPropagation(),i==null||i.classList.remove("visible")}),e.addEventListener("click",()=>{i==null||i.classList.remove("visible"),this.toggle()}),t==null||t.addEventListener("click",()=>this.resetChat()),s.addEventListener("click",()=>this.close()),l.addEventListener("keydown",d=>{d.key==="Enter"&&!d.shiftKey&&(d.preventDefault(),this.sendMessage())}),l.addEventListener("input",()=>{l.style.height="auto",l.style.height=`${Math.min(l.scrollHeight,120)}px`}),h==null||h.addEventListener("click",d=>{var m;let c=d.target instanceof HTMLElement?d.target:null,u=c==null?void 0:c.closest("[data-starter-prompt]");if(!u||this.isPreviewOnly())return;let g=(m=u.getAttribute("data-starter-prompt"))!=null?m:"";g.trim()&&(l.value=g,l.dispatchEvent(new Event("input",{bubbles:!0})),l.focus())}),x.addEventListener("click",()=>void this.sendMessage()),n&&n.addEventListener("pointerdown",d=>{d.preventDefault(),n.setPointerCapture(d.pointerId);let c=r.getBoundingClientRect().width,u=r.getBoundingClientRect().height,g=d.clientX,m=d.clientY,w=340,S=460,M=Math.min(window.innerWidth-32,720),T=Math.min(window.innerHeight-120,900),b=B=>{let I=B.clientX-g,$=B.clientY-m,y=Math.max(w,Math.min(M,c-I)),k=Math.max(S,Math.min(T,u-$));r.style.width=`${Math.round(y)}px`,r.style.height=`${Math.round(k)}px`},v=()=>{window.removeEventListener("pointermove",b),window.removeEventListener("pointerup",v)};window.addEventListener("pointermove",b),window.addEventListener("pointerup",v,{once:!0})})}toggle(){this.isOpen?this.close():this.open()}open(){var t;this.isOpen=!0;let e=this.shadow.getElementById("launcher");e==null||e.classList.add("open"),e==null||e.setAttribute("aria-label","Close chat"),e==null||e.setAttribute("title","Close chat"),(t=this.shadow.getElementById("panel"))==null||t.classList.add("open"),this.isPreviewOnly()||setTimeout(()=>{var s;(s=this.shadow.getElementById("input"))==null||s.focus()},250),this.scrollToBottom()}close(){var t;this.isOpen=!1;let e=this.shadow.getElementById("launcher");e==null||e.classList.remove("open"),e==null||e.setAttribute("aria-label","Open chat"),e==null||e.setAttribute("title","Open chat"),(t=this.shadow.getElementById("panel"))==null||t.classList.remove("open")}async ensureSession(){var e;if(!(this.sessionId&&this.token)){this.sessionError=null;try{let t=await fetch(`${this.baseUrl}/api/v1/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId})});if(t.ok){let r=await t.json();this.sessionId=r.sessionId,this.token=r.token,this.saveSession();return}let s=await t.json().catch(()=>null);this.sessionError=(e=s==null?void 0:s.error)!=null?e:"Widget session could not be created."}catch(t){this.sessionError="Widget session could not be created."}}}async sendMessage(){var h,d,c,u,g,m,w,S,M,T;if(this.isStreaming||this.isPreviewOnly())return;let e=this.shadow.getElementById("input"),t=this.shadow.getElementById("send-btn"),s=e.value.trim();if(!s)return;e.value="",e.style.height="auto",(h=this.shadow.getElementById("greeting"))==null||h.remove(),(d=this.shadow.getElementById("starter-prompts"))==null||d.remove();let r={role:"user",content:s,ts:Date.now()};this.messages.push(r),this.appendMessageToDOM(r),this.isStreaming=!0,t.disabled=!0,await this.ensureSession();let n=this.showTyping(),l="",x={role:"assistant",content:"",ts:Date.now()},i=null,a=null;try{if(!this.sessionId||!this.token)throw new Error((c=this.sessionError)!=null?c:"Widget session could not be created.");let b=await fetch(`${this.baseUrl}/api/v1/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,messages:this.messages.slice(-10).map(({role:$,content:y,sources:k})=>U({role:$,content:y},k!=null&&k.length?{sources:k}:{})),sessionId:this.sessionId,token:this.token,stream:!0})});if(!b.ok||!b.body){let $=await b.text().catch(()=>""),y=(u=$.match(/"message"\s*:\s*"([^"]+)"/))!=null?u:$.match(/"error"\s*:\s*"([^"]+)"/);throw new Error((g=y==null?void 0:y[1])!=null?g:"Chat request failed.")}let v=b.body.getReader(),B=new TextDecoder,I="";for(n.remove(),i=document.createElement("div"),i.className="message assistant",a=document.createElement("div"),a.className="bubble",i.appendChild(a),(m=this.shadow.getElementById("messages"))==null||m.appendChild(i);;){let{done:$,value:y}=await v.read();if($)break;I+=B.decode(y,{stream:!0});let k=I.split(`
`);I=(w=k.pop())!=null?w:"";for(let O of k){if(!O.startsWith("data: "))continue;let P=O.slice(6).trim();if(P!=="[DONE]")try{let E=JSON.parse(P);E.type==="token"&&E.content?(l+=E.content,a.textContent=l,this.scrollToBottom()):E.type==="sources"&&E.sources?x.sources=E.sources:E.type==="error"&&(l=((S=E.message)==null?void 0:S.trim())||"Sorry, something went wrong. Please try again.",a.textContent=l,this.scrollToBottom())}catch(E){}}}}catch(b){n.remove();let v=b instanceof Error?b.message:"";l=/domain not allowed|origin header|required|session/i.test(v)?"This widget is not enabled for this domain yet. Update the allowed domains in setup, then try again.":"Sorry, I couldn't connect. Please try again.",i||(i=document.createElement("div"),i.className="message assistant",a=document.createElement("div"),a.className="bubble",i.appendChild(a),(M=this.shadow.getElementById("messages"))==null||M.appendChild(i)),a&&(a.textContent=l)}finally{if(i){a&&(a.innerHTML=N(l,x.sources));let b=j(x.sources);if(b){let B=document.createElement("div");B.innerHTML=b.trim();let I=B.firstElementChild;I&&i.appendChild(I)}let v=document.createElement("div");v.className="message-time",v.textContent=H(Date.now()),i.appendChild(v)}x.content=l,this.messages.push(x),this.saveSession(),this.scrollToBottom(),this.isStreaming=!1,t.disabled=!1,(T=this.shadow.getElementById("input"))==null||T.focus()}}resetChat(){if(this.isStreaming)return;this.messages=[],this.sessionId=null,this.token=null,sessionStorage.removeItem(this.storageKey(L)),sessionStorage.removeItem(this.storageKey(C)),sessionStorage.removeItem(`${L}:${this.siteId}`),sessionStorage.removeItem(`${C}:${this.siteId}`);let e=this.shadow.getElementById("messages");e&&(e.innerHTML=`${this.renderGreeting()}${this.renderStarterPrompts()}`),this.scrollToBottom()}};function Y(){let o=window.ChatWidget;if(!(o!=null&&o.siteId)){console.warn("[ALT EGO LABS] window.ChatWidget.siteId is required");return}new z(o.siteId)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Y):Y();})();
