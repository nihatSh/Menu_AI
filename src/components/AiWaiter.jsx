"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Microphone, Barbell, Sparkle, WifiSlash } from "@phosphor-icons/react";
import DishCard from "./DishCard";
import HungerSlider from "./HungerSlider";
import { Chip, Note, cx } from "./ui";

const SPEECH_LOCALE = { az: "az-AZ", en: "en-US", ru: "ru-RU" };

const QUICK_ASKS = {
  en: [
    "Tired, something comforting",
    "Something light",
    "High protein, I just trained",
    "Under 20 AZN for two",
    "What is dovga?",
  ],
  az: [
    "Yorğunam, rahatladıcı bir şey",
    "Yüngül bir şey",
    "Çox zülal, indi məşq etdim",
    "İki nəfər üçün 20 AZN-ə qədər",
    "Dovğa nədir?",
  ],
  ru: [
    "Устал, что-то согревающее",
    "Что-нибудь лёгкое",
    "Много белка, после тренировки",
    "До 20 AZN на двоих",
    "Что такое довга?",
  ],
};

/**
 * Reads the NDJSON stream from /api/chat. `onDelta` fires with each piece of
 * reply text as it arrives, `onFinal` with the completed structured answer.
 * Plain JSON responses (offline fallback, rate limit) are handled too.
 */
async function readChatStream(res, { onDelta, onFinal }) {
  const type = res.headers.get("content-type") || "";
  if (!type.includes("ndjson")) {
    onFinal(await res.json());
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotFinal = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!raw) continue;
      const evt = JSON.parse(raw);
      if (evt.type === "delta") onDelta(evt.text);
      else if (evt.type === "final") {
        gotFinal = true;
        onFinal(evt);
      }
    }
  }
  if (!gotFinal) {
    onFinal({ reply: "", recommendations: [], notes: [], flags: {}, source: "stream-cut" });
  }
}

