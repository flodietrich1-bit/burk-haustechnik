import { useState, type FormEvent } from 'react';
import { Mail, User, Building, Phone, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/apiClient';

interface ContactFormProps {
  onSuccess?: () => void;
  className?: string;
}

export function ContactForm({ onSuccess, className = '' }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side quick check
    if (!name.trim()) {
      setError('Bitte gib deinen Namen an.');
      return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Bitte gib eine gültige E-Mail-Adresse an.');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError('Bitte schreibe uns eine Nachricht mit mindestens 10 Zeichen.');
      return;
    }

    setLoading(true);

    try {
      await api<{ success: boolean; message: string }>('/public/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          phone: phone.trim(),
          message: message.trim(),
        }),
      });

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      const msg = err?.details || err?.error || err?.message || 'Deine Nachricht konnte gerade nicht zugestellt werden. Bitte kontaktiere uns direkt unter info@p12-aufmass.de.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className={`rounded-3xl border border-[#D5EAD8] bg-[#F2FAF4] p-8 text-center text-[#1F1A4D] shadow-sm ${className}`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2FA36B]/15 text-[#2FA36B]">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="mt-5 text-2xl font-bold">Vielen Dank für deine Nachricht!</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#516358]">
          Wir haben deine Anfrage erhalten. Unser Team von <strong>P12 - Aufmaß</strong> meldet sich schnellstmöglich persönlich bei dir.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setMessage('');
          }}
          className="mt-6 rounded-xl border border-[#C5DED0] bg-white px-5 py-2.5 text-xs font-semibold text-[#1F1A4D] transition hover:bg-[#EAF5EE]"
        >
          Weitere Nachricht senden
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-3xl border border-[#EAE5F4] bg-white p-6 shadow-[0_20px_50px_-25px_rgba(31,26,77,0.15)] sm:p-8 ${className}`}
    >
      <div className="mb-6">
        <h3 className="text-xl font-bold text-[#1F1A4D] sm:text-2xl">Jetzt Kontakt aufnehmen</h3>
        <p className="mt-1 text-sm text-[#68647D]">
          Interesse an P12 - Aufmaß für dein Unternehmen? Schreib uns einfach eine kurze Nachricht.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-wider text-[#494463]">
            Vollständiger Name <span className="text-[#7437D9]">*</span>
          </label>
          <div className="mt-1.5 flex h-11 items-center gap-2.5 rounded-xl border border-[#DDD5EF] bg-white px-3.5 transition focus-within:border-[#7437D9] focus-within:ring-2 focus-within:ring-[#7437D9]/15">
            <User className="h-4 w-4 shrink-0 text-[#8E8A9F]" />
            <input
              id="contact-name"
              type="text"
              required
              autoComplete="name"
              placeholder="z. B. Florian Müller"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1A4D] outline-none placeholder:text-[#A7A3B4]"
            />
          </div>
        </div>

        {/* E-Mail */}
        <div>
          <label htmlFor="contact-email" className="block text-xs font-semibold uppercase tracking-wider text-[#494463]">
            Geschäftliche E-Mail <span className="text-[#7437D9]">*</span>
          </label>
          <div className="mt-1.5 flex h-11 items-center gap-2.5 rounded-xl border border-[#DDD5EF] bg-white px-3.5 transition focus-within:border-[#7437D9] focus-within:ring-2 focus-within:ring-[#7437D9]/15">
            <Mail className="h-4 w-4 shrink-0 text-[#8E8A9F]" />
            <input
              id="contact-email"
              type="email"
              required
              autoComplete="email"
              placeholder="florian@haustechnik.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1A4D] outline-none placeholder:text-[#A7A3B4]"
            />
          </div>
        </div>

        {/* Unternehmen */}
        <div>
          <label htmlFor="contact-company" className="block text-xs font-semibold uppercase tracking-wider text-[#494463]">
            Unternehmen / Handwerksbetrieb
          </label>
          <div className="mt-1.5 flex h-11 items-center gap-2.5 rounded-xl border border-[#DDD5EF] bg-white px-3.5 transition focus-within:border-[#7437D9] focus-within:ring-2 focus-within:ring-[#7437D9]/15">
            <Building className="h-4 w-4 shrink-0 text-[#8E8A9F]" />
            <input
              id="contact-company"
              type="text"
              autoComplete="organization"
              placeholder="z. B. Burk Haustechnik GmbH"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1A4D] outline-none placeholder:text-[#A7A3B4]"
            />
          </div>
        </div>

        {/* Telefon */}
        <div>
          <label htmlFor="contact-phone" className="block text-xs font-semibold uppercase tracking-wider text-[#494463]">
            Telefonnummer (optional)
          </label>
          <div className="mt-1.5 flex h-11 items-center gap-2.5 rounded-xl border border-[#DDD5EF] bg-white px-3.5 transition focus-within:border-[#7437D9] focus-within:ring-2 focus-within:ring-[#7437D9]/15">
            <Phone className="h-4 w-4 shrink-0 text-[#8E8A9F]" />
            <input
              id="contact-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+49 170 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1A4D] outline-none placeholder:text-[#A7A3B4]"
            />
          </div>
        </div>
      </div>

      {/* Nachricht */}
      <div className="mt-4">
        <label htmlFor="contact-message" className="block text-xs font-semibold uppercase tracking-wider text-[#494463]">
          Deine Nachricht / Anforderungen <span className="text-[#7437D9]">*</span>
        </label>
        <textarea
          id="contact-message"
          rows={4}
          required
          placeholder="Beschreibe kurz deine aktuellen Herausforderungen beim Aufmaß oder welche Schnittstellen (GAEB, CAD, Handwerker-Software) du benötigst …"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5 w-full rounded-2xl border border-[#DDD5EF] bg-white p-3.5 text-sm text-[#1F1A4D] outline-none transition placeholder:text-[#A7A3B4] focus:border-[#7437D9] focus:ring-2 focus:ring-[#7437D9]/15"
        />
      </div>

      {/* Datenschutzhinweis & Submit */}
      <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-xs text-[#7B7692]">
          Mit dem Absenden stimmst du unserer{' '}
          <a href="/datenschutz" className="underline hover:text-[#7437D9]">
            Datenschutzerklärung (DSGVO)
          </a>{' '}
          zu.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7437D9] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6228be] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Wird gesendet …</span>
            </>
          ) : (
            <>
              <span>Nachricht absenden</span>
              <Send className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
