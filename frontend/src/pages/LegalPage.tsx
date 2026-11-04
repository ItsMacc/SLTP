// LegalPage.tsx — Privacy Policy and Terms of Service
//
// One document renderer for both pages: a reading column, a contents list, and
// hairline-separated sections. Every privacy statement below is drawn from the
// code that implements it (see the section comments for the file each claim
// comes from), so the policy cannot promise behaviour the platform lacks.
import type { ReactNode } from 'react';
import Button from '../ui/Button';
import './LegalPage.css';

export type LegalPageKind = 'privacy' | 'terms';

interface LegalListItem {
  lead?: string;
  text: ReactNode;
}

interface LegalParagraph {
  type: 'paragraph';
  text: ReactNode;
}

interface LegalListBlock {
  type: 'list';
  items: LegalListItem[];
}

type LegalBlock = LegalParagraph | LegalListBlock;

interface LegalSection {
  step: string;
  title: string;
  blocks: LegalBlock[];
}

interface LegalDocument {
  title: string;
  meta: string;
  intro: ReactNode;
  sections: LegalSection[];
}

const legalEmail = 'legal.sltp@gmail.com';

// Sources for the statements in this document:
//   app/auth/auth.py            session tokens, JWKS verification, profile read
//   app/auth/security.py        sign-in device hashes, ten-device cap, alerts
//   app/database/users/…        provisioning, API-key hashing, account deletion
//   app/database/turso/turso.py tables held in Turso, digest markers, churn log
//   app/notification/mailer.py  Gmail SMTP delivery and message kinds
//   migrations/migrations.sql   exact columns stored per table
//   frontend/lib/*.ts           browser storage keys and the Supabase client
const privacyDocument: LegalDocument = {
  title: 'Privacy Policy',
  meta: 'Last updated: November 4, 2026',
  intro:
    'SLTP is an independent quantitative research platform: it replays market history against a trading rule and keeps the research you build around that rule. This policy sets out exactly what the platform stores, why, where it goes, and how to have it removed. It describes the systems we run rather than a template, and it applies to the website, the API and the Lab.',
  sections: [
    {
      step: '01',
      title: 'Who we are and what this policy covers',
      blocks: [
        {
          type: 'paragraph',
          text: 'In this policy, "we", "us" and "our" mean SLTP, and "you" means the person using the platform. "Personal information" means any record that identifies you or can reasonably be linked back to you. This policy covers every part of the service and forms part of our Terms of Service; where the two documents differ on how information is handled, this one governs.',
        },
        {
          type: 'paragraph',
          text: 'The platform deliberately holds a narrow set of records. It is a research tool, not a broker: there are no holdings, no orders and no payment details to protect, because none of them exist here.',
        },
      ],
    },
    {
      step: '02',
      title: 'Information we collect',
      blocks: [
        {
          type: 'paragraph',
          text: 'We process the categories below, and nothing outside this list is collected or inferred:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Account credentials:',
              text: 'When you create an account, Supabase stores your email address and your password. Passwords are held by Supabase Auth in hashed form; SLTP never receives, stores or has access to the plain-text password. A successful sign-in returns a session token to your browser and nothing more.',
            },
            {
              lead: 'Profile:',
              text: 'Your account row holds the display name you chose and your email address, which is used for account and security messages.',
            },
            {
              lead: 'Preferences:',
              text: 'Your theme, chart limits and notification choices are stored as a settings object on your account, so the platform opens the way you left it. A mirror of that object is kept in the database our nightly job reads.',
            },
            {
              lead: 'Saved work:',
              text: 'Your portfolio setup answers — portfolio name, base currency, starting cash and the choices made in the onboarding wizard — and, in the Lab, the workspaces, projects, folders and Python files you create.',
            },
            {
              lead: 'Learning progress:',
              text: 'The Learn course records which sections and milestones you have completed and which badges or certificates you have earned.',
            },
            {
              lead: 'API keys:',
              text: 'If you create a personal API key, we store the label you gave it, the first characters so you can recognise it in a list, a one-way hash of the key, and when it was created and last used. The key itself is shown once and never stored.',
            },
            {
              lead: 'Sign-in device checks:',
              text: 'At the moment you sign in — and only then — we record a salted, one-way hash of your IP address and of your browser’s user-agent string, a readable label such as "Chrome on macOS", and the first and last time that device was seen. We keep your ten most recent devices. The raw IP address is never written down, never shown back to you, and never used to locate you.',
            },
            {
              lead: 'Correspondence:',
              text: 'If you email us, we keep the message and your address for as long as it takes to resolve the matter and to keep a record of what was agreed.',
            },
            {
              lead: 'Service logs:',
              text: 'Our hosts record ordinary request logs such as IP address, user-agent and requested URL, and the API writes an error message when a request fails. An error message can include an account identifier so a failure can be traced to the account it affected.',
            },
          ],
        },
      ],
    },
    {
      step: '03',
      title: 'How we use information',
      blocks: [
        {
          type: 'paragraph',
          text: 'Each category above exists for one of these purposes, and is not used for another:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Operating the service:',
              text: 'Authenticating you, loading your preferences and saved work, running the backtests you request, and keeping your portfolio setup and Lab files available across visits.',
            },
            {
              lead: 'Security:',
              text: 'Verifying session tokens, carrying out the sign-in device check, emailing you when an unrecognised device signs in, and investigating abuse of the service.',
            },
            {
              lead: 'Notifications you asked for:',
              text: 'Signal digests and market summaries for strategies you follow, sent only while the notification setting is on. Turning it off in Settings stops them.',
            },
            {
              lead: 'Responding to you:',
              text: 'Answering questions, acting on an access or deletion request, and investigating a reported problem.',
            },
            {
              lead: 'Maintenance:',
              text: 'Diagnosing failures and understanding, in aggregate, which parts of the platform break, so that they can be fixed.',
            },
          ],
        },
      ],
    },
    {
      step: '04',
      title: 'What we do not do',
      blocks: [
        {
          type: 'paragraph',
          text: 'The boundaries matter as much as the list above, so we state them plainly:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'No advertising:',
              text: 'There are no ad networks, advertising pixels or advertising identifiers on the platform. We do not sell, rent or trade personal information, and no data broker receives anything from us.',
            },
            {
              lead: 'No tracking cookies:',
              text: 'The platform sets no tracking or analytics cookies and embeds no third-party analytics script. The browser storage described in section 06 is our own, and it holds your session and your preferences.',
            },
            {
              lead: 'No behavioural profiling:',
              text: 'We do not build commercial interest profiles, log a page-by-page browsing history, or use your activity to target anything at you.',
            },
            {
              lead: 'No continuous IP tracking:',
              text: 'IP address and device details are processed at sign-in only, retained as salted hashes, and never used to follow your activity between visits. After a ban, a masked hash may be retained for the single purpose of detecting a new account; section 08 sets out exactly what that record holds.',
            },
            {
              lead: 'No payment or brokerage data:',
              text: 'SLTP is free to use. We collect no card details, bank details or billing address, hold no funds, and have no broker connection that could place an order; no trading credentials are requested at any point.',
            },
            {
              lead: 'No sensitive categories:',
              text: 'We do not ask for health, biometric, genetic, political, religious or trade-union information, and no feature of the platform requires it.',
            },
          ],
        },
      ],
    },
    {
      step: '05',
      title: 'Service providers',
      blocks: [
        {
          type: 'paragraph',
          text: 'We use a small number of infrastructure providers. Each is bound by contract to process information only on our instructions and for the purpose we engaged it for:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Supabase:',
              text: 'Provides identity — email address, hashed password and sessions — and stores your profile, settings and learning-progress rows. Row-level security restricts each row to the account that owns it.',
            },
            {
              lead: 'Turso:',
              text: 'Our libsql database. It holds the account mirror, portfolio setup, Lab workspaces, projects and files, API-key hashes, the deletion log and the notification bookkeeping described in section 07.',
            },
            {
              lead: 'Vercel:',
              text: 'Hosts the web frontend, serving its files and recording ordinary request logs.',
            },
            {
              lead: 'Render:',
              text: 'Hosts the API service and records ordinary request logs for it.',
            },
            {
              lead: 'Market data:',
              text: 'Daily price and volume history is downloaded from Yahoo Finance through the open-source yfinance client. Those requests concern symbols and dates, and carry no account information.',
            },
            {
              lead: 'Google (Gmail SMTP):',
              text: 'Delivers account, security and notification email from our sending address to the address on your account.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'We do not run an advertising, analytics, crash-reporting or customer-data platform alongside these providers. If one is added or replaced in a way that changes how personal information is handled, this policy is updated before that change takes effect.',
        },
      ],
    },
    {
      step: '06',
      title: 'Browser storage and sessions',
      blocks: [
        {
          type: 'paragraph',
          text: 'The frontend keeps a short, fixed list of values in your browser. There are no cookies. Every item below is first-party, readable only by this site:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Session token:',
              text: 'Your Supabase session, kept in local storage so a reload does not sign you out. It is cleared when you sign out.',
            },
            {
              lead: 'Cached preferences:',
              text: 'A copy of your settings object, so the first paint uses your theme and chart choices before the account row answers. Your display name and theme are also held for the current visit only, in session storage.',
            },
            {
              lead: 'Learning progress:',
              text: 'A local copy of course progress, keyed to your account, used when Supabase or the network is unavailable. Supabase remains the authoritative record.',
            },
            {
              lead: 'Interface state:',
              text: 'Whether groups in the documentation sidebar were open, so the panel looks the same when you return.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'You can remove all of it at any time through your browser’s site-data settings. Doing so signs you out and resets those local choices; it does not delete your account, which is handled in section 08.',
        },
      ],
    },
    {
      step: '07',
      title: 'How long we keep information',
      blocks: [
        {
          type: 'paragraph',
          text: 'Information is kept only while it serves the purpose it was collected for:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Account, profile and saved work:',
              text: 'For as long as your account exists, and removed when you delete it.',
            },
            {
              lead: 'Sign-in device history:',
              text: 'The ten most recent devices, replaced as newer devices sign in, and removed with the account.',
            },
            {
              lead: 'Learning progress:',
              text: 'Held with your account and removed together with it.',
            },
            {
              lead: 'Notification bookkeeping:',
              text: 'One send record per recipient per trading session, pruned after 30 days, so a rerun of the nightly job cannot mail the same digest twice.',
            },
            {
              lead: 'Correspondence:',
              text: 'Until the matter is closed, then for a reasonable further period as a record of how it was resolved.',
            },
            {
              lead: 'Service logs:',
              text: 'For the retention window configured at our hosts, after which they rotate out. Application error entries are kept only as long as needed to diagnose the failure.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Two records can outlive a deleted account — the deletion log, and the ban record kept after a termination for a serious offence. Both are described in section 08 rather than folded into this list, because they deserve to be read on their own.',
        },
      ],
    },
    {
      step: '08',
      title: 'Deletion, access and your rights',
      blocks: [
        {
          type: 'paragraph',
          text: 'You can delete your account yourself, at any time, from Settings. Deletion is permanent and needs no email to us. The server removes, in this order: your Supabase sign-in credential, so the same address can neither sign in again nor be silently re-created; your Supabase profile row; and, in Turso, your Lab files, folders, projects and workspaces, your API keys, your portfolio setup and your account row. Learning-progress and award rows belong to the sign-in credential and are removed with it. When the request completes there is no live account, no backup copy and no shadow profile.',
        },
        {
          type: 'paragraph',
          text: 'One record does survive, and we would rather name it than leave it implied: an entry in our deletion log holding the account id, the email address, the display name and the date of deletion. It exists because deleting an account erases every other trace, and without it we could not report how many accounts were created and closed, or answer a dispute about a deletion. It holds no preferences, no saved work and no device history, it is never used to contact you, and it is not linked to any profile. Ask us and we will remove that entry as well.',
        },
        {
          type: 'paragraph',
          text: 'A second record can survive, and only after a ban. Where we terminate an account for a serious offence — fraud, resale or redistribution of market data, or evading an earlier ban — we keep a suppression record so that the same person cannot open another account and continue. It holds the email address on the account, the reason for the ban, the date, and the sign-in identifiers we already compute for the device check: IP address and browser user-agent, both masked and held only as a salted one-way hash. The original address cannot be read back from it, by us or by anyone else. The record contains none of your saved work, and it has one use only: matching a new sign-up attempt. It is never used to follow ordinary activity, never sold and never shared except where the law compels it. You can ask us whether such a record exists about you and appeal it, and if a ban is lifted the record is removed.',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Access and correction:',
              text: 'You can review and update your account details, preferences and saved work inside the platform at any time, and you can ask us in writing for a copy of what we hold.',
            },
            {
              lead: 'Erasure:',
              text: 'Use the self-serve deletion above, or write to us and we will carry it out for you.',
            },
            {
              lead: 'Withdrawal of consent:',
              text: 'You may turn notifications off, or withdraw consent to any processing that relies on it. Where the service cannot operate without that processing, the consequence is that the relevant feature, or the account itself, stops working.',
            },
            {
              lead: 'Complaints:',
              text: 'Contact us first and we will try to resolve it. SLTP operates under Canadian law, so you may also complain to the Office of the Privacy Commissioner of Canada.',
            },
          ],
        },
      ],
    },
    {
      step: '09',
      title: 'Security',
      blocks: [
        {
          type: 'paragraph',
          text: 'Traffic between your browser and the platform is carried over HTTPS and TLS. Session tokens are verified on every protected request against the signing keys Supabase publishes, so a forged or expired token is rejected before any query runs. Every database query is scoped to the account id taken from that verified token — never from the request body — so one account cannot read another’s rows, and row-level security policies in Supabase enforce the same boundary for direct reads. Service credentials stay on the server and are never sent to the browser. Personal API keys and sign-in device values are stored only as one-way hashes. Administrative access is limited to the operator accounts required to run the service.',
        },
        {
          type: 'paragraph',
          text: 'No system is perfectly secure, and we do not claim otherwise. If a breach affects your personal information, we will notify you and the appropriate regulator without undue delay, and tell you what was affected and what we have done about it.',
        },
      ],
    },
    {
      step: '10',
      title: 'Children and age limits',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is not directed to children, and you must be at least 13 years old to hold an account. We do not knowingly collect personal information from a child under 13, consistent with the Children’s Online Privacy Protection Act. If we learn that an account belongs to a child under 13, we delete the account and its data. If you believe a child under 13 has given us information, write to us and we will remove it.',
        },
        {
          type: 'paragraph',
          text: 'Between 13 and 17, the platform may be used for research and education only. Applying a strategy to real money, placing a live trade or acting on a signal requires you to be at least 18, or the age of majority where you live. No feature of SLTP places an order, so this is a condition of use rather than a technical control, and we may close an account found in breach of it.',
        },
      ],
    },
    {
      step: '11',
      title: 'International transfers',
      blocks: [
        {
          type: 'paragraph',
          text: 'Our providers operate data centres in the United States and other countries, so information you give us may be stored and processed outside Canada, including in the United States. A transfer is covered by the provider’s contractual terms and, where the law requires it, by additional safeguards. We do not structure our operations to avoid the privacy protections of any jurisdiction in which we operate, and we remain accountable for personal information handled on our behalf.',
        },
      ],
    },
    {
      step: '12',
      title: 'Market data and third-party links',
      blocks: [
        {
          type: 'paragraph',
          text: 'Charts and backtests are built from third-party market data. That data may be corrected, delayed or incomplete, and it is provided for research only: it is not a recommendation, an offer or a valuation. Our Terms of Service set out what backtested results do and do not represent, and they prohibit reselling or redistributing that data.',
        },
        {
          type: 'paragraph',
          text: 'The platform may link to sites we do not control. We are not responsible for their content, their availability or their privacy practices, and a link is not an endorsement. Once you leave SLTP, the policy of the site you visit applies to what happens there.',
        },
      ],
    },
    {
      step: '13',
      title: 'Changes to this policy',
      blocks: [
        {
          type: 'paragraph',
          text: 'We revise this policy when the platform or the law changes. The date at the top of this page is the date of the version in force, and each version is published at this address. If a change materially affects how we use information you have already given us, we will tell you before it takes effect, by email to the address on your account or by a notice in the platform, and where the law requires it we will ask for your consent. Continuing to use the platform after a revised policy takes effect means you accept it.',
        },
      ],
    },
    {
      step: '14',
      title: 'Contact',
      blocks: [
        {
          type: 'paragraph',
          text: (
            <>
              For a privacy question, an access or deletion request, or a report about this
              policy, write to{' '}
              <a className="st-legal-link" href={`mailto:${legalEmail}`}>
                {legalEmail}
              </a>
              . Include the email address on your account so we can locate it. We answer privacy
              requests within 30 days, and if a request needs longer or cannot be met, we will
              say so and explain why.
            </>
          ),
        },
      ],
    },
  ],
};

