"use strict";(()=>{var N=Object.defineProperty;var z=Object.getOwnPropertySymbols;var A=Object.prototype.hasOwnProperty,Y=Object.prototype.propertyIsEnumerable;var S=(r,e,t)=>e in r?N(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t,H=(r,e)=>{for(var t in e||(e={}))A.call(e,t)&&S(r,t,e[t]);if(z)for(var t of z(e))Y.call(e,t)&&S(r,t,e[t]);return r};var u=(r,e,t)=>S(r,typeof e!="symbol"?e+"":e,t);function _(r){return`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${r};
      --primary-dark: color-mix(in srgb, ${r} 80%, #000);
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --text: #111827;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 6px rgba(0,0,0,0.08);
      --radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Nudge tooltip */
    #nudge {
      position: fixed;
      bottom: 100px;
      right: 32px;
      background: #ffffff;
      color: #111827;
      padding: 14px 20px;
      border-radius: 20px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
      font-size: 15px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      transform: translateY(16px) scale(0.9);
      pointer-events: none;
      transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 999998;
      transform-origin: bottom right;
      border: 1px solid rgba(0,0,0,0.05);
    }

    #nudge::after {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 18px;
      width: 14px;
      height: 14px;
      background: #ffffff;
      transform: rotate(45deg);
      border-right: 1px solid rgba(0,0,0,0.05);
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }

    #nudge.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
      animation: float-nudge 4s ease-in-out infinite 1s;
    }

    @keyframes float-nudge {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    .nudge-text {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .wave {
      display: inline-block;
      animation: wave 2.5s infinite;
      transform-origin: 70% 70%;
      font-size: 18px;
    }

    @keyframes wave {
      0%, 100% { transform: rotate(0deg); }
      10% { transform: rotate(14deg); }
      20% { transform: rotate(-8deg); }
      30% { transform: rotate(14deg); }
      40% { transform: rotate(-4deg); }
      50% { transform: rotate(10deg); }
      60% { transform: rotate(0deg); }
    }

    #close-nudge {
      background: rgba(0,0,0,0.04);
      border: none;
      color: #6b7280;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    #close-nudge:hover {
      background: rgba(0,0,0,0.08);
      color: #111827;
    }

    /* Launcher button */
    #launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 64px;
      height: 64px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 999998;
      outline: none;
      background: transparent;
      border-radius: 50%;
      animation: float-orb 4s ease-in-out infinite;
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
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #fff), color-mix(in srgb, var(--primary) 60%, #000), var(--primary));
      background-size: 300% 300%;
      animation: gradient-spin 6s ease infinite, morph-blob 8s ease-in-out infinite alternate;
      z-index: -2;
      box-shadow: 0 8px 32px color-mix(in srgb, var(--primary) 50%, transparent);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    #launcher::after {
      content: '';
      position: absolute;
      inset: 2px;
      border-radius: 50%;
      background: linear-gradient(to bottom right, rgba(255,255,255,0.4), rgba(255,255,255,0.05));
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -4px 10px rgba(0,0,0,0.15);
      animation: morph-blob 8s ease-in-out infinite alternate;
      z-index: -1;
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
      transform: scale(1.1) !important;
      animation-play-state: paused;
    }

    #launcher:hover::before, #launcher:hover::after {
      border-radius: 20px !important;
      animation-play-state: paused;
    }
    
    #launcher:hover::before {
      box-shadow: 0 12px 40px color-mix(in srgb, var(--primary) 70%, transparent);
    }

    #launcher:active { transform: scale(0.96) translateY(0) !important; }

    #launcher svg {
      width: 28px;
      height: 28px;
      fill: #fff;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      z-index: 10;
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
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.95);
      border: 1px solid rgba(255,255,255,0.6);
      object-fit: cover;
      box-shadow: 0 6px 14px rgba(0,0,0,0.18);
      opacity: 1;
      transition: opacity 0.2s ease;
      z-index: 10;
    }

    #launcher.open .launcher-logo {
      opacity: 0;
    }

    #launcher .icon-close {
      position: absolute;
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }

    #launcher.open .icon-chat {
      opacity: 0;
      transform: rotate(90deg) scale(0.5);
      animation: none;
    }

    #launcher.open {
      animation: none !important;
      transform: scale(0.9) !important;
    }
    
    #launcher.open::before, #launcher.open::after {
      animation: none !important;
      border-radius: 50% !important;
      background: var(--bg);
      box-shadow: var(--shadow) !important;
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

    /* Chat panel */
    #panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 392px;
      height: 600px;
      max-height: calc(100vh - 120px);
      max-width: calc(100vw - 32px);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 24px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 340px;
      min-height: 460px;
      z-index: 999997;
      transform-origin: bottom right;
      transform: scale(0.85) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
    }

    /* Top-left resize grip */
    #resize-grip {
      position: absolute;
      top: 0;
      left: 0;
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      cursor: nwse-resize;
      opacity: 0.5;
      z-index: 10;
      border-top-left-radius: 24px;
      transition: opacity 0.2s;
    }

    #resize-grip:hover {
      opacity: 1;
      background: radial-gradient(circle at top left, rgba(0,0,0,0.06) 40%, transparent 70%);
    }

    #resize-grip::before {
      content: "";
      position: absolute;
      top: 14px;
      left: 14px;
      width: 8px;
      height: 8px;
      border-top: 2px solid rgba(0,0,0,0.4);
      border-left: 2px solid rgba(0,0,0,0.4);
      border-top-left-radius: 2px;
      transition: transform 0.2s;
    }

    #resize-grip:hover::before {
      border-color: rgba(0,0,0,0.7);
      transform: translate(-1.5px, -1.5px);
    }

    #panel.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* Header */
    #header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 20px;
      background: rgba(255, 255, 255, 0.5);
      border-bottom: 1px solid rgba(0,0,0,0.06);
      color: var(--text);
      flex-shrink: 0;
    }

    #header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), #ec4899);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      border: 2px solid #fff;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent);
    }

    #header-avatar svg { width: 20px; height: 20px; fill: #fff; }
    #header-avatar img { width: 100%; height: 100%; object-fit: cover; }

    #header-info { flex: 1; min-width: 0; }

    #header-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #header-status {
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }

    #status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
    }

    #close-btn, #reset-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      color: var(--text-secondary);
      display: flex;
      border-radius: 10px;
      transition: all 0.2s;
    }

    #close-btn:hover, #reset-btn:hover { background: rgba(0,0,0,0.05); color: var(--text); }
    #close-btn svg, #reset-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; }

    /* Messages */
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
      background: transparent;
    }

    #messages::-webkit-scrollbar { width: 6px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    #messages::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 85%;
      gap: 4px;
    }

    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.assistant { align-self: flex-start; align-items: flex-start; }

    .bubble {
      padding: 12px 16px;
      border-radius: 18px;
      font-size: 14.5px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .message.user .bubble {
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #ec4899));
      color: #fff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 20%, transparent);
    }

    .message.assistant .bubble {
      background: #ffffff;
      color: var(--text);
      border: 1px solid rgba(0,0,0,0.06);
      border-bottom-left-radius: 4px;
    }

    .intext-source {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }

    .intext-source:hover { text-decoration: underline; }

    .message-time {
      font-size: 11px;
      color: var(--text-secondary);
      padding: 0 6px;
      font-weight: 500;
    }

    /* Sources (legacy block, should no longer render) */
    .sources { display: none; }

    /* Typing indicator */
    .typing {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 14px 18px;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.06);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      border-radius: 18px;
      border-bottom-left-radius: 4px;
      width: fit-content;
    }

    .typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      display: inline-block;
      animation: bounce 1.4s ease-in-out infinite;
      opacity: 0.6;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* Greeting card */
    #greeting {
      padding: 16px 20px;
      background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 60%, #8b5cf6) 100%);
      color: #fff;
      border-radius: 16px;
      margin: 8px 0;
      font-size: 14.5px;
      line-height: 1.6;
      box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 30%, transparent);
    }

    /* Input area */
    #input-area {
      padding: 14px 20px;
      border-top: 1px solid rgba(0,0,0,0.06);
      display: flex;
      gap: 10px;
      align-items: flex-end;
      background: rgba(255,255,255,0.6);
      flex-shrink: 0;
    }

    #input {
      flex: 1;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 24px;
      padding: 12px 18px;
      font-size: 14.5px;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.5;
      max-height: 120px;
      min-height: 46px;
      color: var(--text);
      background: #ffffff;
      transition: all 0.2s;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    }

    #input:focus { 
      border-color: var(--primary); 
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent), inset 0 2px 4px rgba(0,0,0,0.02);
    }
    
    #input::placeholder { color: var(--text-secondary); }

    #send-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent);
      margin-bottom: 1px;
    }

    #send-btn:hover { 
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #ec4899));
      transform: translateY(-2px);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 40%, transparent);
    }
    
    #send-btn:active { transform: scale(0.92) translateY(0); }
    #send-btn:disabled { 
      background: var(--border); 
      box-shadow: none; 
      opacity: 0.5; 
      cursor: not-allowed; 
      transform: none; 
    }
    
    #send-btn svg { width: 18px; height: 18px; stroke: #fff; fill: none; margin-left: -2px; }

    /* Powered by */
    #powered-by {
      text-align: center;
      font-size: 10px;
      color: var(--text-secondary);
      padding: 4px 8px 5px;
      background: rgba(255,255,255,0.6);
      flex-shrink: 0;
      font-weight: 400;
      line-height: 1.2;
      opacity: 0.75;
    }

    #powered-by a {
      color: var(--primary);
      text-decoration: none;
      opacity: 0.78;
    }

    #privacy-note {
      margin-top: 1px;
      font-size: 9px;
      line-height: 1.15;
      color: color-mix(in srgb, var(--text-secondary) 65%, #ffffff);
      font-weight: 400;
      opacity: 0.62;
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      #panel {
        bottom: 0;
        right: 0;
        width: 100%;
        max-width: 100%;
        height: 85vh;
        max-height: 85vh;
        border-radius: var(--radius) var(--radius) 0 0;
      }

      #launcher {
        bottom: 16px;
        right: 16px;
      }
    }
  `}var $="rr_chat_session",C="rr_chat_messages",j=28e3;function U(r){return r.replace(/\u0000/g,"").replace(/\s+/g," ").trim()}function R(r){var n;let e=window.ChatWidget;if(typeof(e==null?void 0:e.pageContent)=="string"&&e.pageContent.trim())return U(e.pageContent).slice(0,r);let t=[];for(let s of["main","article",'[role="main"]']){let a=document.querySelector(s);a instanceof HTMLElement&&t.push(a)}document.body instanceof HTMLElement&&t.push(document.body);for(let s of t){let a=U((n=s.innerText)!=null?n:"");if(a.length>80)return a.slice(0,r)}return""}function D(r){var t,n;let e=document.querySelectorAll("script[src*='widget.js']");for(let s of e)try{return new URL(s.src).origin}catch(a){}return(n=(t=window.ChatWidget)==null?void 0:t.apiBase)!=null?n:""}function B(r){return new Date(r).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function p(r){return r.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function G(r){var s;let e=r.trim().replace(/\s+/g," "),n=((s=e.split("|").map(a=>a.trim()).filter(Boolean)[0])!=null?s:e)||"Source";return n.length>32?`${n.slice(0,29)}\u2026`:n}function J(r){return r.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function O(r,e){var h;let t=[],n=`__LINK_${Math.random().toString(36).slice(2)}_`,s=i=>{let o=`${n}${t.length}__`;return t.push(i),o},a=r;if(a=a.replace(/\[([^\]]{1,120})\]\(((?:https?):\/\/[^\s<>"')]{1,2048})\)/g,(i,o,l)=>{let c=String(o).trim(),g=String(l).trim();return!c||!g?"":s(`<a class="intext-source" href="${p(g)}" target="_blank" rel="noopener">${p(c)}</a>`)}),a=a.replace(/\[\[([^\]|]{1,120})\|((?:https?):\/\/[^\s<>"']{1,2048})\]\]/g,(i,o,l)=>{let c=String(o).trim(),g=String(l).trim();return!c||!g?"":s(`<a class="intext-source" href="${p(g)}" target="_blank" rel="noopener">${p(c)}</a>`)}),a=a.replace(/\bhttps?:\/\/[^\s<>"')]+/gi,i=>s(`<a class="intext-source" href="${p(i)}" target="_blank" rel="noopener">${p(i)}</a>`)),e!=null&&e.length)for(let i of e.slice(0,5)){if(!(i!=null&&i.url))continue;let o=(i.title||"").trim(),l=((h=o.split("|")[0])!=null?h:o).trim(),c=G(o||i.url||"Source"),g=Array.from(new Set([l,o,c].map(b=>b.trim()).filter(Boolean))),x=!1;for(let b of g){let m=new RegExp(`\\b${J(b)}\\b`,"i");if(m.test(a)){a=a.replace(m,s(`<a class="intext-source" href="${p(i.url)}" target="_blank" rel="noopener">${p(b)}</a>`)),x=!0;break}}}let d=p(a);for(let i=0;i<t.length;i++)d=d.replace(`${n}${i}__`,t[i]);return d}var T=class{constructor(e){u(this,"shadow");u(this,"host");u(this,"config",null);u(this,"messages",[]);u(this,"siteId");u(this,"baseUrl");u(this,"sessionId",null);u(this,"token",null);u(this,"isOpen",!1);u(this,"isStreaming",!1);this.siteId=e,this.baseUrl=D(e),this.host=document.createElement("div"),this.host.id="rr-chat-widget",this.host.style.cssText="position:fixed;z-index:999999;",document.body.appendChild(this.host),this.shadow=this.host.attachShadow({mode:"closed"}),this.init()}async init(){try{let n=await fetch(`${this.baseUrl}/api/v1/widget-config?siteId=${this.siteId}`);if(!n.ok){n.status===404&&this.host.remove();return}this.config=await n.json()}catch(n){this.config={id:this.siteId,primaryColor:"#6366f1",title:"Alt",greeting:"Hi! How can I help you today?",allowedTopics:[]}}if(!this.host.isConnected)return;let e=sessionStorage.getItem(`${$}:${this.siteId}`);if(e)try{let{sessionId:n,token:s}=JSON.parse(e);this.sessionId=n,this.token=s}catch(n){}let t=sessionStorage.getItem(`${C}:${this.siteId}`);if(t)try{this.messages=JSON.parse(t)}catch(n){}this.render(),this.attachListeners()}saveSession(){this.sessionId&&this.token&&sessionStorage.setItem(`${$}:${this.siteId}`,JSON.stringify({sessionId:this.sessionId,token:this.token})),sessionStorage.setItem(`${C}:${this.siteId}`,JSON.stringify(this.messages))}render(){var n,s,a,d,h,i,o,l,c,g,x;let e=(s=(n=this.config)==null?void 0:n.primaryColor)!=null?s:"#6366f1",t=(i=(h=(a=this.config)==null?void 0:a.logoUrl)!=null?h:(d=window.ChatWidget)==null?void 0:d.pageIconUrl)!=null?i:null;this.shadow.innerHTML=`
      <style>${_(e)}</style>

      <div id="nudge">
        <div class="nudge-text">Got questions? Chat with me! <span class="wave">\u{1F44B}</span></div>
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
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            ${(o=this.config)!=null&&o.logoUrl?`<img alt="Logo" src="${p(this.config.logoUrl)}" onerror="this.remove()" />`:""}
          </div>
          <div id="header-info">
            <div id="header-title">${p((c=(l=this.config)==null?void 0:l.title)!=null?c:"Alt")}</div>
            <div id="header-status">
              <span id="status-dot"></span>
              <span>Online</span>
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

        <div id="messages" aria-live="polite" aria-atomic="false">
          ${this.renderGreeting()}
          ${this.messages.map(b=>this.renderMessage(b)).join("")}
        </div>

        <div id="input-area">
          <textarea
            id="input"
            placeholder="Ask a question\u2026"
            rows="1"
            aria-label="Message input"
          ></textarea>
          <button id="send-btn" aria-label="Send message">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div id="powered-by">
          <a href="${p((x=(g=this.config)==null?void 0:g.appUrl)!=null?x:this.baseUrl)}" target="_blank" rel="noopener">
            Powered by Alt Ego Labs
          </a>
          <div id="privacy-note">Please avoid sharing sensitive personal information.</div>
        </div>
      </div>
    `}renderGreeting(){var e;return!((e=this.config)!=null&&e.greeting)||this.messages.length>0?"":`<div id="greeting">${p(this.config.greeting)}</div>`}renderMessage(e){return`
      <div class="message ${e.role}">
        <div class="bubble">${e.role==="assistant"?O(e.content,e.sources):p(e.content)}</div>
        <div class="message-time">${B(e.ts)}</div>
      </div>
    `}appendMessageToDOM(e,t){let n=document.createElement("div");n.className=`message ${e.role}`,t&&(n.id=t),n.innerHTML=`
      <div class="bubble">${p(e.content)}</div>
      <div class="message-time">${B(e.ts)}</div>
    `;let s=this.shadow.getElementById("messages");return s==null||s.appendChild(n),this.scrollToBottom(),n}showTyping(){var t;let e=document.createElement("div");return e.className="message assistant",e.id="typing-indicator",e.innerHTML='<div class="typing"><span></span><span></span><span></span></div>',(t=this.shadow.getElementById("messages"))==null||t.appendChild(e),this.scrollToBottom(),e}scrollToBottom(){let e=this.shadow.getElementById("messages");e&&(e.scrollTop=e.scrollHeight)}attachListeners(){let e=this.shadow.getElementById("launcher"),t=this.shadow.getElementById("reset-btn"),n=this.shadow.getElementById("close-btn"),s=this.shadow.getElementById("panel"),a=this.shadow.getElementById("resize-grip"),d=this.shadow.getElementById("input"),h=this.shadow.getElementById("send-btn"),i=this.shadow.getElementById("nudge"),o=this.shadow.getElementById("close-nudge");setTimeout(()=>{!this.isOpen&&i&&i.classList.add("visible")},3e3),o==null||o.addEventListener("click",l=>{l.stopPropagation(),i==null||i.classList.remove("visible")}),e.addEventListener("click",()=>{i==null||i.classList.remove("visible"),this.toggle()}),t==null||t.addEventListener("click",()=>this.resetChat()),n.addEventListener("click",()=>this.close()),d.addEventListener("keydown",l=>{l.key==="Enter"&&!l.shiftKey&&(l.preventDefault(),this.sendMessage())}),d.addEventListener("input",()=>{d.style.height="auto",d.style.height=`${Math.min(d.scrollHeight,120)}px`}),h.addEventListener("click",()=>void this.sendMessage()),a&&a.addEventListener("pointerdown",l=>{l.preventDefault(),a.setPointerCapture(l.pointerId);let c=s.getBoundingClientRect().width,g=s.getBoundingClientRect().height,x=l.clientX,b=l.clientY,m=340,M=460,L=Math.min(window.innerWidth-32,720),k=Math.min(window.innerHeight-120,900),w=f=>{let E=f.clientX-x,I=f.clientY-b,v=Math.max(m,Math.min(L,c-E)),W=Math.max(M,Math.min(k,g-I));s.style.width=`${Math.round(v)}px`,s.style.height=`${Math.round(W)}px`},y=()=>{window.removeEventListener("pointermove",w),window.removeEventListener("pointerup",y)};window.addEventListener("pointermove",w),window.addEventListener("pointerup",y,{once:!0})})}toggle(){this.isOpen?this.close():this.open()}open(){var e,t;this.isOpen=!0,(e=this.shadow.getElementById("launcher"))==null||e.classList.add("open"),(t=this.shadow.getElementById("panel"))==null||t.classList.add("open"),setTimeout(()=>{var n;(n=this.shadow.getElementById("input"))==null||n.focus()},250),this.scrollToBottom()}close(){var e,t;this.isOpen=!1,(e=this.shadow.getElementById("launcher"))==null||e.classList.remove("open"),(t=this.shadow.getElementById("panel"))==null||t.classList.remove("open")}getPageContext(){let e=window.ChatWidget,t="";try{typeof(e==null?void 0:e.pageUrl)=="string"&&e.pageUrl.trim()?t=new URL(e.pageUrl.trim(),window.location.origin).href:t=window.location.href}catch(h){t=window.location.href}let n=typeof(e==null?void 0:e.pagePath)=="string"&&e.pagePath.trim()?e.pagePath.trim():window.location.pathname,s=typeof(e==null?void 0:e.pageTitle)=="string"?e.pageTitle:document.title,a=(s!=null?s:"").slice(0,500),d=R(j);return{url:t,pathname:n,title:a,content:d}}async ensureSession(){if(!(this.sessionId&&this.token))try{let e=await fetch(`${this.baseUrl}/api/v1/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,pageContext:this.getPageContext()})});if(e.ok){let t=await e.json();this.sessionId=t.sessionId,this.token=t.token,this.saveSession()}}catch(e){}}async sendMessage(){var l,c,g,x,b;if(this.isStreaming)return;let e=this.shadow.getElementById("input"),t=this.shadow.getElementById("send-btn"),n=e.value.trim();if(!n)return;e.value="",e.style.height="auto",(l=this.shadow.getElementById("greeting"))==null||l.remove();let s={role:"user",content:n,ts:Date.now()};this.messages.push(s),this.appendMessageToDOM(s),this.isStreaming=!0,t.disabled=!0,await this.ensureSession();let a=this.showTyping(),d="",h={role:"assistant",content:"",ts:Date.now()},i=null,o=null;try{let m=await fetch(`${this.baseUrl}/api/v1/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,messages:this.messages.slice(-10).map(({role:w,content:y,sources:f})=>H({role:w,content:y},f!=null&&f.length?{sources:f}:{})),sessionId:this.sessionId,token:this.token,stream:!0,pageContext:this.getPageContext()})});if(!m.ok||!m.body)throw new Error("Network error");let M=m.body.getReader(),L=new TextDecoder,k="";for(a.remove(),i=document.createElement("div"),i.className="message assistant",o=document.createElement("div"),o.className="bubble",i.appendChild(o),(c=this.shadow.getElementById("messages"))==null||c.appendChild(i);;){let{done:w,value:y}=await M.read();if(w)break;k+=L.decode(y,{stream:!0});let f=k.split(`
`);k=(g=f.pop())!=null?g:"";for(let E of f){if(!E.startsWith("data: "))continue;let I=E.slice(6).trim();if(I!=="[DONE]")try{let v=JSON.parse(I);v.type==="token"&&v.content?(d+=v.content,o.textContent=d,this.scrollToBottom()):v.type==="sources"&&v.sources&&(h.sources=v.sources)}catch(v){}}}}catch(m){a.remove(),d="Sorry, I couldn't connect. Please try again.",i||(i=document.createElement("div"),i.className="message assistant",o=document.createElement("div"),o.className="bubble",i.appendChild(o),(x=this.shadow.getElementById("messages"))==null||x.appendChild(i)),o&&(o.textContent=d)}finally{if(i){o&&(o.innerHTML=O(d,h.sources));let m=document.createElement("div");m.className="message-time",m.textContent=B(Date.now()),i.appendChild(m)}h.content=d,this.messages.push(h),this.saveSession(),this.scrollToBottom(),this.isStreaming=!1,t.disabled=!1,(b=this.shadow.getElementById("input"))==null||b.focus()}}resetChat(){if(this.isStreaming)return;this.messages=[],this.sessionId=null,this.token=null,sessionStorage.removeItem(`${$}:${this.siteId}`),sessionStorage.removeItem(`${C}:${this.siteId}`);let e=this.shadow.getElementById("messages");e&&(e.innerHTML=`${this.renderGreeting()}`),this.scrollToBottom()}};function P(){let r=window.ChatWidget;if(!(r!=null&&r.siteId)){console.warn("[ALT EGO LABS] window.ChatWidget.siteId is required");return}new T(r.siteId)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",P):P();})();
