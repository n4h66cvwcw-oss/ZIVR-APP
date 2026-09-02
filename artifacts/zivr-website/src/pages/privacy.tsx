import { Link } from 'wouter';
import { ArrowLeft, Lock, Database, Shield, Eye, Cloud, Bell, Users, Brain } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-slate-950 text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to ZIVR
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-slate-400 text-lg">Last updated: August 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-14">

        {/* Intro */}
        <section>
          <p className="text-lg text-slate-700 leading-relaxed">
            ZIVR is a family-centered messaging app. This policy explains exactly what data ZIVR
            collects, how it is stored, and the controls available to you. We aim to be direct about
            what happens to your information rather than vague or aspirational.
          </p>
        </section>

        {/* 1. Data we collect */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">1. Data We Collect</h2>
          </div>

          <div className="space-y-6 text-slate-600 leading-relaxed">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Account information</h3>
              <p>
                Creating a ZIVR account requires only a display name. Username, phone number, avatar,
                status message, and preferred language are optional. ZIVR does not collect a password —
                authentication is token-based. At registration, a single-use recovery code is generated
                and shown to you once; its hash is stored on our servers so you can recover access to
                your account if needed.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Child and parent accounts</h3>
              <p>
                Parent accounts are promoted from standard accounts when a child account is first
                created. Child accounts are created by a parent and are stored with an explicit
                child account type. A parent can optionally set a numeric PIN for the child account
                at creation.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Server messages</h3>
              <p>
                Messages sent through ZIVR's real-time server are stored in our database. Each record
                includes the message text, type, sender, the chat it belongs to, and a timestamp.{' '}
                <strong className="text-slate-800">Messages are retained indefinitely</strong> — there
                is no automatic expiry or TTL. When your account is deleted, your sender identity in
                messages is disassociated, but the messages themselves are not deleted. Messages are
                removed only when the chat they belong to is deleted.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Local chat backups</h3>
              <p>
                If you use the Backup feature for a local (device-only) chat, the chat's message data
                is serialized and uploaded to ZIVR servers. The upload is stored as-is; no additional
                encryption is applied by the backup process itself. (If you had enabled per-message
                AES encryption on a chat before backing it up, those individual message fields remain
                encrypted in the backup, but unencrypted chats are backed up as plaintext.) Backups
                are retained on our servers until you delete them or delete your account.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Contacts and groups</h3>
              <p>
                Contact relationships, group memberships, and contact approval records are stored on
                our servers to support the real-time features of the app.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Call history</h3>
              <p>
                Call history is stored locally on your device only, in the app's local storage. It
                is not uploaded to or retained by ZIVR's servers.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Device contacts</h3>
              <p>
                If you grant the Contacts permission, ZIVR reads names, phone numbers, and contact
                photos from your device's address book to help you find ZIVR users you already know.
                Imported contact data is stored locally on your device in the app's local storage
                (AsyncStorage). It is not uploaded to ZIVR's servers. You can revoke this permission
                at any time in your device settings.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Device push tokens</h3>
              <p>
                When you grant notification permission, your device's push notification token is
                sent to ZIVR's servers and stored in your account record. This token is used solely
                to deliver push notifications to your device. It is updated automatically when the
                OS issues a new token.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Usage and diagnostics</h3>
              <p>
                We collect basic crash reports and aggregated, non-identifiable usage metrics to
                improve the app. We do not sell or share this data with third-party advertisers.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Content safety scanning */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">2. AI Content Safety Scanning</h2>
          </div>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              When a message is sent in a chat that includes a child account, ZIVR runs automated
              content safety analysis on the message text. This analysis is performed server-side
              using a third-party AI model (Anthropic Claude).
            </p>
            <p>
              If content is flagged, ZIVR stores a record that includes: a truncated excerpt of the
              flagged text (up to 500 characters), a severity level (low, medium, or high), and the
              AI model's reason for flagging. This record is saved in our database and is accessible
              to the parent account linked to the child.
            </p>
            <p>
              Parents choose which severity levels trigger a push notification (All, Medium and
              above, or High only). You can change this setting at any time; the change takes effect
              immediately. Parents can also mark flags as reviewed within the Parental Dashboard.
            </p>
            <p>
              Content flag records persist until the child account is deleted. There is no separate
              endpoint to delete individual flag records.
            </p>
            <p className="text-sm bg-slate-50 rounded-xl p-4 text-slate-500">
              <strong className="text-slate-700">Third-party AI:</strong> Message text from chats
              containing child members is sent to Anthropic for safety classification. Anthropic's
              data handling is governed by their own privacy policy. Only the message text is
              transmitted; no sender identity or account credentials are included.
            </p>
          </div>
        </section>

        {/* 3. Local encryption & passcode */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-900/10 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-slate-900" />
            </div>
            <h2 className="text-2xl font-bold">3. Chat Passcode & Local Encryption</h2>
          </div>
          <div className="space-y-5 text-slate-600 leading-relaxed">
            <p>
              ZIVR provides two separate, independent privacy features for individual chats:
            </p>

            <div className="bg-slate-50 rounded-xl p-5 space-y-3">
              <h3 className="text-base font-semibold text-slate-800">Chat Passcode (access lock)</h3>
              <p>
                A passcode locks access to a specific chat behind a 4–6 digit code. The passcode
                is stored as a salted SHA-256 hash in the app's local storage — the plaintext code
                is never stored. You can optionally add a hint and a recovery email address when
                setting a passcode. If you forget your passcode, the Chat Settings screen includes
                a "Send Recovery Email" option: this uses your device's mail app to compose a draft
                email containing your hint and instructions. No email is sent automatically by
                ZIVR's servers, and the passcode itself cannot be retrieved or reset remotely.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 space-y-3">
              <h3 className="text-base font-semibold text-slate-800">Per-chat Encryption (message content)</h3>
              <p>
                Separately, you can enable AES-256 encryption of message content stored locally on
                your device. When enabled, a random 64-character key is generated and used to
                encrypt each message's text fields in the app's local storage. The key is also
                stored locally. This protects message content at rest on the device — for example,
                if someone accesses your device's local storage directly.
              </p>
              <p className="text-sm text-slate-500">
                <strong className="text-slate-700">What this does not do:</strong> this encryption
                applies only to the locally stored copy of messages. Messages are transmitted over
                standard TLS. Server-connected messages are also stored on ZIVR servers without this
                local encryption layer.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Cloud backup */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold">4. Backup & Restore</h2>
          </div>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              ZIVR includes a cloud backup feature for local (device-only) chats. When you back up
              a local chat, the message data is uploaded to ZIVR's servers and can be restored on a
              new device. The backup process itself does not add an encryption layer to the data —
              if your chat has per-message encryption enabled, those messages remain in their
              encrypted form in the backup; otherwise the messages are stored in plaintext on our
              servers. Backups persist until you delete them manually or delete your account.
            </p>
            <p>
              Server-connected chat history is already stored on ZIVR's servers as part of normal
              messaging and does not need a separate backup step.
            </p>
            <p>
              You can also export any chat as a PDF or plain-text file directly from the app.
              Exports are saved to your device; ZIVR does not receive or store a copy of your export.
            </p>
          </div>
        </section>

        {/* 5. Screenshot & screen-capture */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-2xl font-bold">5. Screen Capture & Self-Destruct Messages</h2>
          </div>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              When a self-destruct (view-once or timed) message is open, ZIVR requests screenshot
              protection using the platform's native API. On iOS and Android, the operating system
              may show a blank or blurred screen when a screenshot is attempted while this flag is
              active.
            </p>
            <p>
              <strong className="text-slate-800">Limitations:</strong> screenshot protection relies
              on platform APIs and applies only while a qualifying message is on screen. It does not
              prevent someone from photographing the screen with another device, and behavior varies
              by OS version and device.
            </p>
          </div>
        </section>

        {/* 6. Parental controls & children's data */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">6. Children's Privacy & Parental Controls</h2>
          </div>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              ZIVR child accounts are created by and linked to a parent account. Parents can review
              and approve incoming contact requests for their child, configure recurring access
              schedules (time limits), grant temporary access outside those hours, and choose which
              safety-alert severity levels send push notifications.
            </p>
            <p>
              ZIVR does not knowingly collect personal information from children under 13 without
              verifiable parental consent, consistent with the Children's Online Privacy Protection
              Act (COPPA) and similar regulations.
            </p>
            <p>
              Content safety flag records for a child — including flagged text excerpts, severity,
              and AI reasoning — are stored on ZIVR servers and are accessible only to that child's
              linked parent account. These records persist until the child account is deleted.
            </p>
            <p>
              Parents may request deletion of their child's account and all associated data by
              contacting ZIVR support as described in section 9 below.
            </p>
          </div>
        </section>

        {/* 7. Safety alerts */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold">7. Safety Alert Notifications</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Parents configure which content safety severity levels (All, Medium and above, or High
            only) trigger a push notification. Alerts are delivered only to the registered parent
            account for the child in question and are not shared with other users or third parties.
            Changing this setting takes effect immediately for new alerts.
          </p>
        </section>

        {/* 8. Data sharing */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-slate-500" />
            </div>
            <h2 className="text-2xl font-bold">8. Data Sharing & Third Parties</h2>
          </div>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              ZIVR does not sell your personal data. We do not share your messages or personal
              information with advertisers. We share data with the following third parties as part
              of operating the app:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-slate-800">Anthropic (content safety)</strong> — message
                text from chats involving child accounts is sent to Anthropic Claude for content
                safety classification. This happens automatically for every qualifying message.
              </li>
              <li>
                <strong className="text-slate-800">Anthropic (PDF export appendix)</strong> — if
                you choose to add an AI-generated summary or key-points appendix when exporting a
                chat to PDF, the selected message text is sent to Anthropic for that processing.
                This is optional and requires explicit consent in the export flow before any text
                is transmitted.
              </li>
              <li>
                <strong className="text-slate-800">Infrastructure providers</strong> — cloud hosting,
                database, and related services operate under data processing agreements that prohibit
                use of your data for any other purpose.
              </li>
            </ul>
            <p>
              We may disclose data if required by law, court order, or to protect the safety of our
              users or the public.
            </p>
          </div>
        </section>

        {/* 9. Your rights */}
        <section>
          <h2 className="text-2xl font-bold mb-4">9. Your Rights & Data Deletion</h2>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              You may request access to, correction of, or deletion of your account and personal
              data at any time. We will respond within 30 days.
            </p>
            <p>
              Deleting your account removes your profile record and your cloud backups from our
              servers. Chats you created are not automatically deleted — the chat record is
              retained and your identity in it is disassociated (set to anonymous). Messages
              in those chats remain. Child accounts linked to your parent account are not
              automatically deleted when your account is deleted; a separate deletion request
              is required for each child account. Content flags associated with a child account
              are removed when that child account is deleted.
            </p>
            <p>
              Locally stored app data on your device is removed when you delete the app.
            </p>
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
              There is not currently a self-service account deletion option in the app. To request
              account deletion, contact ZIVR support through the ZIVR listing on the App Store or
              Google Play — tap "App Support" on the listing page.
            </p>
          </div>
        </section>

        {/* 10. Contact */}
        <section className="bg-slate-50 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-3">10. Contact Us</h2>
          <p className="text-slate-600 mb-4 leading-relaxed">
            For privacy questions, data requests, COPPA inquiries, or to report a concern, visit
            our{' '}
            <Link href="/support" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              support page
            </Link>{' '}
            or contact us through the ZIVR listing on the App Store or Google Play (tap "App Support").
          </p>
          <p className="text-sm text-slate-500">
            This policy may be updated as the app evolves. Material changes will be communicated
            through an in-app notice or on this page.
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
            <Link href="/privacy" className="hover:text-slate-700 transition-colors font-medium text-primary">Privacy</Link>
            <Link href="/support" className="hover:text-slate-700 transition-colors">Support</Link>
          </div>
          <span>&copy; {new Date().getFullYear()} ZIVR. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
