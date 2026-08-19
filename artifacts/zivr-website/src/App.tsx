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

import { Shield, Lock, Globe, Music, EyeOff, FileText, ShieldCheck, Heart, Menu, X, Users, PhoneCall, RefreshCw, MessageSquareQuote } from 'lucide-react';

const queryClient = new QueryClient();

function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Family', href: '#family' },
    { label: 'Security', href: '#security' },
    { label: 'Calls', href: '#calls' }
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass-panel border-x-0 border-t-0" data-testid="nav-main">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3" data-testid="link-home-logo">
          <img src={import.meta.env.BASE_URL + "brand/zivr-icon.png"} alt="ZIVR Logo" className="w-10 h-10 rounded-[10px] shadow-sm" />
          <span className="font-display font-bold text-xl tracking-tight text-foreground">ZIVR</span>
        </a>
        
        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-primary transition-colors" data-testid={`link-nav-${link.label.toLowerCase()}`}>
              {link.label}
            </a>
          ))}
        </div>
        
        <div className="hidden md:block">
          <a href="#features" className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2.5 rounded-full transition-all shadow-lg shadow-primary/25 inline-block" data-testid="link-nav-explore">
            Explore Features
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
        <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-border shadow-xl py-4 px-6 flex flex-col gap-4" data-testid="nav-mobile-menu">
          {navLinks.map((link) => (
            <a 
              key={link.href} 
              href={link.href} 
              className="text-lg font-semibold text-foreground py-2"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid={`link-mobile-${link.label.toLowerCase()}`}
            >
              {link.label}
            </a>
          ))}
          <a 
            href="#features" 
            className="bg-primary text-white font-semibold px-6 py-3 rounded-full text-center mt-2"
            onClick={() => setIsMobileMenuOpen(false)}
            data-testid="link-mobile-explore"
          >
            Explore Features
          </a>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  return (
    <section id="top" className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] max-w-7xl pointer-events-none -z-10">
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute top-[200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 border border-primary/20" data-testid="badge-hero-shield">
            <ShieldCheck className="w-4 h-4" />
            Designed for Families
          </div>
        </Reveal>
        
        <Reveal delay={0.1}>
          <h1 className="text-5xl md:text-7xl font-extrabold text-foreground tracking-tighter mb-6 leading-[1.1]" data-testid="text-hero-title">
            Messaging, <span className="text-gradient">with family in mind.</span>
          </h1>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-hero-subtitle">
            ZIVR is the family-centered messaging app for kids, parents, and trusted circles. Thoughtful controls without losing the fun of everyday conversation.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#features" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-full transition-all shadow-xl shadow-primary/30 text-lg w-full sm:w-auto text-center" data-testid="link-hero-explore-primary">
              Explore Features
            </a>
            <a href="#family" className="bg-white hover:bg-gray-50 text-foreground border border-border font-semibold px-8 py-4 rounded-full transition-all shadow-sm text-lg w-full sm:w-auto text-center" data-testid="link-hero-family-secondary">
              See Family Controls
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.4} className="mt-20 relative h-[600px] w-full max-w-5xl mx-auto hidden md:block">
          <div className="absolute left-[10%] top-12 z-0 scale-90 -rotate-6 opacity-70">
            <ParentalMockup />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
            <ChatMockup />
          </div>
          <div className="absolute right-[10%] top-24 z-0 scale-90 rotate-6 opacity-70">
            <CheckInMockup />
          </div>
        </Reveal>

        {/* Mobile Hero View */}
        <Reveal delay={0.4} className="mt-16 md:hidden">
          <ChatMockup />
        </Reveal>
      </div>
    </section>
  );
}

