
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
import { useAppDialog } from "../components/AppDialogContext";
import {
  RegistrationLegalDialog,
  type RegistrationLegalDocument,
} from "./registration-legal";

type InstitutionType =
  | "School"
  | "College"
  | "University"
  | "Coaching Institute"
  | "Other";

type FormData = {
  username: string;
  password: string;
  confirmPassword: string;
  secQuestion: string;
  secAnswer: string;
  instName: string;
  instType: InstitutionType | "";
  otherInstType: string;
  regNumber: string;
  address: string;
  city: string;
  village: string;
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
  otherInstType: "",
  regNumber: "",
  address: "",
  city: "",
  village: "",
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

const indianStates = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const citiesByState: Record<string, string[]> = {
  "Andaman and Nicobar Islands": ["Port Blair", "Diglipur", "Mayabunder"],
  "Andhra Pradesh": ["Amaravati", "Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore", "Kurnool", "Rajahmundry", "Kakinada"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Tawang", "Pasighat", "Ziro"],
  Assam: ["Guwahati", "Dibrugarh", "Silchar", "Jorhat", "Tezpur", "Nagaon", "Tinsukia"],
  Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia"],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Jagdalpur"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  Delhi: ["New Delhi", "Delhi"],
  Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Ambala", "Hisar", "Karnal", "Rohtak"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan", "Kullu"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh"],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Kalaburagi", "Shivamogga"],
  Kerala: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Kannur"],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti", "Agatti", "Minicoy"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Rewa"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Chhatrapati Sambhajinagar", "Kolhapur"],
  Manipur: ["Imphal", "Thoubal", "Churachandpur"],
  Meghalaya: ["Shillong", "Tura", "Jowai"],
  Mizoram: ["Aizawl", "Lunglei", "Champhai"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung"],
  Odisha: ["Bhubaneswar", "Cuttack", "Rourkela", "Sambalpur", "Puri", "Berhampur"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe", "Yanam"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar"],
  Sikkim: ["Gangtok", "Namchi", "Gyalshing"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode"],
  Telangana: ["Hyderabad", "Warangal", "Karimnagar", "Nizamabad", "Khammam"],
  Tripura: ["Agartala", "Udaipur", "Dharmanagar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut", "Noida", "Ghaziabad", "Gorakhpur"],
  Uttarakhand: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rishikesh"],
  "West Bengal": ["Kolkata", "Howrah", "Siliguri", "Durgapur", "Asansol", "Kharagpur"],
};

type PostalOffice = {
  Name?: string;
  District?: string;
  State?: string;
};

type PostalLookupResult = {
  Status?: string;
  PostOffice?: PostalOffice[] | null;
};

function canonicalStateName(stateName: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
  const normalizedState = normalize(stateName);
  const aliases: Record<string, string> = {
    andamanandnicobarislands: "Andaman and Nicobar Islands",
    andamanandnicobar: "Andaman and Nicobar Islands",
    dadraandnagarhavelianddamandiu: "Dadra and Nagar Haveli and Daman and Diu",
    dadraandnagarhaveli: "Dadra and Nagar Haveli and Daman and Diu",
    damananddiu: "Dadra and Nagar Haveli and Daman and Diu",
    nctofdelhi: "Delhi",
    orissa: "Odisha",
    pondicherry: "Puducherry",
  };

  return (
    aliases[normalizedState] ??
    indianStates.find((state) => normalize(state) === normalizedState) ??
    ""
  );
}

const inputClass =
  "w-full rounded-lg border border-[#E7EAF3] bg-white px-3 py-3 text-sm text-[#1C2333] outline-none transition placeholder:text-gray-400 focus:border-[#2C5CF6] focus:ring-2 focus:ring-blue-100";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[#1C2333]";

const buttonPrimary =
  "flex-1 rounded-lg bg-[#1B2A5B] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#14204A] disabled:cursor-not-allowed disabled:opacity-50";

const buttonOutline =
  "flex-1 rounded-lg border border-[#E7EAF3] bg-white px-4 py-3 text-sm font-bold text-[#1B2A5B] transition hover:bg-gray-50";

export default function CollegeRegistration() {
  const { showAlert } = useAppDialog();
  const [form, setForm] = useState<FormData>(initialForm);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [institutionImages, setInstitutionImages] = useState<File[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalDocument, setLegalDocument] =
    useState<RegistrationLegalDocument | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "error"
  );
  const [loading, setLoading] = useState(false);
  const [pinLookupMessage, setPinLookupMessage] = useState("");
  const [pinLookupLoading, setPinLookupLoading] = useState(false);
  const [pinOffices, setPinOffices] = useState<PostalOffice[]>([]);
  const pinLookupRequest = useRef(0);
  const institutionImagesInputRef = useRef<HTMLInputElement>(null);

  const updateField = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name } = e.target;
    const value =
      name === "contactPhone" && e.target instanceof HTMLInputElement
        ? e.target.value.replace(/\D/g, "").slice(0, 10)
        : e.target.value;
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "state" ? { city: "", village: "" } : {}),
      ...(name === "city" ? { village: "" } : {}),
    }));

    if (name === "state") {
      pinLookupRequest.current++;
      setPinOffices([]);
      setPinLookupLoading(false);
      setPinLookupMessage("");
    }

    if (name === "confirmPassword" || name === "password") {
      setPasswordError("");
    }
  };

  const lookupPinCode = async (pincode: string) => {
    const requestId = ++pinLookupRequest.current;
    setPinLookupLoading(true);
    setPinLookupMessage("");

    try {
      const response = await fetch(
        `https://api.postalpincode.in/pincode/${pincode}`,
      );
      if (!response.ok) {
        throw new Error(`PIN lookup failed with status ${response.status}.`);
      }

      const results = (await response.json()) as PostalLookupResult[];
      const offices = results
        .filter((result) => result.Status === "Success")
        .flatMap((result) => result.PostOffice ?? [])
        .filter((office) => office.Name && office.District && office.State);
      const officeState = offices[0]?.State;
      const state = officeState ? canonicalStateName(officeState) : "";

      if (!offices.length || !state) {
        throw new Error("No matching post office was found.");
      }

      const districts = [
        ...new Set(
          offices
            .filter(
              (office) => canonicalStateName(office.State ?? "") === state,
            )
            .map((office) => office.District!),
        ),
      ];

      if (requestId !== pinLookupRequest.current) return;

      setPinOffices(offices);
      setForm((previous) => ({
        ...previous,
        city: districts.length === 1 ? districts[0] : "",
        state,
        village:
          districts.length === 1 &&
          offices.filter((office) => office.District === districts[0]).length === 1
            ? offices.find((office) => office.District === districts[0])?.Name ??
              ""
            : "",
      }));
      setPinLookupMessage(
        districts.length === 1
          ? "State and district filled from the PIN code. Select the village / post office."
          : "State filled from the PIN code. Select the district and village / post office.",
      );
    } catch {
      if (requestId === pinLookupRequest.current) {
        setPinLookupMessage(
          "PIN code could not be looked up. Select the state and city manually.",
        );
      }
    } finally {
      if (requestId === pinLookupRequest.current) {
        setPinLookupLoading(false);
      }
    }
  };

  const updatePincode = (value: string) => {
    const pincode = value.replace(/\D/g, "").slice(0, 6);
    setForm((previous) => ({
      ...previous,
      pincode,
      city: "",
      village: "",
      state: "",
    }));
    setPinOffices([]);
    setPinLookupMessage("");

    if (pincode.length === 6) {
      void lookupPinCode(pincode);
    } else {
      pinLookupRequest.current++;
      setPinLookupLoading(false);
    }
  };

  const pinDistricts = [
    ...new Set(
      pinOffices
        .filter((office) => canonicalStateName(office.State ?? "") === form.state)
        .map((office) => office.District!)
        .filter(Boolean),
    ),
  ];
  const availableDistricts = pinDistricts.length
    ? pinDistricts
    : citiesByState[form.state] ?? [];
  const villagesForDistrict = [
    ...new Set(
      pinOffices
        .filter(
          (office) =>
            canonicalStateName(office.State ?? "") === form.state &&
            office.District === form.city,
        )
        .map((office) => office.Name!)
        .filter(Boolean),
    ),
  ];

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
      "village",
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

    if (form.instType === "Other" && !form.otherInstType.trim()) {
      setError("Please enter the institution type.");
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
    if (institutionImages.length === 0) {
      setError("Upload at least one clear school or college photo to continue.");
      return false;
    }

    if (
      !form.contactName.trim() ||
      !form.contactDesignation.trim() ||
      !form.contactPhone.trim()
    ) {
      setError("Please complete the contact person's details.");
      return false;
    }

    if (!/^\d{10}$/.test(form.contactPhone)) {
      setError("Contact phone must contain exactly 10 digits.");
      return false;
    }

    if (institutionImages.length > 5) {
      setError("Upload no more than 5 institution photos.");
      return false;
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

  const handleInstitutionImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const validTypes = ["image/jpeg", "image/png"];
    const validExtension = /\.(jpe?g|png)$/i;

    if (files.length > 5) {
      setError("Upload no more than 5 institution photos.");
      e.target.value = "";
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !validExtension.test(file.name) ||
        !validTypes.includes(file.type) ||
        file.size > 5 * 1024 * 1024,
    );
    if (invalidFile) {
      setError(
        "Choose JPG or PNG photos, each smaller than 5 MB.",
      );
      e.target.value = "";
      return;
    }

    setInstitutionImages(files);
    e.target.value = "";
    setMessage("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateStep3()) return;

    if (!termsAccepted) {
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
            institution_type:
              form.instType === "Other"
                ? form.otherInstType.trim()
                : form.instType,
            address: form.address.trim(),
            contact_person: form.contactName.trim(),
            contact_designation: form.contactDesignation.trim(),
            registration_number: form.regNumber.trim(),
            city: form.city.trim(),
            village: form.village.trim(),
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

      let photoUploadWarning = false;
      const uploadedPaths: string[] = [];
      const documentRows: {
        institution_id: string;
        document_type: "institution_image";
        storage_path: string;
        original_file_name: string;
        content_type: string;
        file_size: number;
      }[] = [];
      const supabaseClient = getSupabaseClient();
      for (const image of institutionImages) {
        const safeFileName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${crypto.randomUUID()}-${safeFileName}`;
        const { error: uploadError } = await supabaseClient.storage
          .from("institution-documents")
          .upload(path, image, { contentType: image.type, upsert: false });

        if (uploadError) {
          photoUploadWarning = true;
          break;
        }

        uploadedPaths.push(path);
        documentRows.push({
          institution_id: userId,
          document_type: "institution_image",
          storage_path: path,
          original_file_name: image.name,
          content_type: image.type,
          file_size: image.size,
        });
      }

      if (photoUploadWarning && uploadedPaths.length) {
        const { error: cleanupError } = await supabaseClient.storage
          .from("institution-documents")
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error("Could not clean up partially uploaded institution photos.", cleanupError);
        }
      } else if (uploadedPaths.length) {
        const { error: photoRecordError } = await supabaseClient
          .from("institution_documents")
          .insert(documentRows);

        if (photoRecordError) {
          const { error: cleanupError } = await supabaseClient.storage
            .from("institution-documents")
            .remove(uploadedPaths);
          if (cleanupError) {
            console.error("Could not clean up institution photos after metadata failed.", cleanupError);
          }
          photoUploadWarning = true;
        }
      }

      setMessageType("success");
      setMessage(
        photoUploadWarning
          ? "Registration submitted successfully, but one or more institution photos could not be uploaded. Your institution will be reviewed before verification."
          : "Registration submitted successfully. You can now log in with your username. Your institution will be reviewed before verification."
      );
      await showAlert(
        photoUploadWarning
          ? "Registration successful, but one or more institution photos could not be uploaded. Your institution will be reviewed before verification."
          : "Registration successful. You can now log in with your username. Your institution will be reviewed before verification.",
      );

      setForm(initialForm);
      setInstitutionImages([]);
      setTermsAccepted(false);
      setCurrentStep(1);
      setShowPassword(false);
      if (institutionImagesInputRef.current) {
        institutionImagesInputRef.current.value = "";
      }
    } catch (error: unknown) {
      const errorMessage = getAuthErrorMessage(error);

      if (createdUserId) {
        setMessageType("error");
        const message = `Your account was created, but registration could not finish: ${errorMessage} You can sign in with your username and password; do not register the same username again.`;
        setMessage(message);
        await showAlert(`Registration incomplete.\n${message}`);
      } else {
        setError(errorMessage);
        await showAlert(`Registration unsuccessful.\n${errorMessage}`);
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
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {form.instType === "Other" && (
                    <div className="mt-3 sm:col-span-2 sm:mt-0">
                      <label className={labelClass} htmlFor="otherInstType">
                        Enter institution type
                      </label>
                      <input
                        className={inputClass}
                        id="otherInstType"
                        name="otherInstType"
                        value={form.otherInstType}
                        onChange={updateField}
                        maxLength={80}
                        required
                        placeholder="e.g. Research institute"
                      />
                    </div>
                  )}

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
                    <label className={labelClass} htmlFor="pincode">
                      PIN code
                    </label>
                    <input
                      className={inputClass}
                      id="pincode"
                      name="pincode"
                      value={form.pincode}
                      onChange={(event) => updatePincode(event.target.value)}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      placeholder="6-digit code"
                    />
                    {(pinLookupLoading || pinLookupMessage) && (
                      <p
                        role="status"
                        className={`mt-1 text-xs ${
                          pinLookupLoading ? "text-[#6B7280]" : "text-[#2C5CF6]"
                        }`}
                      >
                        {pinLookupLoading
                          ? "Looking up PIN code..."
                          : pinLookupMessage}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="state">
                      State
                    </label>
                    <select
                      className={inputClass}
                      id="state"
                      name="state"
                      value={form.state}
                      onChange={updateField}
                      required
                    >
                      <option value="">Select state / union territory...</option>
                      {indianStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="city">
                      District / city
                    </label>
                    <select
                      className={inputClass}
                      id="city"
                      name="city"
                      value={form.city}
                      onChange={updateField}
                      disabled={!form.state}
                      required
                    >
                      <option value="">
                        {form.state
                          ? "Select district / city..."
                          : "Select a state first..."}
                      </option>
                      {availableDistricts.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="village">
                      Village / locality / post office
                    </label>
                    {villagesForDistrict.length ? (
                      <select
                        className={inputClass}
                        id="village"
                        name="village"
                        value={form.village}
                        onChange={updateField}
                        disabled={!form.city}
                        required
                      >
                        <option value="">
                          {form.city
                            ? "Select village / post office..."
                            : "Select a district first..."}
                        </option>
                        {villagesForDistrict.map((village) => (
                          <option key={village} value={village}>
                            {village}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={inputClass}
                        id="village"
                        name="village"
                        value={form.village}
                        onChange={updateField}
                        required
                        maxLength={120}
                        placeholder="Enter village or locality"
                      />
                    )}
                  </div>
                </div>

                <div className="mb-4">
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
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    autoComplete="tel"
                    placeholder="10-digit phone number"
                  />
                </div>

                <div className="mb-5">
                  <label className={labelClass} htmlFor="institutionImages">
                    School / college photos
                  </label>
                  <label
                    htmlFor="institutionImages"
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition hover:border-[#2C5CF6] ${
                      institutionImages.length
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-[#E7EAF3] text-gray-500"
                    }`}
                  >
                    <span className="mb-2 text-2xl">
                      {institutionImages.length ? "✅" : "🏫"}
                    </span>
                    <span className="max-w-full break-all text-sm font-semibold">
                      {institutionImages.length
                        ? `${institutionImages.length} photo${institutionImages.length === 1 ? "" : "s"} selected`
                        : "Upload at least one clear photo of your school or college"}
                    </span>
                    <span className="mt-1 text-xs">
                      Required · JPG or PNG · Up to 5 photos, 5 MB each
                    </span>
                  </label>

                  <input
                    ref={institutionImagesInputRef}
                    className="hidden"
                    type="file"
                    id="institutionImages"
                    accept="image/jpeg,image/png"
                    multiple
                    onChange={handleInstitutionImages}
                  />

                  {institutionImages.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {institutionImages.map((image) => (
                        <li key={`${image.name}-${image.lastModified}`}>
                          {image.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  {institutionImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setInstitutionImages([]);
                        if (institutionImagesInputRef.current) {
                          institutionImagesInputRef.current.value = "";
                        }
                      }}
                      className="mt-2 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Clear selected photos
                    </button>
                  )}
                </div>

                <div className="mb-4 flex items-start gap-2 text-xs leading-5 text-gray-500">
                  <input
                    className="mt-1 h-4 w-4 shrink-0 accent-[#1B2A5B]"
                    type="checkbox"
                    id="institution-terms"
                    required
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    aria-label="I confirm the institution details are accurate and agree to the Terms of Service and Privacy Policy"
                  />
                  <div>
                    I confirm the details provided are accurate and agree to{" "}
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
      {legalDocument && (
        <RegistrationLegalDialog
          document={legalDocument}
          accountType="institution"
          onClose={() => setLegalDocument(null)}
        />
      )}
    </main>
  );
}
