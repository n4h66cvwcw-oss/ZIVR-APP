import { Link } from 'wouter';
import { ArrowLeft, MessageSquare, Users, Lock, Bell, FileText, Cloud, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

type FaqItem = {
  question: string;
  answer: string;
};

type FaqSection = {
  title: string;
  icon: React.ReactNode;
  items: FaqItem[];
};

function Accordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border">
      {items.map((item, i) => (
        <div key={i}>
          <button
            className="w-full flex items-start justify-between gap-4 py-4 text-left font-semibold text-slate-800 hover:text-primary transition-colors"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span>{item.question}</span>
            {openIndex === i
              ? <ChevronUp className="w-5 h-5 shrink-0 text-primary mt-0.5" />
              : <ChevronDown className="w-5 h-5 shrink-0 text-slate-400 mt-0.5" />
            }
          </button>
          {openIndex === i && (
            <p className="pb-5 text-slate-600 leading-relaxed">{item.answer}</p>
          )}
        </div>
      ))}
    </div>
  );
}

const faqSections: FaqSection[] = [
  {
    title: 'Getting Started',
    icon: <MessageSquare className="w-5 h-5 text-primary" />,
    items: [
      {
        question: 'How do I create a ZIVR account?',
        answer:
          'Download ZIVR from the App Store or Google Play, open the app, and tap "Create Account". A display name is the only required field. At the end of registration, you are shown a one-time recovery code — save it somewhere safe, as it is the only way to recover your account if you need to.',
      },
      {
        question: 'ZIVR doesn\'t ask for a password. How does login work?',
        answer:
          'ZIVR uses token-based authentication, not a password. When you register, a secure token is issued to your device. To regain access on a new device, you use the recovery code you were shown at registration.',
      },
      {
        question: 'What is the difference between a child account and a parent account?',
        answer:
          'Child accounts are created by a parent from the Parental Dashboard. The parent account can then approve contact requests on behalf of the child, set recurring access schedules (time limits), grant temporary unlocks, and configure which safety-alert severity levels send push notifications.',
      },
      {
        question: 'How do I add contacts?',
        answer:
          'Search for another ZIVR user by username and tap "Add Contact". If the recipient is a child account, their parent will receive an approval request. The contact is only added after the parent approves it.',
      },
    ],
  },
  {
    title: 'Parental Controls',
    icon: <Users className="w-5 h-5 text-green-600" />,
    items: [
      {
        question: 'How do I review or approve a contact request for my child?',
        answer:
          "Open the Parental Dashboard in the app, navigate to your child's profile, and tap \"Pending Contacts\". You can approve or deny each request individually. Your child cannot message a new contact until you approve.",
      },
      {
        question: 'How do access schedules (time limits) work?',
        answer:
          "In the Parental Dashboard, select your child's profile and tap \"Access Schedule\". You can configure recurring quiet periods — for example, no access after 9 PM or during school hours. Outside allowed hours, the app locks and your child sees a message explaining when access returns.",
      },
      {
        question: 'How do I grant a temporary unlock?',
        answer:
          "In the Parental Dashboard, open your child's profile and tap \"Temporary Unlock\". You can grant 1 or 2 additional hours of access outside the normal schedule. The unlock expires automatically when the time is up.",
      },
      {
        question: 'Which safety alerts can I receive?',
        answer:
          'You can choose from three levels: "All" (every flagged event), "Medium and above" (moderate and high severity), or "High Only" (only the most serious flags). You can change this in the Parental Dashboard under Safety Alerts at any time; changes take effect immediately.',
      },
      {
        question: 'How does content safety scanning work?',
        answer:
          "When a message is sent in a chat that includes your child, ZIVR's servers run AI analysis on the message text using Anthropic Claude. If content is flagged, a record is saved — including a text excerpt (up to 500 characters), a severity level, and the AI's reason. You can review flagged content in the Parental Dashboard. Alerts are sent at the severity level you chose.",
      },
      {
        question: 'Are content flag records stored permanently?',
        answer:
          "Flag records are stored on ZIVR's servers and persist until the child account is deleted. Parents can mark individual flags as reviewed in the Parental Dashboard, but there is no option to delete individual flag records.",
      },
    ],
  },
  {
    title: 'Messaging',
    icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
    items: [
      {
        question: 'Are my messages stored on ZIVR servers?',
        answer:
          'Yes. Server-connected messages are stored in our database without automatic expiry. Deleting your account disassociates your identity from your messages but does not remove the messages themselves — they remain until the chat they belong to is deleted. See our Privacy Policy for full details on data retention.',
      },
      {
        question: 'Why are some notifications quiet when I first open the app?',
        answer:
          'ZIVR catches up missed messages silently on startup. Notifications for messages received while the app was closed are processed quietly — you will see unread counts in the chat list without a flood of individual banners.',
      },
      {
        question: 'How do I mute a chat?',
        answer:
          'Open the chat, tap the name or group title at the top, and select "Mute". You can mute for 8 hours, 1 week, or always. Messages still arrive — they just do not show a notification banner during normal use. Note: messages caught up at app startup may not fully respect the mute setting in all cases; we are actively working on a fix.',
      },
      {
        question: 'How do broadcast check-in groups work?',
        answer:
          "Create a check-in group and add members. When you send a check-in prompt, each member receives it privately and can reply. Members cannot see each other's replies or who else is in the group — only the creator sees all responses.",
      },
    ],
  },
  {
    title: 'Chat Passcode & Encryption',
    icon: <Lock className="w-5 h-5 text-slate-700" />,
    items: [
      {
        question: 'What is the difference between a chat passcode and chat encryption?',
        answer:
          'These are two separate, independent features. A chat passcode is an access lock: it protects the chat behind a 4–6 digit code stored as a hash on your device, so someone with access to your unlocked phone cannot open that chat. Chat encryption is a separate toggle that uses AES-256 to encrypt the actual message text stored in the app\'s local storage — protecting message content at rest on the device.',
      },
      {
        question: 'What happens if I forget my chat passcode?',
        answer:
          'When setting a passcode you can add a hint and an optional recovery email address. If you forget the code, go to Chat Settings and tap "Send Recovery Email" — this uses your device\'s mail app to compose a draft email to the recovery address you saved, containing your hint and instructions for resetting the passcode in Chat Settings. The email is composed locally by your mail app; ZIVR\'s servers do not send it automatically, and the passcode itself cannot be retrieved remotely.',
      },
      {
        question: 'What does enabling chat encryption actually protect?',
        answer:
          'Enabling encryption generates a random AES-256 key and uses it to encrypt each message\'s text stored in the app\'s local storage. This protects message content if someone accesses the raw local data on your device. It does not change how messages travel over the network (all connections use TLS), and server-connected messages are also stored on ZIVR servers independently.',
      },
      {
        question: 'Is ZIVR end-to-end encrypted?',
        answer:
          'ZIVR uses TLS for all data in transit. The optional per-chat encryption feature encrypts message text stored locally on your device. Messages sent through the server are stored server-side — see "Are my messages stored on ZIVR servers?" above.',
      },
      {
        question: 'How do secure picture messages work?',
        answer:
          'When you send a photo in "view once", "timed", or "password-protected" mode, ZIVR requests screenshot protection using the platform\'s native API while the image is on screen. This relies on iOS and Android APIs and cannot prevent someone from photographing your screen with another device.',
      },
    ],
  },
  {
    title: 'Backup & Export',
    icon: <Cloud className="w-5 h-5 text-blue-500" />,
    items: [
      {
        question: 'How does backup work for local chats?',
        answer:
          "Local (device-only) chats can be backed up to ZIVR's servers from the chat settings screen. The message data is uploaded and can be restored on a new device. The backup process itself does not add encryption — if your chat had per-message encryption enabled, those encrypted messages remain in that form in the backup; otherwise messages are stored as-is. Backups persist until you delete them or delete your account.",
      },
      {
        question: 'What about server-connected chats?',
        answer:
          'Messages in server-connected chats are already stored on ZIVR servers as part of normal messaging. They are available on any device you sign in to — no separate backup step is needed.',
      },
      {
        question: 'How do I export a chat as a PDF?',
        answer:
          'Open a chat, tap the options menu, and select "Export". You can choose the scope (entire thread or selected messages), a document style (Legal, Business, or Personal), and an optional AI-generated appendix (summary or key points). If you add an AI appendix, the selected message text is sent to ZIVR AI for processing — the export screen includes a consent step before this happens. The PDF is saved to your device only; ZIVR does not keep a copy.',
      },
      {
        question: 'What happens to my data if I delete the app?',
        answer:
          'Locally stored messages and app data are removed when you delete the app. Your account and server-side data — including server messages, cloud backups, and content flags — remain until you request account deletion through ZIVR support.',
      },
    ],
  },
  {
    title: 'Notifications',
    icon: <Bell className="w-5 h-5 text-red-500" />,
    items: [
      {
        question: 'How do I set per-chat notification sounds?',
        answer:
          'Open a chat, tap the name or group title, then tap "Notification Settings". You can choose from several notification sound options or set the chat to vibrate-only or silent.',
      },
      {
        question: "I'm not receiving notifications. What should I check?",
        answer:
          'First, check that ZIVR has notification permission in your device Settings > Apps > ZIVR > Notifications. Next, confirm the individual chat is not muted. Finally, check that Do Not Disturb is not active on your device.',
      },
    ],
  },
  {
    title: 'PDF Export',
    icon: <FileText className="w-5 h-5 text-orange-500" />,
    items: [
      {
        question: 'What options are available when exporting a chat to PDF?',
        answer:
          'You can choose the scope (whole thread or selected messages), a document style (Legal, Business, or Personal), and an optional AI appendix (none, summary, or key points). If you choose an AI appendix, the selected message text is sent to ZIVR AI for processing — a consent checkbox is shown before this step.',
      },
      {
        question: 'Does the PDF include sender names?',
        answer:
          'Yes. The exported PDF includes sender display names and chat metadata. View-once messages that have already been opened are not included in exports regardless of your settings.',
      },
    ],
  },
  {
    title: 'Account Recovery',
    icon: <Lock className="w-5 h-5 text-indigo-500" />,
    items: [
      {
        question: 'I need to sign in on a new device. How do I recover my account?',
        answer:
          'Use the recovery code you were shown when you first created your account. Install ZIVR on the new device, tap "Recover Account" on the sign-in screen, and enter your recovery code. Server-connected chat history will be available after signing in. Local chat history can be restored from a cloud backup if you previously backed it up from chat settings.',
      },
      {
        question: 'I lost my recovery code. Can I still recover my account?',
        answer:
          'If you no longer have your recovery code, please contact ZIVR support through the app store listing. Recovery options may be limited without the code.',
      },
    ],
  },
];

