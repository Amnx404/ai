"use strict";(()=>{var O=Object.defineProperty;var U=(n,e,s)=>e in n?O(n,e,{enumerable:!0,configurable:!0,writable:!0,value:s}):n[e]=s;var c=(n,e,s)=>U(n,typeof e!="symbol"?e+"":e,s);function L(n){return`
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
  `}var $="rr_chat_session",C="rr_chat_messages";function W(n){var s,t;let e=document.querySelectorAll("script[src*='widget.js']");for(let i of e)try{return new URL(i.src).origin}catch(a){}return(t=(s=window.ChatWidget)==null?void 0:s.apiBase)!=null?t:""}function T(n){return new Date(n).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function g(n){return n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function N(n){var i;let e=n.trim().replace(/\s+/g," "),t=((i=e.split("|").map(a=>a.trim()).filter(Boolean)[0])!=null?i:e)||"Source";return t.length>32?`${t.slice(0,29)}\u2026`:t}function j(n){return n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function H(n,e){let s=g(n);if(!(e!=null&&e.length))return s;let t=s;for(let i of e.slice(0,5)){if(!(i!=null&&i.url))continue;let a=N(i.title||i.url||"Source"),l=g(a),r=new RegExp(`\\b${j(l)}\\b`,"i");r.test(t)&&(t=t.replace(r,`<a class="intext-source" href="${g(i.url)}" target="_blank" rel="noopener">${l}</a>`))}return t}var S=class{constructor(e){c(this,"shadow");c(this,"host");c(this,"config",null);c(this,"messages",[]);c(this,"siteId");c(this,"baseUrl");c(this,"sessionId",null);c(this,"token",null);c(this,"isOpen",!1);c(this,"isStreaming",!1);this.siteId=e,this.baseUrl=W(e),this.host=document.createElement("div"),this.host.id="rr-chat-widget",this.host.style.cssText="position:fixed;z-index:999999;",document.body.appendChild(this.host),this.shadow=this.host.attachShadow({mode:"closed"}),this.init()}async init(){try{let t=await fetch(`${this.baseUrl}/api/v1/widget-config?siteId=${this.siteId}`);if(!t.ok)return;this.config=await t.json()}catch(t){this.config={id:this.siteId,primaryColor:"#6366f1",title:"Chat",greeting:"Hi! How can I help you today?",allowedTopics:[]}}let e=sessionStorage.getItem(`${$}:${this.siteId}`);if(e)try{let{sessionId:t,token:i}=JSON.parse(e);this.sessionId=t,this.token=i}catch(t){}let s=sessionStorage.getItem(`${C}:${this.siteId}`);if(s)try{this.messages=JSON.parse(s)}catch(t){}this.render(),this.attachListeners()}saveSession(){this.sessionId&&this.token&&sessionStorage.setItem(`${$}:${this.siteId}`,JSON.stringify({sessionId:this.sessionId,token:this.token})),sessionStorage.setItem(`${C}:${this.siteId}`,JSON.stringify(this.messages))}render(){var t,i,a,l,r,o,d,h,u,m,b;let e=(i=(t=this.config)==null?void 0:t.primaryColor)!=null?i:"#6366f1",s=(o=(r=(a=this.config)==null?void 0:a.logoUrl)!=null?r:(l=window.ChatWidget)==null?void 0:l.pageIconUrl)!=null?o:null;this.shadow.innerHTML=`
      <style>${L(e)}</style>

      <button id="launcher" aria-label="Open chat" title="Open chat">
        ${s?`<img class="launcher-logo" alt="" src="${g(s)}" onerror="this.remove()" />`:""}
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
            ${(d=this.config)!=null&&d.logoUrl?`<img alt="Logo" src="${g(this.config.logoUrl)}" onerror="this.remove()" />`:""}
          </div>
          <div id="header-info">
            <div id="header-title">${g((u=(h=this.config)==null?void 0:h.title)!=null?u:"Chat")}</div>
            <div id="header-status">
              <span id="status-dot"></span>
              <span>Online</span>
            </div>
          </div>
          <button id="close-btn" aria-label="Close chat">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div id="messages" aria-live="polite" aria-atomic="false">
          ${this.renderGreeting()}
          ${this.messages.map(f=>this.renderMessage(f)).join("")}
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
          <a href="${g((b=(m=this.config)==null?void 0:m.appUrl)!=null?b:this.baseUrl)}" target="_blank" rel="noopener">
            Powered by Gemini
          </a>
        </div>
      </div>
    `}renderGreeting(){var e;return!((e=this.config)!=null&&e.greeting)||this.messages.length>0?"":`<div id="greeting">${g(this.config.greeting)}</div>`}renderMessage(e){return`
      <div class="message ${e.role}">
        <div class="bubble">${e.role==="assistant"?H(e.content,e.sources):g(e.content)}</div>
        <div class="message-time">${T(e.ts)}</div>
      </div>
    `}appendMessageToDOM(e,s){let t=document.createElement("div");t.className=`message ${e.role}`,s&&(t.id=s),t.innerHTML=`
      <div class="bubble">${g(e.content)}</div>
      <div class="message-time">${T(e.ts)}</div>
    `;let i=this.shadow.getElementById("messages");return i==null||i.appendChild(t),this.scrollToBottom(),t}showTyping(){var s;let e=document.createElement("div");return e.className="message assistant",e.id="typing-indicator",e.innerHTML='<div class="typing"><span></span><span></span><span></span></div>',(s=this.shadow.getElementById("messages"))==null||s.appendChild(e),this.scrollToBottom(),e}scrollToBottom(){let e=this.shadow.getElementById("messages");e&&(e.scrollTop=e.scrollHeight)}attachListeners(){let e=this.shadow.getElementById("launcher"),s=this.shadow.getElementById("close-btn"),t=this.shadow.getElementById("panel"),i=this.shadow.getElementById("resize-grip"),a=this.shadow.getElementById("input"),l=this.shadow.getElementById("send-btn");e.addEventListener("click",()=>this.toggle()),s.addEventListener("click",()=>this.close()),a.addEventListener("keydown",r=>{r.key==="Enter"&&!r.shiftKey&&(r.preventDefault(),this.sendMessage())}),a.addEventListener("input",()=>{a.style.height="auto",a.style.height=`${Math.min(a.scrollHeight,120)}px`}),l.addEventListener("click",()=>void this.sendMessage()),i&&i.addEventListener("pointerdown",r=>{r.preventDefault(),i.setPointerCapture(r.pointerId);let o=t.getBoundingClientRect().width,d=t.getBoundingClientRect().height,h=r.clientX,u=r.clientY,m=340,b=460,f=Math.min(window.innerWidth-32,720),p=Math.min(window.innerHeight-120,900),k=v=>{let y=v.clientX-h,w=v.clientY-u,I=Math.max(m,Math.min(f,o-y)),M=Math.max(b,Math.min(p,d-w));t.style.width=`${Math.round(I)}px`,t.style.height=`${Math.round(M)}px`},E=()=>{window.removeEventListener("pointermove",k),window.removeEventListener("pointerup",E)};window.addEventListener("pointermove",k),window.addEventListener("pointerup",E,{once:!0})})}toggle(){this.isOpen?this.close():this.open()}open(){var e,s;this.isOpen=!0,(e=this.shadow.getElementById("launcher"))==null||e.classList.add("open"),(s=this.shadow.getElementById("panel"))==null||s.classList.add("open"),setTimeout(()=>{var t;(t=this.shadow.getElementById("input"))==null||t.focus()},250),this.scrollToBottom()}close(){var e,s;this.isOpen=!1,(e=this.shadow.getElementById("launcher"))==null||e.classList.remove("open"),(s=this.shadow.getElementById("panel"))==null||s.classList.remove("open")}async ensureSession(){if(!(this.sessionId&&this.token))try{let e=await fetch(`${this.baseUrl}/api/v1/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId})});if(e.ok){let s=await e.json();this.sessionId=s.sessionId,this.token=s.token,this.saveSession()}}catch(e){}}async sendMessage(){var h,u,m,b,f;if(this.isStreaming)return;let e=this.shadow.getElementById("input"),s=this.shadow.getElementById("send-btn"),t=e.value.trim();if(!t)return;e.value="",e.style.height="auto",(h=this.shadow.getElementById("greeting"))==null||h.remove();let i={role:"user",content:t,ts:Date.now()};this.messages.push(i),this.appendMessageToDOM(i),this.isStreaming=!0,s.disabled=!0,await this.ensureSession();let a=this.showTyping(),l="",r={role:"assistant",content:"",ts:Date.now()},o=null,d=null;try{let p=await fetch(`${this.baseUrl}/api/v1/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,messages:this.messages.slice(-10).map(({role:y,content:w})=>({role:y,content:w})),sessionId:this.sessionId,token:this.token,stream:!0})});if(!p.ok||!p.body)throw new Error("Network error");let k=p.body.getReader(),E=new TextDecoder,v="";for(a.remove(),o=document.createElement("div"),o.className="message assistant",d=document.createElement("div"),d.className="bubble",o.appendChild(d),(u=this.shadow.getElementById("messages"))==null||u.appendChild(o);;){let{done:y,value:w}=await k.read();if(y)break;v+=E.decode(w,{stream:!0});let I=v.split(`
`);v=(m=I.pop())!=null?m:"";for(let M of I){if(!M.startsWith("data: "))continue;let B=M.slice(6).trim();if(B!=="[DONE]")try{let x=JSON.parse(B);x.type==="token"&&x.content?(l+=x.content,d.textContent=l,this.scrollToBottom()):x.type==="sources"&&x.sources&&(r.sources=x.sources)}catch(x){}}}}catch(p){a.remove(),l="Sorry, I couldn't connect. Please try again.",o||(o=document.createElement("div"),o.className="message assistant",d=document.createElement("div"),d.className="bubble",o.appendChild(d),(b=this.shadow.getElementById("messages"))==null||b.appendChild(o)),d&&(d.textContent=l)}finally{if(o){d&&(d.innerHTML=H(l,r.sources));let p=document.createElement("div");p.className="message-time",p.textContent=T(Date.now()),o.appendChild(p)}r.content=l,this.messages.push(r),this.saveSession(),this.scrollToBottom(),this.isStreaming=!1,s.disabled=!1,(f=this.shadow.getElementById("input"))==null||f.focus()}}};function z(){let n=window.ChatWidget;if(!(n!=null&&n.siteId)){console.warn("[Alter Ego] window.ChatWidget.siteId is required");return}new S(n.siteId)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",z):z();})();
