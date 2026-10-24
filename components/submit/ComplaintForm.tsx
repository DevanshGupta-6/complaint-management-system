"use client";

import { useRef, useState, type FormEvent } from "react";

const MAX_LEN = 5000;

type Status = "idle" | "submitting" | "success" | "error";

const ERROR_BY_STATUS: Record<number, string> = {
  401: "This complaint link is no longer valid. Please contact the company for a new one.",
  403: "This form isn't available from this website. (Site owner: check the key's allowed origins.)",
  413: "Your message is too long. Please shorten it and try again.",
  429: "Too many submissions right now. Please wait a minute and try again.",
};

const FIELD_MAP: Record<string, "name" | "email" | "message"> = {
  customer_name: "name",
  customer_email: "email",
  raw_text: "message",
};

const FIELD_MESSAGES = {
  name: "That name is too long.",
  email: "Please enter a valid email address.",
  message: "Please describe your complaint.",
};

// crypto.randomUUID needs a secure context (https or localhost), so keep a fallback
const newAttemptId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const inputClass =
  "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

export function ComplaintForm({ apiKey, companyName }: { apiKey: string; companyName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "email" | "message", string>>>({});
  const [reference, setReference] = useState<string | null>(null);

  // One id per attempt: a double-click or retry maps to the same complaint (server-side idempotency)
  const attemptId = useRef("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    const form = new FormData(e.currentTarget); // read before any await

    // Honeypot: real visitors never see this field. A bot that fills it gets a fake success
    if (form.get("website")) {
      setReference(null);
      setStatus("success");
      return;
    }

    setStatus("submitting");
    setError(null);
    setFieldErrors({});
    attemptId.current ||= newAttemptId();

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          raw_text: message,
          customer_name: String(form.get("name") ?? ""),
          customer_email: String(form.get("email") ?? ""),
          external_ref: `web-${attemptId.current}`,
          metadata: { channel: "hosted-form" },
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // 202 = accepted, 200 = this exact attempt was already received
        setReference(data.id ? String(data.id).slice(0, 8).toUpperCase() : null);
        attemptId.current = "";
        setStatus("success");
        return;
      }

      if (res.status === 422 && Array.isArray(data.issues)) {
        const next: typeof fieldErrors = {};
        for (const issue of data.issues as { field: string }[]) {
          const field = FIELD_MAP[issue.field];
          if (field && !next[field]) next[field] = FIELD_MESSAGES[field];
        }
        setFieldErrors(next);
        setError(Object.keys(next).length ? null : "Please check your details and try again.");
      } else {
        setError(ERROR_BY_STATUS[res.status] ?? "Something went wrong. Please try again in a moment.");
      }
      setStatus("error");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  function reset() {
    setMessage("");
    setReference(null);
    setError(null);
    setFieldErrors({});
    setStatus("idle");
  }

  if (status === "success") {
    return (
      <div role="status" className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">Thank you</h1>
        <p className="text-sm text-gray-600">
          Your complaint has been sent to {companyName}.
        </p>
        {reference && (
          <p className="text-sm text-gray-500">
            Reference: <span className="font-mono font-medium text-gray-900">{reference}</span>
          </p>
        )}
        <button onClick={reset} className="mt-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
          Submit another complaint
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">Submit a complaint</h1>
        <p className="mt-1 text-sm text-gray-600">
          Tell {companyName} what went wrong. Include details such as dates or order numbers if you can.
        </p>
      </div>

      <label className="block text-sm font-medium">
        Your name <span className="font-normal text-gray-400">(optional)</span>
        <input name="name" maxLength={200} autoComplete="name" className={inputClass} />
        {fieldErrors.name && <span className="mt-1 block text-xs text-red-600">{fieldErrors.name}</span>}
      </label>

      <label className="block text-sm font-medium">
        Email <span className="font-normal text-gray-400">(optional, if you&rsquo;d like a reply)</span>
        <input name="email" type="email" maxLength={254} autoComplete="email" className={inputClass} />
        {fieldErrors.email && <span className="mt-1 block text-xs text-red-600">{fieldErrors.email}</span>}
      </label>

      <label className="block text-sm font-medium">
        Your complaint
        <textarea
          name="message"
          rows={6}
          required
          maxLength={MAX_LEN}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 flex justify-between text-xs">
          <span className="text-red-600">{fieldErrors.message}</span>
          <span className="text-gray-400">{message.length}/{MAX_LEN}</span>
        </span>
      </label>

      {/* Honeypot: hidden from people and screen readers, tempting to bots */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div aria-live="polite">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={status === "submitting" || message.trim().length === 0}
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Sending…" : "Send complaint"}
      </button>
    </form>
  );
}