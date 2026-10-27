"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import rules from "./rules.json";

interface ChatRule {
  intent: string;
  keywords: string[];
  reply: string;
}

interface ChatMessage {
  id: number;
  sender: "user" | "bot";
  text: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult:
    | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  start: () => void;
  stop: () => void;
}

const chatRules = rules as ChatRule[];

function normalizeMessage(message: string): string {
  return message.toLowerCase().trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findRule(intent: string): ChatRule | undefined {
  return chatRules.find((rule) => rule.intent === intent);
}

function getBotReply(message: string): string {
  const normalized = normalizeMessage(message);

  const matchedRule = chatRules.find((rule) =>
    rule.keywords.some((keyword) => {
      const normalizedKeyword = normalizeMessage(keyword);
      if (!normalizedKeyword) return false;

      const pattern = new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`
      );
      return pattern.test(normalized);
    })
  );

  if (matchedRule) return matchedRule.reply;
  return findRule("Fallback")?.reply ?? "Sorry, I could not understand that.";
}

function getWelcomeMessage(): ChatMessage {
  return {
    id: 1,
    sender: "bot",
    text: findRule("Greeting")?.reply ?? findRule("Fallback")?.reply ?? "",
  };
}

function cleanForSpeech(text: string): string {
  return text.replace(/[^\p{L}\p{N}\s.,!?:'-]/gu, " ").replace(/\s+/g, " ");
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([getWelcomeMessage()]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [language, setLanguage] = useState<"en-US" | "ur-PK">("en-US");

  const nextId = useRef(2);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  }

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: nextId.current++,
      sender: "user",
      text: trimmed,
    };

    const botMessage: ChatMessage = {
      id: nextId.current++,
      sender: "bot",
      text: getBotReply(trimmed),
    };

    setMessages((previous) => [...previous, userMessage, botMessage]);
    setInput("");

    if (voiceOn) speak(botMessage.text);
  }

  function startListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognitionApi = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      alert("Is browser mein voice support nahi hai. Chrome ya Edge use karo.");
      return;
    }

    window.speechSynthesis?.cancel();

    const recognition = new SpeechRecognitionApi();
    recognition.lang = language;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      sendMessage(spokenText);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleClearChat() {
    window.speechSynthesis?.cancel();
    nextId.current = 2;
    setMessages([getWelcomeMessage()]);
    setInput("");
  }

  function toggleVoice() {
    window.speechSynthesis?.cancel();
    setVoiceOn((value) => !value);
  }

  return (
    <main className="min-h-screen bg-orange-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex h-[calc(100dvh-2rem)] max-h-[900px] min-h-[520px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-xl sm:h-[calc(100dvh-4rem)]">
        {/* Header */}
        <header className="flex items-center gap-3 bg-gradient-to-r from-red-600 to-orange-500 px-4 py-4 text-white sm:px-6">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl"
            aria-hidden="true"
          >
            🍔
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold sm:text-xl">
              Restaurant Voice Bot
            </h1>
            <p className="text-xs text-orange-100 sm:text-sm">
              Speak or type to order
            </p>
          </div>

          <div className="shrink-0">
            <label htmlFor="lang" className="sr-only">
              Voice language
            </label>
            <select
              id="lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en-US" | "ur-PK")}
              className="rounded-lg bg-white/20 px-2 py-2 text-xs font-semibold text-white outline-none focus:ring-2 focus:ring-white/60"
            >
              <option value="en-US" className="text-stone-800">
                English
              </option>
              <option value="ur-PK" className="text-stone-800">
                اردو
              </option>
            </select>
          </div>
        </header>

        {/* Chat window */}
        <section
          aria-label="Chat conversation"
          aria-live="polite"
          className="flex-1 space-y-4 overflow-y-auto bg-orange-50/60 px-3 py-5 sm:px-6"
        >
          {messages.map((message) => {
            const isUser = message.sender === "user";

            return (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && (
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm"
                    aria-hidden="true"
                  >
                    🍽️
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[75%] ${
                    isUser
                      ? "rounded-br-sm bg-red-600 text-white"
                      : "rounded-bl-sm border border-orange-100 bg-white text-stone-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                </div>

                {isUser && (
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm"
                    aria-hidden="true"
                  >
                    👤
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </section>

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-center gap-2 border-t border-orange-100 bg-white p-3 sm:flex-nowrap sm:gap-3 sm:p-4"
        >
          <label htmlFor="chat-input" className="sr-only">
            Type your message
          </label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={isListening ? "Listening..." : "Type or tap the mic..."}
            autoComplete="off"
            className="min-w-0 flex-1 basis-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 sm:basis-auto"
          />

          <button
            type="button"
            onClick={startListening}
            aria-label={isListening ? "Stop listening" : "Speak your message"}
            className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-orange-200 ${
              isListening
                ? "animate-pulse bg-green-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {isListening ? "🎙️ Listening..." : "🎤 Speak"}
          </button>

          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
          >
            Send
          </button>

          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceOn ? "Turn bot voice off" : "Turn bot voice on"}
            className="shrink-0 rounded-xl border border-orange-300 bg-white px-3 py-3 text-sm text-orange-700 transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="shrink-0 rounded-xl border border-orange-300 bg-white px-3 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-200 sm:px-4"
          >
            Clear
          </button>
        </form>

        <footer className="bg-white pb-3 text-center text-[11px] text-stone-400">
          Demo chatbot: menu, prices, and offers are sample data. No real orders are placed.
        </footer>
      </div>
    </main>
  );
}