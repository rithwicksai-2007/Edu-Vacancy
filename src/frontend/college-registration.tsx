
import React, {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { getSupabaseClient, usernameAuthEmail } from "../lib/supabase-config";
import { apiPublicRequest } from "../lib/api-config";
import { getAuthErrorMessage } from "../lib/auth-error";

type InstitutionType =
  | "School"
  | "College"
  | "University"
  | "Coaching Institute";

type FormData = {
  username: string;
  password: string;
  confirmPassword: string;
  secQuestion: string;
  secAnswer: string;
  instName: string;
  instType: InstitutionType | "";
  regNumber: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  website: string;
  contactName: string;
  contactDesignation: string;
  contactPhone: string;
};

const initialForm: FormData = {
  username: "",
  password: "",
  confirmPassword: "",
  secQuestion: "",
  secAnswer: "",
  instName: "",
  instType: "",
  regNumber: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  website: "",
  contactName: "",
  contactDesignation: "",
  contactPhone: "",
};

const questions = [
  "Year the institution was established?",
  "Name of the founding principal/director?",
  "City of your institution's head office?",
];

const inputClass =
  "w-full rounded-lg border border-[#E7EAF3] bg-white px-3 py-3 text-sm text-[#1C2333] outline-none transition placeholder:text-gray-400 focus:border-[#2C5CF6] focus:ring-2 focus:ring-blue-100";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[#1C2333]";

const buttonPrimary =
  "flex-1 rounded-lg bg-[#1B2A5B] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#14204A] disabled:cursor-not-allowed disabled:opacity-50";

const buttonOutline =
  "flex-1 rounded-lg border border-[#E7EAF3] bg-white px-4 py-3 text-sm font-bold text-[#1B2A5B] transition hover:bg-gray-50";

export default function CollegeRegistration() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "error"
  );
  const [loading, setLoading] = useState(false);
  const certificateInputRef = useRef<HTMLInputElement>(null);

  const updateField = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((previous) => ({ ...previous, [name]: value }));

    if (name === "confirmPassword" || name === "password") {
      setPasswordError("");
    }
  };

  const passwordScore = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password) && /[a-z]/.test(form.password),
    /[0-9]/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ].filter(Boolean).length;

  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-gray-200",
    "bg-red-500",
    "bg-amber-500",
    "bg-blue-500",
    "bg-green-500",
  ];

  const setError = (text: string) => {
    setMessageType("error");
    setMessage(text);
  };

  const validateStep1 = () => {
    if (!/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/i.test(form.username.trim())) {
      setError("Username must be 3–30 characters and use letters, numbers, dots, underscores, or hyphens.");
      return false;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return false;
    }

    if (form.password !== form.confirmPassword) {
      setPasswordError("Passwords don't match.");
      setError("Please make sure both passwords match.");
      return false;
    }

    if (!form.secQuestion || !form.secAnswer.trim()) {
      setError("Please select a security question and enter its answer.");
      return false;
    }

    setMessage("");
    setPasswordError("");
    return true;
  };

  const validateStep2 = () => {
    const requiredFields: (keyof FormData)[] = [
      "instName",
      "instType",
      "regNumber",
      "address",
      "city",
      "state",
      "pincode",
    ];

    for (const key of requiredFields) {
      if (!String(form[key]).trim()) {
        setError("Please complete all required institution details.");
        return false;
      }
    }

    if (!/^\d{6}$/.test(form.pincode)) {
      setError("Please enter a valid 6-digit PIN code.");
      return false;
    }

    if (
      form.website &&
      !/^https?:\/\/.+\..+/.test(form.website.trim())
    ) {
      setError("Enter a valid website URL starting with https:// or http://.");
      return false;
    }

    setMessage("");
    return true;
  };

  const validateStep3 = () => {
    if (
      !form.contactName.trim() ||
      !form.contactDesignation.trim() ||
      !form.contactPhone.trim()
    ) {
      setError("Please complete the contact person's details.");
      return false;
    }

    if (certificate) {
      const validExtension = /\.(pdf|jpe?g|png)$/i.test(certificate.name);
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

      if (
        !validExtension ||
        (certificate.type !== "" && !allowedTypes.includes(certificate.type))
      ) {
        setError("Upload a PDF, JPG, or PNG certificate.");
        return false;
      }

      if (certificate.size > 5 * 1024 * 1024) {
        setError("Certificate size must not exceed 5 MB.");
        return false;
      }
    }

    setMessage("");
    return true;
  };

  // Hash the security answer before saving it.
  const hashAnswer = async (answer: string) => {
    const normalized = answer.trim().toLowerCase();
    const encoded = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", encoded);

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCertificate = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      setCertificate(null);
      return;
    }

    const validExtension = /\.(pdf|jpe?g|png)$/i.test(file.name);
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

    if (
      !validExtension ||
      (file.type !== "" && !allowedTypes.includes(file.type))
    ) {
      setError("Upload a PDF, JPG, or PNG certificate.");
      e.target.value = "";
      setCertificate(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Certificate size must not exceed 5 MB.");
      e.target.value = "";
      setCertificate(null);
      return;
    }

    setCertificate(file);
    setMessage("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateStep3()) return;

    const terms = document.getElementById(
      "institution-terms"
    ) as HTMLInputElement | null;

    if (!terms?.checked) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);
    setMessage("");

    let createdUserId: string | null = null;

    try {
      const answerHash = await hashAnswer(form.secAnswer);
      const username = form.username.trim().toLowerCase();
      const account = await apiPublicRequest<{ id: string }>(
        "/api/v1/auth/register/institution",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password: form.password,
            full_name: form.instName.trim(),
            phone: form.contactPhone.trim(),
            security_question: form.secQuestion,
            security_answer_hash: answerHash,
            institution_name: form.instName.trim(),
            institution_type: form.instType,
            address: form.address.trim(),
            contact_person: form.contactName.trim(),
            contact_designation: form.contactDesignation.trim(),
            registration_number: form.regNumber.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pincode: form.pincode.trim(),
            website: form.website.trim() || null,
          }),
        },
      );
      createdUserId = account.id;

      const { data, error: signInError } =
        await getSupabaseClient().auth.signInWithPassword({
          email: usernameAuthEmail(username),
          password: form.password,
        });
      if (signInError) throw signInError;
      if (!data.session) {
        throw new Error("The account was created, but a login session was not returned. Sign in with your username and password.");
      }
      const userId = account.id;

      let certificateUploadWarning = false;
      if (certificate) {
        const safeFileName = certificate.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const path = `${userId}/${crypto.randomUUID()}-${safeFileName}`;

        const { error: uploadError } = await getSupabaseClient().storage
          .from("certificates")
          .upload(path, certificate, {
            contentType: certificate.type,
            upsert: false,
          });

        if (uploadError) {
          certificateUploadWarning = true;
        } else {
          const { error: certificateError } = await getSupabaseClient()
            .from("institution_certificates")
            .insert({
              institution_id: userId,
              file_url: path,
              cert_type: "registration_certificate",
            });

          if (certificateError) {
            await getSupabaseClient().storage.from("certificates").remove([path]);
            certificateUploadWarning = true;
          }
        }
      }

      setMessageType("success");
      setMessage(
        certificateUploadWarning
          ? "Registration submitted successfully. Log in with your username to upload your certificate. Your institution will be reviewed before verification."
          : "Registration submitted successfully. You can now log in with your username. Your institution will be reviewed before verification."
      );

      setForm(initialForm);
      setCertificate(null);
      setCurrentStep(1);
      setShowPassword(false);
      if (certificateInputRef.current) {
        certificateInputRef.current.value = "";
      }
    } catch (error: unknown) {
      const errorMessage = getAuthErrorMessage(error);

      if (createdUserId) {
        setMessageType("error");
        setMessage(
          `Your account was created, but registration could not finish: ${errorMessage} You can sign in with your username and password; do not register the same username again.`
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,#E9F1FE,#F4F6FB_55%)] font-['Inter',sans-serif] text-left text-[#1C2333] lg:flex-row">
      {/* Left brand panel */}
      <aside className="hidden w-[42%] flex-col justify-between bg-gradient-to-br from-[#1B2A5B] to-[#14204A] p-9 text-white lg:flex xl:p-11">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">
            🎓
          </div>
          <div>
            <h2 className="!m-0 !text-lg !leading-normal !tracking-normal !text-white !font-['Poppins',sans-serif] !font-bold">
              EduVacancy
            </h2>
            <p className="text-xs text-white/70">School & College Jobs</p>
          </div>
        </div>

        <div className="my-12">
          <h1 className="!m-0 !text-3xl !leading-snug !tracking-normal !text-white max-w-md !font-['Poppins',sans-serif] !font-bold xl:!text-4xl">
            Get your school or college in front of qualified teachers.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
            Free to join. Post your first job in minutes once your
            institution is verified.
          </p>

          <div className="mt-8 space-y-5">
            {[
              ["📢", "Unlimited job postings on the free tier trial"],
              ["🗂️", "Track every applicant's status in one place"],
              ["🎖️", "Verified badge appears on all your listings"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-3 text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  {icon}
                </span>
                <p className="pt-2 text-white/90">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/50">
          © 2026 EduVacancy. Built for schools, colleges & universities.
        </p>
      </aside>

      {/* Registration panel */}
      <section className="flex min-h-screen flex-1 items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-[500px] rounded-2xl border border-[#E7EAF3] bg-white p-5 shadow-[0_12px_32px_rgba(20,32,74,0.08)] sm:p-8 xl:p-9">
          <div className="mb-7 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <span className="font-['Poppins',sans-serif] font-bold text-[#1B2A5B]">
                EduVacancy
              </span>
            </div>
          </div>

          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#2C5CF6]">
            Institution Portal
          </p>

          <h1 className="!m-0 !text-2xl !leading-tight !tracking-normal !text-[#1C2333] !font-['Poppins',sans-serif] !font-bold">
            Register your institution
          </h1>

          <p className="mb-7 mt-2 text-sm leading-6 text-gray-500">
            Takes about 3 minutes. Your account is reviewed before it goes live.
          </p>

          {/* Stepper */}
          <div className="mb-8 flex items-start">
            {(["Account", "Institution", "Verify"] as const).map(
              (label, index) => {
                const step = index + 1;
                const isDone = currentStep > step;
                const isActive = currentStep === step;

                return (
                  <React.Fragment key={label}>
                    <div className="flex w-[70px] shrink-0 flex-col items-center">
                      <div
                        className={`flex h-[27px] w-[27px] items-center justify-center rounded-full text-xs font-bold transition ${
                          isDone
                            ? "bg-green-600 text-white"
                            : isActive
                              ? "bg-[#1B2A5B] text-white"
                              : "bg-[#E7EAF3] text-gray-500"
                        }`}
                      >
                        {isDone ? "✓" : step}
                      </div>
                      <span
                        className={`mt-2 text-[10px] ${
                          isActive ? "font-bold text-[#1B2A5B]" : "text-gray-500"
                        }`}
                      >
                        {label}
                      </span>
                    </div>

                    {index < 2 && (
                      <div
                        className={`mt-3 h-0.5 flex-1 ${
                          currentStep > step ? "bg-green-600" : "bg-[#E7EAF3]"
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              }
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* STEP 1: Account */}
            {currentStep === 1 && (
              <div className="animate-[fadeIn_0.25s_ease]">
                <div className="mb-4">
                  <label className={labelClass} htmlFor="username">
                    Username
                  </label>
                  <input
                    className={inputClass}
                    type="text"
                    id="username"
                    name="username"
                    value={form.username}
                    onChange={updateField}
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Choose a username"
                  />
                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                    Use 3–30 letters, numbers, dots, underscores, or hyphens.
                  </p>
                </div>

                <div className="mb-4">
                  <label className={labelClass} htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-12`}
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={form.password}
                      onChange={updateField}
                      minLength={8}
                      autoComplete="new-password"
                      required
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-gray-500"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>

                  <div className="mt-2 flex gap-1">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`h-1 flex-1 rounded-full ${
                          index < passwordScore
                            ? strengthColors[passwordScore]
                            : "bg-[#E7EAF3]"
                        }`}
                      />
                    ))}
                  </div>
                  <p
                    className={`mt-1 text-[11px] ${
                      passwordScore >= 3
                        ? "text-green-600"
                        : passwordScore >= 1
                          ? "text-amber-600"
                          : "text-gray-500"
                    }`}
                  >
                    {form.password
                      ? `Password strength: ${strengthLabels[passwordScore]}`
                      : "Enter a password"}
                  </p>
                </div>

                <div className="mb-4">
                  <label className={labelClass} htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input
                    className={inputClass}
                    type={showPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={updateField}
                    autoComplete="new-password"
                    required
                    placeholder="Re-enter password"
                  />
                  {passwordError && (
                    <p className="mt-1 text-xs text-red-600">
                      {passwordError}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className={labelClass} htmlFor="secQuestion">
                    Security question
                  </label>
                  <select
                    className={inputClass}
                    id="secQuestion"
                    name="secQuestion"
                    value={form.secQuestion}
                    onChange={updateField}
                    required
                  >
                    <option value="">Choose a question...</option>
                    {questions.map((question) => (
                      <option key={question} value={question}>
                        {question}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className={labelClass} htmlFor="secAnswer">
                    Answer
                  </label>
                  <input
                    className={inputClass}
                    type="text"
                    id="secAnswer"
                    name="secAnswer"
                    value={form.secAnswer}
                    onChange={updateField}
                    required
                    placeholder="Your answer"
                  />
                </div>

                <div className="mt-6 flex">
                  <button
                    type="button"
                    className={buttonPrimary}
                    onClick={() => {
                      if (validateStep1()) goToStep(2);
                    }}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Institution details */}
            {currentStep === 2 && (
              <div className="animate-[fadeIn_0.25s_ease]">
                <div className="mb-4">
                  <label className={labelClass} htmlFor="instName">
                    Institution name
                  </label>
                  <input
                    className={inputClass}
                    id="instName"
                    name="instName"
                    value={form.instName}
                    onChange={updateField}
                    required
                    placeholder="e.g. Green Valley Public School"
                  />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="instType">
                      Institution type
                    </label>
                    <select
                      className={inputClass}
                      id="instType"
                      name="instType"
                      value={form.instType}
                      onChange={updateField}
                      required
                    >
                      <option value="">Select...</option>
                      <option value="School">School</option>
                      <option value="College">College</option>
                      <option value="University">University</option>
                      <option value="Coaching Institute">Coaching Institute</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="regNumber">
                      Registration / affiliation no.
                    </label>
                    <input
                      className={inputClass}
                      id="regNumber"
                      name="regNumber"
                      value={form.regNumber}
                      onChange={updateField}
                      required
                      placeholder="e.g. CBSE/AFF/12345"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className={labelClass} htmlFor="address">
                    Address
                  </label>
                  <textarea
                    className={inputClass}
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={updateField}
                    rows={2}
                    required
                    placeholder="Street, area"
                  />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="city">
                      City
                    </label>
                    <input
                      className={inputClass}
                      id="city"
                      name="city"
                      value={form.city}
                      onChange={updateField}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="state">
                      State
                    </label>
                    <input
                      className={inputClass}
                      id="state"
                      name="state"
                      value={form.state}
                      onChange={updateField}
                      required
                    />
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="pincode">
                      PIN code
                    </label>
                    <input
                      className={inputClass}
                      id="pincode"
                      name="pincode"
                      value={form.pincode}
                      onChange={updateField}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      placeholder="6-digit code"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="website">
                      Website (optional)
                    </label>
                    <input
                      className={inputClass}
                      type="url"
                      id="website"
                      name="website"
                      value={form.website}
                      onChange={updateField}
                      placeholder="https://"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className={buttonOutline}
                    onClick={() => goToStep(1)}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className={buttonPrimary}
                    onClick={() => {
                      if (validateStep2()) goToStep(3);
                    }}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Contact and verification */}
            {currentStep === 3 && (
              <div className="animate-[fadeIn_0.25s_ease]">
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="contactName">
                      Contact person name
                    </label>
                    <input
                      className={inputClass}
                      id="contactName"
                      name="contactName"
                      value={form.contactName}
                      onChange={updateField}
                      required
                      placeholder="e.g. Anil Mehta"
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="contactDesignation">
                      Designation
                    </label>
                    <input
                      className={inputClass}
                      id="contactDesignation"
                      name="contactDesignation"
                      value={form.contactDesignation}
                      onChange={updateField}
                      required
                      placeholder="e.g. HR Manager"
                    />
                  </div>
                </div>

                <div className="mb-5">
                  <label className={labelClass} htmlFor="contactPhone">
                    Contact phone
                  </label>
                  <input
                    className={inputClass}
                    type="tel"
                    id="contactPhone"
                    name="contactPhone"
                    value={form.contactPhone}
                    onChange={updateField}
                    required
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div className="mb-5">
                  <label className={labelClass} htmlFor="certFile">
                    Registration certificate (optional)
                  </label>
                  <label
                    htmlFor="certFile"
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition hover:border-[#2C5CF6] ${
                      certificate
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-[#E7EAF3] text-gray-500"
                    }`}
                  >
                    <span className="mb-2 text-2xl">
                      {certificate ? "✅" : "📎"}
                    </span>
                    <span className="max-w-full break-all text-sm font-semibold">
                      {certificate
                        ? certificate.name
                        : "Click to upload certificate"}
                    </span>
                    <span className="mt-1 text-xs">
                      PDF, JPG, or PNG · Maximum 5 MB
                    </span>
                  </label>

                  <input
                    ref={certificateInputRef}
                    className="hidden"
                    type="file"
                    id="certFile"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleCertificate}
                  />

                  {certificate && (
                    <button
                      type="button"
                      onClick={() => {
                        setCertificate(null);
                        if (certificateInputRef.current) {
                          certificateInputRef.current.value = "";
                        }
                      }}
                      className="mt-2 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove selected file
                    </button>
                  )}
                </div>

                <div className="mb-4 flex items-start gap-2 text-xs leading-5 text-gray-500">
                  <input
                    className="mt-1 h-4 w-4 shrink-0 accent-[#1B2A5B]"
                    type="checkbox"
                    id="institution-terms"
                    required
                  />
                  <label htmlFor="institution-terms">
                    I confirm the details provided are accurate and agree to
                    EduVacancy's{" "}
                    <span className="font-semibold text-[#2C5CF6]">
                      Terms of Service
                    </span>{" "}
                    and{" "}
                    <span className="font-semibold text-[#2C5CF6]">
                      Privacy Policy
                    </span>
                    .
                  </label>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className={buttonOutline}
                    disabled={loading}
                    onClick={() => goToStep(2)}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className={buttonPrimary}
                    disabled={loading}
                  >
                    {loading ? "Submitting..." : "Submit for Review"}
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div
                role="alert"
                className={`mt-5 rounded-lg border p-3 text-sm leading-6 ${
                  messageType === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            )}
          </form>

          <p className="mt-7 text-center text-sm text-gray-500">
            Already registered?{" "}
            <Link
              to="/college-login"
              className="font-bold text-[#2C5CF6] hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
