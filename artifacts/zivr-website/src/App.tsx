import React, { type ReactNode, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Privacy from '@/pages/privacy';
import Support from '@/pages/support';
import { Route, Switch, Router as WouterRouter, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

// Mockups
import { ChatMockup } from '@/components/mockups/ChatMockup';
import { ParentalMockup } from '@/components/mockups/ParentalMockup';
import { CheckInMockup } from '@/components/mockups/CheckInMockup';
import { SecurityMockup } from '@/components/mockups/SecurityMockup';
import { FavoritesMockup } from '@/components/mockups/FavoritesMockup';
import { CallsMockup } from '@/components/mockups/CallsMockup';
import { SettingsMockup } from '@/components/mockups/SettingsMockup';

import {
  Lock, Globe, Music, EyeOff,
  ShieldCheck, Heart, Menu, X, Users, PhoneCall,
  MessageSquareQuote, ExternalLink,
  Sparkles, Palette, Zap, Clock, ShieldAlert, ArrowRight, Search, RefreshCw
} from 'lucide-react';

const queryClient = new QueryClient();

const storeLinks = {
  appStore: getStoreUrl(import.meta.env.VITE_ZIVR_APP_STORE_URL, 'appStore'),
  googlePlay: getStoreUrl(import.meta.env.VITE_ZIVR_GOOGLE_PLAY_URL, 'googlePlay'),
};

function getStoreUrl(value: unknown, platform: StoreBadgeProps['platform']) {
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

function Reveal({ children, delay = 0, direction = "up", className = "" }: { children: ReactNode, delay?: number, direction?: "up" | "down" | "left" | "right", className?: string }) {
  const y = direction === "up" ? 30 : direction === "down" ? -30 : 0;
  const x = direction === "left" ? 30 : direction === "right" ? -30 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type StoreBadgeProps = {
  platform: 'appStore' | 'googlePlay';
  label: string;
  storeName: string;
  url?: string;
};

function StoreBadge({ platform, label, storeName, url }: StoreBadgeProps) {
  const badgeContent = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl font-bold" aria-hidden="true">
        {platform === 'appStore' ? 'A' : '▶'}
      </span>
      <span className="flex flex-col text-left">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">{url ? label : 'Coming soon'}</span>
        <span className="text-lg font-bold text-white leading-tight">{storeName}</span>
      </span>
      {url && <ExternalLink className="ml-auto h-5 w-5 text-white/40 group-hover:text-white/80 transition-colors" aria-hidden="true" />}
    </>
  );

  if (!url) {
    return (
      <div
        className="flex min-h-[76px] w-full sm:w-[240px] items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 opacity-60 backdrop-blur-md"
        role="status"
        aria-label={`${storeName} download link coming soon`}
        data-testid={`badge-${platform}-coming-soon`}
      >
        {badgeContent}
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex min-h-[76px] w-full sm:w-[240px] items-center gap-4 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 transition-all hover:-translate-y-1 hover:border-white/40 hover:bg-white/20 hover:shadow-xl hover:shadow-white/5 backdrop-blur-md"
      aria-label={`Download ZIVR from the ${storeName}`}
      data-testid={`link-download-${platform}`}
    >
      {badgeContent}
    </a>
  );
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
    { label: 'Features', href: '#features' },
    { label: 'Check-Ins', href: '#checkins' },
    { label: 'Family', href: '#family' }
  ];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-xl border-b border-border shadow-sm py-2' : 'bg-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3">
          <img src={import.meta.env.BASE_URL + "brand/zivr-icon.png"} alt="ZIVR Logo" className="w-10 h-10 rounded-xl shadow-sm" />
          <span className="font-display font-bold text-xl tracking-tight text-foreground">ZIVR</span>
        </a>
        
        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-primary transition-colors">
              {link.label}
            </a>
          ))}
        </div>
        
        <div className="hidden md:block">
          <a href="#download" className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2.5 rounded-full transition-all shadow-lg shadow-primary/25 inline-block">
            Get ZIVR
          </a>
        </div>

        <button
          className="md:hidden text-foreground p-2 -mr-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          data-testid="button-mobile-menu"
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
            className="md:hidden absolute top-[72px] left-0 w-full bg-white border-b border-border shadow-xl py-4 px-6 flex flex-col gap-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-lg font-semibold text-foreground py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#download"
              className="bg-primary text-white font-semibold px-6 py-3 rounded-full text-center mt-2"
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

function HeroSection() {
  return (
    <section id="top" className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-background">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] max-w-7xl pointer-events-none -z-10">
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute top-[200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-accent/15 blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-border text-foreground text-sm font-semibold mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>The family-centered messaging experience</span>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <h1 className="text-6xl md:text-8xl font-extrabold text-foreground tracking-tighter mb-8 leading-[1.05]">
            Keep your circle <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">close and secure.</span>
          </h1>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Expressive messaging for kids, calm controls for parents, and an unmistakably mobile-first experience for the whole family.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#download" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-full transition-all shadow-xl shadow-primary/20 text-lg w-full sm:w-auto text-center flex items-center justify-center gap-2">
              Get ZIVR <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.4} className="mt-24 relative h-[700px] w-full max-w-5xl mx-auto hidden md:block">
          <motion.div
            initial={{ y: 100, opacity: 0, rotate: -8 }}
            animate={{ y: 0, opacity: 1, rotate: -8 }}
            transition={{ duration: 1, delay: 0.5, type: "spring" }}
            className="absolute left-[5%] top-16 z-0 scale-[0.85] origin-bottom shadow-2xl shadow-black/10 rounded-[3rem]"
          >
            <ParentalMockup />
          </motion.div>
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 0.6, type: "spring" }}
            className="absolute left-1/2 -translate-x-1/2 top-0 z-10 shadow-2xl shadow-black/20 rounded-[3rem]"
          >
            <ChatMockup />
          </motion.div>
          <motion.div
            initial={{ y: 100, opacity: 0, rotate: 8 }}
            animate={{ y: 0, opacity: 1, rotate: 8 }}
            transition={{ duration: 1, delay: 0.7, type: "spring" }}
            className="absolute right-[5%] top-24 z-0 scale-[0.85] origin-bottom shadow-2xl shadow-black/10 rounded-[3rem]"
          >
            <CheckInMockup />
          </motion.div>
        </Reveal>

        {/* Mobile Hero View */}
        <Reveal delay={0.4} className="mt-16 md:hidden flex justify-center">
          <ChatMockup />
        </Reveal>
      </div>
    </section>
  );
}

