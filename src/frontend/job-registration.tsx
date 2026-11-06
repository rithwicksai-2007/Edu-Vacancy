
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getSupabaseClient, usernameAuthEmail } from "../lib/supabase-config";
import { apiPublicRequest } from "../lib/api-config";
import { getAuthErrorMessage } from "../lib/auth-error";
import { useAppDialog } from "../components/AppDialogContext";
import {
  RegistrationLegalDialog,
  type RegistrationLegalDocument,
} from "./registration-legal";

type RegistrationData = {
  username: string;
  password: string;
  confirmPassword: string;
  securityQuestion: string;
  securityAnswer: string;
  fullName: string;
  phone: string;
  subject: string;
  otherSubject: string;
  qualification: string;
  otherQualification: string;
  experience: string;
  location: string;
  terms: boolean;
};

const initialData: RegistrationData = {
  username: "",
  password: "",
  confirmPassword: "",
  securityQuestion: "",
  securityAnswer: "",
  fullName: "",
  phone: "",
  subject: "",
  otherSubject: "",
  qualification: "",
  otherQualification: "",
  experience: "",
  location: "",
  terms: false,
};

const questions = [
  "First school you attended?",
  "Name of your first pet?",
  "City you were born in?",
  "Your favourite subject in school?",
];

const schoolSubjects = [
  "Primary / Foundational",
  "Mathematics",
  "English",
  "Hindi",
  "Regional Language",
  "Sanskrit",
  "Science",
  "General Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Environmental Studies",
  "Social Studies",
  "History",
  "Geography",
  "Civics / Political Science",
  "Economics",
  "Computer Science",
  "Information Technology",
  "Physical Education",
  "Art & Craft",
  "Music",
];

const collegeSubjects = [
  "Commerce & Accountancy",
  "Business Studies",
  "English Literature",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Botany",
  "Zoology",
  "Computer Science",
  "Information Technology",
  "Data Science",
  "Artificial Intelligence / Machine Learning",
  "Electronics",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Law",
  "Management",
  "Psychology",
  "Sociology",
  "Education",
  "Nursing / Healthcare",
  "Agriculture",
  "Design",
];

const qualifications = [
  "Class 10 / Secondary",
  "Class 12 / Senior Secondary",
  "Diploma",
  "ITI / Vocational Certificate",
  "B.A",
  "B.Sc",
  "B.Com",
  "B.E / B.Tech",
  "BBA / BCA",
  "B.Ed",
  "B.A / B.Sc + B.Ed",
  "D.El.Ed",
  "M.A",
  "M.Sc",
  "M.A / M.Sc",
  "M.Com",
  "M.E / M.Tech",
  "MBA",
  "MCA",
  "M.Ed",
  "M.Phil",
  "Ph.D",
  "NET Qualified",
  "SET Qualified",
  "NET / SET Qualified",
  "NET/SET Qualified",
  "Other",
];

const inputClass =
  "w-full rounded-lg border border-[#E7EAF3] bg-white px-3 py-[11px] text-[13px] text-[#1C2333] outline-none transition focus:border-[#2C5CF6] focus:ring-4 focus:ring-blue-100";

const labelClass =
  "mb-1.5 block text-[12.5px] font-bold text-[#1C2333]";

