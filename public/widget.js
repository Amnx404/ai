"use strict";(()=>{var D=Object.defineProperty;var W=Object.getOwnPropertySymbols;var Y=Object.prototype.hasOwnProperty,q=Object.prototype.propertyIsEnumerable;var O=(i,e,t)=>e in i?D(i,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):i[e]=t,U=(i,e)=>{for(var t in e||(e={}))Y.call(e,t)&&O(i,t,e[t]);if(W)for(var t of W(e))q.call(e,t)&&O(i,t,e[t]);return i};var f=(i,e,t)=>O(i,typeof e!="symbol"?e+"":e,t);function j(i){return`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${i};
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
      display: inline-flex;
      height: 52px;
      max-width: min(240px, calc(100vw - 32px));
      align-items: center;
      justify-content: center;
      gap: 9px;
      border: 1px solid color-mix(in srgb, var(--primary) 76%, #000);
      border-radius: 14px;
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent);
      cursor: pointer;
      outline: none;
      padding: 0 15px 0 12px;
      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }

    #launcher:hover {
      box-shadow: 0 16px 34px color-mix(in srgb, var(--primary) 36%, transparent);
      transform: translateY(-1px);
    }

    #launcher:active { transform: translateY(0); }

    #launcher:focus-visible {
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent), 0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent);
    }

    .launcher-face {
      display: flex;
      width: 28px;
      height: 28px;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
    }

    #launcher svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #launcher .launcher-logo {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(255,255,255,0.55);
      border-radius: 8px;
      background: #ffffff;
      object-fit: cover;
    }

    .launcher-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 750;
      letter-spacing: 0;
    }

    #launcher .icon-close {
      display: none;
      width: 20px;
      height: 20px;
      fill: currentColor;
      stroke: none;
    }

    #launcher.open {
      width: 52px;
      padding: 0;
      border-color: var(--border);
      background: #ffffff;
      color: var(--text);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
    }

    #launcher.open .launcher-face,
    #launcher.open .launcher-text {
      display: none;
    }

    #launcher.open .icon-close {
      display: block;
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
        max-width: calc(100vw - 32px);
      }

      .message {
        max-width: 92%;
      }
    }
  `}var M="rr_chat_session",C="rr_chat_messages";function G(i){var t,s;let e=document.querySelectorAll("script[src*='widget.js']");for(let r of e)try{return new URL(r.src).origin}catch(n){}return(s=(t=window.ChatWidget)==null?void 0:t.apiBase)!=null?s:""}function H(i){return new Date(i).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function d(i){return i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function K(i){var r;let e=i.trim().replace(/\s+/g," "),s=((r=e.split("|").map(n=>n.trim()).filter(Boolean)[0])!=null?r:e)||"Source";return s.length>32?`${s.slice(0,29)}\u2026`:s}function J(i){try{let e=new URL(i),s=e.pathname.replace(/\/$/,"").split("/").filter(Boolean).pop();return s?`${e.hostname.replace(/^www\./,"")}/${s}`:e.hostname.replace(/^www\./,"")}catch(e){return"Source"}}function F(i){var s;let e=new Set,t=[];for(let r of i!=null?i:[]){let n=(s=r==null?void 0:r.url)==null?void 0:s.trim();!n||e.has(n)||(e.add(n),t.push(r))}return t.slice(0,5)}function _(i){let e=F(i);return e.length?`
    <div class="source-list" aria-label="Sources used">
      <div class="source-list-title">Sources used</div>
      <div class="source-list-links">
        ${e.map(t=>{var r;let s=(r=t.title)!=null&&r.trim()?K(t.title):J(t.url);return`<a class="source-chip" href="${d(t.url)}" target="_blank" rel="noopener">${d(s)}</a>`}).join("")}
      </div>
    </div>
  `:""}function V(i){let e=(i!=null?i:"").trim().replace(/\s+/g," ");return e?e.length>18?"Ask":`Ask ${e}`:"Ask"}function Q(i){return i.trim().replace(/\s+/g," ").replace(/[?.!]+$/g,"")}function X(i){return i.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function N(i,e){var h;let t=[],s=`__LINK_${Math.random().toString(36).slice(2)}_`,r=o=>{let a=`${s}${t.length}__`;return t.push(o),a},n=i;if(n=n.replace(/\[([^\]]{1,120})\]\(((?:https?):\/\/[^\s<>"')]{1,2048})\)/g,(o,a,g)=>{let p=String(a).trim(),c=String(g).trim();return!p||!c?"":r(`<a class="intext-source" href="${d(c)}" target="_blank" rel="noopener">${d(p)}</a>`)}),n=n.replace(/\[\[([^\]|]{1,120})\|((?:https?):\/\/[^\s<>"']{1,2048})\]\]/g,(o,a,g)=>{let p=String(a).trim(),c=String(g).trim();return!p||!c?"":r(`<a class="intext-source" href="${d(c)}" target="_blank" rel="noopener">${d(p)}</a>`)}),n=n.replace(/\bhttps?:\/\/[^\s<>"')]+/gi,o=>r(`<a class="intext-source" href="${d(o)}" target="_blank" rel="noopener">${d(o)}</a>`)),e!=null&&e.length)for(let o of e.slice(0,5)){if(!(o!=null&&o.url))continue;let a=(o.title||"").trim(),g=((h=a.split("|")[0])!=null?h:a).trim(),p=K(a||o.url||"Source"),c=Array.from(new Set([g,a,p].map(b=>b.trim()).filter(Boolean))),m=!1;for(let b of c){let w=new RegExp(`\\b${X(b)}\\b`,"i");if(w.test(n)){n=n.replace(w,r(`<a class="intext-source" href="${d(o.url)}" target="_blank" rel="noopener">${d(b)}</a>`)),m=!0;break}}}let l=d(n);for(let o=0;o<t.length;o++)l=l.replace(`${s}${o}__`,t[o]);return l}var A=class{constructor(e){f(this,"shadow");f(this,"host");f(this,"config",null);f(this,"messages",[]);f(this,"siteId");f(this,"baseUrl");f(this,"previewMode");f(this,"sessionId",null);f(this,"token",null);f(this,"sessionError",null);f(this,"isOpen",!1);f(this,"isStreaming",!1);var t;this.siteId=e,this.baseUrl=G(e),this.previewMode=((t=window.ChatWidget)==null?void 0:t.preview)===!0,this.host=document.createElement("div"),this.host.id="rr-chat-widget",this.host.style.cssText="position:fixed;z-index:999999;",document.body.appendChild(this.host),this.shadow=this.host.attachShadow({mode:"open"}),this.init()}async init(){var s,r;try{let n=new URLSearchParams({siteId:this.siteId});this.previewMode&&n.set("preview","1");let l=await fetch(`${this.baseUrl}/api/v1/widget-config?${n.toString()}`);if(!l.ok){this.host.remove();return}this.config=await l.json()}catch(n){this.config={id:this.siteId,primaryColor:"#6366f1",title:"Alt",greeting:"Hi! How can I help you today?",allowedTopics:[],preview:this.previewMode}}if(!this.host.isConnected)return;let e=(s=sessionStorage.getItem(this.storageKey(M)))!=null?s:this.previewMode?null:sessionStorage.getItem(`${M}:${this.siteId}`);if(e)try{let{sessionId:n,token:l}=JSON.parse(e);this.sessionId=n,this.token=l}catch(n){}let t=(r=sessionStorage.getItem(this.storageKey(C)))!=null?r:this.previewMode?null:sessionStorage.getItem(`${C}:${this.siteId}`);if(t)try{this.messages=JSON.parse(t)}catch(n){}this.render(),this.attachListeners()}storageKey(e){return`${e}:${this.siteId}:${this.previewMode?"preview":"live"}`}isPreviewOnly(){var e;return((e=this.config)==null?void 0:e.preview)===!0&&this.config.isActive===!1}previewBlockedCopy(){var t;let e=(t=this.config)==null?void 0:t.readiness;return e!=null&&e.hasWebsite?e!=null&&e.hasAllowedDomains?e!=null&&e.hasKnowledgeBase?{label:"Draft preview",body:"The widget is ready. Publish it from setup to enable live answer testing.",placeholder:"Publish widget to test answers"}:{label:"Source pages needed",body:"Read source pages in setup before this widget can answer questions.",placeholder:"Read source pages to test answers"}:{label:"Allowed domains needed",body:"Add the website domain in setup before this widget can be published.",placeholder:"Add allowed domain to test answers"}:{label:"Website needed",body:"Set the website URL in setup before this widget can be published.",placeholder:"Set website URL to test answers"}}saveSession(){this.sessionId&&this.token&&sessionStorage.setItem(this.storageKey(M),JSON.stringify({sessionId:this.sessionId,token:this.token})),sessionStorage.setItem(this.storageKey(C),JSON.stringify(this.messages))}render(){var g,p,c,m,b,w,$,T,B,L,u,x;let e=(p=(g=this.config)==null?void 0:g.primaryColor)!=null?p:"#6366f1",t=(w=(b=(c=this.config)==null?void 0:c.logoUrl)!=null?b:(m=window.ChatWidget)==null?void 0:m.pageIconUrl)!=null?w:null,s=(T=($=this.config)==null?void 0:$.title)!=null?T:"Alt",r=this.isPreviewOnly(),n=this.previewBlockedCopy(),l=r?"Preview only":(B=this.config)!=null&&B.preview?"Preview":"Online",h=r?"Preview widget":V(s),o=r?"Preview widget":"Ask a question",a=r?n.placeholder:"Ask a question";this.shadow.innerHTML=`
      <style>${j(e)}</style>

      <div id="nudge">
        <div class="nudge-text">${d(o)}</div>
        <button id="close-nudge" aria-label="Close nudge">&times;</button>
      </div>

      <button id="launcher" aria-label="Open chat" title="Open chat">
        <span class="launcher-face">
          ${t?`<img class="launcher-logo" alt="" src="${d(t)}" onerror="this.remove()" />`:`<svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
                </svg>`}
        </span>
        <span class="launcher-text">${d(h)}</span>
        <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <div id="panel" role="dialog" aria-label="Chat window">
        <div id="header">
          <div id="header-avatar">
            <svg class="header-default-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
            ${(L=this.config)!=null&&L.logoUrl?`<img alt="Logo" src="${d(this.config.logoUrl)}" onerror="this.remove()" />`:""}
          </div>
          <div id="header-info">
            <div id="header-title">${d(s)}</div>
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

        ${r?`<div id="mode-banner"><strong>${d(n.label)}</strong><span> ${d(n.body)}</span></div>`:""}

        <div id="messages" aria-live="polite" aria-atomic="false">
          ${this.renderGreeting()}
          ${this.renderStarterPrompts()}
          ${this.messages.map(E=>this.renderMessage(E)).join("")}
        </div>

        <div id="input-area">
          <textarea
            id="input"
            placeholder="${d(a)}"
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
          <a href="${d((x=(u=this.config)==null?void 0:u.appUrl)!=null?x:this.baseUrl)}" target="_blank" rel="noopener">
            Powered by Alt Ego Labs
          </a>
        </div>
      </div>
    `}renderGreeting(){var e;return!((e=this.config)!=null&&e.greeting)||this.messages.length>0?"":`<div id="greeting">${d(this.config.greeting)}</div>`}starterPrompts(){var s,r;let e=((r=(s=this.config)==null?void 0:s.allowedTopics)!=null?r:[]).map(Q).filter(Boolean).slice(0,3).map(n=>`What should I know about ${n}?`),t=["What can you help me with?","What are the most important details?","Where should I get started?"];return Array.from(new Set([...e,...t])).slice(0,3)}renderStarterPrompts(){if(this.messages.length>0||this.isPreviewOnly())return"";let e=this.starterPrompts();return e.length?`
      <div id="starter-prompts" aria-label="Suggested questions">
        <div class="starter-title">Try asking</div>
        <div class="starter-list">
          ${e.map(t=>`
                <button type="button" class="starter-prompt" data-starter-prompt="${d(t)}">
                  ${d(t)}
                </button>
              `).join("")}
        </div>
      </div>
    `:""}renderMessage(e){return`
      <div class="message ${e.role}">
        <div class="bubble">${e.role==="assistant"?N(e.content,e.sources):d(e.content)}</div>
        ${e.role==="assistant"?_(e.sources):""}
        <div class="message-time">${H(e.ts)}</div>
      </div>
    `}appendMessageToDOM(e,t){let s=document.createElement("div");s.className=`message ${e.role}`,t&&(s.id=t),s.innerHTML=`
      <div class="bubble">${d(e.content)}</div>
      <div class="message-time">${H(e.ts)}</div>
    `;let r=this.shadow.getElementById("messages");return r==null||r.appendChild(s),this.scrollToBottom(),s}showTyping(){var t;let e=document.createElement("div");return e.className="message assistant",e.id="typing-indicator",e.innerHTML=`
      <div class="typing-wrap">
        <div class="typing" aria-label="Assistant is checking sources">
          <span></span><span></span><span></span>
        </div>
        <div class="typing-label">Checking sources</div>
      </div>
    `,(t=this.shadow.getElementById("messages"))==null||t.appendChild(e),this.scrollToBottom(),e}scrollToBottom(){let e=this.shadow.getElementById("messages");e&&(e.scrollTop=e.scrollHeight)}attachListeners(){let e=this.shadow.getElementById("launcher"),t=this.shadow.getElementById("reset-btn"),s=this.shadow.getElementById("close-btn"),r=this.shadow.getElementById("input"),n=this.shadow.getElementById("send-btn"),l=this.shadow.getElementById("nudge"),h=this.shadow.getElementById("close-nudge"),o=this.shadow.getElementById("messages");setTimeout(()=>{!this.isOpen&&l&&l.classList.add("visible")},3e3),h==null||h.addEventListener("click",a=>{a.stopPropagation(),l==null||l.classList.remove("visible")}),e.addEventListener("click",()=>{l==null||l.classList.remove("visible"),this.toggle()}),t==null||t.addEventListener("click",()=>this.resetChat()),s.addEventListener("click",()=>this.close()),r.addEventListener("keydown",a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),this.sendMessage())}),r.addEventListener("input",()=>{r.style.height="auto",r.style.height=`${Math.min(r.scrollHeight,120)}px`}),o==null||o.addEventListener("click",a=>{var m;let g=a.target instanceof HTMLElement?a.target:null,p=g==null?void 0:g.closest("[data-starter-prompt]");if(!p||this.isPreviewOnly())return;let c=(m=p.getAttribute("data-starter-prompt"))!=null?m:"";c.trim()&&(r.value=c,r.dispatchEvent(new Event("input",{bubbles:!0})),r.focus())}),n.addEventListener("click",()=>void this.sendMessage())}toggle(){this.isOpen?this.close():this.open()}open(){var t;this.isOpen=!0;let e=this.shadow.getElementById("launcher");e==null||e.classList.add("open"),e==null||e.setAttribute("aria-label","Close chat"),e==null||e.setAttribute("title","Close chat"),(t=this.shadow.getElementById("panel"))==null||t.classList.add("open"),this.isPreviewOnly()||setTimeout(()=>{var s;(s=this.shadow.getElementById("input"))==null||s.focus()},250),this.scrollToBottom()}close(){var t;this.isOpen=!1;let e=this.shadow.getElementById("launcher");e==null||e.classList.remove("open"),e==null||e.setAttribute("aria-label","Open chat"),e==null||e.setAttribute("title","Open chat"),(t=this.shadow.getElementById("panel"))==null||t.classList.remove("open")}async ensureSession(){var e;if(!(this.sessionId&&this.token)){this.sessionError=null;try{let t=await fetch(`${this.baseUrl}/api/v1/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId})});if(t.ok){let r=await t.json();this.sessionId=r.sessionId,this.token=r.token,this.saveSession();return}let s=await t.json().catch(()=>null);this.sessionError=(e=s==null?void 0:s.error)!=null?e:"Widget session could not be created."}catch(t){this.sessionError="Widget session could not be created."}}}async sendMessage(){var g,p,c,m,b,w,$,T,B,L;if(this.isStreaming||this.isPreviewOnly())return;let e=this.shadow.getElementById("input"),t=this.shadow.getElementById("send-btn"),s=e.value.trim();if(!s)return;e.value="",e.style.height="auto",(g=this.shadow.getElementById("greeting"))==null||g.remove(),(p=this.shadow.getElementById("starter-prompts"))==null||p.remove();let r={role:"user",content:s,ts:Date.now()};this.messages.push(r),this.appendMessageToDOM(r),this.isStreaming=!0,t.disabled=!0,await this.ensureSession();let n=this.showTyping(),l="",h={role:"assistant",content:"",ts:Date.now()},o=null,a=null;try{if(!this.sessionId||!this.token)throw new Error((c=this.sessionError)!=null?c:"Widget session could not be created.");let u=await fetch(`${this.baseUrl}/api/v1/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,messages:this.messages.slice(-10).map(({role:S,content:y,sources:k})=>U({role:S,content:y},k!=null&&k.length?{sources:k}:{})),sessionId:this.sessionId,token:this.token,stream:!0})});if(!u.ok||!u.body){let S=await u.text().catch(()=>""),y=(m=S.match(/"message"\s*:\s*"([^"]+)"/))!=null?m:S.match(/"error"\s*:\s*"([^"]+)"/);throw new Error((b=y==null?void 0:y[1])!=null?b:"Chat request failed.")}let x=u.body.getReader(),E=new TextDecoder,I="";for(n.remove(),o=document.createElement("div"),o.className="message assistant",a=document.createElement("div"),a.className="bubble",o.appendChild(a),(w=this.shadow.getElementById("messages"))==null||w.appendChild(o);;){let{done:S,value:y}=await x.read();if(S)break;I+=E.decode(y,{stream:!0});let k=I.split(`
`);I=($=k.pop())!=null?$:"";for(let P of k){if(!P.startsWith("data: "))continue;let z=P.slice(6).trim();if(z!=="[DONE]")try{let v=JSON.parse(z);v.type==="token"&&v.content?(l+=v.content,a.textContent=l,this.scrollToBottom()):v.type==="sources"&&v.sources?h.sources=v.sources:v.type==="error"&&(l=((T=v.message)==null?void 0:T.trim())||"Sorry, something went wrong. Please try again.",a.textContent=l,this.scrollToBottom())}catch(v){}}}}catch(u){n.remove();let x=u instanceof Error?u.message:"";l=/domain not allowed|origin header|required|session/i.test(x)?"This widget is not enabled for this domain yet. Update the allowed domains in setup, then try again.":"Sorry, I couldn't connect. Please try again.",o||(o=document.createElement("div"),o.className="message assistant",a=document.createElement("div"),a.className="bubble",o.appendChild(a),(B=this.shadow.getElementById("messages"))==null||B.appendChild(o)),a&&(a.textContent=l)}finally{if(o){a&&(a.innerHTML=N(l,h.sources));let u=_(h.sources);if(u){let E=document.createElement("div");E.innerHTML=u.trim();let I=E.firstElementChild;I&&o.appendChild(I)}let x=document.createElement("div");x.className="message-time",x.textContent=H(Date.now()),o.appendChild(x)}h.content=l,this.messages.push(h),this.saveSession(),this.scrollToBottom(),this.isStreaming=!1,t.disabled=!1,(L=this.shadow.getElementById("input"))==null||L.focus()}}resetChat(){if(this.isStreaming)return;this.messages=[],this.sessionId=null,this.token=null,sessionStorage.removeItem(this.storageKey(M)),sessionStorage.removeItem(this.storageKey(C)),sessionStorage.removeItem(`${M}:${this.siteId}`),sessionStorage.removeItem(`${C}:${this.siteId}`);let e=this.shadow.getElementById("messages");e&&(e.innerHTML=`${this.renderGreeting()}${this.renderStarterPrompts()}`),this.scrollToBottom()}};function R(){let i=window.ChatWidget;if(!(i!=null&&i.siteId)){console.warn("[ALT EGO LABS] window.ChatWidget.siteId is required");return}new A(i.siteId)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",R):R();})();
