// LegalPage.tsx — Privacy Policy and Terms of Service
import type { ReactNode } from 'react';
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
  meta: 'Last Updated: September 18, 2026',
  intro: 'This Privacy Policy governs the data collection, storage, and processing practices of SLTP ("we," "our," or "us").',
  sections: [
    {
      step: '01',
      title: 'Introduction & Scope',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is an independent quantitative research platform. We respect your right to privacy and are committed to minimizing data collection to the absolute operational necessities required to deliver our services.',
        },
      ],
    },
    {
      step: '02',
      title: 'Information We Collect',
      blocks: [
        {
          type: 'paragraph',
          text: 'To provide personalized user features, we process limited categories of information:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Account Credentials:',
              text: 'If you register an account, we store authentication details (such as your email address and encrypted password credentials) via Supabase to secure your session.',
            },
            {
              lead: 'User Preferences & Portfolios:',
              text: 'We save your custom settings, watchlists, saved parameters, and portfolio configurations to ensure platform continuity across your visits.',
            },
            {
              lead: 'Support Communications:',
              text: 'If you contact us via email, we retain your message details and email address solely to address your inquiries.',
            },
          ],
        },
      ],
    },
    {
      step: '03',
      title: 'Data Retention and Immediate Deletion',
      blocks: [
        {
          type: 'paragraph',
          text: 'We believe in data minimization. You maintain full ownership and control over your account data:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Instant Removal:',
              text: 'At the exact moment you request account deletion through your dashboard or settings, all associated records, watchlists, portfolios, and authentication identifiers are entirely and permanently purged from our Supabase database.',
            },
            {
              lead: 'No Residual Storage:',
              text: 'We do not retain archived backups or lingering shadow profiles once an account or record is deleted.',
            },
          ],
        },
      ],
    },
    {
      step: '04',
      title: 'Infrastructure and Third-Party Data Processors',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP utilizes industry-standard cloud infrastructure partners to maintain high availability and security:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Supabase:',
              text: 'Acts as our secure database and authentication provider, processing user credentials and saved preferences securely.',
            },
            {
              lead: 'Hosting Providers (Vercel / Render):',
              text: 'Deliver frontend and backend code execution environments. While these providers process standard web traffic logs for operational stability, they do not access or commercialize personal user data pools.',
            },
          ],
        },
      ],
    },
    {
      step: '05',
      title: 'Age Restrictions (13+ Policy)',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is intended for users who are at least 13 years of age. Because quantitative strategies carry real financial risk, users under the age of 18 may use the research and analysis features of the platform, but may not apply any strategy to live financial trading or investment execution.',
        },
      ],
    },
    {
      step: '06',
      title: 'What We Do NOT Collect or Track',
      blocks: [
        {
          type: 'paragraph',
          text: 'To ensure complete transparency, SLTP explicitly enforces the following data boundaries:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'No Tracking Cookies:',
              text: 'We do not deploy intrusive tracking cookies, advertising pixels, or third-party marketing identifiers.',
            },
            {
              lead: 'No Behavioral Profiling:',
              text: 'We do not log individual browsing paths, build commercial user profiles, or sell data to brokers or advertisers.',
            },
          ],
        },
      ],
    },
    {
      step: '07',
      title: 'Data Security Measures',
      blocks: [
        {
          type: 'paragraph',
          text: 'We implement robust administrative, technical, and physical safeguards, including encrypted transport protocols (HTTPS/SSL) and database row-level security, to protect your information against unauthorized access or disclosure.',
        },
      ],
    },
    {
      step: '08',
      title: 'Changes to This Privacy Policy',
      blocks: [
        {
          type: 'paragraph',
          text: 'We may update this Privacy Policy from time to time. Continued use of the platform after modifications indicates your acknowledgment of the revised terms.',
        },
      ],
    },
    {
      step: '09',
      title: 'Contact Information',
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
  meta: 'Last Updated: September 18, 2026',
  intro: 'Please read these Terms of Service carefully before accessing or using SLTP. By using the platform, you agree to be bound by these terms.',
  sections: [
    {
      step: '01',
      title: 'Acceptance of Terms & Governing Law',
      blocks: [
        {
          type: 'paragraph',
          text: 'This agreement constitutes a binding legal contract between you and SLTP. These Terms shall be governed by, construed, and enforced in accordance with the laws of Canada and the provincial jurisdiction in which SLTP operates, without regard to conflict of law principles.',
        },
      ],
    },
    {
      step: '02',
      title: 'Our Role and What We Do Not Provide',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is a quantitative research and analysis platform. We are not a registered investment advisor, broker-dealer, financial planner or tax professional, and we do not manage money or hold client accounts on your behalf.',
        },
        {
          type: 'paragraph',
          text: 'Everything on the platform is designed to help you research markets and understand strategies more clearly. Our models, metrics and signals are a starting point for your own analysis rather than personalized financial, investment, legal or tax advice. What you do with them, and the due diligence behind it, stays your decision.',
        },
      ],
    },
    {
      step: '03',
      title: 'Age Eligibility & Trading Restrictions',
      blocks: [
        {
          type: 'paragraph',
          text: 'You must be at least 13 years of age to access and use the basic informational features of SLTP. However, to execute strategies, utilize live market signals, or make real financial investments, you must be at least 18 years of age (or the legal age of majority in your jurisdiction). You represent that you meet these eligibility requirements.',
        },
      ],
    },
    {
      step: '04',
      title: 'Backtested and Hypothetical Performance',
      blocks: [
        {
          type: 'paragraph',
          text: 'Investing carries risk, including the possibility of losing the capital you commit. We want that to be clear before you use any of our models. You acknowledge and agree that:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Backtested Results:',
              text: 'Every strategy, metric and model on SLTP can be tested across historical data up to the current date. Backtested figures are hypothetical: they are produced with hindsight over past data and do not represent trades that were actually placed.',
            },
            {
              lead: 'Live Results:',
              text: 'Signals and live tracking apply the same documented rules to current market data. They are not predictions, and they carry no guarantee of profit.',
            },
            {
              lead: 'Capital Risk:',
              text: 'Past performance does not predict future results, and you can lose some or all of the capital you invest. Treat a signal as a starting point for your own research, sized so that being wrong is survivable.',
            },
          ],
        },
      ],
    },
    {
      step: '05',
      title: 'Intellectual Property & Anti-Scraping Provisions',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP retains all ownership rights, title, and intellectual property interests in and to its platform design, algorithms, code structures, strategy logic, branding, and data compilations under Canadian and international intellectual property laws.',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Prohibition of Scraping:',
              text: 'Automated data harvesting, web scraping, spidering, or mass extraction of content or strategy logic from SLTP is strictly prohibited.',
            },
            {
              lead: 'No Reverse Engineering:',
              text: 'You agree not to decompile, reverse-engineer, copy, or attempt to derive the source code or proprietary mathematical structures of our quantitative models.',
            },
            {
              lead: 'Official API Usage:',
              text: 'Access to data via official programmatic interfaces or APIs is governed by dedicated developer agreements and requires explicit authorization.',
            },
          ],
        },
      ],
    },
    {
      step: '06',
      title: 'User Accounts & Future User-Generated Content (UGC)',
      blocks: [
        {
          type: 'paragraph',
          text: 'You are responsible for maintaining the security of your account credentials. Furthermore, where the platform permits future user-generated content (such as custom strategy inputs, reviews, or comments):',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'User Responsibility:',
              text: 'You retain responsibility for any content you publish or upload, ensuring it violates no third-party rights or laws.',
            },
            {
              lead: 'License Grant:',
              text: 'By submitting content to SLTP, you grant us a non-exclusive license to host, display, and manage that content within the scope of platform operations.',
            },
          ],
        },
      ],
    },
    {
      step: '07',
      title: 'Free Service Model & No Monetary Liability',
      blocks: [
        {
          type: 'paragraph',
          text: 'SLTP is provided to users entirely free of charge. No subscription fees, purchases, or monetary transactions are processed through the platform. Accordingly, to the maximum extent permitted by applicable law, SLTP, its founders, and affiliates shall bear zero financial or legal liability for any direct, indirect, incidental, or consequential damages arising from your use of the platform or reliance on its signals.',
        },
      ],
    },
    {
      step: '08',
      title: 'Modifications and Termination',
      blocks: [
        {
          type: 'paragraph',
          text: 'We reserve the right to modify, suspend, or terminate the platform or these Terms at any time without notice. Continued use of SLTP following updates constitutes your binding acceptance of the revised terms.',
        },
      ],
    },
    {
      step: '09',
      title: 'Contact Information',
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
        <button type="button" className="st-legal-back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to SLTP
        </button>

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