export default function JobRegistration() {
  const { showAlert } = useAppDialog();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<RegistrationData>(initialData);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resume, setResume] = useState<File | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoName, setProfilePhotoName] = useState("");
  const [legalDocument, setLegalDocument] =
    useState<RegistrationLegalDocument | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [loading, setLoading] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof RegistrationData>(
    field: K,
    value: RegistrationData[K],
  ) => {
    setData((previous) => ({ ...previous, [field]: value }));
    setMessage("");
  };

  const passwordScore = (() => {
    if (!data.password) return 0;

    let score = 0;
    if (data.password.length >= 8) score++;
    if (/[A-Z]/.test(data.password) && /[a-z]/.test(data.password)) score++;
    if (/[0-9]/.test(data.password)) score++;
    if (/[^A-Za-z0-9]/.test(data.password)) score++;

    return score;
  })();

  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "#DC2626",
    "#D97706",
    "#2C5CF6",
    "#16A34A",
  ];

  const strengthLabel =
    data.password.length === 0
      ? "Enter a password"
      : `Password strength: ${
          strengthLabels[Math.max(passwordScore - 1, 0)]
        }`;

  const validateCurrentStep = () => {
    const form = formRef.current;
    if (!form) return false;

    const fields = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        `[data-step="${step}"] [required]`,
      ),
    );

    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }

    if (step === 2 && !profilePhoto) {
      setMessage("Please upload a valid profile photo to continue.");
      setMessageType("error");
      return false;
    }

    if (
      step === 1 &&
      !/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/i.test(data.username.trim())
    ) {
      setMessage("Username must be 3–30 characters and use letters, numbers, dots, underscores, or hyphens.");
      return false;
    }

    if (step === 1 && data.password !== data.confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return false;
    }

    return true;
  };

  const nextStep = () => {
    if (!validateCurrentStep()) return;

    setStep((current) => Math.min(current + 1, 3));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const previousStep = () => {
    setStep((current) => Math.max(current - 1, 1));
    setMessage("");
  };

  const handleResume = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setResume(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const validExtension = /\.(pdf|doc|docx)$/i.test(file.name);

    if (!validExtension || !allowedTypes.includes(file.type)) {
      setMessage("Please select a valid PDF, DOC, or DOCX resume.");
      setMessageType("error");
      event.target.value = "";
      setResume(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Your resume must be smaller than 5 MB.");
      setMessageType("error");
      event.target.value = "";
      setResume(null);
      return;
    }

    setResume(file);
    setMessage("");
  };

  const handleProfilePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please select a JPG, PNG, or WebP profile photo.");
      setMessageType("error");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Your profile photo must be smaller than 2 MB.");
      setMessageType("error");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setMessage("The selected photo could not be read. Please try another image.");
        setMessageType("error");
        return;
      }

      const photoData = reader.result;
      const image = new Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
          setMessage("Please select a valid image for your profile photo.");
          setMessageType("error");
          event.target.value = "";
          return;
        }

        setProfilePhoto(photoData);
        setProfilePhotoFile(file);
        setProfilePhotoName(file.name);
        setMessage("");
      };
      image.onerror = () => {
        setMessage("Please select a valid image for your profile photo.");
        setMessageType("error");
        event.target.value = "";
      };
      image.src = photoData;
    };
    reader.onerror = () => {
      setMessage("The selected photo could not be read. Please try another image.");
      setMessageType("error");
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const hashAnswer = async (answer: string) => {
    const normalized = answer.trim().toLowerCase();
    const bytes = new TextEncoder().encode(normalized);
    const hash = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    if (!data.terms) {
      setMessage("Please accept the Terms of Service to continue.");
      setMessageType("error");
      return;
    }

    if (!validateCurrentStep()) return;

    setLoading(true);
    setMessage("");

    let createdUserId: string | null = null;
    try {
      const supabaseClient = getSupabaseClient();
      const answerHash = await hashAnswer(data.securityAnswer);
      const username = data.username.trim().toLowerCase();
      const account = await apiPublicRequest<{ id: string }>("/api/v1/auth/register/job-seeker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: data.password,
          full_name: data.fullName.trim(),
          phone: data.phone.trim(),
          security_question: data.securityQuestion,
          security_answer_hash: answerHash,
          subject:
            data.subject === "Other"
              ? data.otherSubject.trim()
              : data.subject,
          qualification:
            data.qualification === "Other"
              ? data.otherQualification.trim()
              : data.qualification,
          years_experience: Number(data.experience),
          preferred_location: data.location.trim(),
        }),
      });
      createdUserId = account.id;
      const { data: authData, error: signInError } =
        await supabaseClient.auth.signInWithPassword({
          email: usernameAuthEmail(username),
          password: data.password,
        });
      if (signInError) throw signInError;
      if (!authData.session) {
        throw new Error("The account was created, but a login session was not returned. Sign in with your username and password.");
      }

      const userId = account.id;

      let resumeUploadWarning = false;
      const uploadedPaths: string[] = [];
      if (!profilePhotoFile) {
        throw new Error("Please upload a valid profile photo before registration.");
      }

      const photoPath = `${userId}/${crypto.randomUUID()}-${profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: photoUploadError } = await supabaseClient.storage
        .from("job-seeker-documents")
        .upload(photoPath, profilePhotoFile, {
          contentType: profilePhotoFile.type,
          upsert: false,
        });
      if (photoUploadError) {
        throw new Error(`Your account was created, but the profile photo could not be uploaded: ${photoUploadError.message}`);
      }
      uploadedPaths.push(photoPath);

      let resumePath: string | null = null;
      if (resume) {
        const safeFileName = resume.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${crypto.randomUUID()}-${safeFileName}`;

        const { error: uploadError } = await supabaseClient.storage
          .from("job-seeker-documents")
          .upload(path, resume, { upsert: false });

        if (uploadError) {
          resumeUploadWarning = true;
        } else {
          resumePath = path;
          uploadedPaths.push(path);
        }
      }

      const { error: detailsError } = await supabaseClient
        .from("job_seeker_details")
        .update({
          profile_photo_url: photoPath,
          ...(resumePath ? { resume_url: resumePath } : {}),
        })
        .eq("id", userId);
      if (detailsError) {
        const { error: cleanupError } = await supabaseClient.storage
          .from("job-seeker-documents")
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error("Could not clean up jobseeker files after profile update failed.", cleanupError);
        }
        throw new Error(`Your account was created, but profile details could not be saved: ${detailsError.message}`);
      }

      const documents = [
        {
          job_seeker_id: userId,
          document_type: "profile_photo" as const,
          storage_path: photoPath,
          original_file_name: profilePhotoFile.name,
          content_type: profilePhotoFile.type,
          file_size: profilePhotoFile.size,
        },
        ...(resumePath && resume
          ? [{
              job_seeker_id: userId,
              document_type: "resume" as const,
              storage_path: resumePath,
              original_file_name: resume.name,
              content_type: resume.type,
              file_size: resume.size,
            }]
          : []),
      ];
      const { error: documentsError } = await supabaseClient
        .from("job_seeker_documents")
        .insert(documents);
      if (documentsError) {
        const { error: cleanupError } = await supabaseClient.storage
          .from("job-seeker-documents")
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error("Could not clean up jobseeker files after document records failed.", cleanupError);
        }
        const { error: detailsCleanupError } = await supabaseClient
          .from("job_seeker_details")
          .update({ profile_photo_url: null, resume_url: null })
          .eq("id", userId);
        if (detailsCleanupError) {
          console.error("Could not clear jobseeker file references after document records failed.", detailsCleanupError);
        }
        throw new Error(`Your account was created, but uploaded files could not be recorded: ${documentsError.message}`);
      }

      setMessageType("success");
      setMessage(
        resumeUploadWarning
          ? "Account created successfully. Your profile photo is saved. Your resume could not be uploaded. Your account is awaiting administrator verification."
          : "Account created successfully. Your profile photo and registration details are saved. Your account is awaiting administrator verification.",
      );
      await showAlert(
        resumeUploadWarning
          ? "Registration successful. Your profile photo and details are saved, but your resume could not be uploaded. Your account is awaiting administrator verification."
          : "Registration successful. Your profile photo and details are saved. You can now log in with your username; your account is awaiting administrator verification.",
      );

      setData(initialData);
      setResume(null);
      setProfilePhoto(null);
      setProfilePhotoFile(null);
      setProfilePhotoName("");
      setStep(1);
      formRef.current?.reset();
    } catch (error: unknown) {
      setMessageType("error");
      const errorMessage = getAuthErrorMessage(error);
      setMessage(errorMessage);
      await showAlert(
        createdUserId
          ? `Account created, but registration could not be completed.\n${errorMessage}`
          : `Registration unsuccessful.\n${errorMessage}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E9F1FE,#F4F6FB_55%)] font-['Inter',sans-serif] text-left text-[#1C2333]">
      <div className="flex min-h-screen flex-col min-[861px]:flex-row">
        {/* Left branding panel */}
        <aside className="hidden w-[42%] shrink-0 flex-col justify-between bg-gradient-to-br from-[#1B2A5B] to-[#14204A] px-11 py-12 text-white min-[861px]:flex">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-white/10 text-xl">
              🎓
            </div>

            <div>
              <h2 className="!m-0 !text-[17px] !leading-normal !tracking-normal !text-white font-['Poppins',sans-serif] font-bold">
                EduVacancy
              </h2>
              <p className="text-[11px] opacity-75">
                School &amp; College Jobs
              </p>
            </div>
          </div>

          <div className="my-12">
            <h1 className="!mb-3.5 !mt-0 !text-3xl !leading-tight !tracking-normal !text-white max-w-[380px] font-['Poppins',sans-serif] font-bold">
              Find your next teaching role, faster.
            </h1>

            <p className="max-w-[360px] text-sm leading-relaxed opacity-80">
              Browse verified openings from schools and colleges, and apply
              in a few clicks.
            </p>

            <div className="mt-7 flex flex-col gap-4">
              {[
                ["✅", "Apply only to verified institutions"],
                ["📄", "Build your resume right on the platform"],
                ["🔔", "Get alerted when a matching job opens"],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3 text-sm">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-white/10">
                    {icon}
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] opacity-55">
            © 2026 EduVacancy. Built for schools, colleges &amp; universities.
          </p>
        </aside>

        {/* Registration panel */}
        <section className="flex min-h-screen flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-10">
          <div className="my-auto w-full max-w-[460px] animate-[fadeIn_0.4s_ease] rounded-2xl border border-[#E7EAF3] bg-white px-[22px] py-7 shadow-[0_12px_32px_rgba(20,32,74,0.08)] sm:px-[38px] sm:py-9">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-[#2C5CF6]">
              Job Seeker
            </div>

            <h1 className="!m-0 !text-2xl !leading-tight !tracking-normal !text-[#1C2333] font-['Poppins',sans-serif] font-bold">
              Create your account
            </h1>

            <p className="mb-6 mt-1.5 text-[13.5px] leading-relaxed text-[#6B7280]">
              Takes about 2 minutes. Free forever for job seekers.
            </p>

            {/* Progress stepper */}
            <div className="mb-7 flex items-start">
              {[1, 2, 3].map((number, index) => (
                <div
                  key={number}
                  className={`flex items-start ${
                    index < 2 ? "flex-1" : ""
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-bold transition ${
                        step === number
                          ? "bg-[#1B2A5B] text-white"
                          : step > number
                            ? "bg-[#16A34A] text-white"
                            : "bg-[#E7EAF3] text-[#6B7280]"
                      }`}
                    >
                      {step > number ? "✓" : number}
                    </div>

                    <span className="mt-1.5 w-[70px] text-center text-[10.5px] text-[#6B7280]">
                      {["Account", "Profile", "Resume"][index]}
                    </span>
                  </div>

                  {index < 2 && (
                    <div
                      className={`mx-1.5 mt-3 h-0.5 flex-1 ${
                        step > number ? "bg-[#16A34A]" : "bg-[#E7EAF3]"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <form ref={formRef} onSubmit={handleSubmit} noValidate>
              {/* STEP 1: Account */}
              {step === 1 && (
                <div data-step="1" className="animate-[fadeIn_0.25s_ease]">
                  <div className="mb-4">
                    <label htmlFor="username" className={labelClass}>
                      Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={inputClass}
                      placeholder="Choose a username"
                      value={data.username}
                      onChange={(e) => updateField("username", e.target.value)}
                    />
                    <p className="mt-1 text-[11px] leading-5 text-gray-500">
                      Use 3–30 letters, numbers, dots, underscores, or hyphens.
                    </p>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="password" className={labelClass}>
                      Password
                    </label>

                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className={`${inputClass} pr-12`}
                        placeholder="At least 8 characters"
                        value={data.password}
                        onChange={(e) =>
                          updateField("password", e.target.value)
                        }
                      />

                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-base"
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>

                    <div className="mt-2 flex gap-1">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className="h-1 flex-1 rounded-sm transition-colors"
                          style={{
                            background:
                              index < passwordScore
                                ? strengthColors[
                                    Math.max(passwordScore - 1, 0)
                                  ]
                                : "#E7EAF3",
                          }}
                        />
                      ))}
                    </div>

                    <p
                      className="mt-1.5 text-[11px]"
                      style={{
                        color:
                          data.password.length === 0
                            ? "#6B7280"
                            : strengthColors[
                                Math.max(passwordScore - 1, 0)
                              ],
                      }}
                    >
                      {strengthLabel}
                    </p>
                  </div>

                  <div className="mb-4">
                    <label
                      htmlFor="confirmPassword"
                      className={labelClass}
                    >
                      Confirm password
                    </label>

                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      className={inputClass}
                      placeholder="Re-enter password"
                      value={data.confirmPassword}
                      onChange={(e) =>
                        updateField("confirmPassword", e.target.value)
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="mt-1 text-xs font-semibold text-[#2C5CF6]"
                    >
                      {showConfirmPassword ? "Hide password" : "Show password"}
                    </button>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="secQuestion" className={labelClass}>
                      Security question
                    </label>

                    <select
                      id="secQuestion"
                      required
                      className={inputClass}
                      value={data.securityQuestion}
                      onChange={(e) =>
                        updateField("securityQuestion", e.target.value)
                      }
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
                    <label htmlFor="secAnswer" className={labelClass}>
                      Answer
                    </label>

                    <input
                      id="secAnswer"
                      required
                      autoComplete="off"
                      className={inputClass}
                      placeholder="Your answer"
                      value={data.securityAnswer}
                      onChange={(e) =>
                        updateField("securityAnswer", e.target.value)
                      }
                    />
                  </div>

                  <div className="mt-5 flex gap-2.5">
                    <button
                      type="button"
                      onClick={nextStep}
                      className="flex-1 rounded-lg bg-[#1B2A5B] px-3 py-3 text-[13.5px] font-bold text-white transition hover:bg-[#14204A]"
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Professional profile */}
              {step === 2 && (
                <div data-step="2" className="animate-[fadeIn_0.25s_ease]">
                  <div className="mb-5">
                    <label className={labelClass}>Profile photo</label>
                    <div className="flex items-center gap-4 rounded-xl border border-[#E7EAF3] p-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF2FF] text-2xl text-[#2C5CF6]">
                        {profilePhoto ? (
                          <img
                            src={profilePhoto}
                            alt="Profile photo preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          "♙"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-[#6B7280]">
                          {profilePhotoName || "Add a clear photo for your profile"}
                        </p>
                        <button
                          type="button"
                          onClick={() => profilePhotoInputRef.current?.click()}
                          className="mt-2 rounded-lg border border-[#E7EAF3] px-3 py-2 text-xs font-semibold text-[#1B2A5B] hover:bg-gray-50"
                        >
                          {profilePhoto ? "Change photo" : "Upload photo"}
                        </button>
                        {profilePhoto && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfilePhoto(null);
                              setProfilePhotoName("");
                              if (profilePhotoInputRef.current) {
                                profilePhotoInputRef.current.value = "";
                              }
                            }}
                            className="ml-3 text-xs font-semibold text-red-600"
                          >
                            Remove
                          </button>
                        )}
                        <p className="mt-1 text-[10px] text-[#6B7280]">
                          JPG, PNG, or WebP · Up to 2 MB
                        </p>
                      </div>
                    </div>
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleProfilePhoto}
                      className="hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3">
                    <div className="mb-4">
                      <label htmlFor="fullName" className={labelClass}>
                        Full name
                      </label>
                      <input
                        id="fullName"
                        required
                        autoComplete="name"
                        className={inputClass}
                        placeholder="e.g. Anita Sharma"
                        value={data.fullName}
                        onChange={(e) =>
                          updateField("fullName", e.target.value)
                        }
                      />
                    </div>

                    <div className="mb-4">
                      <label htmlFor="phone" className={labelClass}>
                        Phone number
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        autoComplete="tel"
                        className={inputClass}
                        placeholder="10-digit phone number"
                        value={data.phone}
                        onChange={(e) =>
                          updateField(
                            "phone",
                            e.target.value.replace(/\D/g, "").slice(0, 10),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3">
                    <div className="mb-4">
                      <label htmlFor="subject" className={labelClass}>
                        Subject / specialization
                      </label>
                      <select
                        id="subject"
                        required
                        className={inputClass}
                        value={data.subject}
                        onChange={(e) =>
                          updateField("subject", e.target.value)
                        }
                      >
                        <option value="">Select...</option>
                        <optgroup label="School subjects">
                          {schoolSubjects.map((subject) => (
                            <option key={subject}>{subject}</option>
                          ))}
                        </optgroup>
                        <optgroup label="College subjects & specializations">
                          {collegeSubjects.map((subject) => (
                            <option key={subject}>{subject}</option>
                          ))}
                        </optgroup>
                        <option>Other</option>
                      </select>
                    </div>

                    {data.subject === "Other" && (
                      <div className="mb-4">
                        <label htmlFor="otherSubject" className={labelClass}>
                          Enter your subject / specialization
                        </label>
                        <input
                          id="otherSubject"
                          required
                          maxLength={120}
                          className={inputClass}
                          placeholder="e.g. Biotechnology"
                          value={data.otherSubject}
                          onChange={(e) =>
                            updateField("otherSubject", e.target.value)
                          }
                        />
                      </div>
                    )}

                    <div className="mb-4">
                      <label htmlFor="qualification" className={labelClass}>
                        Highest qualification
                      </label>
                      <select
                        id="qualification"
                        required
                        className={inputClass}
                        value={data.qualification}
                        onChange={(e) =>
                          updateField("qualification", e.target.value)
                        }
                      >
                        <option value="">Select...</option>
                        {qualifications.map((qualification) => (
                          <option key={qualification}>{qualification}</option>
                        ))}
                      </select>
                    </div>

                    {data.qualification === "Other" && (
                      <div className="mb-4">
                        <label
                          htmlFor="otherQualification"
                          className={labelClass}
                        >
                          Enter your highest qualification
                        </label>
                        <input
                          id="otherQualification"
                          required
                          maxLength={240}
                          className={inputClass}
                          placeholder="Enter your qualification"
                          value={data.otherQualification}
                          onChange={(e) =>
                            updateField("otherQualification", e.target.value)
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3">
                    <div className="mb-4">
                      <label htmlFor="experience" className={labelClass}>
                        Years of experience
                      </label>
                      <input
                        id="experience"
                        type="number"
                        min="0"
                        max="60"
                        required
                        className={inputClass}
                        placeholder="e.g. 3"
                        value={data.experience}
                        onChange={(e) =>
                          updateField("experience", e.target.value)
                        }
                      />
                    </div>

                    <div className="mb-4">
                      <label htmlFor="location" className={labelClass}>
                        Preferred location
                      </label>
                      <input
                        id="location"
                        required
                        className={inputClass}
                        placeholder="e.g. Hyderabad"
                        value={data.location}
                        onChange={(e) =>
                          updateField("location", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={previousStep}
                      className="flex-1 rounded-lg border border-[#E7EAF3] bg-white px-3 py-3 text-[13.5px] font-bold text-[#1B2A5B] hover:bg-gray-50"
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      onClick={nextStep}
                      className="flex-1 rounded-lg bg-[#1B2A5B] px-3 py-3 text-[13.5px] font-bold text-white hover:bg-[#14204A]"
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Resume and terms */}
              {step === 3 && (
                <div data-step="3" className="animate-[fadeIn_0.25s_ease]">
                  <div className="mb-4">
                    <label className={labelClass}>
                      Resume (optional)
                    </label>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full rounded-xl border-2 border-dashed p-5 text-center text-[12.5px] transition hover:border-[#2C5CF6] ${
                        resume
                          ? "border-[#16A34A] bg-[#F0FBF4] text-[#16A34A]"
                          : "border-[#E7EAF3] text-[#6B7280]"
                      }`}
                    >
                      <span className="block text-2xl">📎</span>
                      <span className="mt-2 block break-all">
                        {resume
                          ? `✓ ${resume.name}`
                          : "Click to upload PDF / DOC / DOCX"}
                      </span>
                      <span className="mt-1 block text-[11px]">
                        Maximum file size: 5 MB
                      </span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleResume}
                      className="hidden"
                    />

                    {resume && (
                      <button
                        type="button"
                        onClick={() => {
                          setResume(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="mt-2 text-xs font-semibold text-red-600"
                      >
                        Remove resume
                      </button>
                    )}
                  </div>

                  <div className="my-4 flex items-start gap-2.5 text-[12.5px] text-[#6B7280]">
                    <input
                      id="terms"
                      type="checkbox"
                      required
                      aria-label="I confirm my details are accurate and agree to the Terms of Service and Privacy Policy"
                      checked={data.terms}
                      onChange={(e) =>
                        updateField("terms", e.target.checked)
                      }
                      className="mt-1 h-4 w-4 shrink-0 accent-[#2C5CF6]"
                    />

                    <div>
                      I confirm my details are accurate and agree to{" "}
                      <button
                        type="button"
                        onClick={() => setLegalDocument("terms")}
                        className="font-semibold text-[#2C5CF6] hover:underline"
                      >
                        Terms of Service
                      </button>{" "}
                      and{" "}
                      <button
                        type="button"
                        onClick={() => setLegalDocument("privacy")}
                        className="font-semibold text-[#2C5CF6] hover:underline"
                      >
                        Privacy Policy
                      </button>
                      .
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={previousStep}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-[#E7EAF3] bg-white px-3 py-3 text-[13.5px] font-bold text-[#1B2A5B] hover:bg-gray-50 disabled:opacity-50"
                    >
                      ← Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 rounded-lg bg-[#1B2A5B] px-3 py-3 text-[13.5px] font-bold text-white transition hover:bg-[#14204A] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {loading ? "Creating account..." : "Create account"}
                    </button>
                  </div>
                </div>
              )}

              {/* Status message */}
              {message && (
                <div
                  role="alert"
                  aria-live="polite"
                  className={`mt-4 rounded-lg border px-3 py-3 text-[13px] ${
                    messageType === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-600"
                  }`}
                >
                  {message}
                </div>
              )}
            </form>

            <p className="mt-5 text-center text-[13px] text-[#6B7280]">
              Already have an account?{" "}
              <Link
                to="/job-login"
                className="font-bold text-[#2C5CF6] hover:underline"
              >
                Log in
              </Link>
            </p>

          </div>
        </section>
      </div>

      {legalDocument && (
        <RegistrationLegalDialog
          document={legalDocument}
          onClose={() => setLegalDocument(null)}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
