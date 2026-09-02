import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Privacy from '@/pages/privacy';
import Support from '@/pages/support';
import { Route, Switch, Router as WouterRouter, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Menu, X, ArrowRight, ExternalLink, Check
} from 'lucide-react';

const queryClient = new QueryClient();

const storeLinks = {
  appStore: getStoreUrl(import.meta.env.VITE_ZIVR_APP_STORE_URL, 'appStore'),
  googlePlay: getStoreUrl(import.meta.env.VITE_ZIVR_GOOGLE_PLAY_URL, 'googlePlay'),
};

function getStoreUrl(value: unknown, platform: 'appStore' | 'googlePlay') {
  if (typeof value !== 'string') return undefined;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return undefined;

    if (platform === 'appStore') {
      const isAppleListing =
        url.hostname === 'apps.apple.com' &&
        /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?app\/(?:[^/]+\/)?id\d+/i.test(url.pathname);
      return isAppleListing ? url.toString() : undefined;
    }

    const isGoogleListing =
      url.hostname === 'play.google.com' &&
      url.pathname === '/store/apps/details' &&
      Boolean(url.searchParams.get('id'));

    return isGoogleListing ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function Reveal({ children, className = "" }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}) {
  return <div className={className}>{children}</div>;
}

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Message', href: '#message' },
    { label: 'Family', href: '#family' },
    { label: 'Privacy', href: '#privacy' }
  ];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-paper/90 backdrop-blur-xl shadow-sm py-2' : 'bg-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <span className="font-display font-bold text-2xl tracking-tight text-ink">ZIVR</span>
          <div className="w-2.5 h-2.5 rounded-full bg-mint pulse-mint mt-1"></div>
        </a>
        
        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-slate">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-ink transition-colors">
              {link.label}
            </a>
          ))}
        </div>
        
        <div className="hidden md:block">
          <a href="#download" className="bg-coral hover:bg-coral-dark text-white font-semibold px-6 py-2.5 rounded-full transition-all inline-block">
            Get ZIVR
          </a>
        </div>

        <button
          className="md:hidden text-ink p-2 -mr-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-[72px] left-0 w-full bg-paper border-b border-border shadow-xl py-4 px-6 flex flex-col gap-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-lg font-semibold text-ink py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#download"
              className="bg-coral text-white font-semibold px-6 py-3 rounded-full text-center mt-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Get ZIVR
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function HeroAnimatedChat() {
  return (
    <div className="relative w-full max-w-sm mx-auto shadow-[0_32px_64px_rgba(124,111,240,0.15),0_16px_32px_rgba(255,90,95,0.1)] rounded-[28px] bg-ink text-white overflow-hidden flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-violet/20 flex items-center justify-center font-bold text-violet">M</div>
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-mint border-2 border-ink pulse-mint"></div>
        </div>
        <span className="font-semibold text-lg">Mom</span>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto no-scrollbar relative">
        {/* Incoming 1 */}
        <div className="animate-pop-in flex items-end gap-2" style={{ animationDelay: '0.5s' }}>
          <div className="bg-slate-light/20 text-white rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%]">
            Landed! 🛬 all good
          </div>
        </div>

        {/* Outgoing 1 with reaction */}
        <div className="animate-pop-in flex flex-col items-end gap-1 mt-2" style={{ animationDelay: '1.5s' }}>
          <div className="relative">
            <div className="bg-coral text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%]">
              so relieved, love you
            </div>
            {/* Reaction Badge */}
            <div className="animate-badge-pop absolute -bottom-3 -left-3 bg-ink border border-white/20 rounded-full px-1.5 py-0.5 text-sm shadow-sm" style={{ animationDelay: '2.8s' }}>
              ❤️
            </div>
          </div>
        </div>

        {/* Incoming 2 (Song) */}
        <div className="animate-pop-in flex items-end gap-2 mt-4" style={{ animationDelay: '3.5s' }}>
          <div className="bg-slate-light/20 text-white rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">🎵</div>
            <span className="font-medium">sent a song</span>
          </div>
        </div>

        {/* Check-In Card */}
        <div className="animate-pop-in mt-4 bg-white/5 border border-white/10 rounded-2xl p-4" style={{ animationDelay: '4.5s' }}>
          <p className="font-semibold text-sm text-mint mb-1">Family Check-In</p>
          <p className="text-white font-medium mb-3">everyone home safe?</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden flex gap-1">
              <div className="h-full bg-mint animate-fill-mint w-full rounded-full" style={{ animationDelay: '5.0s', opacity: 0 }}></div>
              <div className="h-full bg-mint animate-fill-mint w-full rounded-full" style={{ animationDelay: '5.2s', opacity: 0 }}></div>
              <div className="h-full bg-mint animate-fill-mint w-full rounded-full" style={{ animationDelay: '5.4s', opacity: 0 }}></div>
              <div className="h-full bg-white/20 w-full rounded-full"></div>
            </div>
          </div>
          <p className="text-xs text-slate-light">3 of 4 responded</p>
        </div>

        {/* Typing indicator */}
        <div className="animate-pop-in flex items-end gap-2 mt-4" style={{ animationDelay: '6.5s' }}>
          <div className="bg-slate-light/10 text-slate-light rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5 text-sm">
            Mom is typing 
            <div className="flex gap-1 ml-1">
              <span className="w-1 h-1 rounded-full bg-slate-light typing-dot"></span>
              <span className="w-1 h-1 rounded-full bg-slate-light typing-dot"></span>
              <span className="w-1 h-1 rounded-full bg-slate-light typing-dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section id="top" className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          {/* Left Col */}
          <div className="text-center lg:text-left">
            <Reveal>
              <h1 className="text-[clamp(2.4rem,4.6vw,3.9rem)] font-extrabold text-ink tracking-tight mb-6 leading-[1.05]">
                Message like you mean it.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-xl md:text-2xl text-slate max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed font-sans">
                Blending expressive everyday chat, real family controls, and privacy features explained honestly.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <a href="#download" className="bg-coral hover:bg-coral-dark text-white font-semibold px-8 py-4 rounded-full transition-all text-lg w-full sm:w-auto text-center">
                  Get ZIVR
                </a>
                <a href="#message" className="bg-transparent text-ink border border-slate-light hover:border-ink font-semibold px-8 py-4 rounded-full transition-all text-lg w-full sm:w-auto text-center">
                  See what's inside
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right Col */}
          <div className="flex justify-center lg:justify-end">
            <Reveal delay={0.3} direction="left" className="w-full max-w-sm">
               <HeroAnimatedChat />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageSection() {
  const tiles = [
    { title: "Voice & musical messages", text: "Record a voice note or drop in a song when words alone won't cut it." },
    { title: "Photos with rules", text: "View-once, timed, or password-protected pictures; you decide how long a moment lasts." },
    { title: "Reactions & typing indicators", text: "Feel a conversation as it happens." },
    { title: "Pre-send translation", text: "Write in your language, send in theirs, original stays available." },
    { title: "AI suggested replies", text: "A quick assist when you want one, never in the way when you don't." },
    { title: "GIFs, emoji & contact cards", text: "Say it with a GIF, react in a tap, drop a contact into the chat." }
  ];

  return (
    <section id="message" className="py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink mb-4">Say more, your way</h2>
          <p className="text-xl text-slate max-w-2xl mb-20">
            Every kind of message, minus the flat texting-app feel.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-x-8 gap-y-12 max-w-4xl mx-auto relative">
          {tiles.map((tile, i) => {
            const isOdd = i % 2 === 0; // 0-indexed, so evens are "odd" visually (1st, 3rd, 5th)
            return (
              <Reveal key={i} delay={i * 0.1}>
                <div 
                  className={`bg-paper p-8 flex flex-col justify-center min-h-[160px] ${!isOdd ? 'md:mt-[26px]' : ''}`}
                  style={{
                    borderRadius: isOdd ? '22px 22px 22px 4px' : '22px 22px 4px 22px'
                  }}
                >
                  <h3 className="text-xl font-bold text-ink mb-2">{tile.title}</h3>
                  <p className="text-slate leading-relaxed">{tile.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FamilySection() {
  const bullets = [
    "Parent and child modes with a shared family dashboard",
    "Recurring access schedules (school, bedtime) plus temporary unlocks a parent can end early",
    "Contact and group requests held for approval before a child sees them",
    "Safety alerts calibrated by severity (all flagged / medium-and-up / high only)"
  ];

  return (
    <section id="family" className="py-32 bg-paper relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink mb-6">A safety net for the people you love</h2>
              <p className="text-xl text-slate mb-10 leading-relaxed">
                Controls that feel like care, not just restriction.
              </p>
              
              <ul className="space-y-6">
                {bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="w-3 h-3 rounded-full bg-violet shrink-0 mt-2"></div>
                    <p className="text-lg text-ink font-medium leading-relaxed">{bullet}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          
          <div className="flex justify-center lg:justify-end">
            <Reveal direction="left">
              <div className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-sm border border-border">
                <h3 className="text-xl font-bold text-ink mb-6 text-center">Weekend Check-In</h3>
                <div className="flex justify-center gap-4 mb-6">
                  {/* Responded */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-slate-light/20"></div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-mint rounded-full border-2 border-white flex items-center justify-center text-white font-bold"><Check className="w-3 h-3" /></div>
                  </div>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-slate-light/20"></div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-mint rounded-full border-2 border-white flex items-center justify-center text-white font-bold"><Check className="w-3 h-3" /></div>
                  </div>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-slate-light/20"></div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-mint rounded-full border-2 border-white flex items-center justify-center text-white font-bold"><Check className="w-3 h-3" /></div>
                  </div>
                  {/* Pending */}
                  <div className="relative opacity-40">
                    <div className="w-12 h-12 rounded-full bg-slate-light/20"></div>
                  </div>
                </div>
                <p className="text-center text-sm text-slate-light font-medium bg-paper py-3 rounded-xl">
                  Replies stay private to you
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  const bullets = [
    "Lock any chat with a 4–6 digit passcode, optional hint, biometric unlock where supported",
    "Optional local AES-256 encryption for messages kept on-device",
    "Screen-capture protection requests on qualifying self-destructing pictures",
    "Block and report controls"
  ];

  return (
    <section id="privacy" className="py-32 bg-ink text-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Privacy you can actually explain</h2>
          <p className="text-xl text-slate-light mb-12">
            No jargon, no overselling — here's exactly what's protected.
          </p>
          
          <ul className="space-y-6 max-w-2xl mb-16">
            {bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-4">
                <div className="w-3 h-3 rounded-full bg-mint shrink-0 mt-2"></div>
                <p className="text-lg font-medium leading-relaxed">{bullet}</p>
              </li>
            ))}
          </ul>

          <div className="pt-8 border-t border-white/10 max-w-3xl">
            <p className="text-sm text-slate-light leading-relaxed">
              Honest disclaimer: ZIVR is not an end-to-end encrypted messenger. Messages sent through the server are stored server-side to support multi-device access and safety features. Full details live in the <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ExportSection() {
  return (
    <section className="py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink mb-16 text-center">Built for the conversations that matter</h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-12">
          <Reveal delay={0.1}>
            <div className="pt-6 border-t-2 border-ink">
              <h3 className="text-xl font-bold text-ink mb-3">Export-ready PDFs</h3>
              <p className="text-slate leading-relaxed">Personal, business, or legal-ready formats.</p>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="pt-6 border-t-2 border-ink">
              <h3 className="text-xl font-bold text-ink mb-3">Pick what's included</h3>
              <p className="text-slate leading-relaxed">Full thread or hand-picked messages.</p>
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="pt-6 border-t-2 border-ink">
              <h3 className="text-xl font-bold text-ink mb-3">Optional AI summary</h3>
              <p className="text-slate leading-relaxed">Or key-points appendix, added only after explicit consent.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function PersonalizeSection() {
  const chips = [
    "Light / Dark / System",
    "Bubble Skins",
    "Custom Typing Emoji",
    "VibeCoin Extras"
  ];

  return (
    <section className="py-24 bg-paper relative text-center">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink mb-6">Make it feel like yours</h2>
          <p className="text-xl text-slate mb-12">
            The parts nobody needs, but everybody ends up loving.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            {chips.map((chip, i) => (
              <span key={i} className="px-6 py-3 bg-white text-ink font-semibold rounded-full shadow-sm border border-border">
                {chip}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CallsPreviewStrip() {
  return (
    <div className="bg-ink text-white py-4 px-6 text-center border-t border-white/10">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-4xl mx-auto">
        <span className="px-2 py-0.5 bg-violet text-white text-xs font-bold uppercase tracking-wider rounded-sm shrink-0">Preview</span>
        <p className="text-sm font-medium text-slate-light">
          Voice and video calling — the interface is live now, with the full calling experience on the way.
        </p>
      </div>
    </div>
  );
}

function FooterCTA() {
  const { appStore, googlePlay } = storeLinks;
  
  return (
    <section id="download" className="py-32 bg-white text-center">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-ink mb-6">Get ZIVR</h2>
          <p className="text-xl text-slate mb-12">Available for iOS and Android.</p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {appStore ? (
              <a href={appStore} target="_blank" rel="noreferrer" className="px-8 py-4 bg-paper hover:bg-slate-light/10 text-ink font-semibold rounded-xl transition-colors border border-border w-full sm:w-auto inline-block">
                Get ZIVR — App Store
              </a>
            ) : (
              <button disabled className="px-8 py-4 bg-paper/50 text-slate-light font-semibold rounded-xl border border-border w-full sm:w-auto cursor-not-allowed">
                App Store (Coming Soon)
              </button>
            )}
            
            {googlePlay ? (
              <a href={googlePlay} target="_blank" rel="noreferrer" className="px-8 py-4 bg-paper hover:bg-slate-light/10 text-ink font-semibold rounded-xl transition-colors border border-border w-full sm:w-auto inline-block">
                Get ZIVR — Google Play
              </a>
            ) : (
              <button disabled className="px-8 py-4 bg-paper/50 text-slate-light font-semibold rounded-xl border border-border w-full sm:w-auto cursor-not-allowed">
                Google Play (Coming Soon)
              </button>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 bg-paper border-t border-border">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-tight text-ink">ZIVR</span>
          <div className="w-2 h-2 rounded-full bg-mint"></div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-medium text-slate">
          <a href="#message" className="hover:text-ink transition-colors">Message</a>
          <a href="#family" className="hover:text-ink transition-colors">Family</a>
          <a href="#privacy" className="hover:text-ink transition-colors">Privacy</a>
          <Link href="/support" className="hover:text-ink transition-colors">Support</Link>
          <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
        </div>
        
        <div className="text-sm text-slate-light font-medium">
          ZIVR — message like you mean it.
        </div>
      </div>
    </footer>
  );
}

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main>
        <HeroSection />
        <MessageSection />
        <FamilySection />
        <PrivacySection />
        <ExportSection />
        <PersonalizeSection />
        <CallsPreviewStrip />
        <FooterCTA />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/support" component={Support} />
              <Route component={NotFound} />
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
