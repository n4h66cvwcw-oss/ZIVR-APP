import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

// Mockups
import { ChatMockup } from '@/components/mockups/ChatMockup';
import { ParentalMockup } from '@/components/mockups/ParentalMockup';
import { CheckInMockup } from '@/components/mockups/CheckInMockup';
import { SecurityMockup } from '@/components/mockups/SecurityMockup';
import { FavoritesMockup } from '@/components/mockups/FavoritesMockup';
import { CallsMockup } from '@/components/mockups/CallsMockup';
import { ContactsMockup } from '@/components/mockups/ContactsMockup';
import { SettingsMockup } from '@/components/mockups/SettingsMockup';
import { Reveal } from '@/components/Reveal';

import { Shield, Lock, Globe, Music, EyeOff, FileText, ShieldCheck, Heart, Menu, X, Users, PhoneCall, RefreshCw, MessageSquareQuote, CheckCircle2 } from 'lucide-react';

const queryClient = new QueryClient();

function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Family controls', href: '#family' },
    { label: 'Security', href: '#security' },
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass-panel border-x-0 border-t-0" data-testid="nav-main">
      <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3" data-testid="link-home-logo">
          <img src={import.meta.env.BASE_URL + "brand/zivr-icon.png"} alt="ZIVR Logo" className="w-9 h-9 rounded-2xl shadow-sm" />
          <span className="font-display font-bold text-xl tracking-tight text-foreground">ZIVR</span>
        </a>
        
        <div className="hidden md:flex items-center gap-8 font-medium text-[15px] text-muted-foreground">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground transition-colors" data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}>
              {link.label}
            </a>
          ))}
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <a href="#features" className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2.5 rounded-full transition-all inline-flex items-center gap-2 text-sm shadow-sm" data-testid="link-nav-explore">
            Explore features
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

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-[72px] left-0 w-full bg-white/95 backdrop-blur-xl border-b border-border shadow-xl py-6 px-6 flex flex-col gap-6" data-testid="nav-mobile-menu">
          <div className="flex flex-col gap-4">
             {navLinks.map((link) => (
               <a
                 key={link.href}
                 href={link.href}
                 className="text-lg font-semibold text-foreground"
                 onClick={() => setIsMobileMenuOpen(false)}
                 data-testid={`link-mobile-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
               >
                 {link.label}
               </a>
             ))}
          </div>
          <a 
            href="#features" 
            className="bg-primary text-white font-semibold px-6 py-3.5 rounded-full text-center"
            onClick={() => setIsMobileMenuOpen(false)}
            data-testid="link-mobile-explore"
          >
            Explore features
          </a>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  return (
    <section id="top" className="relative pt-32 pb-24 md:pt-48 md:pb-32 overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-6 text-center">
        
        <Reveal delay={0.1}>
          <h1 className="text-5xl md:text-7xl lg:text-[5rem] font-extrabold text-foreground tracking-tighter mb-6 leading-[1.05] max-w-4xl mx-auto" data-testid="text-hero-title">
            Messaging, <span className="text-gradient">with family in mind.</span>
          </h1>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="text-[17px] md:text-[21px] text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-hero-subtitle">
            ZIVR is the messaging app for kids, parents, and trusted circles. Thoughtful controls without losing the fun of everyday conversation.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#features" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-full transition-all shadow-sm text-[17px] w-full sm:w-auto text-center" data-testid="link-hero-explore">
              Explore features
            </a>
            <a href="#family" className="bg-white hover:bg-gray-50 text-foreground border border-border font-semibold px-8 py-4 rounded-full transition-all shadow-sm text-[17px] w-full sm:w-auto text-center" data-testid="link-hero-family">
              See family controls
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.4} className="mt-24 relative h-[650px] w-full max-w-5xl mx-auto hidden md:block perspective-1000">
          <div className="absolute left-[8%] top-12 z-0 scale-90 -rotate-3 opacity-90 transition-transform duration-700 hover:rotate-0 hover:scale-95 hover:z-20">
            <ParentalMockup />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10 scale-100 transition-transform duration-700 hover:scale-105">
            <ChatMockup />
          </div>
          <div className="absolute right-[8%] top-24 z-0 scale-90 rotate-3 opacity-90 transition-transform duration-700 hover:rotate-0 hover:scale-95 hover:z-20">
            <CheckInMockup />
          </div>
        </Reveal>

        {/* Mobile Hero View */}
        <Reveal delay={0.4} className="mt-16 md:hidden px-4">
          <ChatMockup />
        </Reveal>
      </div>
    </section>
  );
}

function FamilySection() {
  return (
    <section id="family" className="py-24 md:py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-center">
          <Reveal direction="right" className="order-2 md:order-1 px-4 md:px-0" data-testid="mockup-family">
            <ParentalMockup />
          </Reveal>
          <div className="order-1 md:order-2">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-6">
                <ShieldCheck className="w-4 h-4" />
                Parental Dashboard
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-foreground leading-[1.1]" data-testid="text-family-title">Peace of mind for parents.</h2>
              <p className="text-lg md:text-[19px] text-muted-foreground mb-8 leading-relaxed" data-testid="text-family-desc">
                Family Controls lets parents review contact requests, configure recurring access schedules, and set specific push-alert thresholds for content safety.
              </p>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold mb-1 text-foreground">Contact review</h3>
                    <p className="text-muted-foreground leading-relaxed">Review supported incoming requests and manage contact records. Approval is not a blanket block across every chat type.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold mb-1 text-foreground">Custom alert thresholds</h3>
                    <p className="text-muted-foreground leading-relaxed">Choose which content-safety severity levels generate push alerts to your device (All, Medium+, or High Only).</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <Lock className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold mb-1 text-foreground">Smart time limits</h3>
                    <p className="text-muted-foreground leading-relaxed">Configure recurring access schedules for each child account.</p>
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

function FunSection() {
  return (
    <section id="features" className="py-24 md:py-32 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-6">
                <Music className="w-4 h-4" />
                Chat Experience
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-foreground leading-[1.1]" data-testid="text-chat-title">Fun, expressive, alive.</h2>
              <p className="text-lg md:text-[19px] text-muted-foreground mb-8 leading-relaxed" data-testid="text-chat-desc">
                ZIVR supports audio and music attachments, optional reply suggestions, and pre-send outgoing translation. Robust recovery logic prevents notification floods if a device is offline for an extended period.
              </p>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Music className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold mb-1 text-foreground">Audio & music</h3>
                    <p className="text-muted-foreground leading-relaxed">Attach an audio clip; optionally include music metadata with the message.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold mb-1 text-foreground">Pre-send translation</h3>
                    <p className="text-muted-foreground leading-relaxed">Set a recipient language to translate outgoing text before it is sent; the original remains visible.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold mb-1 text-foreground">Quiet recovery</h3>
                    <p className="text-muted-foreground leading-relaxed">Missed messages fetched during app startup won't trigger a flood of delayed notifications.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
          <Reveal direction="left" className="flex justify-center md:justify-end px-4 md:px-0" data-testid="mockup-chat">
            <ChatMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CallsSection() {
  return (
    <section id="calls" className="py-24 md:py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-center">
          <Reveal direction="right" className="order-2 md:order-1 px-4 md:px-0" data-testid="mockup-calls">
            <CallsMockup />
          </Reveal>
          <div className="order-1 md:order-2">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <PhoneCall className="w-4 h-4" />
                Coming Soon
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-foreground leading-[1.1]" data-testid="text-calls-title">A calls workspace in preview.</h2>
              <p className="text-lg md:text-[19px] text-muted-foreground mb-8 leading-relaxed" data-testid="text-calls-desc">
                ZIVR includes a visual preview of the Calls workspace for recent, missed, voice, and video entries. Live calling is not yet available, but the interface demonstrates our future layout.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-[17px]">All, Missed, Voice, and Video filters</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-[17px]">Call-layout preview with familiar contact rows</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-[17px]">Visual contact launch controls shown in preview</span>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactsSection() {
  return (
    <section id="contacts" className="py-24 md:py-32 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-200 text-gray-800 text-sm font-semibold mb-6">
                <Users className="w-4 h-4" />
                Network
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-foreground leading-[1.1]" data-testid="text-contacts-title">Your contacts, organized.</h2>
              <p className="text-lg md:text-[19px] text-muted-foreground mb-8 leading-relaxed" data-testid="text-contacts-desc">
                Sync contacts from your device and share invite messages. View status and last-seen values where available (presence is an indicator, not a live network guarantee).
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <span className="text-[17px]">Sync contacts from your device</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <span className="text-[17px]">Available status and last-seen fields</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <span className="text-[17px]">Share an invite link or message</span>
                </li>
              </ul>
            </Reveal>
          </div>
          <Reveal direction="left" className="flex justify-center md:justify-end px-4 md:px-0" data-testid="mockup-contacts">
            <ContactsMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CheckInSection() {
  return (
    <section id="checkins" className="py-24 md:py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-6 text-center max-w-3xl mb-16">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-6">
            <EyeOff className="w-4 h-4" />
            Check-Ins
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-foreground leading-[1.1]" data-testid="text-checkins-title">Check in without the noise.</h2>
          <p className="text-lg md:text-[19px] text-muted-foreground leading-relaxed" data-testid="text-checkins-desc">
            Check-In broadcasts collect replies in the creator's view. The app labels those replies private to the creator (an in-app visibility rule, not an encryption guarantee).
          </p>
        </Reveal>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-center px-4 md:px-0">
          <Reveal direction="up">
            <CheckInMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="security" className="py-24 md:py-32 bg-foreground text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-accent rounded-full blur-[120px]"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-center">
          <Reveal direction="right" className="px-4 md:px-0">
            <SecurityMockup />
          </Reveal>
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-semibold mb-6 backdrop-blur-sm border border-white/10">
                <Lock className="w-4 h-4" />
                Security
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight leading-[1.1]">Privacy controls for each chat.</h2>
              <p className="text-lg md:text-[19px] text-gray-300 mb-10 leading-relaxed">
                Choose optional per-chat AES encryption for local message storage, add a local passcode, or receive screenshot warnings around self-destruct messages.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-md">
                  <ShieldCheck className="w-7 h-7 text-primary mb-4" />
                  <h3 className="text-[17px] font-bold mb-2">Local Encryption</h3>
                  <p className="text-[14px] text-gray-400 leading-relaxed">Apply per-chat AES encryption for local device storage (not end-to-end encryption).</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-md">
                  <Lock className="w-7 h-7 text-secondary mb-4" />
                  <h3 className="text-[17px] font-bold mb-2">Passcode Locks</h3>
                  <p className="text-[14px] text-gray-400 leading-relaxed">Store a hash of a 4-6 digit passcode locally to gate app access.</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-md">
                  <EyeOff className="w-7 h-7 text-accent mb-4" />
                  <h3 className="text-[17px] font-bold mb-2">Screenshot Warning</h3>
                  <p className="text-[14px] text-gray-400 leading-relaxed">Platform-dependent warnings when the OS reports a screenshot during self-destruct chats.</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-md">
                  <FileText className="w-7 h-7 text-gray-300 mb-4" />
                  <h3 className="text-[17px] font-bold mb-2">Export Data</h3>
                  <p className="text-[14px] text-gray-400 leading-relaxed">Export available chat data. Restore availability depends on backup flows.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function FavoritesSection() {
  return (
    <section id="favorites" className="py-24 md:py-32 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF9F0A]/10 text-[#FF9F0A] text-sm font-semibold mb-6">
                <Heart className="w-4 h-4" />
                Favorites
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-foreground leading-[1.1]" data-testid="text-favorites-title">Keep your circle close.</h2>
              <p className="text-lg md:text-[19px] text-muted-foreground mb-8 leading-relaxed" data-testid="text-favorites-desc">
                Organize favorites into labeled, colored groups and show favorite strips in supported in-app tabs to jump straight into conversation.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                  <span className="text-[17px]">Pin people and chats for fast access</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                  <span className="text-[17px]">Assign distinct colors to groups</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-[#FF9F0A] shrink-0 mt-0.5" />
                  <span className="text-[17px]">Visible across supported tabs</span>
                </li>
              </ul>
            </Reveal>
          </div>
          <Reveal direction="left" className="flex justify-center md:justify-end px-4 md:px-0">
            <FavoritesMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white border-t border-border py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-[1.5fr_1fr_1fr] gap-12 lg:gap-8 mb-16">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img src={import.meta.env.BASE_URL + "brand/zivr-icon.png"} alt="ZIVR Logo Large" className="w-10 h-10 rounded-[10px] shadow-sm" />
              <span className="font-display font-bold text-2xl tracking-tight text-foreground">ZIVR</span>
            </div>
            <p className="text-muted-foreground text-[15px] max-w-[280px] leading-relaxed mb-6">
              The family-centered messaging app for kids, parents, and the people they know.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-[13px] tracking-wider uppercase text-foreground mb-6">Features</h4>
            <ul className="space-y-4 text-[15px] text-muted-foreground font-medium">
              <li><a href="#family" className="hover:text-primary transition-colors" data-testid="link-footer-family">Family Controls</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors" data-testid="link-footer-chat">Messaging & Translation</a></li>
              <li><a href="#checkins" className="hover:text-primary transition-colors" data-testid="link-footer-checkins">Check-Ins</a></li>
              <li><a href="#calls" className="hover:text-primary transition-colors" data-testid="link-footer-calls">Calls Preview</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-[13px] tracking-wider uppercase text-foreground mb-6">Privacy</h4>
            <ul className="space-y-4 text-[15px] text-muted-foreground font-medium">
              <li><a href="#security" className="hover:text-primary transition-colors" data-testid="link-footer-security">Security & Encryption</a></li>
              <li><a href="#contacts" className="hover:text-primary transition-colors" data-testid="link-footer-contacts">Contacts & Requests</a></li>
              <li><a href="#favorites" className="hover:text-primary transition-colors" data-testid="link-footer-favorites">Favorites Groups</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground font-medium">
          <p>© {new Date().getFullYear()} ZIVR. All rights reserved.</p>
          <a href="#top" className="hover:text-foreground transition-colors" data-testid="link-footer-top">Back to top</a>
        </div>
      </div>
    </footer>
  );
}

function Home() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <Navbar />
      <main>
        <HeroSection />
        <FamilySection />
        <FunSection />
        <CallsSection />
        <ContactsSection />
        <CheckInSection />
        <FavoritesSection />
        <SecuritySection />
      </main>
      <Footer />
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;