function FamilySection() {
  return (
    <section id="family" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <Reveal direction="right" className="order-2 md:order-1" data-testid="mockup-family">
            <ParentalMockup />
          </Reveal>
          <div className="order-1 md:order-2">
            <Reveal>
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary mb-6" data-testid="icon-family">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" data-testid="text-family-title">Peace of mind for parents.</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-family-desc">
                Family Controls lets parents review supported contact requests and configure recurring access schedules. Group-chat contact restrictions are still being strengthened.
              </p>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Contact Review</h3>
                    <p className="text-muted-foreground">Review supported incoming requests and manage contact records. Approval is not a blanket block across every chat type.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                    <Lock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Smart Time Limits</h3>
                    <p className="text-muted-foreground">View and configure supported recurring access schedules. Temporary unlocks are not currently available.</p>
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
    <section id="features" className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal>
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-6" data-testid="icon-chat">
                <Music className="w-6 h-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" data-testid="text-chat-title">Fun, expressive, alive.</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-chat-desc">
                ZIVR supports audio and music attachments, optional reply suggestions, and outgoing translation before a message is sent.
              </p>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0 mt-1">
                    <Music className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Audio & Music Attachments</h3>
                    <p className="text-muted-foreground">Attach an audio clip; optionally include music metadata with the message.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-1">
                    <MessageSquareQuote className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Suggested Replies</h3>
                    <p className="text-muted-foreground">Optional reply suggestions may appear in the chat composer.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Pre-Send Translation</h3>
                    <p className="text-muted-foreground">Set a recipient language to translate outgoing text before it is sent; the original can remain available to the sender.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
          <Reveal direction="left" className="flex justify-end" data-testid="mockup-chat">
            <ChatMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CallsSection() {
  return (
    <section id="calls" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <Reveal direction="right" className="order-2 md:order-1" data-testid="mockup-calls">
            <CallsMockup />
          </Reveal>
          <div className="order-1 md:order-2">
            <Reveal>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6" data-testid="icon-calls">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" data-testid="text-calls-title">A calls workspace in preview.</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-calls-desc">
                ZIVR includes the visual Calls workspace for recent, missed, voice, and video entries alongside familiar contact controls. It is currently an interface preview; live voice and video calling are not yet available.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  All, Missed, Voice, and Video filters
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Call-layout preview with familiar contact rows
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Visual contact launch controls shown in the preview
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
    <section id="contacts" className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal>
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600 mb-6" data-testid="icon-contacts">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" data-testid="text-contacts-title">Your contacts, organized.</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-contacts-desc">
                Sync contacts from your device, share an invite message, and view the status or last-seen values available in the app. Presence is not presented as a live network guarantee.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-green-600"><RefreshCw className="w-3 h-3" /></div>
                  Sync contacts from your device
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-green-600"><RefreshCw className="w-3 h-3" /></div>
                  Available status and last-seen fields
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-green-600"><RefreshCw className="w-3 h-3" /></div>
                  Share an invite link or message
                </li>
              </ul>
            </Reveal>
          </div>
          <Reveal direction="left" className="flex justify-end" data-testid="mockup-contacts">
            <ContactsMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CheckInSection() {
  return (
    <section id="checkins" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6 text-center max-w-3xl mb-16">
        <Reveal>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
            <EyeOff className="w-6 h-6" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" data-testid="text-checkins-title">Check in without the noise.</h2>
          <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-checkins-desc">
            Check-In broadcasts collect replies in the creator's view. The app labels those replies private to the creator; this is an in-app visibility rule, not an end-to-end encryption guarantee.
          </p>
        </Reveal>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-center">
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
    <section id="security" className="py-24 bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-slate-900 to-black pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <Reveal direction="right">
            <SecurityMockup />
          </Reveal>
          <div>
            <Reveal>
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white mb-6 backdrop-blur-md">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Privacy controls for each chat.</h2>
              <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                Choose optional per-chat AES encryption for local message storage, add a local passcode, receive a platform-dependent screenshot warning around self-destruct messages, or export available chat data.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                  <ShieldCheck className="w-8 h-8 text-primary mb-4" />
                  <h3 className="text-lg font-bold mb-2">Local Chat Encryption</h3>
                  <p className="text-sm text-slate-400">Apply per-chat AES encryption for local message storage. This is not end-to-end encryption.</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                  <Lock className="w-8 h-8 text-secondary mb-4" />
                  <h3 className="text-lg font-bold mb-2">Passcode Locks</h3>
                  <p className="text-sm text-slate-400">Store a hash of a 4–6 digit passcode locally. Biometric unlock is not supported.</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                  <EyeOff className="w-8 h-8 text-accent mb-4" />
                  <h3 className="text-lg font-bold mb-2">Screenshot Warning</h3>
                  <p className="text-sm text-slate-400">On supported platforms, show an in-app warning when the OS reports a screenshot while self-destruct messages are present.</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                  <FileText className="w-8 h-8 text-green-400 mb-4" />
                  <h3 className="text-lg font-bold mb-2">Export to PDF</h3>
                  <p className="text-sm text-slate-400">Export the available chat data as a PDF.</p>
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
    <section id="favorites" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal>
              <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
                <Heart className="w-6 h-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" data-testid="text-favorites-title">Keep your circle close.</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-favorites-desc">
                Organize favorites into labeled, colored groups and show favorite strips in supported in-app tabs.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Favorite strips in supported in-app tabs
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Assign distinct colors and labels to groups
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Pin people and chats for faster in-app access
                </li>
              </ul>
            </Reveal>
          </div>
          <Reveal direction="left" className="flex justify-end">
            <FavoritesMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function BackupSection() {
  return (
    <section id="backup" className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <Reveal direction="right" className="order-2 md:order-1" data-testid="mockup-backup">
            <SettingsMockup />
          </Reveal>
          <div className="order-1 md:order-2">
            <Reveal>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6" data-testid="icon-backup">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" data-testid="text-backup-title">
                Export and backup controls.
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-backup-desc">
                Export available chat data as PDF or text, or use account backup controls for supported chat data. Availability and restore behavior depend on the backup flow; backups are not end-to-end encrypted archives.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Account backup controls for supported chat data
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Export available chat data as PDF or text
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="w-3 h-3" /></div>
                  Restore availability depends on the implemented backup flow
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-gray-200 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr] gap-10 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img src={import.meta.env.BASE_URL + "brand/zivr-splash-icon.png"} alt="ZIVR Logo Large" className="w-12 h-12 rounded-[12px] shadow-md object-cover" />
              <span className="font-display font-bold text-2xl tracking-tight text-foreground">ZIVR</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm">
              The family-centered messaging app for kids, parents, and the people they know.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-sm mb-4">Features</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#family" className="hover:text-primary transition-colors" data-testid="link-footer-family">Family Controls</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors" data-testid="link-footer-chat">Messaging & Pre-Send Translation</a></li>
              <li><a href="#checkins" className="hover:text-primary transition-colors" data-testid="link-footer-checkins">Check-In Reply Visibility</a></li>
              <li><a href="#calls" className="hover:text-primary transition-colors" data-testid="link-footer-calls">Calls Preview</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-sm mb-4">Privacy & continuity</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#security" className="hover:text-primary transition-colors" data-testid="link-footer-security">Optional Local Chat Encryption</a></li>
              <li><a href="#backup" className="hover:text-primary transition-colors" data-testid="link-footer-backup">Chat-Data Export & Backup Controls</a></li>
              <li><a href="#contacts" className="hover:text-primary transition-colors" data-testid="link-footer-contacts">Contacts & Requests</a></li>
              <li><a href="#favorites" className="hover:text-primary transition-colors" data-testid="link-footer-favorites">Favorites</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ZIVR. All rights reserved.</p>
          <a href="#top" className="hover:text-primary transition-colors" data-testid="link-footer-top">Back to top</a>
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
        <BackupSection />
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
