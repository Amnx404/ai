"use strict";(()=>{var O=Object.defineProperty;var N=(i,e,s)=>e in i?O(i,e,{enumerable:!0,configurable:!0,writable:!0,value:s}):i[e]=s;var o=(i,e,s)=>N(i,typeof e!="symbol"?e+"":e,s);function C(i){return`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${i};
      --primary-dark: color-mix(in srgb, ${i} 80%, #000);
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
      width: 380px;
      height: 580px;
      max-height: calc(100vh - 120px);
      max-width: calc(100vw - 32px);
      background: var(--bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999997;
      transform-origin: bottom right;
      transform: scale(0.85) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                  opacity 0.2s ease;
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
      background: var(--primary);
      color: #fff;
      flex-shrink: 0;
    }

    #header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    #header-avatar svg { width: 18px; height: 18px; fill: #fff; }

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

    .message-time {
      font-size: 11px;
      color: var(--text-secondary);
      padding: 0 4px;
    }

    /* Sources */
    .sources {
      margin-top: 6px;
      padding: 8px 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 12px;
      color: var(--text-secondary);
      max-width: 100%;
    }

    .sources-label {
      font-weight: 600;
      color: var(--text);
      margin-bottom: 4px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .source-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 0;
      overflow: hidden;
    }

    .source-item a {
      color: var(--primary);
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
    }

    .source-item a:hover { text-decoration: underline; }

    .source-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--primary);
      flex-shrink: 0;
    }

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
  `}var L="rr_chat_session",H="rr_chat_messages";function j(i){var s,t;let e=document.querySelectorAll("script[src*='widget.js']");for(let r of e)try{return new URL(r.src).origin}catch(n){}return(t=(s=window.ChatWidget)==null?void 0:s.apiBase)!=null?t:""}function y(i){return new Date(i).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function d(i){return i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var b=class{constructor(e){o(this,"shadow");o(this,"host");o(this,"config",null);o(this,"messages",[]);o(this,"siteId");o(this,"baseUrl");o(this,"sessionId",null);o(this,"token",null);o(this,"isOpen",!1);o(this,"isStreaming",!1);this.siteId=e,this.baseUrl=j(e),this.host=document.createElement("div"),this.host.id="rr-chat-widget",this.host.style.cssText="position:fixed;z-index:999999;",document.body.appendChild(this.host),this.shadow=this.host.attachShadow({mode:"closed"}),this.init()}async init(){try{let t=await fetch(`${this.baseUrl}/api/v1/widget-config?siteId=${this.siteId}`);if(!t.ok)return;this.config=await t.json()}catch(t){this.config={id:this.siteId,primaryColor:"#6366f1",title:"Chat",greeting:"Hi! How can I help you today?",allowedTopics:[]}}let e=sessionStorage.getItem(`${L}:${this.siteId}`);if(e)try{let{sessionId:t,token:r}=JSON.parse(e);this.sessionId=t,this.token=r}catch(t){}let s=sessionStorage.getItem(`${H}:${this.siteId}`);if(s)try{this.messages=JSON.parse(s)}catch(t){}this.render(),this.attachListeners()}saveSession(){this.sessionId&&this.token&&sessionStorage.setItem(`${L}:${this.siteId}`,JSON.stringify({sessionId:this.sessionId,token:this.token})),sessionStorage.setItem(`${H}:${this.siteId}`,JSON.stringify(this.messages))}render(){var s,t,r,n;let e=(t=(s=this.config)==null?void 0:s.primaryColor)!=null?t:"#6366f1";this.shadow.innerHTML=`
      <style>${C(e)}</style>

      <button id="launcher" aria-label="Open chat" title="Open chat">
        <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <div id="panel" role="dialog" aria-label="Chat window">
        <div id="header">
          <div id="header-avatar">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <div id="header-info">
            <div id="header-title">${d((n=(r=this.config)==null?void 0:r.title)!=null?n:"Chat")}</div>
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
          ${this.messages.map(p=>this.renderMessage(p)).join("")}
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
          Powered by <a href="https://roboracer.ai" target="_blank" rel="noopener">RoboRacer</a>
        </div>
      </div>
    `}renderGreeting(){var e;return!((e=this.config)!=null&&e.greeting)||this.messages.length>0?"":`<div id="greeting">${d(this.config.greeting)}</div>`}renderMessage(e){let s=e.sources&&e.sources.length>0?`<div class="sources">
            <div class="sources-label">Sources</div>
            ${e.sources.map(t=>`<div class="source-item">
                    <span class="source-dot"></span>
                    ${t.url?`<a href="${d(t.url)}" target="_blank" rel="noopener">${d(t.title)}</a>`:`<span>${d(t.title)}</span>`}
                  </div>`).join("")}
          </div>`:"";return`
      <div class="message ${e.role}">
        <div class="bubble">${d(e.content)}</div>
        ${s}
        <div class="message-time">${y(e.ts)}</div>
      </div>
    `}appendMessageToDOM(e,s){let t=document.createElement("div");t.className=`message ${e.role}`,s&&(t.id=s),t.innerHTML=`
      <div class="bubble">${d(e.content)}</div>
      <div class="message-time">${y(e.ts)}</div>
    `;let r=this.shadow.getElementById("messages");return r==null||r.appendChild(t),this.scrollToBottom(),t}showTyping(){var s;let e=document.createElement("div");return e.className="message assistant",e.id="typing-indicator",e.innerHTML='<div class="typing"><span></span><span></span><span></span></div>',(s=this.shadow.getElementById("messages"))==null||s.appendChild(e),this.scrollToBottom(),e}scrollToBottom(){let e=this.shadow.getElementById("messages");e&&(e.scrollTop=e.scrollHeight)}attachListeners(){let e=this.shadow.getElementById("launcher"),s=this.shadow.getElementById("close-btn"),t=this.shadow.getElementById("input"),r=this.shadow.getElementById("send-btn");e.addEventListener("click",()=>this.toggle()),s.addEventListener("click",()=>this.close()),t.addEventListener("keydown",n=>{n.key==="Enter"&&!n.shiftKey&&(n.preventDefault(),this.sendMessage())}),t.addEventListener("input",()=>{t.style.height="auto",t.style.height=`${Math.min(t.scrollHeight,120)}px`}),r.addEventListener("click",()=>void this.sendMessage())}toggle(){this.isOpen?this.close():this.open()}open(){var e,s;this.isOpen=!0,(e=this.shadow.getElementById("launcher"))==null||e.classList.add("open"),(s=this.shadow.getElementById("panel"))==null||s.classList.add("open"),setTimeout(()=>{var t;(t=this.shadow.getElementById("input"))==null||t.focus()},250),this.scrollToBottom()}close(){var e,s;this.isOpen=!1,(e=this.shadow.getElementById("launcher"))==null||e.classList.remove("open"),(s=this.shadow.getElementById("panel"))==null||s.classList.remove("open")}async ensureSession(){if(!(this.sessionId&&this.token))try{let e=await fetch(`${this.baseUrl}/api/v1/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId})});if(e.ok){let s=await e.json();this.sessionId=s.sessionId,this.token=s.token,this.saveSession()}}catch(e){}}async sendMessage(){var w,k,E,I,M,S;if(this.isStreaming)return;let e=this.shadow.getElementById("input"),s=this.shadow.getElementById("send-btn"),t=e.value.trim();if(!t)return;e.value="",e.style.height="auto",(w=this.shadow.getElementById("greeting"))==null||w.remove();let r={role:"user",content:t,ts:Date.now()};this.messages.push(r),this.appendMessageToDOM(r),this.isStreaming=!0,s.disabled=!0,await this.ensureSession();let n=this.showTyping(),p="",u={role:"assistant",content:"",ts:Date.now()},a=null,l=null;try{let c=await fetch(`${this.baseUrl}/api/v1/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,messages:this.messages.slice(-10).map(({role:x,content:v})=>({role:x,content:v})),sessionId:this.sessionId,token:this.token,stream:!0})});if(!c.ok||!c.body)throw new Error("Network error");let m=c.body.getReader(),h=new TextDecoder,f="";for(n.remove(),a=document.createElement("div"),a.className="message assistant",l=document.createElement("div"),l.className="bubble",a.appendChild(l),(k=this.shadow.getElementById("messages"))==null||k.appendChild(a);;){let{done:x,value:v}=await m.read();if(x)break;f+=h.decode(v,{stream:!0});let T=f.split(`
`);f=(E=T.pop())!=null?E:"";for(let B of T){if(!B.startsWith("data: "))continue;let $=B.slice(6).trim();if($!=="[DONE]")try{let g=JSON.parse($);g.type==="token"&&g.content?(p+=g.content,l.textContent=p,this.scrollToBottom()):g.type==="sources"&&g.sources&&(u.sources=g.sources)}catch(g){}}}}catch(c){n.remove(),p="Sorry, I couldn't connect. Please try again.",a||(a=document.createElement("div"),a.className="message assistant",l=document.createElement("div"),l.className="bubble",a.appendChild(l),(I=this.shadow.getElementById("messages"))==null||I.appendChild(a)),l&&(l.textContent=p)}finally{if(a){if((M=u.sources)!=null&&M.length){let m=document.createElement("div");m.className="sources",m.innerHTML=`
            <div class="sources-label">Sources</div>
            ${u.sources.map(h=>`<div class="source-item">
                    <span class="source-dot"></span>
                    ${h.url?`<a href="${d(h.url)}" target="_blank" rel="noopener">${d(h.title)}</a>`:`<span>${d(h.title)}</span>`}
                  </div>`).join("")}
          `,a.appendChild(m)}let c=document.createElement("div");c.className="message-time",c.textContent=y(Date.now()),a.appendChild(c)}u.content=p,this.messages.push(u),this.saveSession(),this.scrollToBottom(),this.isStreaming=!1,s.disabled=!1,(S=this.shadow.getElementById("input"))==null||S.focus()}}};function z(){let i=window.ChatWidget;if(!(i!=null&&i.siteId)){console.warn("[RoboRacer] window.ChatWidget.siteId is required");return}new b(i.siteId)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",z):z();})();
