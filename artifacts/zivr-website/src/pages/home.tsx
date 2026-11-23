import { useState } from 'react';
import { Link } from 'wouter';
import './home.css';

/**
 * Homepage claims are limited to docs/website-feature-inventory.md (Shipped).
 *
 * TODO: No public TestFlight URL exists in the repo (eas.json uses placeholder
 * Apple ids). Do not invent an invite link. The beta section says TestFlight
 * and sends questions to /support.
 * TODO: Reactions, image/GIF/music chat, skins, live calls, agent/MCP connectors,
 * sub-profiles, and calendar propose are not shipped. They are omitted on purpose.
 * TODO: Optional store buttons appear only when VITE_ZIVR_APP_STORE_URL or
 * VITE_ZIVR_GOOGLE_PLAY_URL is a real https listing. Both are unset today.
 */

function storeUrl(value: unknown, platform: 'appStore' | 'googlePlay') {
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

const links = [
  { href: '#check-ins', label: 'Check-ins' },
  { href: '#parents', label: 'Parents' },
  { href: '#chat', label: 'Chat' },
  { href: '#people', label: 'People' },
  { href: '#how', label: 'How it works' },
];

export default function Home() {
  const [open, setOpen] = useState(false);
  const appStore = storeUrl(import.meta.env.VITE_ZIVR_APP_STORE_URL, 'appStore');
  const googlePlay = storeUrl(import.meta.env.VITE_ZIVR_GOOGLE_PLAY_URL, 'googlePlay');

  const close = () => setOpen(false);

  return (
    <div className="z-home">
      <a className="skip" href="#content">Skip to content</a>
      <header className="nav">
        <div className="wrap">
          <div className="nav-row">
            <a className="mark" href="#top" onClick={close}>ZIVR<i aria-hidden="true" /></a>
            <nav className="nav-links" aria-label="On this page">
              {links.map((link) => (
                <a key={link.href} href={link.href}>{link.label}</a>
              ))}
              <a className="btn btn-solid" href="#beta">TestFlight beta</a>
            </nav>
            <button
              className="menu-btn btn btn-line"
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Close' : 'Menu'}
            </button>
          </div>
          <nav id="site-menu" className={open ? 'menu-panel open' : 'menu-panel'} aria-label="On this page">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={close}>{link.label}</a>
            ))}
            <a href="#beta" onClick={close}>TestFlight beta</a>
          </nav>
        </div>
      </header>

      <main id="content">
        <section className="hero" id="top">
          <div className="wrap hero-grid">
            <div>
              <p className="kicker"><span aria-hidden="true" />Household messenger · iOS beta</p>
              <h1>Ask once.<br />Only you read<br /><em>the answers.</em></h1>
              <p className="lede">
                ZIVR is for the household. One person can check in with the group and keep every reply.
                A parent decides who a child can reach. The rest is a normal conversation: live text,
                a translation before you send, or a message that waits until morning.
              </p>
              <div className="actions">
                <a className="btn btn-solid" href="#beta">See the TestFlight beta</a>
                <a className="btn btn-line" href="#how">How it works</a>
              </div>
              <ul className="facts">
                <li>Private check-in replies</li>
                <li>Parent approval</li>
                <li>Scheduled texts</li>
                <li>30 languages</li>
                <li>Push when they’re offline</li>
              </ul>
            </div>
            <figure className="slip">
              <div className="slip-head">
                <span className="slip-label">Check-in · what you see</span>
                <span className="stamp">Sender only</span>
              </div>
              <h2 className="serif">Home safe?</h2>
              <p className="example">Example question. Not a screenshot.</p>
              <ol className="replies">
                <li>
                  <span className="who">Member</span>
                  <span className="what">Their reply, visible to you</span>
                </li>
                <li>
                  <span className="who">Member</span>
                  <span className="what">Their reply, visible to you</span>
                </li>
                <li className="wait">
                  <span className="who">Member</span>
                  <span className="what">No reply yet</span>
                </li>
              </ol>
              <figcaption>
                Other members do not receive these words. You also see how many people have answered.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="band" id="check-ins">
          <div className="wrap spread">
            <div className="copy">
              <p className="index">01</p>
              <h2>A check-in is not a group chat.</h2>
              <p>
                Send one note to people in a check-in group. Each person answers you.
                The reply is stored for you and for the person who wrote it.
                Everyone else does not get that text.
              </p>
              <p>
                You get a count of who has replied. They do not. The note itself can be text,
                and it can carry an audio file. A reply follows the same privacy rule.
              </p>
            </div>
            <div className="visual panel">
              <h3>Who can read a reply</h3>
              <ul className="timeline">
                <li>
                  <span className="when">You</span>
                  <p><strong>The words and the count</strong> You asked. You see each answer and how many have come in.</p>
                </li>
                <li>
                  <span className="when">Author</span>
                  <p><strong>Their own reply</strong> The person who answered can see what they sent.</p>
                </li>
                <li>
                  <span className="when">Others</span>
                  <p><strong>Not the message</strong> Another member is not given someone else’s reply.</p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="band band-deep" id="parents">
          <div className="wrap spread reverse">
            <div className="copy">
              <p className="index">02</p>
              <h2>A parent stays in the loop.</h2>
              <p>
                A parent account can create a child account and open it on this phone.
                A new contact for that child waits. Messaging starts after the parent approves.
                The parent can also block someone later.
              </p>
              <p>
                Hours are a start time, an end time, and the days you choose.
                Outside that window the child app locks. A parent can open one or two extra hours,
                and can end that early.
              </p>
              <p>
                Text in a child’s server chat can be flagged, with a low, medium, or high severity.
                The parent chooses which of those send a push: all of them, medium and up, or high only.
                The message still sends if the check fails.
              </p>
            </div>
            <div className="visual panel" aria-hidden="true">
              <h3>An example window</h3>
              <div className="week">
                <span className="on">Mon</span>
                <span className="on">Tue</span>
                <span className="on">Wed</span>
                <span className="on">Thu</span>
                <span className="on">Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
              <div className="hours">
                <div><small>Opens</small><b>3 PM</b></div>
                <div><small>Closes</small><b>8 PM</b></div>
              </div>
              <p className="note">Example only. A parent chooses the hours and the days, then turns the schedule on. Nothing locks before that.</p>
              <div className="states">
                <span className="hold">Pending</span>
                <span className="ok">Approved</span>
                <span className="no">Blocked</span>
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="chat">
          <div className="wrap spread">
            <div className="copy">
              <p className="index">03</p>
              <h2>The conversation is still a conversation.</h2>
              <p>
                Direct chats and groups of up to 50 people carry live text.
                You can see typing, when your message has been read, and whether the other person is online.
                If they are offline, ZIVR sends a push to their phone.
              </p>
              <p>
                Set the other person’s language and ZIVR can translate what you write before it goes out.
                Thirty languages are in the app. If translation fails, the original is what they receive.
                You can also ask for a suggested reply from the recent messages, then edit it.
              </p>
              <p>
                A text can wait. Pick a time, then change or cancel it until it sends.
                The same parent-approval rule applies as if you had sent it now.
                From a server chat you can export the thread, including a PDF made on the phone.
                An AI summary is added only when you ask for it.
              </p>
            </div>
            <div className="visual">
              <ol className="timeline panel">
                <li>
                  <span className="when">Now</span>
                  <p><strong>Live text</strong> Typing, a read receipt, and whether they’re online.</p>
                </li>
                <li>
                  <span className="when">Before</span>
                  <p><strong>Translate or suggest</strong> Send in their language, or start from a suggestion you can change.</p>
                </li>
                <li>
                  <span className="when">Later</span>
                  <p><strong>A scheduled text</strong> It leaves when you said it would. Edit or cancel until then.</p>
                </li>
                <li>
                  <span className="when">Away</span>
                  <p><strong>A push</strong> Offline members with a push token get the new message.</p>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="band band-deep" id="people">
          <div className="wrap spread reverse">
            <div className="copy">
              <p className="index">04</p>
              <h2>Start with people you already have.</h2>
              <p>
                ZIVR can read the contacts on your phone, match numbers that already belong to an account,
                and let you invite the rest. You can also look someone up by username.
                The address book stays on the phone. The server is asked who matches, and it does not keep the full list.
              </p>
              <p>
                A child does not get a new conversation out of that match.
                The parent still has to approve the contact.
              </p>
            </div>
            <div className="visual split">
              <div>
                <h3>On ZIVR</h3>
                <p>A phone number or username that already has an account can open a chat.</p>
              </div>
              <div>
                <h3>Not yet</h3>
                <p>Everyone else gets an invite. They are not uploaded as a stored contact book.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="band how" id="how">
          <div className="wrap">
            <p className="index">How it works</p>
            <h2>Three steps, then the household is on it.</h2>
            <div className="steps">
              <article>
                <em>1</em>
                <h3>Name yourself</h3>
                <p>A display name is the required field. You are shown a recovery code once. That code is how you get back in. There is no password.</p>
              </article>
              <article>
                <em>2</em>
                <h3>Find your people</h3>
                <p>Match phone contacts or search by username. If the other person is a child account, their parent approves the contact before either of you can message.</p>
              </article>
              <article>
                <em>3</em>
                <h3>Talk, or check in</h3>
                <p>Send live text, schedule one for later, or ask the group a question whose answers come back only to you.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="band limits" id="limits">
          <div className="wrap limits-card">
            <p className="index">Plain limits</p>
            <h2>What this beta does not pretend to be.</h2>
            <p>
              Messages that go through ZIVR’s server are stored there so the other person can receive them,
              including when they were offline. A chat can also be locked with a passcode on that phone,
              and a local chat can use on-device encryption. That is not end-to-end encryption.
              The <Link href="/privacy">privacy policy</Link> is the full account.
            </p>
            <p>
              The Calls tab is a preview on the device. It does not place a voice or video call.
            </p>
          </div>
        </section>

        <section className="beta" id="beta">
          <div className="wrap beta-grid">
            <div>
              <p className="kicker"><span aria-hidden="true" />iOS beta</p>
              <h2>Install ZIVR from TestFlight.</h2>
              <p>
                The iOS beta is distributed through TestFlight. Use the invite you were sent.
                This page does not publish a public install link, and there is no store listing here yet.
              </p>
              <div className="actions">
                <Link className="btn btn-light" href="/support">Questions go to Support</Link>
                <Link className="btn btn-line" href="/privacy">Privacy policy</Link>
                {appStore ? <a className="btn btn-line" href={appStore}>App Store</a> : null}
                {googlePlay ? <a className="btn btn-line" href={googlePlay}>Google Play</a> : null}
              </div>
            </div>
            <aside className="beta-aside">
              <strong>TestFlight</strong>
              Invite-only while the beta is open. Android is part of the app project, and this site does not offer a Play build.
            </aside>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-row">
          <span className="mark">ZIVR<i aria-hidden="true" /></span>
          <nav aria-label="Footer">
            <a href="#check-ins">Check-ins</a>
            <a href="#parents">Parents</a>
            <a href="#chat">Chat</a>
            <a href="#how">How it works</a>
            <Link href="/support">Support</Link>
            <Link href="/privacy">Privacy policy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
