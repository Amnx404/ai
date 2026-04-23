"use strict";(()=>{var N=Object.defineProperty;var H=Object.getOwnPropertySymbols;var j=Object.prototype.hasOwnProperty,A=Object.prototype.propertyIsEnumerable;var B=(n,e,t)=>e in n?N(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t,z=(n,e)=>{for(var t in e||(e={}))j.call(e,t)&&B(n,t,e[t]);if(H)for(var t of H(e))A.call(e,t)&&B(n,t,e[t]);return n};var g=(n,e,t)=>B(n,typeof e!="symbol"?e+"":e,t);function O(n){return`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${n};
      --primary-dark: color-mix(in srgb, ${n} 80%, #000);
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --text: #111827;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 6px rgba(0,0,0,0.08);
      --radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Launcher button */
    #launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      z-index: 999998;
      outline: none;
    }

    #launcher:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    }

    #launcher:active { transform: scale(0.96); }

    #launcher svg {
      width: 24px;
      height: 24px;
      fill: #fff;
      transition: transform 0.3s ease, opacity 0.2s ease;
    }

    #launcher .launcher-logo {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(255,255,255,0.55);
      object-fit: cover;
      box-shadow: 0 6px 14px rgba(0,0,0,0.18);
      opacity: 1;
      transition: opacity 0.15s ease;
    }

    #launcher.open .launcher-logo {
      opacity: 0;
    }

    #launcher .icon-close {
      position: absolute;
      opacity: 0;
      transform: rotate(-90deg) scale(0.8);
    }

    #launcher.open .icon-chat {
      opacity: 0;
      transform: rotate(90deg) scale(0.8);
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
      background: var(--bg);
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: var(--radius);
      box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 10px 24px rgba(0,0,0,0.10);
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
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                  opacity 0.2s ease;
    }

    /* Top-left resize grip */
    #resize-grip {
      position: absolute;
      top: 10px;
      left: 10px;
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      cursor: nwse-resize;
      opacity: 0.75;
      z-index: 3;
      border-radius: 8px;
    }

    #resize-grip:hover {
      background: rgba(255,255,255,0.14);
      opacity: 1;
    }

    #resize-grip::before {
      content: "";
      position: absolute;
      inset: 3px;
      border-left: 2px solid rgba(255,255,255,0.85);
      border-top: 2px solid rgba(255,255,255,0.85);
      border-top-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
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
      gap: 10px;
      padding: 16px 18px;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--primary) 92%, #000) 0%,
        var(--primary) 60%,
        color-mix(in srgb, var(--primary) 88%, #fff) 100%
      );
      color: #fff;
      flex-shrink: 0;
    }

    #header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.22);
    }

    #header-avatar svg { width: 18px; height: 18px; fill: #fff; }
    #header-avatar img { width: 100%; height: 100%; object-fit: cover; }

    #header-info { flex: 1; min-width: 0; }

    #header-title {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #header-status {
      font-size: 12px;
      opacity: 0.85;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    #status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ade80;
      display: inline-block;
    }

    #close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: rgba(255,255,255,0.85);
      display: flex;
      border-radius: 8px;
      transition: background 0.15s;
    }

    #close-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
    #close-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; }

    #reset-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: rgba(255,255,255,0.85);
      display: flex;
      border-radius: 8px;
      transition: background 0.15s;
    }

    #reset-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
    #reset-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; }

    /* Messages */
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
      background: radial-gradient(
        1200px 600px at 100% 0%,
        rgba(99,102,241,0.08),
        rgba(255,255,255,0)
      );
    }

    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      gap: 2px;
    }

    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.assistant { align-self: flex-start; align-items: flex-start; }

    .bubble {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.user .bubble {
      background: var(--primary);
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    .message.assistant .bubble {
      background: var(--bg-secondary);
      color: var(--text);
      border: 1px solid var(--border);
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
      padding: 0 4px;
    }

    /* Sources (legacy block, should no longer render) */
    .sources { display: none; }

    /* Typing indicator */
    .typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      width: fit-content;
    }

    .typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-secondary);
      display: inline-block;
      animation: bounce 1.2s ease infinite;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* Greeting card */
    #greeting {
      padding: 16px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: #fff;
      border-radius: 14px;
      margin: 4px 0;
      font-size: 14px;
      line-height: 1.6;
    }

    /* Input area */
    #input-area {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: flex-end;
      background: var(--bg);
      flex-shrink: 0;
    }

    #input {
      flex: 1;
      border: 1.5px solid var(--border);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.5;
      max-height: 120px;
      min-height: 42px;
      color: var(--text);
      background: var(--bg-secondary);
      transition: border-color 0.15s;
      overflow-y: auto;
    }

    #input:focus { border-color: var(--primary); background: var(--bg); }
    #input::placeholder { color: var(--text-secondary); }

    #send-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, transform 0.1s;
    }

    #send-btn:hover { background: var(--primary-dark); }
    #send-btn:active { transform: scale(0.92); }
    #send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    #send-btn svg { width: 16px; height: 16px; stroke: #fff; fill: none; }

    /* Powered by */
    #powered-by {
      text-align: center;
      font-size: 11px;
      color: var(--text-secondary);
      padding: 6px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    #powered-by a {
      color: var(--primary);
      text-decoration: none;
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
  `}var L="rr_chat_session",$="rr_chat_messages";function R(n){var t,s;let e=document.querySelectorAll("script[src*='widget.js']");for(let i of e)try{return new URL(i.src).origin}catch(a){}return(s=(t=window.ChatWidget)==null?void 0:t.apiBase)!=null?s:""}function C(n){return new Date(n).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function c(n){return n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function D(n){var i;let e=n.trim().replace(/\s+/g," "),s=((i=e.split("|").map(a=>a.trim()).filter(Boolean)[0])!=null?i:e)||"Source";return s.length>32?`${s.slice(0,29)}\u2026`:s}function _(n){return n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function U(n,e){var s;let t=c(n);if(t=t.replace(/\[\[([^\]|]{1,120})\|((?:https?):\/\/[^\s<>"']{1,2048})\]\]/g,(i,a,o)=>{let l=String(a).trim(),r=String(o).trim();return!l||!r?"":`<a class="intext-source" href="${c(r)}" target="_blank" rel="noopener">${c(l)}</a>`}),t=t.replace(/\bhttps?:\/\/[^\s<>"']+/gi,i=>`<a class="intext-source" href="${c(i)}" target="_blank" rel="noopener">${c(i)}</a>`),!(e!=null&&e.length))return t;for(let i of e.slice(0,5)){if(!(i!=null&&i.url))continue;let a=(i.title||"").trim(),o=((s=a.split("|")[0])!=null?s:a).trim(),l=D(a||i.url||"Source"),r=Array.from(new Set([o,a,l].map(p=>p.trim()).filter(Boolean))),d=!1;for(let p of r){let h=c(p),u=new RegExp(`\\b${_(h)}\\b`,"i");if(u.test(t)){t=t.replace(u,`<a class="intext-source" href="${c(i.url)}" target="_blank" rel="noopener">${h}</a>`),d=!0;break}}}return t}var S=class{constructor(e){g(this,"shadow");g(this,"host");g(this,"config",null);g(this,"messages",[]);g(this,"siteId");g(this,"baseUrl");g(this,"sessionId",null);g(this,"token",null);g(this,"isOpen",!1);g(this,"isStreaming",!1);this.siteId=e,this.baseUrl=R(e),this.host=document.createElement("div"),this.host.id="rr-chat-widget",this.host.style.cssText="position:fixed;z-index:999999;",document.body.appendChild(this.host),this.shadow=this.host.attachShadow({mode:"closed"}),this.init()}async init(){try{let s=await fetch(`${this.baseUrl}/api/v1/widget-config?siteId=${this.siteId}`);if(!s.ok){s.status===404&&this.host.remove();return}this.config=await s.json()}catch(s){this.config={id:this.siteId,primaryColor:"#6366f1",title:"Chat",greeting:"Hi! How can I help you today?",allowedTopics:[]}}if(!this.host.isConnected)return;let e=sessionStorage.getItem(`${L}:${this.siteId}`);if(e)try{let{sessionId:s,token:i}=JSON.parse(e);this.sessionId=s,this.token=i}catch(s){}let t=sessionStorage.getItem(`${$}:${this.siteId}`);if(t)try{this.messages=JSON.parse(t)}catch(s){}this.render(),this.attachListeners()}saveSession(){this.sessionId&&this.token&&sessionStorage.setItem(`${L}:${this.siteId}`,JSON.stringify({sessionId:this.sessionId,token:this.token})),sessionStorage.setItem(`${$}:${this.siteId}`,JSON.stringify(this.messages))}render(){var s,i,a,o,l,r,d,p,h,u,f;let e=(i=(s=this.config)==null?void 0:s.primaryColor)!=null?i:"#6366f1",t=(r=(l=(a=this.config)==null?void 0:a.logoUrl)!=null?l:(o=window.ChatWidget)==null?void 0:o.pageIconUrl)!=null?r:null;this.shadow.innerHTML=`
      <style>${O(e)}</style>

      <button id="launcher" aria-label="Open chat" title="Open chat">
        ${t?`<img class="launcher-logo" alt="" src="${c(t)}" onerror="this.remove()" />`:""}
        <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
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
            ${(d=this.config)!=null&&d.logoUrl?`<img alt="Logo" src="${c(this.config.logoUrl)}" onerror="this.remove()" />`:""}
          </div>
          <div id="header-info">
            <div id="header-title">${c((h=(p=this.config)==null?void 0:p.title)!=null?h:"Chat")}</div>
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
          ${this.messages.map(v=>this.renderMessage(v)).join("")}
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
          <a href="${c((f=(u=this.config)==null?void 0:u.appUrl)!=null?f:this.baseUrl)}" target="_blank" rel="noopener">
            Powered by Alt Ego Labs
          </a>
        </div>
      </div>
    `}renderGreeting(){var e;return!((e=this.config)!=null&&e.greeting)||this.messages.length>0?"":`<div id="greeting">${c(this.config.greeting)}</div>`}renderMessage(e){return`
      <div class="message ${e.role}">
        <div class="bubble">${e.role==="assistant"?U(e.content,e.sources):c(e.content)}</div>
        <div class="message-time">${C(e.ts)}</div>
      </div>
    `}appendMessageToDOM(e,t){let s=document.createElement("div");s.className=`message ${e.role}`,t&&(s.id=t),s.innerHTML=`
      <div class="bubble">${c(e.content)}</div>
      <div class="message-time">${C(e.ts)}</div>
    `;let i=this.shadow.getElementById("messages");return i==null||i.appendChild(s),this.scrollToBottom(),s}showTyping(){var t;let e=document.createElement("div");return e.className="message assistant",e.id="typing-indicator",e.innerHTML='<div class="typing"><span></span><span></span><span></span></div>',(t=this.shadow.getElementById("messages"))==null||t.appendChild(e),this.scrollToBottom(),e}scrollToBottom(){let e=this.shadow.getElementById("messages");e&&(e.scrollTop=e.scrollHeight)}attachListeners(){let e=this.shadow.getElementById("launcher"),t=this.shadow.getElementById("reset-btn"),s=this.shadow.getElementById("close-btn"),i=this.shadow.getElementById("panel"),a=this.shadow.getElementById("resize-grip"),o=this.shadow.getElementById("input"),l=this.shadow.getElementById("send-btn");e.addEventListener("click",()=>this.toggle()),t==null||t.addEventListener("click",()=>this.resetChat()),s.addEventListener("click",()=>this.close()),o.addEventListener("keydown",r=>{r.key==="Enter"&&!r.shiftKey&&(r.preventDefault(),this.sendMessage())}),o.addEventListener("input",()=>{o.style.height="auto",o.style.height=`${Math.min(o.scrollHeight,120)}px`}),l.addEventListener("click",()=>void this.sendMessage()),a&&a.addEventListener("pointerdown",r=>{r.preventDefault(),a.setPointerCapture(r.pointerId);let d=i.getBoundingClientRect().width,p=i.getBoundingClientRect().height,h=r.clientX,u=r.clientY,f=340,v=460,m=Math.min(window.innerWidth-32,720),T=Math.min(window.innerHeight-120,900),E=w=>{let k=w.clientX-h,b=w.clientY-u,I=Math.max(f,Math.min(m,d-k)),M=Math.max(v,Math.min(T,p-b));i.style.width=`${Math.round(I)}px`,i.style.height=`${Math.round(M)}px`},y=()=>{window.removeEventListener("pointermove",E),window.removeEventListener("pointerup",y)};window.addEventListener("pointermove",E),window.addEventListener("pointerup",y,{once:!0})})}toggle(){this.isOpen?this.close():this.open()}open(){var e,t;this.isOpen=!0,(e=this.shadow.getElementById("launcher"))==null||e.classList.add("open"),(t=this.shadow.getElementById("panel"))==null||t.classList.add("open"),setTimeout(()=>{var s;(s=this.shadow.getElementById("input"))==null||s.focus()},250),this.scrollToBottom()}close(){var e,t;this.isOpen=!1,(e=this.shadow.getElementById("launcher"))==null||e.classList.remove("open"),(t=this.shadow.getElementById("panel"))==null||t.classList.remove("open")}async ensureSession(){if(!(this.sessionId&&this.token))try{let e=await fetch(`${this.baseUrl}/api/v1/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId})});if(e.ok){let t=await e.json();this.sessionId=t.sessionId,this.token=t.token,this.saveSession()}}catch(e){}}async sendMessage(){var p,h,u,f,v;if(this.isStreaming)return;let e=this.shadow.getElementById("input"),t=this.shadow.getElementById("send-btn"),s=e.value.trim();if(!s)return;e.value="",e.style.height="auto",(p=this.shadow.getElementById("greeting"))==null||p.remove();let i={role:"user",content:s,ts:Date.now()};this.messages.push(i),this.appendMessageToDOM(i),this.isStreaming=!0,t.disabled=!0,await this.ensureSession();let a=this.showTyping(),o="",l={role:"assistant",content:"",ts:Date.now()},r=null,d=null;try{let m=await fetch(`${this.baseUrl}/api/v1/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,messages:this.messages.slice(-10).map(({role:w,content:k,sources:b})=>z({role:w,content:k},b!=null&&b.length?{sources:b}:{})),sessionId:this.sessionId,token:this.token,stream:!0})});if(!m.ok||!m.body)throw new Error("Network error");let T=m.body.getReader(),E=new TextDecoder,y="";for(a.remove(),r=document.createElement("div"),r.className="message assistant",d=document.createElement("div"),d.className="bubble",r.appendChild(d),(h=this.shadow.getElementById("messages"))==null||h.appendChild(r);;){let{done:w,value:k}=await T.read();if(w)break;y+=E.decode(k,{stream:!0});let b=y.split(`
`);y=(u=b.pop())!=null?u:"";for(let I of b){if(!I.startsWith("data: "))continue;let M=I.slice(6).trim();if(M!=="[DONE]")try{let x=JSON.parse(M);x.type==="token"&&x.content?(o+=x.content,d.textContent=o,this.scrollToBottom()):x.type==="sources"&&x.sources&&(l.sources=x.sources)}catch(x){}}}}catch(m){a.remove(),o="Sorry, I couldn't connect. Please try again.",r||(r=document.createElement("div"),r.className="message assistant",d=document.createElement("div"),d.className="bubble",r.appendChild(d),(f=this.shadow.getElementById("messages"))==null||f.appendChild(r)),d&&(d.textContent=o)}finally{if(r){d&&(d.innerHTML=U(o,l.sources));let m=document.createElement("div");m.className="message-time",m.textContent=C(Date.now()),r.appendChild(m)}l.content=o,this.messages.push(l),this.saveSession(),this.scrollToBottom(),this.isStreaming=!1,t.disabled=!1,(v=this.shadow.getElementById("input"))==null||v.focus()}}resetChat(){if(this.isStreaming)return;this.messages=[],this.sessionId=null,this.token=null,sessionStorage.removeItem(`${L}:${this.siteId}`),sessionStorage.removeItem(`${$}:${this.siteId}`);let e=this.shadow.getElementById("messages");e&&(e.innerHTML=`${this.renderGreeting()}`),this.scrollToBottom()}};function W(){let n=window.ChatWidget;if(!(n!=null&&n.siteId)){console.warn("[ALT EGO LABS] window.ChatWidget.siteId is required");return}new S(n.siteId)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",W):W();})();