const termsDocument: LegalDocument = {
  title: 'Terms of Service',
  meta: 'Last updated: November 4, 2026',
  intro:
    'Please read these Terms of Service carefully before accessing or using SLTP. By using the platform, you agree to be bound by them. If you do not agree, please do not use the platform.',
  sections: [
    {
      step: '01',
      title: 'Acceptance of terms and governing law',
      blocks: [
        {
          type: 'paragraph',
          text: 'This agreement forms a binding contract between you and SLTP. These Terms are governed by, and construed and enforced in accordance with, the laws of Canada and the province in which SLTP operates, without regard to conflict-of-law principles. If you are accepting these Terms on behalf of an organization, you confirm that you have the authority to bind that organization, and "you" includes that organization.',
        },
      ],
    },
    {
      step: '02',
      title: 'Our role and what we do not provide',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is a quantitative research and analysis platform. We are not a registered investment advisor, broker-dealer, financial planner, or tax professional. We do not manage money, hold client accounts, execute trades, or provide personalized financial, investment, legal, or tax advice.',
        },
        {
          type: 'paragraph',
          text: 'Everything on the platform is designed to help you research markets and understand strategies more clearly. Our models, metrics, and signals are a starting point for your own analysis. What you do with them, and the diligence behind those decisions, remains your responsibility.',
        },
      ],
    },
    {
      step: '03',
      title: 'Age eligibility and trading restrictions',
      blocks: [
        {
          type: 'paragraph',
          text: 'You must be at least 13 years of age to access and use the informational features of SLTP. To execute strategies, use live market signals, or make real financial investments, you must be at least 18 years of age, or the legal age of majority in your jurisdiction. By using the platform you represent that you meet these eligibility requirements, and you agree not to use it on behalf of anyone who does not.',
        },
      ],
    },
    {
      step: '04',
      title: 'Backtested and hypothetical performance',
      blocks: [
        {
          type: 'paragraph',
          text: 'Investing carries risk, including the possibility of losing the capital you commit. We want that to be clear before you use any of our models. You acknowledge and agree that:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Backtested results:',
              text: 'Every strategy, metric, and model on SLTP can be tested against historical data up to the current date. Backtested figures are hypothetical. They are produced with hindsight over past data and do not represent trades that were actually placed or could have been placed.',
            },
            {
              lead: 'Live results:',
              text: 'Signals and live tracking apply the same documented rules to current market data. They are not predictions, they carry no guarantee of profit, and they may differ from the backtest that suggested them.',
            },
            {
              lead: 'Capital risk:',
              text: 'Past performance does not predict future results, and you can lose some or all of the capital you invest. Treat a signal as the start of your own research, and size any position so that being wrong is survivable.',
            },
            {
              lead: 'Data limitations:',
              text: 'Historical prices are supplied by third-party providers and may be corrected, delayed, or incomplete. Errors in market data, corporate actions, or transaction costs can change the outcome of a backtest.',
            },
          ],
        },
      ],
    },
    {
      step: '05',
      title: 'User accounts, security, and user-generated content',
      blocks: [
        {
          type: 'paragraph',
          text: 'You are responsible for maintaining the security of your account credentials, for all activity that occurs under your account, and for keeping your contact details current. Where the platform permits user-generated content, including custom strategy code, parameters, reviews, or comments:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'User responsibility:',
              text: 'You retain responsibility for any content you publish or upload, and you confirm that it does not infringe third-party rights or breach any law.',
            },
            {
              lead: 'Ownership and licence:',
              text: 'You keep ownership of everything you write or submit — strategy code, parameters, notes and Lab projects. By submitting it, you grant us only a non-exclusive, worldwide, royalty-free licence to store, host, display and run it so that we can operate the platform for you. Section 07 draws that boundary in full.',
            },
            {
              lead: 'Code you run:',
              text: 'Strategy code you write in the Lab executes in a sandboxed environment provided for that purpose. You remain responsible for the code you run and for any loss it may cause to you or to a third party.',
            },
          ],
        },
      ],
    },
    {
      step: '06',
      title: 'Acceptable use',
      blocks: [
        {
          type: 'paragraph',
          text: 'You agree not to use SLTP in a way that is unlawful, that interferes with the service for other users, or that attempts to extract more from it than the platform is intended to provide:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Prohibited conduct:',
              text: 'You may not attempt to gain unauthorised access to any account, system, or data; introduce malicious code; interfere with the operation or security of the platform; use the service in violation of law; or misrepresent your identity or the origin of content you submit.',
            },
            {
              lead: 'Prohibited scraping:',
              text: 'Automated data harvesting, web scraping, spidering, or mass extraction of content, strategy logic, or market data from SLTP is prohibited, except where a published interface is made available for that purpose and you hold explicit authorisation.',
            },
            {
              lead: 'No reverse engineering:',
              text: 'You agree not to decompile, reverse-engineer, copy, or attempt to derive the source code or the proprietary mathematical structures of our quantitative models, except to the extent that restriction is not permitted by law.',
            },
            {
              lead: 'Official API usage:',
              text: 'Access to data through official programmatic interfaces is governed by separate developer terms and requires explicit authorization.',
            },
          ],
        },
      ],
    },
    {
      step: '07',
      title: 'Intellectual property',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP retains all right, title, and interest in and to the platform itself — its design, source code, backtesting engine, the strategies and models we publish, our written content, branding and data compilations — under Canadian and international intellectual property law. What we grant you is a limited, revocable, non-exclusive, non-transferable licence to access the platform for your own research and personal use. It is a licence to use the platform, not a licence to its code.',
        },
        {
          type: 'paragraph',
          text: 'Your own work stays yours. Strategy code, parameters, notebooks and Lab projects you write are your intellectual property: we claim no ownership of them, we do not license them to anyone else, and we do not publish them. We store and execute them only to provide the platform to you — saving a project, running a backtest you asked for, keeping your work available when you return — and they are deleted with your account or when you remove them. You remain free to use, publish, license or sell your own strategies anywhere.',
        },
        {
          type: 'paragraph',
          text: 'The same boundary applies in the other direction. You may not:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Sell or sublicense SLTP:',
              text: 'You may not sell, resell, rent, sublicense or redistribute SLTP’s code, engine or access to the platform, and you may not offer the platform, its engine or its outputs to third parties as a service of your own.',
            },
            {
              lead: 'Re-create the engine:',
              text: 'You may not copy, translate, decompile, disassemble or reverse-engineer the code or engine, and you may not attempt to re-create, reimplement or derive its source code, models or mathematical structure, in whole or in part, or commission or help anyone else to do so.',
            },
            {
              lead: 'Build a competing product:',
              text: 'You may not use the code, the engine or its outputs to develop, train or improve a competing product or service.',
            },
            {
              lead: 'What you may do:',
              text: 'Study the strategy logic and results we publish, quote them with attribution to SLTP, and build your own code on your own side of the boundary described above.',
            },
          ],
        },
      ],
    },
    {
      step: '08',
      title: 'Market data and educational use',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is an educational and research platform. Price and volume history, charts and backtest output are built from third-party market data licensed to us for research and display inside the platform, and it is given to you for that purpose only — so that you can study how a rule behaves, not so that you can redistribute the data itself.',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'No resale:',
              text: 'You may not sell, resell, sublicense, license or otherwise commercially exploit market data obtained through SLTP.',
            },
            {
              lead: 'No redistribution:',
              text: 'You may not publish, redistribute, share or otherwise make that data available to any third party, in whole or in part, whether as a file, a feed, a dataset or a derived table, and you may not upload it to another platform or data service.',
            },
            {
              lead: 'No reuse in another product:',
              text: 'You may not use the data to build, feed, train or enrich another dataset, model, index or product, or to supply a service that depends on it.',
            },
            {
              lead: 'Ordinary research use:',
              text: 'Reading a chart, running the backtests you request, and quoting a figure in your own notes or research write-up with attribution to SLTP are all fine.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Bulk extraction is prohibited by section 06, and nothing here relaxes that. Where a data provider’s terms require it, we may restrict or suspend an account’s access to market data, and we may close an account that resells or redistributes it.',
        },
      ],
    },
    {
      step: '09',
      title: 'Third-party services and links',
      blocks: [
        {
          type: 'paragraph',
          text: 'The platform may reference or link to third-party sites, data sources, and services. We do not control them and are not responsible for their content, availability, or practices. Any agreement you enter into with a third party is between you and them, and we are not a party to it. Your use of a linked service is at your own risk.',
        },
      ],
    },
    {
      step: '10',
      title: 'Disclaimers and no warranty',
      blocks: [
        {
          type: 'paragraph',
          text: 'The platform and everything on it are provided on an "as is" and "as available" basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including any implied warranty of merchantability, fitness for a particular purpose, title, non-infringement, and accuracy of the content. We do not warrant that the platform will be uninterrupted, that any result will be accurate, or that the service will meet your requirements. You accept full responsibility for any decision you make based on the platform.',
        },
      ],
    },
    {
      step: '11',
      title: 'Limitation of liability',
      blocks: [
        {
          type: 'paragraph',
          text: 'To the maximum extent permitted by applicable law, SLTP, its founders, employees, and affiliates are not liable for any direct, indirect, incidental, special, consequential, or punitive damages arising out of or connected to your use of the platform, including any reliance on its models, metrics, or signals, or any loss of profits, data, or opportunity. Nothing in these Terms excludes liability that cannot be excluded by law, including in respect of fraud, fraudulent misrepresentation, or death or personal injury caused by negligence.',
        },
      ],
    },
    {
      step: '12',
      title: 'Indemnity',
      blocks: [
        {
          type: 'paragraph',
          text: 'You agree to defend, indemnify, and hold harmless SLTP, its founders, employees, and affiliates from and against any claim, demand, loss, liability, or expense, including reasonable legal fees, arising out of your use of the platform, your breach of these Terms, your violation of law, or your infringement of the rights of a third party.',
        },
      ],
    },
    {
      step: '13',
      title: 'Free service model',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is provided to users free of charge. No subscription fees, purchases, or monetary transactions are processed through the platform, and we do not take custody of, hold, or have any authority over any funds or assets. If we ever introduce a paid tier, the terms of that tier will be presented to you and accepted separately before you are charged.',
        },
      ],
    },
    {
      step: '14',
      title: 'Modifications, suspension, and termination',
      blocks: [
        {
          type: 'paragraph',
          text: 'We reserve the right to modify these Terms, or to modify, suspend, or discontinue any part of the platform, at any time and without notice. Continued use of SLTP after a change indicates your acceptance of the revised Terms. We may also suspend or terminate your access immediately, without notice, if you breach these Terms, if you use the platform in a way that endangers it or its users, or if we are required to do so by law. On termination, your right to use the platform ends, and your data is handled as described in our Privacy Policy.',
        },
        {
          type: 'paragraph',
          text: 'Where we ban an account for a serious offence under these Terms — fraud, resale or redistribution of market data, or evading an earlier ban — we keep a limited record of that ban so the same person cannot simply open another account and carry on. The record holds the email address on the account, the reason, the date, and the sign-in identifiers we already compute for device checks: your IP address and browser user-agent. Both are kept masked and only as a salted one-way hash, so the address cannot be read back out of our records by us or by anyone else, and they are used for one purpose only — matching a new sign-up attempt. The record holds no portfolio setup, no Lab work, no strategies, no API keys and no learning progress; that material is deleted with the account. These identifiers are never used to follow your ordinary activity, never sold, and never shared except where the law compels it. You can write to us to ask whether such a record exists about you, and to appeal it; if a ban is lifted, the record is removed.',
        },
      ],
    },
    {
      step: '15',
      title: 'General provisions',
      blocks: [
        {
          type: 'paragraph',
          text: 'These Terms are the entire agreement between you and SLTP on the subject matter of the platform, and they supersede any earlier agreement, proposal, or representation, whether written or oral. If a provision is held unenforceable, the remaining provisions stay in force. Our failure to enforce a provision is not a waiver of it. Neither these Terms nor your use of the platform create a partnership, agency, or employment relationship. You may not assign your rights under these Terms without our written consent.',
        },
        {
          type: 'paragraph',
          text: 'Notices under these Terms may be delivered to the email address on your account, or to the address in section 18 for our side. Electronic delivery is effective on transmission, and email notices are deemed received on the first business day after sending.',
        },
      ],
    },
    {
      step: '16',
      title: 'Account deletion',
      blocks: [
        {
          type: 'paragraph',
          text: 'You can delete your account from Settings at any time. Deletion is permanent and cannot be undone. It removes your profile, your portfolio setup, your Lab workspaces, projects and files, your API keys, and your sign-in credentials. If we terminate your account, the same rules apply.',
        },
      ],
    },
    {
      step: '17',
      title: 'Portfolio setup and Lab work',
      blocks: [
        {
          type: 'paragraph',
          text: 'Your portfolio setup answers and Lab projects are tools for recording and testing your own decisions. They do not connect to a brokerage, do not place orders, and do not reflect real holdings. The portfolio figures on the platform, such as base currency and starting cash, are the values you entered, and the research results derived from them are only as accurate as those entries.',
        },
      ],
    },
    {
      step: '18',
      title: 'Contact information',
      blocks: [
        {
          type: 'paragraph',
          text: (
            <>
              For any questions regarding these Terms of Service, please contact us at{' '}
              <a className="st-legal-link" href={`mailto:${legalEmail}`}>
                {legalEmail}
              </a>
              .
            </>
          ),
        },
      ],
    },
  ],
};