export default function Support() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-slate-950 text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to ZIVR
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Support</h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            Answers to common questions about ZIVR's features, privacy settings, and parental controls.
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">

        <div className="space-y-12">
          {faqSections.map((section) => (
            <section key={section.title}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  {section.icon}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              </div>
              <div className="bg-slate-50 rounded-2xl px-6">
                <Accordion items={section.items} />
              </div>
            </section>
          ))}
        </div>

        {/* Still need help */}
        <section className="mt-16 bg-slate-950 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">Still need help?</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            If you can't find the answer above, please reach out through the app store listing.
            We aim to respond within one business day.
          </p>
          <div className="inline-block bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-slate-200 text-sm">
            <p className="font-semibold text-white mb-1">ZIVR Support</p>
            <p>Contact us through the ZIVR listing on the App Store or Google Play — tap "App Support" on the listing page.</p>
          </div>
          <p className="text-slate-500 text-sm mt-6">
            For privacy-related requests (data access, deletion, COPPA inquiries), see our{' '}
            <Link href="/privacy" className="text-slate-300 underline underline-offset-2 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-sm text-slate-500">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-semibold text-slate-700 hover:text-primary transition-colors">
            ZIVR
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
            <Link href="/support" className="hover:text-slate-700 transition-colors font-medium text-primary">Support</Link>
          </div>
          <span>&copy; {new Date().getFullYear()} ZIVR. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
