"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IBM_Plex_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { useSession } from "next-auth/react";
import { BrandLogo } from "~/components/brand-logo";
import { api } from "~/trpc/react";
import { 
  ArrowRight, 
  Terminal as TerminalIcon,
  CheckCircle2,
  MessageSquare,
  Cpu,
  Database,
  Shield,
  Activity,
  Bot,
  Link as LinkIcon,
  ChevronRight,
  ChevronLeft,
  Zap,
  Search,
  Layers,
  Calendar,
  Palette,
  UploadCloud,
  Globe,
  RotateCcw,
  Send
} from "lucide-react";

// Fonts
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

// Components
const RotatingWords = () => {
  const words = ["PORTFOLIO", "DOCUMENTATION", "BRAND", "WEBSITE", "STOREFRONT"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center relative z-10">
      <span className="invisible whitespace-nowrap pointer-events-none tracking-tight">DOCUMENTATION</span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={words[index]}
          initial={{ y: 50, opacity: 0, filter: "blur(8px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -50, opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 whitespace-nowrap tracking-tight"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

type Message = {
  id: string;
  role: "user" | "ego";
  content: string;
  sourcePage?: string;
};

type PersonaDef = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: "blue" | "emerald" | "purple";
  messages: Message[];
};

const PERSONAS: PersonaDef[] = [
  {
    id: "clone",
    name: "ALT CLONE",
    tagline: "Your Digital Twin",
    description: "Upload your past writing, emails, and notes. The Alt Clone mimics your exact tone and answers questions for you.",
    accent: "blue",
    messages: [
      { id: "1", role: "user", content: "What makes your design work different?" },
      { id: "2", role: "ego", content: "I focus on the physicality of digital spaces. I want interfaces to feel tactile and responsive, not just like flat pixels on a screen.", sourcePage: "portfolio/about" },
      { id: "3", role: "user", content: "Any recent examples?" },
      { id: "4", role: "ego", content: "Yeah, check out the Kinetic project. I used spring physics to tie typography to cursor velocity. Super visceral feel.", sourcePage: "portfolio/projects" },
      { id: "5", role: "user", content: "Are you taking new clients right now?" },
      { id: "6", role: "ego", content: "Mostly booked for the quarter, but I always leave room for weird, highly experimental stuff. What are you building?", sourcePage: "portfolio/contact" }
    ]
  },
  {
    id: "support",
    name: "ALT SUPPORT",
    tagline: "The Technical Assistant",
    description: "Point it at your docs and codebase. It provides instant, accurate answers and code snippets to your users.",
    accent: "emerald",
    messages: [
      { id: "1", role: "user", content: "How do I initialize the streaming client?" },
      { id: "2", role: "ego", content: "Import `EgoClient` from `@altego/sdk`. Pass your API key and set `mode: 'stream'`. Want the code snippet?", sourcePage: "docs/sdk/init" },
      { id: "3", role: "user", content: "Yes please, specifically for Next.js." },
      { id: "4", role: "ego", content: "In App Router, you'll want to initialize it server-side or in an API route to protect your key. Here is a secure implementation for `app/api/chat/route.ts`.", sourcePage: "docs/frameworks/nextjs" },
      { id: "5", role: "user", content: "Does it support edge runtime?" },
      { id: "6", role: "ego", content: "Absolutely. The SDK is fully edge-compatible. Just export `const runtime = 'edge'` in your route handler.", sourcePage: "docs/deployment/edge" }
    ]
  },
  {
    id: "sales",
    name: "ALT SALES",
    tagline: "The Revenue Driver",
    description: "Designed to capture leads and close deals. It answers product questions, identifies buying intent, and books meetings.",
    accent: "purple",
    messages: [
      { id: "1", role: "user", content: "Why should I upgrade to the Enterprise plan?" },
      { id: "2", role: "ego", content: "Enterprise unlocks the GEO Engine. This guarantees your brand is synced correctly across external LLM crawlers, not just your own site.", sourcePage: "pricing/enterprise" },
      { id: "3", role: "user", content: "We get maybe 50k visitors a month. Is that overkill?" },
      { id: "4", role: "ego", content: "At 50k, you're exactly in the sweet spot where automated intent capturing pays for itself. You're likely losing 10-15% of leads due to response latency.", sourcePage: "resources/roi-calculator" },
      { id: "5", role: "user", content: "Can I try it first?" },
      { id: "6", role: "ego", content: "I can spin up a sandbox environment for your team for 14 days. Shall I generate the access link?", sourcePage: "sales/trial" }
    ]
  }
];

const accentColors = {
  blue: { bg: "bg-blue-500", text: "text-blue-400", border: "border-blue-500/30", gradient: "from-blue-500/20 to-transparent", bubble: "bg-blue-500/10 border-blue-500/20", shadow: "shadow-[0_0_80px_rgba(59,130,246,0.15)]" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/30", gradient: "from-emerald-500/20 to-transparent", bubble: "bg-emerald-500/10 border-emerald-500/20", shadow: "shadow-[0_0_80px_rgba(16,185,129,0.15)]" },
  purple: { bg: "bg-purple-500", text: "text-purple-400", border: "border-purple-500/30", gradient: "from-purple-500/20 to-transparent", bubble: "bg-purple-500/10 border-purple-500/20", shadow: "shadow-[0_0_80px_rgba(168,85,247,0.15)]" },
};

const ChatDemo = ({ activePersona }: { activePersona: PersonaDef }) => {
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setVisibleMessages([]);
    setIsTyping(false);
    
    let isMounted = true;
    let timer: NodeJS.Timeout;
    
    const playConversation = async () => {
      for (let i = 0; i < activePersona.messages.length; i++) {
        if (!isMounted) break;
        
        const msg = activePersona.messages[i];
        
        if (msg.role === "user") {
          await new Promise(r => { timer = setTimeout(r, i === 0 ? 500 : 1500) });
          if (!isMounted) break;
          setVisibleMessages(prev => [...prev, msg]);
        } else {
          setIsTyping(true);
          await new Promise(r => { timer = setTimeout(r, 1200 + Math.random() * 800) });
          if (!isMounted) break;
          setIsTyping(false);
          setVisibleMessages(prev => [...prev, msg]);
        }
      }
    };
    
    playConversation();
    return () => { 
      isMounted = false; 
      clearTimeout(timer);
    };
  }, [activePersona, replayKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages, isTyping]);

  const accent = accentColors[activePersona.accent];

  return (
    <div className={`relative w-full h-[550px] border border-white/10 bg-black/40 backdrop-blur-3xl rounded-[24px] overflow-hidden flex flex-col group transition-all duration-700 shadow-[0_30px_80px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] ${accent.shadow}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
      
      {/* Mac-like Premium Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl z-10 relative">
        <div className="flex items-center gap-4">
           {/* Window Controls */}
           <div className="flex gap-1.5 group">
              <div className="w-3 h-3 rounded-full bg-white/10 group-hover:bg-[#FF5F56] transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-white/10 group-hover:bg-[#FFBD2E] transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-white/10 group-hover:bg-[#27C93F] transition-colors cursor-pointer" />
           </div>
           
           <div className="flex items-center gap-3 ml-2">
             <div className="relative">
                <div className={`w-8 h-8 rounded-full ${accent.bubble} border border-white/10 shadow-lg flex items-center justify-center text-white backdrop-blur-md`}>
                   <Bot size={15} className={accent.text} />
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${accent.bg} border border-black shadow-[0_0_8px_${accent.bg}]`} />
             </div>
             <div>
               <div className="font-sans text-[13px] font-semibold text-white tracking-wide">
                 {activePersona.name}
               </div>
               <div className="text-[10px] text-neutral-400 font-medium tracking-wide">
                 {activePersona.tagline}
               </div>
             </div>
           </div>
        </div>
        
        <div className="flex gap-2">
           <button onClick={() => setReplayKey(k => k + 1)} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all shadow-inner" title="Restart conversation">
              <RotateCcw size={13} />
           </button>
        </div>
      </div>
      
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth relative"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style dangerouslySetInnerHTML={{__html: `div::-webkit-scrollbar { display: none; }`}} />
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`flex items-end gap-2 max-w-[90%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto flex-row"}`}
            >
              {msg.role === "ego" && (
                <div className={`w-6 h-6 rounded-full flex-shrink-0 ${accent.bubble} border flex items-center justify-center mb-1`}>
                   <Bot size={12} className={accent.text} />
                </div>
              )}
              <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 text-[14px] leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,0.15)] ${
                  msg.role === "user" 
                    ? "bg-gradient-to-br from-neutral-800 to-neutral-900 text-white rounded-[20px] rounded-tr-[6px] border border-white/5" 
                    : `${accent.bubble} text-white rounded-[20px] rounded-tl-[6px] border border-white/10 backdrop-blur-md`
                }`}>
                  {msg.content}
                </div>
                {msg.sourcePage && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-neutral-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer w-fit self-start"
                  >
                    <LinkIcon size={10} />
                    <span>Source: {msg.sourcePage}</span>
                    <CheckCircle2 size={10} className="text-green-500" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-end gap-2 mr-auto"
            >
               <div className={`w-6 h-6 rounded-full flex-shrink-0 ${accent.bubble} border flex items-center justify-center mb-1`}>
                   <Bot size={12} className={accent.text} />
               </div>
                <div className={`px-4 py-3.5 ${accent.bubble} rounded-[20px] rounded-tl-[6px] border border-white/10 backdrop-blur-md flex items-center gap-1.5 h-[42px] shadow-[0_4px_20px_rgba(0,0,0,0.15)]`}>
                  <motion.div animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className={`w-1.5 h-1.5 rounded-full ${accent.bg}`} />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className={`w-1.5 h-1.5 rounded-full ${accent.bg}`} />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className={`w-1.5 h-1.5 rounded-full ${accent.bg}`} />
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-black/40 backdrop-blur-2xl z-10 border-t border-white/5 relative">
         <div className="flex items-center gap-3 px-2 py-2 bg-white/5 border border-white/10 rounded-[24px] text-neutral-500 text-sm focus-within:border-white/30 focus-within:bg-white/10 transition-all mb-2 shadow-inner">
            <input 
              type="text" 
              placeholder={`Message ${activePersona.name}...`} 
              className="flex-1 bg-transparent border-none outline-none px-4 text-[14.5px] text-white placeholder:text-neutral-500" 
              disabled 
            />
            <button disabled className="w-9 h-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)] flex items-center justify-center text-white/80 hover:text-white transition-all flex-shrink-0 mr-1">
               <Send size={15} className="-ml-0.5" />
            </button>
         </div>
         <div className="text-center">
            <span className="text-[10px] text-neutral-500 font-medium tracking-wide">Powered by Alt Ego Engine</span>
         </div>
      </div>
    </div>
  );
};

const DashboardMockup = () => {
  const [activeTab, setActiveTab] = useState("connectors");

  return (
    <section className="py-32 px-6 lg:px-8 bg-[#020202] border-t border-white/5 relative">
       <div className="max-w-7xl mx-auto">
         <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              CONNECT <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">EVERYTHING.</span>
            </h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
               Your Ego is only as smart as the data it has access to. Sync your databases, schedules, and documents in seconds.
            </p>
         </div>

         {/* Dashboard Window */}
         <div className="max-w-5xl mx-auto bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.03)] flex flex-col min-h-[450px] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
            
            {/* Premium Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-xl border-b border-white/5 relative z-20">
               <div className="flex items-center gap-2">
                 <div className="flex gap-1.5 mr-4 group">
                    <div className="w-3 h-3 rounded-full bg-white/10 group-hover:bg-[#FF5F56] transition-colors cursor-pointer" />
                    <div className="w-3 h-3 rounded-full bg-white/10 group-hover:bg-[#FFBD2E] transition-colors cursor-pointer" />
                    <div className="w-3 h-3 rounded-full bg-white/10 group-hover:bg-[#27C93F] transition-colors cursor-pointer" />
                 </div>
                 <div className="hidden sm:flex items-center gap-2 text-neutral-500">
                    <div className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 hover:text-neutral-300 transition-colors cursor-pointer">
                      <ChevronLeft size={14} />
                    </div>
                    <div className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 hover:text-neutral-300 transition-colors cursor-pointer">
                      <ChevronRight size={14} />
                    </div>
                 </div>
               </div>
               
               <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-1.5 bg-white/5 border border-white/10 rounded-lg max-w-[400px] w-[50%] shadow-inner mx-4">
                  <Globe size={12} className="text-neutral-500 hidden sm:block" />
                  <span className="font-mono text-[11px] text-neutral-300 tracking-wide flex-1 text-center truncate">app.altegolabs.com/workspace</span>
                  <Activity size={12} className="text-blue-400 hidden sm:block animate-pulse" />
               </div>

               <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 border border-white/20 shadow-sm" />
               </div>
            </div>

            <div className="flex flex-col md:flex-row flex-1 relative z-10">
               {/* Sidebar */}
               <div className="w-full md:w-64 bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col gap-2">
               <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-4">Settings</div>
               
               <button onClick={() => setActiveTab("connectors")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === "connectors" ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"}`}>
                 <LinkIcon size={16} /> Integrations
               </button>
               
               <button onClick={() => setActiveTab("uploads")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === "uploads" ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"}`}>
                 <UploadCloud size={16} /> Knowledge Base
               </button>

               <button onClick={() => setActiveTab("branding")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === "branding" ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"}`}>
                 <Palette size={16} /> Brand & Persona
               </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 bg-[#050505]">
               <AnimatePresence mode="wait">
                  {activeTab === "connectors" && (
                    <motion.div key="connectors" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                       <div className="flex items-center justify-between mb-8">
                         <div>
                           <h3 className="text-xl font-bold">Integrations</h3>
                           <p className="text-sm text-neutral-400">Connect live data sources to your Ego.</p>
                         </div>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2 p-5 border border-blue-500/30 rounded-xl bg-blue-500/5 flex flex-col sm:flex-row sm:items-center gap-5">
                              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                <Globe size={24} />
                              </div>
                              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                 <div>
                                   <h4 className="font-bold text-base text-blue-100">Website Crawler</h4>
                                   <p className="text-sm text-blue-200/70">Auto-syncs all pages, posts, and dynamic content.</p>
                                 </div>
                                 <div className="flex items-center gap-2 text-xs font-mono text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full border border-green-400/20 whitespace-nowrap self-start sm:self-auto">
                                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Syncing (244 pages)
                                 </div>
                              </div>
                          </div>

                          <div className="p-5 border border-white/10 rounded-xl bg-white/[0.02] flex items-start gap-4">
                             <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-white">
                               <Database size={20} />
                             </div>
                             <div className="flex-1">
                               <h4 className="font-semibold text-sm">PostgreSQL</h4>
                               <p className="text-xs text-neutral-500 mb-3">Sync table schemas & live data</p>
                               <div className="flex items-center gap-2 text-xs font-mono text-green-400">
                                 <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
                               </div>
                             </div>
                          </div>
                          <div className="p-5 border border-white/10 rounded-xl bg-white/[0.02] flex items-start gap-4">
                             <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                               <Calendar size={20} />
                             </div>
                             <div className="flex-1">
                               <h4 className="font-semibold text-sm">Calendly</h4>
                               <p className="text-xs text-neutral-500 mb-3">Allow Ego to book meetings</p>
                               <button className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 transition-colors text-xs font-bold rounded-md w-full">Connect</button>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {activeTab === "uploads" && (
                    <motion.div key="uploads" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                       <div className="flex items-center justify-between mb-8">
                         <div>
                           <h3 className="text-xl font-bold">Knowledge Base</h3>
                           <p className="text-sm text-neutral-400">Train your Ego on static documents.</p>
                         </div>
                         <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono uppercase rounded-full">Coming Soon</span>
                       </div>
                       <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-white/[0.01]">
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <UploadCloud className="text-neutral-400" size={24} />
                          </div>
                          <p className="font-medium text-neutral-300 mb-1">Drag and drop files here</p>
                          <p className="text-sm text-neutral-500">Supports PDF, CSV, TXT, and DOCX (up to 50MB)</p>
                       </div>
                    </motion.div>
                  )}

                  {activeTab === "branding" && (
                    <motion.div key="branding" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                       <div className="flex items-center justify-between mb-8">
                         <div>
                           <h3 className="text-xl font-bold">Brand & Persona</h3>
                           <p className="text-sm text-neutral-400">Customize how your Ego looks and speaks.</p>
                         </div>
                       </div>
                       <div className="space-y-6">
                         <div>
                           <label className="text-xs font-mono text-neutral-500 uppercase mb-2 block">System Prompt / Instructions</label>
                           <textarea className="w-full h-24 bg-black border border-white/10 rounded-xl p-4 text-sm text-neutral-300 resize-none focus:outline-none focus:border-blue-500/50" defaultValue="You are a helpful, witty assistant for Alt Ego Labs. You communicate in short, punchy sentences." />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-mono text-neutral-500 uppercase mb-2 block">Primary Color</label>
                              <div className="flex items-center gap-3 border border-white/10 rounded-xl p-3 bg-black">
                                 <div className="w-6 h-6 rounded-full bg-blue-500 border border-white/20" />
                                 <span className="font-mono text-xs">#3B82F6</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-mono text-neutral-500 uppercase mb-2 block">Widget Style</label>
                              <select className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white appearance-none">
                                <option>Floating Bubble</option>
                                <option>Inline Chat</option>
                                <option>Sidebar</option>
                              </select>
                            </div>
                         </div>
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>
            </div>
         </div>
       </div>
    </section>
  );
};

function normalizeHttps(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function deriveSiteNameFromHost(host: string) {
  const clean = host.replace(/^www\./i, "").toLowerCase();
  const parts = clean.split(".").filter(Boolean);
  const core =
    parts.length >= 2
      ? parts[parts.length - 2] // good enough heuristic for most domains
      : parts[0] ?? clean;
  const spaced = core.replace(/[-_]+/g, " ").trim();
  return spaced
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .slice(0, 100);
}

export default function HomePage() {
  const [activePersonaId, setActivePersonaId] = useState<string>("clone");
  const activePersona = PERSONAS.find(p => p.id === activePersonaId) || PERSONAS[0];
  const router = useRouter();
  const { status } = useSession();

  const [onboardUrl, setOnboardUrl] = useState("");
  const [onboardError, setOnboardError] = useState<string>("");
  const autoStartOnce = useRef(false);

  const createSite = api.sites.create.useMutation({
    onSuccess: (site) => {
      setOnboardError("");
      setOnboardUrl("");
      sessionStorage.removeItem("ae:onboardUrl");
      router.push(`/sites/${site.id}?setup=1&tab=branding`);
      router.refresh();
    },
    onError: (e) => {
      setOnboardError(e.message);
    },
  });

  const startFromUrl = (raw: string) => {
    const normalized = normalizeHttps(raw);
    let host = "";
    try {
      host = new URL(normalized).host;
    } catch {
      setOnboardError("Enter a valid URL (e.g. altegolabs.com).");
      return;
    }
    if (!host) {
      setOnboardError("Enter a valid URL (e.g. altegolabs.com).");
      return;
    }

    const name = deriveSiteNameFromHost(host);
    setOnboardError("");

    if (status !== "authenticated") {
      sessionStorage.setItem("ae:onboardUrl", normalized);
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/?onboard=1")}`);
      return;
    }

    createSite.mutate({
      name,
      primaryUrl: normalized,
      allowedDomains: [host],
    });
  };

  useEffect(() => {
    if (autoStartOnce.current) return;
    if (status !== "authenticated") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("onboard")) return;
    const pending = sessionStorage.getItem("ae:onboardUrl") ?? "";
    if (!pending) return;
    autoStartOnce.current = true;
    startFromUrl(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <main className={`${GeistSans.variable} ${ibmPlexMono.variable} bg-[#020202] text-white selection:bg-white/20 font-sans min-h-screen overflow-x-hidden`}>
      
      {/* ── Fixed UI Elements ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
        <motion.nav 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto flex items-center justify-between px-2 py-2 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset] w-full max-w-3xl transition-all duration-500 hover:bg-black/50 hover:border-white/15"
        >
          <Link href="/" className="flex items-center gap-3 pl-4 pr-6 py-2 rounded-full hover:bg-white/5 transition-colors">
            <BrandLogo size="sm" />
            <span className="font-mono text-sm tracking-[0.2em] uppercase font-bold text-white mt-0.5">ALT EGO</span>
          </Link>
          
          <div className="flex items-center gap-2 pr-1">
            <Link href="/contact" className="hidden sm:flex text-xs font-semibold text-neutral-400 hover:text-white transition-colors px-4 py-2">
              Talk to us
            </Link>
            <Link href="/dashboard" className="relative group overflow-hidden font-mono text-[10px] font-bold uppercase tracking-widest px-6 py-3 bg-white text-black hover:bg-neutral-200 transition-all rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              <span className="relative z-10 flex items-center gap-2">
                <TerminalIcon size={12} /> Dashboard
              </span>
            </Link>
          </div>
        </motion.nav>
      </div>

      {/* ── Hero Section ── */}
      <section className="relative min-h-[95vh] flex flex-col justify-center px-6 lg:px-8 pt-32 pb-20 overflow-hidden text-center">
        {/* Deep Ambient Background */}
        <div className="absolute inset-0 bg-[#020202]">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] opacity-40 pointer-events-none mix-blend-screen"
               style={{ background: 'radial-gradient(ellipse at top, rgba(59,130,246,0.15) 0%, rgba(168,85,247,0.1) 40%, transparent 70%)' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[600px] opacity-20 pointer-events-none mix-blend-screen"
               style={{ background: 'radial-gradient(circle at bottom right, rgba(16,185,129,0.15) 0%, transparent 60%)' }} />
        </div>
        
        <div className="max-w-5xl mx-auto w-full relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          >
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-300">Alt Ego Engine v0.1 Live</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(2.5rem,7vw,6.5rem)] md:text-[5.5rem] lg:text-[7rem] font-extrabold leading-[1.05] tracking-tight mb-8 flex flex-col items-center"
          >
            <span>GIVE YOUR</span>
            <div className="relative h-[1.3em] overflow-hidden flex items-center justify-center px-8 md:px-12 my-2 md:my-4 rounded-[2rem] md:rounded-[3rem] w-auto">
               <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 border border-white/10 backdrop-blur-xl shadow-[0_0_40px_rgba(59,130,246,0.1)]" />
               <RotatingWords />
            </div>
            <span className="mt-1">AN INTELLIGENT VOICE.</span>
          </motion.h1>

          <motion.form
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[600px] relative group mb-8 z-20"
            onSubmit={(e) => {
              e.preventDefault();
              startFromUrl(onboardUrl);
            }}
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-full blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-center bg-black/60 backdrop-blur-xl border border-white/15 rounded-3xl sm:rounded-full p-1.5 focus-within:border-white/30 focus-within:bg-white/10 transition-all shadow-2xl gap-2 sm:gap-0">
               <div className="hidden sm:block pl-4 text-neutral-500">
                 <Globe size={18} />
               </div>
               <input
                 value={onboardUrl}
                 onChange={(e) => setOnboardUrl(e.target.value)}
                 placeholder="Enter your website URL (e.g. altegolabs.com)"
                 className="flex-1 bg-transparent border-none px-3 py-3 sm:py-2.5 text-sm sm:text-base text-white placeholder:text-neutral-500 outline-none w-full text-center sm:text-left"
                 inputMode="url"
                 autoComplete="url"
               />
               <button
                 type="submit"
                 disabled={!onboardUrl.trim() || createSite.isPending}
                 className="w-full sm:w-auto relative overflow-hidden flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 bg-white text-black hover:bg-neutral-200 disabled:opacity-60 transition-all rounded-2xl sm:rounded-full font-bold text-sm whitespace-nowrap shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
               >
                 <span>{createSite.isPending ? "Creating…" : "Start Building"}</span>
                 <ArrowRight size={16} className="hidden sm:block" />
               </button>
            </div>
            {onboardError && (
              <p className="mt-4 text-xs text-red-400 font-medium absolute left-0 right-0">{onboardError}</p>
            )}
          </motion.form>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-neutral-400 font-light leading-relaxed max-w-2xl mb-12 hover:text-neutral-300 transition-colors"
          >
            Static pages are dead. Deploy an autonomous conversational twin that deeply understands your content, speaks your exact language, and actively engages visitors 24/7.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-3 px-6 py-3 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-semibold text-sm"
            >
              <TerminalIcon size={16} />
              {status === "authenticated" ? "Go to dashboard" : "Sign in"}
            </Link>
            <Link
              href="/contact"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-full transition-all text-neutral-400 hover:text-white text-sm font-medium"
            >
              Talk to sales <ChevronRight size={14} />
            </Link>
          </motion.div>
        </div>

        <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', 
               backgroundSize: '4rem 4rem',
               maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)',
               WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)'
             }} />
      </section>

      {/* ── Interactive Demo Section ── */}
      <section className="py-32 px-6 lg:px-8 bg-[#050505] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 md:mb-24">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              CHOOSE YOUR <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">AGENT.</span>
            </h2>
            <p className="text-neutral-400 text-xl max-w-2xl leading-relaxed">
              Don't settle for a generic chatbot. Deploy a specialized Alt Ego agent that is fine-tuned for your exact use case and speaks perfectly to your audience.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20">
            <div className="flex flex-col gap-4">
              {PERSONAS.map((p) => {
                const isActive = activePersonaId === p.id;
                const accent = accentColors[p.accent];
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePersonaId(p.id)}
                    className={`text-left p-6 md:p-8 rounded-[2rem] border transition-all duration-500 relative overflow-hidden group ${
                      isActive 
                        ? `bg-white/5 ${accent.border} ${accent.shadow} scale-[1.02]` 
                        : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02] hover:scale-[1.01]'
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="active-bg" 
                        className={`absolute inset-0 bg-gradient-to-r ${accent.gradient} opacity-20`} 
                      />
                    )}
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                           <h3 className={`font-mono text-sm uppercase tracking-widest font-bold ${isActive ? accent.text : 'text-neutral-300'}`}>
                             {p.name}
                           </h3>
                           {isActive && <div className={`w-1.5 h-1.5 rounded-full ${accent.bg} animate-pulse`} />}
                        </div>
                        <p className="text-white font-medium text-lg mb-3">{p.tagline}</p>
                        <p className={`text-[15px] leading-relaxed ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {p.description}
                        </p>
                      </div>
                      <ChevronRight className={`mt-2 transition-transform duration-300 ${isActive ? `translate-x-1 ${accent.text}` : 'opacity-0 -translate-x-4 group-hover:opacity-50 group-hover:translate-x-0'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="relative">
               <div className="absolute -inset-8 bg-gradient-to-b from-white/5 to-transparent rounded-[3rem] blur-2xl pointer-events-none" />
               <ChatDemo activePersona={activePersona} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Dashboard / Connectors Mockup ── */}
      <DashboardMockup />

      {/* ── Visual Features / Architecture ── */}
      <section className="py-32 px-6 lg:px-8 border-t border-white/5 bg-[#020202] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">ENGINEERED FOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">AGENTS.</span></h2>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Knowledge Sync Vis */}
            <div className="bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.04] transition-all duration-500 rounded-[2rem] p-8 flex flex-col items-center text-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="h-40 w-full flex items-center justify-center relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                        <Layers className="text-neutral-400" />
                    </div>
                    {/* Animated dots */}
                    <div className="flex gap-2">
                        <motion.div animate={{ x: [0, 20, 40], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-1/2 -translate-y-1/2 left-[60px]" />
                        <motion.div animate={{ x: [0, 20, 40], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear", delay: 0.5 }} className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-1/2 -translate-y-1/2 left-[60px]" />
                        <motion.div animate={{ x: [0, 20, 40], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear", delay: 1.0 }} className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-1/2 -translate-y-1/2 left-[60px]" />
                    </div>
                    <div className="w-16 h-16 ml-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center backdrop-blur-sm shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                        <Database className="text-blue-400" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">Knowledge Sync</h3>
                <p className="text-[15px] text-neutral-400 leading-relaxed">Automatically ingests and vectorizes your site content. The Ego learns in real-time.</p>
            </div>

            {/* Edge Vis */}
            <div className="bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all duration-500 rounded-[2rem] p-8 flex flex-col items-center text-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="h-40 w-full flex items-center justify-center relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} className="w-32 h-32 border border-dashed border-white/10 rounded-full flex items-center justify-center relative">
                        <div className="absolute -top-1.5 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_#34d399]" />
                        <div className="absolute -bottom-1.5 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_#34d399]" />
                    </motion.div>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center z-10 backdrop-blur-md shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                    <Zap className="text-emerald-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">Low-Latency Edge</h3>
                <p className="text-[15px] text-neutral-400 leading-relaxed">Deployed globally on edge networks. Sub-50ms response times for immediate flow.</p>
            </div>

            {/* Shield Vis */}
            <div className="bg-white/[0.02] border border-white/5 hover:border-purple-500/30 hover:bg-white/[0.04] transition-all duration-500 rounded-[2rem] p-8 flex flex-col items-center text-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="h-40 w-full flex items-center justify-center relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                      <motion.div 
                        animate={{ y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                        className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center z-10 relative backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                      >
                        <Shield className="text-purple-400" size={28} />
                      </motion.div>
                      <motion.div
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                        className="absolute inset-0 bg-purple-500/30 rounded-2xl blur-xl"
                      />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">Hallucination Guard</h3>
                <p className="text-[15px] text-neutral-400 leading-relaxed">Strict citation enforcement. If it's not in your docs, the Ego refuses to invent it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Visual GEO Section ── */}
      <section className="py-32 px-6 lg:px-8 bg-[#020202] border-t border-white/5 relative overflow-hidden">
        {/* Massive background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          
          <div className="text-center max-w-4xl mx-auto mb-24">
             <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8">
               THE DAWN OF <br />
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400">G.E.O.</span>
             </h2>
             <p className="text-2xl md:text-3xl text-white font-light leading-snug mb-6">
                SEO is for search engines.<br/> 
                <strong className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Generative Engine Optimization</strong> is for AI.
             </p>
             <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
               Don't let AI hallucinate your product features. Control your brand narrative across the entire agentic ecosystem by serving structured, perfectly aligned knowledge to every crawler.
             </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
             {/* GPT Bot Card */}
             <div className="bg-black border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-purple-500/50 transition-colors duration-500">
                <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-6">
                   <Bot size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">OpenAI GPTBot</h3>
                <p className="text-[15px] text-neutral-400 leading-relaxed mb-6">When ChatGPT searches the web for your company, Ego intercepts the crawl and feeds it your verified knowledge graph.</p>
                <div className="flex items-center gap-2 text-xs font-mono text-purple-400 bg-purple-400/10 px-3 py-1.5 rounded-full w-fit">
                   <Activity size={12} /> Intercepted & Aligned
                </div>
             </div>

             {/* Claude Card */}
             <div className="bg-black border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-purple-500/50 transition-colors duration-500 md:-translate-y-8">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-6">
                   <Cpu size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">Anthropic Claude</h3>
                <p className="text-[15px] text-neutral-400 leading-relaxed mb-6">Claude's artifacts and analysis tools receive perfectly formatted markdown and data schemas, ensuring accurate summaries.</p>
                <div className="flex items-center gap-2 text-xs font-mono text-purple-400 bg-purple-400/10 px-3 py-1.5 rounded-full w-fit">
                   <Activity size={12} /> Semantic Sync
                </div>
             </div>

             {/* Perplexity Card */}
             <div className="bg-black border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-purple-500/50 transition-colors duration-500">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6">
                   <Search size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">Perplexity AI</h3>
                <p className="text-[15px] text-neutral-400 leading-relaxed mb-6">Ensure you are cited as the primary source. Ego provides high-density context chunks that citation engines explicitly prefer.</p>
                <div className="flex items-center gap-2 text-xs font-mono text-purple-400 bg-purple-400/10 px-3 py-1.5 rounded-full w-fit">
                   <Activity size={12} /> Citation Optimized
                </div>
             </div>
          </div>

        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 lg:px-8 border-t border-white/10 bg-[#020202]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-400">ALT EGO LABS</span>
          </div>
          <div className="flex gap-8 font-mono text-xs uppercase tracking-widest text-neutral-500">
             <Link href="#" className="hover:text-white transition-colors">Docs</Link>
             <Link href="#" className="hover:text-white transition-colors">Pricing</Link>
             <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
             <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
      <Script id="chat-widget-config">
        {`window.ChatWidget = { siteId: "cmobwwqxn00l7ry1ysx2iyo9u" };`}
      </Script>
      <Script async src="https://altegolabs.com/widget.js" />
    </main>
  );
}