function ExpressiveSection() {
  return (
    <section id="features" className="py-32 bg-white relative overflow-hidden border-t border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 relative flex justify-center lg:justify-start">
            <div className="absolute -inset-10 bg-gradient-to-tr from-primary/10 to-accent/10 rounded-full blur-3xl -z-10" />
            <Reveal>
              <ChatMockup />
            </Reveal>
          </div>
          <div className="order-1 lg:order-2">
            <Reveal>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-8">
                <MessageSquareQuote className="w-7 h-7" />
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 tracking-tight">Expressive, lively conversations.</h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                Connect in real-time with rich features designed to keep conversations engaging, personal, and secure.
              </p>
              
              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-xl bg-[#FF9F0A]/10 flex items-center justify-center shrink-0">
                    <Music className="w-6 h-6 text-[#FF9F0A]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Audio & Musical Messages</h3>
                    <p className="text-muted-foreground leading-relaxed">Attach audio clips or explore curated musical messages rendered as rich mini-players with animated visualizers.</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Pre-Send Translation</h3>
                    <p className="text-muted-foreground leading-relaxed">Translate your text before it sends. A subtle badge lets you keep the original available while sending exactly what you mean.</p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Real-Time Presence</h3>
                    <p className="text-muted-foreground leading-relaxed">Live server chats support read receipts, active typing indicators, and emoji reactions without missing a beat.</p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-6 h-6 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Quiet Recovery</h3>
                    <p className="text-muted-foreground leading-relaxed">Messages caught up during app startup do not create a flood of delayed notifications.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckInSection() {
  return (
    <section id="checkins" className="py-32 bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-secondary/10 via-slate-950 to-black pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary/20 text-secondary mb-8">
                <EyeOff className="w-7 h-7" />
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 tracking-tight text-white">Check in without the noise.</h2>
              <p className="text-xl text-slate-300 mb-10 leading-relaxed">
                Broadcast groups let you gather answers without overwhelming a chat thread. Members can't see each other, and only you see their replies.
              </p>
              
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-1">
                    <ShieldCheck className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1">Creator-Only Visibility</h4>
                    <p className="text-slate-400">Replies are routed directly to the creator's view. This is a built-in visibility rule, keeping group responses tidy and private.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-1">
                    <ShieldCheck className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1">Live Progress</h4>
                    <p className="text-slate-400">Track who has responded at a glance with built-in reply progress bars for the group.</p>
                  </div>
                </li>
              </ul>
            </Reveal>
          </div>
          <div className="flex justify-center lg:justify-end">
            <Reveal direction="left">
              <div className="relative">
                <div className="absolute -inset-10 bg-secondary/10 rounded-full blur-3xl -z-10" />
                <CheckInMockup />
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function FamilySection() {
  return (
    <section id="family" className="py-32 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 flex justify-center lg:justify-start">
            <Reveal direction="right">
              <ParentalMockup />
            </Reveal>
          </div>
          <div className="order-1 lg:order-2">
            <Reveal>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-8">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 tracking-tight">Peace of mind for parents.</h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                Empower your family with clear contact management, calm recurring access schedules, and safety alerts that match the level you choose.
              </p>
              
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-border mb-6">
                <div className="flex gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Contact Review</h3>
                    <p className="text-muted-foreground">Review incoming contact requests and manage contact records directly. Approval keeps external requests in check for supported chats.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-border">
                <div className="flex gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Smart Time Limits</h3>
                    <p className="text-muted-foreground">Configure recurring access schedules and review supported contact requests. Keep bedtime quiet and school hours focused.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-border mt-6">
                <div className="flex gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Safety Alert Choices</h3>
                    <p className="text-muted-foreground">Choose which content-safety severity levels notify you: All, Medium+, or High Only.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function BentoFeatures() {
  return (
    <section className="py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Everything you need to connect.</h2>
            <p className="text-xl text-muted-foreground">From per-chat privacy controls to expansive customization, ZIVR is built for both utility and expression.</p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Security & Local Privacy - Large Card */}
          <Reveal delay={0.1} className="lg:col-span-2 bg-slate-950 rounded-[2rem] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row gap-8 items-center border border-slate-800 shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="flex-1 relative z-10 text-white">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-md">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-4">Local Privacy & Encryption</h3>
              <p className="text-slate-300 text-lg mb-6">
                Apply optional per-chat AES encryption for local storage, add a custom passcode, and share secure pictures with view-once, timed, or password-protected modes. On supported platforms, screenshot warnings can appear around self-destruct messages.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium text-slate-200 backdrop-blur-md">Local Passcode</span>
                <span className="px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium text-slate-200 backdrop-blur-md">Secure Pictures</span>
              </div>
            </div>
            <div className="shrink-0 w-full md:w-64 flex justify-center relative z-10 scale-90 origin-right lg:scale-100">
              <SecurityMockup />
            </div>
          </Reveal>

          {/* Skin Store - Tall Card */}
          <Reveal delay={0.2} className="bg-gradient-to-br from-indigo-500 to-accent rounded-[2rem] p-8 md:p-12 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="relative z-10 text-white mb-8">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-6 backdrop-blur-md">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-4">The Skin Store</h3>
              <p className="text-indigo-100 text-lg">
                Personalize your experience. Use ZivCoin to unlock AI-generated skins and dynamic gradient chat themes in the AI Lab.
              </p>
            </div>
            <div className="h-40 w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-accent to-indigo-500 opacity-50 blur-xl" />
               <Sparkles className="w-12 h-12 text-white/80 relative z-10" />
            </div>
          </Reveal>

          {/* Organization - Square Card */}
          <Reveal delay={0.3} className="bg-slate-50 rounded-[2rem] p-8 relative overflow-hidden border border-border flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-6">
              <Heart className="w-6 h-6 text-yellow-500" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Organized Favorites</h3>
            <p className="text-muted-foreground mb-8 flex-1">
              Group favorites into colored strips, manage smart per-chat notifications, and sync contacts seamlessly.
            </p>
            <div className="h-48 overflow-hidden rounded-2xl relative">
              <div className="absolute inset-x-0 top-0 h-full scale-[0.6] origin-top">
                <FavoritesMockup />
              </div>
            </div>
          </Reveal>

          {/* Search & Backup - Square Card */}
          <Reveal delay={0.4} className="bg-slate-50 rounded-[2rem] p-8 relative overflow-hidden border border-border flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6">
              <Search className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Search, Backup & Widgets</h3>
            <p className="text-muted-foreground mb-8 flex-1">
              Advanced message search, local chat data exports, and a preview of home screen widget configuration.
            </p>
            <div className="h-48 overflow-hidden rounded-2xl relative">
              <div className="absolute inset-x-0 top-0 h-full scale-[0.6] origin-top">
                <SettingsMockup />
              </div>
            </div>
          </Reveal>

          {/* Calls Preview - Square Card */}
          <Reveal delay={0.5} className="bg-slate-50 rounded-[2rem] p-8 relative overflow-hidden border border-border flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-6">
              <PhoneCall className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Calls Preview</h3>
            <p className="text-muted-foreground mb-8 flex-1">
              Explore the upcoming visual calls workspace. Interface preview only—live voice and video coming soon.
            </p>
            <div className="h-48 overflow-hidden rounded-2xl relative">
               <div className="absolute inset-x-0 top-0 h-full scale-[0.6] origin-top">
                 <CallsMockup />
               </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}

function DownloadSection() {
  const hasConfiguredStoreLink = Boolean(storeLinks.appStore || storeLinks.googlePlay);
  const downloadDescription = storeLinks.appStore && storeLinks.googlePlay
    ? 'Choose your platform to download ZIVR from its verified store listing.'
    : storeLinks.appStore
      ? 'ZIVR is available on the App Store. Google Play is coming soon.'
      : storeLinks.googlePlay
        ? 'ZIVR is available on Google Play. The App Store is coming soon.'
        : 'Verified App Store and Google Play download links will appear here when the mobile app listings are live.';

  return (
    <section id="download" className="relative overflow-hidden bg-slate-950 py-32 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/20 via-slate-950 to-black pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-4xl text-center px-6">
        <Reveal>
          <div className="w-20 h-20 mx-auto bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 border border-white/20">
            <img src={import.meta.env.BASE_URL + "brand/zivr-icon.png"} alt="ZIVR Icon" className="w-12 h-12 rounded-xl" />
          </div>
          <h2 className="mb-6 text-5xl md:text-7xl font-extrabold tracking-tight">
            Bring family conversations with you.
          </h2>
          <p className="max-w-2xl mx-auto text-xl leading-relaxed text-slate-300 mb-12">
            {downloadDescription}
          </p>
        </Reveal>

        <Reveal delay={0.2} className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <StoreBadge
            platform="appStore"
            label="Download on the"
            storeName="App Store"
            url={storeLinks.appStore}
          />
          <StoreBadge
            platform="googlePlay"
            label="GET IT ON"
            storeName="Google Play"
            url={storeLinks.googlePlay}
          />
        </Reveal>

        {!hasConfiguredStoreLink && (
          <Reveal delay={0.3}>
            <p className="mt-8 text-sm text-slate-500 max-w-lg mx-auto">
              The download buttons are not active yet. We will only ever direct you to official, verified store listings.
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-950 py-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <img src={import.meta.env.BASE_URL + "brand/zivr-icon.png"} alt="ZIVR Logo" className="w-8 h-8 rounded-lg opacity-80 grayscale" />
            <span className="font-display font-bold text-lg tracking-tight text-white/80">ZIVR</span>
          </div>
          <p className="text-sm text-slate-500 max-w-md text-center">
            The family-centered messaging app for kids, parents, and trusted circles.
          </p>
          <nav className="flex items-center gap-6 text-sm" aria-label="Footer navigation">
            <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-700" aria-hidden="true">·</span>
            <Link href="/support" className="text-slate-400 hover:text-white transition-colors">
              Support
            </Link>
          </nav>
          <div className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} ZIVR. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary">
            <Navbar />
            <main>
              <Switch>
                <Route path="/">
                  <HeroSection />
                  <ExpressiveSection />
                  <CheckInSection />
                  <FamilySection />
                  <BentoFeatures />
                  <DownloadSection />
                </Route>
                <Route path="/privacy" component={Privacy} />
                <Route path="/support" component={Support} />
                <Route component={NotFound} />
              </Switch>
            </main>
            <Footer />
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