export default function AiWaiter({
  slug,
  table,
  lang,
  strings,
  profile,
  cart,
  hunger,
  setHunger,
  justTrained,
  setJustTrained,
  currency,
  extraMinutes,
  pendingAsk,
  onAskConsumed,
  cartQty,
  favourites,
  onToggleFavourite,
  onAdd,
  onSetQty,
  onOpenDish,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  // Once-only behaviours the AI has already performed this conversation.
  const [flags, setFlags] = useState({});
  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSpeechOk(Boolean(SR));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // A question handed over from the dish sheet ("what is Piti?") arrives as a
  // prop and is asked immediately, so tapping "ask about this" lands the guest
  // in a conversation rather than in an empty input.
  useEffect(() => {
    if (!pendingAsk || busy) return;
    onAskConsumed?.();
    ask(pendingAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  async function ask(text) {
    const question = (text ?? input).trim();
    if (!question || busy) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setBusy(true);

    const idx = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true, recommendations: [], notes: [] },
    ]);
    const patch = (fn) => setMessages((prev) => prev.map((m, i) => (i === idx ? fn(m) : m)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          table,
          message: question.slice(0, 500),
          profile,
          cart: cart.map((c) => ({
            dishId: c.dishId,
            name: c.name,
            qty: c.qty,
            price: c.price,
            kcal: c.kcal,
            protein: c.protein,
          })),
          hunger,
          justTrained,
          flags,
        }),
      });

      await readChatStream(res, {
        onDelta: (piece) => patch((m) => ({ ...m, content: m.content + piece })),
        onFinal: (data) => {
          patch((m) => ({
            ...m,
            streaming: false,
            content: data.replaceReply || !m.content ? data.reply || m.content : m.content,
            recommendations: data.recommendations || [],
            notes: data.notes || [],
            source: data.source,
          }));
          if (data.flags) {
            setFlags((f) => ({
              ...f,
              ...Object.fromEntries(Object.entries(data.flags).filter(([, v]) => v)),
            }));
          }
        },
      });
    } catch {
      patch((m) => ({
        ...m,
        streaming: false,
        failed: true,
        content: strings.aiUnreachable,
      }));
    } finally {
      setBusy(false);
    }
  }

  function toggleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SR();
    recognition.lang = SPEECH_LOCALE[lang] || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setListening(false);
      ask(said);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const asks = QUICK_ASKS[lang] || QUICK_ASKS.en;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-3">
        {/* Context controls sit above the conversation: they change what the
            AI is answering, so they belong before the answer, not after. */}
        <HungerSlider value={hunger} onChange={setHunger} label={strings.hungerQ} />

        <button
          onClick={() => setJustTrained(!justTrained)}
          aria-pressed={justTrained}
          className={cx(
            "flex w-full items-center gap-3 rounded-card px-4 py-3 text-left",
            "transition-colors duration-200 ease-out active:scale-[0.99]",
            justTrained ? "bg-good-soft text-good" : "bg-raised text-muted shadow-card"
          )}
        >
          <Barbell size={19} weight={justTrained ? "fill" : "regular"} className="shrink-0" />
          <span className="flex-1 text-sm font-medium">{strings.justTrained}</span>
          <span
            className={cx(
              "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors duration-200",
              justTrained ? "bg-good" : "bg-line"
            )}
          >
            <span
              className={cx(
                "block h-4 w-4 rounded-full bg-raised shadow-card transition-transform duration-200 ease-out",
                justTrained && "translate-x-4"
              )}
            />
          </span>
        </button>

        {messages.length === 0 ? (
          <div className="rounded-card bg-raised p-4 shadow-card animate-rise-in">
            <p className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted">
              <Sparkle size={17} weight="fill" className="mt-0.5 shrink-0 text-accent" />
              <span>{strings.aiIntro}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {asks.map((q) => (
                <Chip key={q} onClick={() => ask(q)}>
                  {q}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end animate-rise-in">
                  <p className="max-w-[85%] rounded-card rounded-br-chip bg-ink px-3.5 py-2.5 text-[14px] leading-snug text-paper">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="space-y-2.5 animate-rise-in">
                  <div
                    className={cx(
                      "max-w-[88%] rounded-card rounded-bl-chip px-3.5 py-2.5 shadow-card",
                      m.failed ? "bg-danger-soft" : "bg-raised"
                    )}
                  >
                    {m.content ? (
                      <p
                        className={cx(
                          "whitespace-pre-line text-[14px] leading-relaxed",
                          m.failed && "text-danger"
                        )}
                      >
                        {m.content}
                        {m.streaming && (
                          <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret bg-accent align-baseline" />
                        )}
                      </p>
                    ) : (
                      /* Skeleton lines rather than a spinner, matching the
                         shape of the reply that is about to arrive. */
                      <div className="space-y-2 py-0.5" aria-label={strings.thinking}>
                        <div className="skeleton h-3 w-[85%]" />
                        <div className="skeleton h-3 w-[60%]" />
                      </div>
                    )}

                    {m.notes?.length > 0 && (
                      <ul className="mt-2.5 space-y-1 border-t border-line pt-2.5 text-[12.5px] leading-snug text-muted">
                        {m.notes.map((n, k) => (
                          <li key={k} className="flex gap-1.5">
                            <span aria-hidden="true" className="text-faint">
                              &middot;
                            </span>
                            {n}
                          </li>
                        ))}
                      </ul>
                    )}

                    {m.source?.startsWith("fallback") && !m.streaming && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-faint">
                        <WifiSlash size={12} weight="bold" />
                        {strings.offlinePicker}
                      </p>
                    )}
                  </div>

                  {m.recommendations?.length > 0 && (
                    <div className="space-y-2.5">
                      {m.recommendations.map((r, k) => (
                        <DishCard
                          key={r.dishId}
                          dish={{ ...r.dish, prepMinutes: r.dish.prepMinutes - extraMinutes }}
                          lang={lang}
                          strings={strings}
                          currency={currency}
                          extraMinutes={extraMinutes}
                          reason={r.reason}
                          inCart={cartQty(r.dishId)}
                          isFavourite={favourites?.includes(r.dishId)}
                          onToggleFavourite={onToggleFavourite}
                          onAdd={onAdd}
                          onSetQty={onSetQty}
                          onOpen={onOpenDish}
                          index={k}
                          animate
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer. Sticky to the bottom of the scroll area so the guest can
          keep asking without scrolling back down. */}
      <div
        className="sticky z-bar -mx-4 mt-3 bg-paper/90 px-4 pb-2 pt-2 backdrop-blur-md"
        style={{ bottom: "var(--bar-h)" }}
      >
        <div className="flex items-end gap-2">
          {speechOk && (
            <button
              onClick={toggleVoice}
              aria-label={listening ? strings.listening : strings.speak}
              aria-pressed={listening}
              className={cx(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors duration-200",
                listening ? "bg-danger-soft text-danger" : "bg-sunken text-muted hover:text-ink"
              )}
            >
              <Microphone size={19} weight={listening ? "fill" : "regular"} />
            </button>
          )}

          <div className="flex min-w-0 flex-1 items-center rounded-full bg-sunken pr-1.5 focus-within:ring-2 focus-within:ring-accent/40">
            <input
              ref={inputRef}
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder={listening ? strings.listening : strings.askPlaceholder}
              aria-label={strings.askPlaceholder}
              className="min-w-0 flex-1 bg-transparent py-3 pl-4 text-[14px] text-ink outline-none placeholder:text-faint"
            />
            <button
              onClick={() => ask()}
              disabled={busy || !input.trim()}
              aria-label={strings.send}
              className={cx(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all duration-200 ease-out",
                "active:scale-90 disabled:opacity-30",
                input.trim() ? "bg-accent text-accent-ink" : "bg-line text-faint"
              )}
            >
              <ArrowUp size={17} weight="bold" />
            </button>
          </div>
        </div>

        <p className="mt-1.5 text-center text-[10.5px] leading-snug text-faint">
          {strings.aiDisclaimer}
        </p>
      </div>
    </div>
  );
}
