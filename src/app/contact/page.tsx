import Link from "next/link";
import { BrandLogo } from "~/components/brand-logo";
import { TerminalIcon, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { GeistSans } from "geist/font/sans";
import { IBM_Plex_Mono } from "next/font/google";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

export default function PublicContactPage() {
  const email = "hello@altegolabs.com";
  const subject = "ALT EGO LABS — Inquiry";
  const body = "Hi ALT EGO team,\n\nI'd like to talk about:\n\nThanks!";

  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <main className={`${GeistSans.variable} ${ibmPlexMono.variable} bg-[#020202] text-white font-sans min-h-screen overflow-x-hidden flex flex-col`}>
      
      {/* ── Fixed Nav ── */}
      <nav className="w-full z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8 lg:py-5">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo size="md" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase font-bold text-white">ALT EGO</span>
          </Link>
          <Link href="/dashboard" className="font-mono text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-white text-black hover:bg-neutral-200 transition-all rounded-full flex items-center gap-2">
            <TerminalIcon size={12} /> Dashboard
          </Link>
        </div>
      </nav>

      {/* ── Content ── */}
      <section className="flex-1 flex flex-col justify-center px-6 lg:px-8 py-20 relative">
        <div className="absolute inset-0 bg-[#020202] -z-10">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-20 pointer-events-none mix-blend-screen"
               style={{ background: 'radial-gradient(ellipse at top, rgba(59,130,246,0.3) 0%, transparent 70%)' }} />
        </div>
        
        <div className="max-w-2xl mx-auto w-full relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8 text-xs font-mono text-neutral-400">
            <Mail size={12} /> Contact Us
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Let's build your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Alt Ego.</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed mb-10">
            Whether you need a custom integration, enterprise limits, or just want to report a bug, we'd love to hear from you.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            <a
              href={mailto}
              className="group flex flex-col items-center justify-center gap-3 p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
                <Mail size={20} />
              </div>
              <span className="font-semibold text-white">Default Email App</span>
              <span className="text-xs text-neutral-500 font-mono flex items-center gap-1 group-hover:text-blue-400 transition-colors">Launch <ArrowRight size={10} /></span>
            </a>

            <a
              href={gmail}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col items-center justify-center gap-3 p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.728L12 16.669l-6.545-4.941v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.943L12 8.568l8.073-5.054C21.691 2.279 24 3.434 24 5.457z"/></svg>
              </div>
              <span className="font-semibold text-white">Open Gmail</span>
              <span className="text-xs text-neutral-500 font-mono flex items-center gap-1 group-hover:text-red-400 transition-colors">Compose <ArrowRight size={10} /></span>
            </a>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 sm:p-8">
             <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">What to include <CheckCircle2 size={16} className="text-emerald-400" /></h3>
             <ul className="space-y-3">
               {[
                 "What you're trying to achieve",
                 "Your website URL or use-case",
                 "Any bugs or issues you encountered",
                 "Features you'd like to see"
               ].map((item, i) => (
                 <li key={i} className="flex items-start gap-3 text-sm text-neutral-400">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                   {item}
                 </li>
               ))}
             </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
