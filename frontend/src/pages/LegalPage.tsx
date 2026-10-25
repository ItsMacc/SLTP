// LegalPage.tsx — Privacy Policy and Terms of Service
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

const privacyDocument: LegalDocument = {
  title: 'Privacy Policy',
  meta: 'Last Updated: October 24, 2026',
  intro: 'This Privacy Policy explains what information SLTP collects, why we collect it, how long we keep it, and what you can ask us to do with it. It applies to the SLTP website, its API, and the research and backtesting tools offered through it.',
  sections: [
    {
      step: '01',
      title: 'Introduction and scope',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is an independent quantitative research platform. We collect as little information as the service genuinely requires, and we do not sell, rent, or trade what we hold. This policy is written to be read: it describes our actual practices rather than an aspirational version of them.',
        },
        {
          type: 'paragraph',
          text: 'In this policy, "we", "us", and "our" refer to SLTP. "You" refers to the person using the platform. "Personal information" means any record that identifies you or can be linked back to you.',
        },
      ],
    },
    {
      step: '02',
      title: 'Information we collect',
      blocks: [
        {
          type: 'paragraph',
          text: 'We process the following categories of information, and only these categories:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Account credentials:',
              text: 'If you create an account, we store your email address and encrypted authentication credentials through Supabase, our authentication provider, so that we can establish and secure your session.',
            },
            {
              lead: 'User preferences and portfolios:',
              text: 'We save your settings, watchlists, saved parameters, and portfolio configurations so that your work is still there when you return.',
            },
            {
              lead: 'Sign-in device checks:',
              text: 'At the moment you sign in, and only at that moment, we record a one-way salted hash of your IP address and browser device string for device security. We never store the raw IP address, we do not track you while you use the platform, and the record exists so that we can alert you when an unfamiliar device signs in to your account.',
            },
            {
              lead: 'Support communications:',
              text: 'If you contact us by email, we retain your message and your email address for as long as it takes to address your inquiry and to keep a record of the resolution.',
            },
            {
              lead: 'Technical data:',
              text: 'Our hosting providers record standard web server logs, including IP address, browser type, and requested URL, for the purpose of diagnosing faults and keeping the service available. These logs are governed by our hosting agreements and are not used to build a profile of you.',
            },
          ],
        },
      ],
    },
    {
      step: '03',
      title: 'How we use the information',
      blocks: [
        {
          type: 'paragraph',
          text: 'Information is used for a defined set of purposes and nothing else:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Operating the platform:',
              text: 'Authenticating you, loading your saved work, running backtests on your behalf, and keeping your projects and portfolios in sync across your visits.',
            },
            {
              lead: 'Security and integrity:',
              text: 'Verifying sign-in attempts, detecting unusual access to an account, preventing abuse of the service, and enforcing the restrictions set out in our Terms of Service.',
            },
            {
              lead: 'Responding to you:',
              text: 'Answering questions, acting on data requests, and investigating reports of a problem with the platform.',
            },
            {
              lead: 'Improving the service:',
              text: 'Understanding which parts of the platform are used and where they fail, in aggregate, so that we can fix what is broken. We do not use your individual activity to build advertising profiles.',
            },
          ],
        },
      ],
    },
    {
      step: '04',
      title: 'How we do not use the information',
      blocks: [
        {
          type: 'paragraph',
          text: 'To make the boundaries explicit, SLTP does not do the following:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'No tracking cookies:',
              text: 'We do not deploy tracking cookies, advertising pixels, or third-party marketing identifiers. The only browser storage we use holds your session and your local preferences.',
            },
            {
              lead: 'No behavioural profiling:',
              text: 'We do not log individual browsing paths, build commercial user profiles, or sell, rent, or disclose data to brokers, advertisers, or data brokers.',
            },
            {
              lead: 'No continuous IP tracking:',
              text: 'Your IP address and device are processed at the instant of sign-in, for device security alerts only. We do not monitor your IP address, location, or device activity at any other time, and only salted hashes are retained, never raw values.',
            },
            {
              lead: 'No third-party advertising:',
              text: 'Nothing on the platform is used to build an advertising audience.',
            },
          ],
        },
      ],
    },
    {
      step: '05',
      title: 'Third-party processors and service providers',
      blocks: [
        {
          type: 'paragraph',
          text: 'We use a small number of infrastructure providers, each under a written agreement that limits what it may do with our data:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Supabase:',
              text: 'Provides authentication and stores your account profile, notification settings, and sign-in device history.',
            },
            {
              lead: 'Turso:',
              text: 'Our database for portfolio setup, Lab workspaces and projects, API key records, and portfolio trade records.',
            },
            {
              lead: 'Hosting providers (Vercel and Render):',
              text: 'Host the frontend and backend code. They process ordinary web traffic logs for operational stability and do not access or commercialize personal user data.',
            },
            {
              lead: 'Market data providers:',
              text: 'Supply the historical price and volume data used by the charts and backtests. These providers receive queries about instrument prices, not information about you.',
            },
            {
              lead: 'Email delivery:',
              text: 'Security alerts, such as a sign-in from a new device, are sent through Gmail SMTP to the address on your account.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'We may add or replace a provider as the platform changes. If we ever add a provider that processes personal information in a materially different way, we will update this policy before that change takes effect.',
        },
      ],
    },
    {
      step: '06',
      title: 'How long we keep information',
      blocks: [
        {
          type: 'paragraph',
          text: 'We keep information only for as long as it serves a stated purpose. In practice, that means:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Account data:',
              text: 'For as long as your account exists.',
            },
            {
              lead: 'Support correspondence:',
              text: 'Until the matter is resolved, and afterwards for a reasonable period so that we have a record of what was agreed.',
            },
            {
              lead: 'Sign-in device history:',
              text: 'We keep up to 10 of your most recently used devices, stored with your account settings, until you delete your account or newer devices replace them.',
            },
            {
              lead: 'Server logs:',
              text: 'Retained for the period set by our hosting providers for security and debugging, and then deleted automatically.',
            },
          ],
        },
      ],
    },
    {
      step: '07',
      title: 'Deletion and your rights',
      blocks: [
        {
          type: 'paragraph',
          text: 'You maintain full ownership of your account data, and you can exercise the following rights at any time:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Access and correction:',
              text: 'You can review and update the information held on your account from within the platform, and you can ask us for a copy of it in writing.',
            },
            {
              lead: 'Account deletion:',
              text: 'Deleting your account from Settings permanently removes your profile, portfolio setup, portfolio trade records, Lab workspaces, projects and files, API keys, and sign-in credentials.',
            },
            {
              lead: 'No residual storage:',
              text: 'We do not keep archived backups or shadow profiles of accounts that have been deleted.',
            },
            {
              lead: 'Withdrawal of consent:',
              text: 'You may withdraw consent to any processing that relies on it. Where the service cannot operate without that processing, the consequence is that the relevant feature or the account itself stops working.',
            },
            {
              lead: 'Complaints:',
              text: 'If you are unsatisfied with how we have handled your information, you may contact us at the address below. Because SLTP operates under Canadian law, you also have the right to raise a complaint with the Office of the Privacy Commissioner of Canada.',
            },
          ],
        },
      ],
    },
    {
      step: '08',
      title: 'Security measures',
      blocks: [
        {
          type: 'paragraph',
          text: 'We apply administrative, technical, and physical safeguards appropriate to the sensitivity of the data, including encrypted transport (HTTPS and TLS), database row-level security policies that scope access to the account that owns each record, restricted administrative access, and regular review of who holds it. No system is perfectly secure, and we do not claim otherwise, but a breach of our systems that affects your personal information will be disclosed to you and to the relevant regulator without undue delay and in accordance with applicable law.',
        },
      ],
    },
    {
      step: '09',
      title: 'Age restrictions and children',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is intended for users who are at least 13 years of age. We do not knowingly collect personal information from children under 13. Because quantitative strategies carry real financial risk, users aged 13 to 17 may use the research and analysis features of the platform but may not apply any strategy to live financial trading or investment execution. If you believe a child under 13 has provided us with personal information, contact us and we will delete it.',
        },
      ],
    },
    {
      step: '10',
      title: 'International transfers',
      blocks: [
        {
          type: 'paragraph',
          text: 'Our providers operate data centres in more than one country, so information you submit may be processed outside Canada. Where that happens, the transfer is covered by the provider\u2019s contractual terms and, where required, additional safeguards under applicable law. We have not knowingly structured our operations to avoid privacy protections in any jurisdiction in which we operate.',
        },
      ],
    },
    {
      step: '11',
      title: 'Third-party links',
      blocks: [
        {
          type: 'paragraph',
          text: 'The platform may link to sites we do not control. We are not responsible for their content, their privacy practices, or the way they handle data once you leave SLTP. A link is provided for convenience and does not imply endorsement.',
        },
      ],
    },
    {
      step: '12',
      title: 'Changes to this policy',
      blocks: [
        {
          type: 'paragraph',
          text: 'We may revise this Privacy Policy as the platform changes or as legal requirements shift. The date at the top of this page shows when it was last updated, and the revised version is published at the same address. Continued use of the platform after a revision indicates your acceptance of it. If a change materially affects how we use information you have already given us, we will tell you before it takes effect.',
        },
      ],
    },
    {
      step: '13',
      title: 'Cookies and browser storage',
      blocks: [
        {
          type: 'paragraph',
          text: 'We do not use tracking cookies or advertising pixels. The platform keeps your sign-in session in your browser. It also caches your learning progress in local storage so pages load faster, and keeps your display name and theme preference in session storage for the current visit. You can clear this data at any time through the site settings of your browser.',
        },
      ],
    },
    {
      step: '14',
      title: 'Contact information',
      blocks: [
        {
          type: 'paragraph',
          text: (
            <>
              For privacy inquiries, data requests, or removal verification, please contact us at{' '}
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

const termsDocument: LegalDocument = {
  title: 'Terms of Service',
  meta: 'Last Updated: October 24, 2026',
  intro: 'Please read these Terms of Service carefully before accessing or using SLTP. By using the platform, you agree to be bound by them. If you do not agree, please do not use the platform.',
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
              lead: 'License grant:',
              text: 'By submitting content to SLTP, you grant us a non-exclusive, worldwide, royalty-free licence to host, display, and manage that content for the purpose of operating the platform.',
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
          text: 'You agree not to use SLTP in a way that is unlawful, that interferes with the service for other users, or that attempts to extract more from it than your subscription is intended to provide:',
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
          text: 'SLTP retains all right, title, and interest in and to the platform, including its design, algorithms, code structures, strategy logic, branding, written content, and data compilations, under Canadian and international intellectual property laws. We grant you a limited, revocable, non-exclusive, non-transferable licence to access the platform for your own research and personal use. We grant no right to resell the platform, or to use its content to build a competing product, except where we agree otherwise in writing.',
        },
      ],
    },
    {
      step: '08',
      title: 'Third-party services and links',
      blocks: [
        {
          type: 'paragraph',
          text: 'The platform may reference or link to third-party sites, data sources, and services. We do not control them and are not responsible for their content, availability, or practices. Any agreement you enter into with a third party is between you and them, and we are not a party to it. Your use of a linked service is at your own risk.',
        },
      ],
    },
    {
      step: '09',
      title: 'Disclaimers and no warranty',
      blocks: [
        {
          type: 'paragraph',
          text: 'The platform and everything on it are provided on an "as is" and "as available" basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including any implied warranty of merchantability, fitness for a particular purpose, title, non-infringement, and accuracy of the content. We do not warrant that the platform will be uninterrupted, that any result will be accurate, or that the service will meet your requirements. You accept full responsibility for any decision you make based on the platform.',
        },
      ],
    },
    {
      step: '10',
      title: 'Limitation of liability',
      blocks: [
        {
          type: 'paragraph',
          text: 'To the maximum extent permitted by applicable law, SLTP, its founders, employees, and affiliates are not liable for any direct, indirect, incidental, special, consequential, or punitive damages arising out of or connected to your use of the platform, including any reliance on its models, metrics, or signals, or any loss of profits, data, or opportunity. Nothing in these Terms excludes liability that cannot be excluded by law, including in respect of fraud, fraudulent misrepresentation, or death or personal injury caused by negligence.',
        },
      ],
    },
    {
      step: '11',
      title: 'Indemnity',
      blocks: [
        {
          type: 'paragraph',
          text: 'You agree to defend, indemnify, and hold harmless SLTP, its founders, employees, and affiliates from and against any claim, demand, loss, liability, or expense, including reasonable legal fees, arising out of your use of the platform, your breach of these Terms, your violation of law, or your infringement of the rights of a third party.',
        },
      ],
    },
    {
      step: '12',
      title: 'Free service model',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is provided to users free of charge. No subscription fees, purchases, or monetary transactions are processed through the platform, and we do not take custody of, hold, or have any authority over any funds or assets. If we ever introduce a paid tier, the terms of that tier will be presented to you and accepted separately before you are charged.',
        },
      ],
    },
    {
      step: '13',
      title: 'Modifications, suspension, and termination',
      blocks: [
        {
          type: 'paragraph',
          text: 'We reserve the right to modify these Terms, or to modify, suspend, or discontinue any part of the platform, at any time and without notice. Continued use of SLTP after a change indicates your acceptance of the revised Terms. We may also suspend or terminate your access immediately, without notice, if you breach these Terms, if you use the platform in a way that endangers it or its users, or if we are required to do so by law. On termination, your right to use the platform ends, and your data is handled as described in our Privacy Policy.',
        },
      ],
    },
    {
      step: '14',
      title: 'General provisions',
      blocks: [
        {
          type: 'paragraph',
          text: 'These Terms are the entire agreement between you and SLTP on the subject matter of the platform, and they supersede any earlier agreement, proposal, or representation, whether written or oral. If a provision is held unenforceable, the remaining provisions stay in force. Our failure to enforce a provision is not a waiver of it. Neither these Terms nor your use of the platform create a partnership, agency, or employment relationship. You may not assign your rights under these Terms without our written consent.',
        },
        {
          type: 'paragraph',
          text: 'Notices under these Terms may be delivered to the email address on your account, or to the address in section 15 for our side. Electronic delivery is effective on transmission, and email notices are deemed received on the first business day after sending.',
        },
      ],
    },
    {
      step: '15',
      title: 'Account deletion',
      blocks: [
        {
          type: 'paragraph',
          text: 'You can delete your account from Settings at any time. Deletion is permanent and cannot be undone. It removes your profile, your portfolio setup and trade records, your Lab work, your API keys, and your sign-in credentials. If we terminate your account, the same rules apply.',
        },
      ],
    },
    {
      step: '16',
      title: 'Portfolio records and Lab work',
      blocks: [
        {
          type: 'paragraph',
          text: 'Portfolio trade records and Lab projects are tools for recording and testing your own decisions. They do not connect to a brokerage, do not place orders, and do not reflect real holdings held by SLTP. Figures such as cash, realised gain or loss, and average cost are calculated from the entries you make, and may be wrong if those entries are wrong.',
        },
      ],
    },
    {
      step: '17',
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
      <div className="st-legal-container">
        <Button variant="link" size="sm" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to SLTP
        </Button>

        <header className="st-legal-header">
          <span className="st-legal-eyebrow">Legal</span>
          <h1 className="st-legal-title">{doc.title}</h1>
          <p className="st-legal-meta">{doc.meta}</p>
          <p className="st-legal-intro">{doc.intro}</p>
        </header>

        <div className="st-legal-body">
          {doc.sections.map((section) => (
            <section key={section.step} className="st-legal-section">
              <div className="st-legal-section-heading">
                <span className="st-legal-step">{section.step}</span>
                <h2>{section.title}</h2>
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
                          {item.lead && <strong className="st-legal-list-lead">{item.lead}</strong>}
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
      </div>
    </div>
  );
}
