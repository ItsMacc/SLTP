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

const legalEmail = 'stocker.legal@gmail.com';

const privacyDocument: LegalDocument = {
  title: 'Privacy Policy',
  meta: 'Last Updated: August 17, 2026',
  intro: 'This document outlines the data privacy practices of Stocker.',
  sections: [
    {
      step: '01',
      title: 'Introduction',
      blocks: [
        {
          type: 'paragraph',
          text: 'Stocker is operated independently. Respecting user privacy is a priority. This Privacy Policy explains what limited information is processed when accessing or using Stocker ("the Service").',
        },
      ],
    },
    {
      step: '02',
      title: 'Information Processing',
      blocks: [
        {
          type: 'paragraph',
          text: 'Stocker is designed to minimize data collection:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'Information You Provide:',
              text: 'If you contact support or submit inquiries, the email address and message details provided will be used solely to respond to you.',
            },
            {
              lead: 'Account Information:',
              text: 'If an account is created, necessary authentication details (such as email address and password credentials) are processed to secure your login.',
            },
          ],
        },
      ],
    },
    {
      step: '03',
      title: 'What Is NOT Collected or Tracked',
      blocks: [
        {
          type: 'paragraph',
          text: 'To provide full transparency, Stocker explicitly does not do any of the following:',
        },
        {
          type: 'list',
          items: [
            {
              lead: 'No Tracking Cookies:',
              text: 'Stocker does not use tracking, advertising, or third-party cookies.',
            },
            {
              lead: 'No Analytics or Behavioral Tracking:',
              text: 'Stocker does not log individual page visits, track browsing activity, or build behavioral profiles.',
            },
            {
              lead: 'No Data Sales:',
              text: 'Personal data is never sold, rented, or commercialized.',
            },
          ],
        },
      ],
    },
    {
      step: '04',
      title: 'Data Security',
      blocks: [
        {
          type: 'paragraph',
          text: 'Standard administrative and technical measures are maintained to protect account credentials and support communications. However, no internet-based transmission or storage system can be guaranteed to be completely secure.',
        },
      ],
    },
    {
      step: '05',
      title: 'Third-Party Services',
      blocks: [
        {
          type: 'paragraph',
          text: 'If the Service links to external websites or third-party resources, this Privacy Policy does not apply to those outside services. Reviewing their respective privacy policies is recommended.',
        },
      ],
    },
    {
      step: '06',
      title: 'Changes to This Policy',
      blocks: [
        {
          type: 'paragraph',
          text: 'This Privacy Policy may be updated periodically to reflect service adjustments. The revision date at the top of this page indicates when the latest changes took effect.',
        },
      ],
    },
    {
      step: '07',
      title: 'Contact',
      blocks: [
        {
          type: 'paragraph',
          text: (
            <>
              For questions or privacy inquiries regarding Stocker, send an email to{' '}
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
  meta: 'Last Updated: August 17, 2026',
  intro: 'This document is a legal agreement between you and Stocker. Please read it carefully.',
  sections: [
    {
      step: '01',
      title: 'Acceptance of Terms',
      blocks: [
        {
          type: 'paragraph',
          text: 'By accessing or using the Stocker website, platform, and associated services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not access or use the Service.',
        },
      ],
    },
    {
      step: '02',
      title: 'Educational and Informational Purpose Only',
      blocks: [
        {
          type: 'paragraph',
          text: 'Stocker is an educational and analytical research platform. Stocker is not a registered investment advisor, broker-dealer, financial planner, or tax professional.',
        },
        {
          type: 'paragraph',
          text: 'All tools, data, metrics, strategies, and content provided through the Service are for informational and educational purposes only.',
        },
        {
          type: 'list',
          items: [
            {
              text: 'No content on Stocker should be construed as personalized financial, investment, legal, or tax advice.',
            },
            {
              text: 'You are solely responsible for conducting your own independent research and due diligence before making any investment or financial decisions.',
            },
          ],
        },
      ],
    },
    {
      step: '03',
      title: 'Investment Risk Acknowledgment',
      blocks: [
        {
          type: 'paragraph',
          text: 'Investing in financial markets, including stocks, options, cryptocurrencies, and other assets, carries inherent risk. Past performance, historical returns, or strategy backtests displayed on Stocker do not guarantee future performance or financial success. You acknowledge that you may lose some or all of your invested capital.',
        },
      ],
    },
    {
      step: '04',
      title: 'Intellectual Property Rights',
      blocks: [
        {
          type: 'paragraph',
          text: 'All content, branding, trademarks, graphics, code, algorithms, and data presented on Stocker are the property of Stocker and protected by applicable intellectual property laws. You agree not to copy, reproduce, scrape, modify, distribute, or reverse-engineer any portion of the Service without prior written authorization from Stocker.',
        },
      ],
    },
    {
      step: '05',
      title: 'User Conduct and Account Security',
      blocks: [
        {
          type: 'paragraph',
          text: 'If you create an account on Stocker, you are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. You agree not to use the Service for unlawful purposes or attempt to interfere with platform operations or security.',
        },
      ],
    },
    {
      step: '06',
      title: 'Limitation of Liability',
      blocks: [
        {
          type: 'paragraph',
          text: 'To the maximum extent permitted by applicable law, Stocker, its founders, employees, partners, and affiliates shall not be liable for any direct, indirect, incidental, consequential, or punitive damages resulting from your access to, or inability to access, the Service, or any action taken based on content provided on the Service.',
        },
      ],
    },
    {
      step: '07',
      title: 'Modifications to Terms',
      blocks: [
        {
          type: 'paragraph',
          text: 'Stocker reserves the right to update or modify these Terms at any time. Continued use of the Service following any changes constitutes acceptance of the new Terms.',
        },
      ],
    },
    {
      step: '08',
      title: 'Governing Law',
      blocks: [
        {
          type: 'paragraph',
          text: 'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction where Stocker operates, without regard to conflicts of law principles. Any disputes arising out of or relating to these Terms shall be resolved in the appropriate courts of that jurisdiction.',
        },
      ],
    },
    {
      step: '09',
      title: 'Contact',
      blocks: [
        {
          type: 'paragraph',
          text: (
            <>
              If you have questions about these Terms, please contact us at{' '}
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
          <span aria-hidden="true">←</span> Back to Stocker
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