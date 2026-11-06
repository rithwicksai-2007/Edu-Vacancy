import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export type RegistrationLegalDocument = "terms" | "privacy";

const termsSections = [
  {
    title: "Using EduVacancy",
    paragraphs: [
      "EduVacancy helps jobseekers discover education-sector opportunities and helps institutions connect with candidates. You must be legally able to create an account and use the service in accordance with applicable laws.",
      "Keep your login credentials private and tell us promptly if you believe someone else has accessed your account. You are responsible for activity carried out through your account.",
    ],
  },
  {
    title: "Accurate profile information",
    paragraphs: [
      "Provide truthful, current information about your identity, contact details, qualifications, experience, and uploaded materials. Keep your profile and application information up to date.",
      "Do not impersonate another person, submit materials you do not have permission to use, or misrepresent your qualifications. EduVacancy may review accounts and institution or vacancy information, but a verification status is not a guarantee of any person's credentials or a job's outcome.",
    ],
  },
  {
    title: "Applications and hiring",
    paragraphs: [
      "You decide whether to apply for an opportunity and what information to include in an application. Institutions are responsible for their job listings and their hiring decisions. EduVacancy does not promise interviews, employment, or the accuracy of information provided by other users.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Do not use the service to harass, defraud, threaten, or discriminate against others; distribute unlawful or misleading content; access accounts or data without permission; interfere with the service; or circumvent its security controls.",
    ],
  },
  {
    title: "Service changes and account restrictions",
    paragraphs: [
      "We may update or discontinue features and may restrict or suspend accounts when necessary to protect users, enforce these terms, or meet legal obligations. Where appropriate, we will provide notice through the service.",
    ],
  },
  {
    title: "Changes to these terms",
    paragraphs: [
      "We may revise these terms as the service changes. Updated terms will be posted on this page. Continuing to use EduVacancy after an update means you accept the revised terms.",
    ],
  },
];

const privacySections = [
  {
    title: "Information you provide",
    paragraphs: [
      "When you register or use your account, EduVacancy processes details such as your name, username, phone number, security-question response (stored as a hash), profile or institution information, and information you provide in job applications or institution listings.",
      "If you upload a jobseeker profile photo, it is saved in your browser's local storage and may not be available on another device. Resumes and institution photos may be uploaded to the service's file storage.",
    ],
  },
  {
    title: "How information is used",
    paragraphs: [
      "Information is used to create and secure your account, maintain your profile or institution listing, support job applications and recruitment, show relevant details to other users, provide service features, and protect the platform from misuse.",
    ],
  },
  {
    title: "Who can see your information",
    paragraphs: [
      "Information you share through your profile, institution listing, or job application may be visible to other users who use relevant recruitment features. Information may also be processed by service providers that support account authentication, hosting, database, and file-storage functions.",
      "We do not make your account password or security-answer hash visible in your public profile.",
    ],
  },
  {
    title: "Storage and security",
    paragraphs: [
      "Account and profile information is stored by the services used to operate EduVacancy. We use reasonable safeguards, but no online service or method of storage can be guaranteed completely secure.",
      "Your profile photo is stored in this browser's local storage. Clearing browser data or using another device may remove or make that photo unavailable. You can remove or replace it through the service where that option is provided.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: [
      "You can choose what information to include in your profile and whether to upload a resume. Do not include sensitive information that is not needed for your job search. You can update profile details through the available account features.",
    ],
  },
  {
    title: "Changes to this policy",
    paragraphs: [
      "We may update this policy as EduVacancy changes. The current version will be posted on this page.",
    ],
  },
];

export function RegistrationLegalDialog({
  document,
  accountType = "jobseeker",
  onClose,
}: {
  document: RegistrationLegalDocument;
  accountType?: "jobseeker" | "institution";
  onClose: () => void;
}) {
  const isPrivacyPage = document === "privacy";
  const title = isPrivacyPage ? "Privacy Policy" : "Terms of Service";
  const sections = isPrivacyPage ? privacySections : termsSections;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-legal-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6 text-[#1C2333] shadow-xl sm:p-9"
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-[#E7EAF3] pb-5">
          <div>
            <h2
              id="registration-legal-title"
              className="text-2xl font-bold text-[#1B2A5B]"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              Please review this information before creating your EduVacancy
              {accountType === "institution"
                ? " institution account."
                : " jobseeker account."}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close legal information"
            className="shrink-0 rounded-lg border border-[#E7EAF3] px-3 py-2 text-sm font-semibold text-[#1B2A5B] hover:bg-gray-50"
          >
            Close
          </button>
        </header>

        <div className="space-y-6 overflow-y-auto pr-2">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-2 text-lg font-bold text-[#1B2A5B]">
                {section.title}
              </h3>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-2 text-sm leading-7 text-[#4B5563]"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-5 border-t border-[#E7EAF3] pt-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1B2A5B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#14204A]"
          >
            Back to registration
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function RegistrationLegalPage() {
  const { pathname } = useLocation();
  const isPrivacyPage = pathname === "/privacy";
  const title = isPrivacyPage ? "Privacy Policy" : "Terms of Service";
  const sections = isPrivacyPage ? privacySections : termsSections;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E9F1FE,#F4F6FB_55%)] px-4 py-10 text-[#1C2333] sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <header className="mb-8 border-b border-[#E7EAF3] pb-6">
          <Link
            to="/job-registration"
            className="text-sm font-semibold text-[#2C5CF6] hover:underline"
          >
            ← Back to jobseeker registration
          </Link>
          <h1 className="mt-5 text-3xl font-bold text-[#1B2A5B]">{title}</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Please read this information before creating your EduVacancy
            jobseeker account.
          </p>
        </header>

        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 text-lg font-bold text-[#1B2A5B]">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-2 text-sm leading-7 text-[#4B5563]"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-9 flex flex-wrap gap-4 border-t border-[#E7EAF3] pt-5 text-sm">
          <Link
            to={isPrivacyPage ? "/terms" : "/privacy"}
            className="font-semibold text-[#2C5CF6] hover:underline"
          >
            Read the {isPrivacyPage ? "Terms of Service" : "Privacy Policy"}
          </Link>
          <Link
            to="/job-registration"
            className="font-semibold text-[#2C5CF6] hover:underline"
          >
            Return to registration
          </Link>
        </footer>
      </article>
    </main>
  );
}