interface LegalPageProps {
  page: LegalPageKind;
  onBack: () => void;
}

export default function LegalPage({ page, onBack }: LegalPageProps) {
  const doc = page === 'privacy' ? privacyDocument : termsDocument;

  return (
    <div className="st-legal-layout">
      <article className="st-legal-container">
        <Button variant="link" size="sm" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to SLTP
        </Button>

        <header className="st-legal-header">
          <span className="st-legal-eyebrow">Legal</span>
          <h1 className="st-legal-title">{doc.title}</h1>
          <p className="st-legal-meta">{doc.meta}</p>
          <p className="st-legal-intro">{doc.intro}</p>
        </header>

        <nav className="st-legal-toc" aria-label={`Contents of the ${doc.title}`}>
          <p className="st-legal-toc-title">On this page</p>
          <ol className="st-legal-toc-list">
            {doc.sections.map((section) => (
              <li key={section.step}>
                <a className="st-legal-toc-link" href={`#${page}-${section.step}`}>
                  <span className="st-legal-toc-step">{section.step}</span>
                  <span>{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="st-legal-body">
          {doc.sections.map((section) => (
            <section
              key={section.step}
              id={`${page}-${section.step}`}
              className="st-legal-section"
              aria-labelledby={`${page}-${section.step}-title`}
            >
              <div className="st-legal-section-heading">
                <span className="st-legal-step" aria-hidden="true">
                  {section.step}
                </span>
                <h2 id={`${page}-${section.step}-title`}>{section.title}</h2>
              </div>
              <div className="st-legal-section-content">
                {section.blocks.map((block, blockIndex) =>
                  block.type === 'paragraph' ? (
                    <p key={blockIndex} className="st-legal-paragraph">
                      {block.text}
                    </p>
                  ) : (
                    <ul key={blockIndex} className="st-legal-list">
                      {block.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="st-legal-list-item">
                          {item.lead && <strong className="st-legal-list-lead">{item.lead}</strong>}{' '}
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
