import { useState, useRef, useEffect, useCallback } from "react";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useLang } from "../LangContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRobot,
  faTimes,
  faPaperPlane,
  faSpinner,
  faLightbulb,
  faChartLine,
  faHandHoldingDollar,
  faTriangleExclamation,
  faTrash,
  faPlus,
  faMessage,
  faBrain,
  faMobileScreen,
  faArrowTrendUp,
} from "@fortawesome/free-solid-svg-icons";

const db = getFirestore();

// ── FIX: Create stable options objects OUTSIDE the component so they are
//    never recreated on re-renders. useCollection's dep array then sees
//    a constant reference, keeping its size fixed every render.
//    These are module-level constants — one per collection.
const EMPTY_OPTS = {};
function makeOpts(ownerUid) {
  // Called once per ownerUid value change (inside a useMemo-like pattern below)
  return ownerUid ? { ownerUid } : EMPTY_OPTS;
}

function buildContext({ sales, purchases, expenses, losses, credits }) {
  const sum = (arr) => arr.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const today = new Date();

  const thisMonth = (arr) =>
    arr.filter((r) => {
      try {
        const d = new Date(r.date);
        return (
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear()
        );
      } catch {
        return false;
      }
    });

  const lastMonth = (arr) => {
    const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return arr.filter((r) => {
      try {
        const d = new Date(r.date);
        return (
          d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
        );
      } catch {
        return false;
      }
    });
  };

  const monthlySales = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    return {
      month: d.toLocaleString("default", { month: "short", year: "numeric" }),
      sales: sum(
        sales.filter((r) => {
          try {
            const rd = new Date(r.date);
            return (
              rd.getMonth() === d.getMonth() &&
              rd.getFullYear() === d.getFullYear()
            );
          } catch {
            return false;
          }
        }),
      ),
    };
  });

  return {
    summary: {
      totalSalesAllTime: sum(sales),
      totalSalesThisMonth: sum(thisMonth(sales)),
      totalSalesLastMonth: sum(lastMonth(sales)),
      totalExpensesThisMonth: sum(thisMonth(expenses)),
      totalLossesThisMonth: sum(thisMonth(losses)),
      totalPurchasesThisMonth: sum(thisMonth(purchases)),
      profitThisMonth:
        sum(thisMonth(sales)) -
        sum(thisMonth(purchases)) -
        sum(thisMonth(expenses)) -
        sum(thisMonth(losses)),
      profitLastMonth:
        sum(lastMonth(sales)) -
        sum(lastMonth(purchases)) -
        sum(lastMonth(expenses)) -
        sum(lastMonth(losses)),
    },
    monthlySalesTrend: monthlySales,
    recentSales: sales.slice(0, 20).map((r) => ({
      date: r.date,
      amount: r.amount,
      description: r.description,
      item: r.item,
      customer: r.customer,
    })),
    recentExpenses: expenses.slice(0, 10).map((r) => ({
      date: r.date,
      amount: r.amount,
      category: r.category,
    })),
    recentLosses: losses.slice(0, 10).map((r) => ({
      date: r.date,
      amount: r.amount,
      item: r.item,
      category: r.category,
    })),
    outstandingDebts: credits
      .filter((c) => c.status === "outstanding")
      .map((c) => ({
        customer: c.customer,
        phone: c.phone,
        totalAmount: c.totalAmount,
        paidAmount: c.paidAmount,
        remaining: (c.totalAmount || 0) - (c.paidAmount || 0),
      })),
  };
}

function parsePrefill(text) {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (!match) return null;
    const parsed = JSON.parse(match[1]);
    if (parsed.action === "prefill") return parsed;
  } catch {
    /* empty */
  }
  return null;
}

function chatTitle(messages) {
  const first = messages?.[0]?.text || "New conversation";
  return first.length > 32 ? first.slice(0, 32) + "…" : first;
}

// ── Simple markdown renderer (bold + line breaks only) ────────────────
function MessageText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part.split("\n").map((line, j, arr) => (
          <span key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ));
      })}
    </span>
  );
}

export default function AIAssistant({ ownerUid }) {
  const { t: tObj } = useLang();
  const t = (key) => tObj?.[key] ?? key;

  // ── FIX: Stabilise the options object passed to useCollection.
  //    Previously `ownerUid ? { ownerUid } : undefined` created a new
  //    object on every render, which caused useCollection's internal
  //    useEffect dep array to change size ("Previous: [] Incoming: [...]").
  //    We memoize the options object in a ref, only replacing it when
  //    ownerUid actually changes.
  const optsRef = useRef(makeOpts(ownerUid));
  if (optsRef.current.ownerUid !== ownerUid) {
    optsRef.current = makeOpts(ownerUid);
  }
  const collectionOpts = optsRef.current;

  const { items: sales } = useCollection("sales", collectionOpts);
  const { items: purchases } = useCollection("purchases", collectionOpts);
  const { items: expenses } = useCollection("expenses", collectionOpts);
  const { items: losses } = useCollection("losses", collectionOpts);
  const { items: credits } = useCollection("credits", collectionOpts);

  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  // activeChatId is stored in a ref too so _saveMessages always sees the latest value
  const [activeChatId, setActiveChatId] = useState(null);
  const activeChatIdRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTip, setShowTip] = useState(true);
  // Track whether we just loaded a chat from sidebar (to avoid overwriting with stale state)
  const loadingFromSidebar = useRef(false);

  // ── FIX: Keep conversations in a ref so the sidebar-load useEffect
  //    can read it without listing it as a dependency. This prevents
  //    that effect's dep array from changing size as Firestore populates.
  const conversationsRef = useRef([]);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const setActiveChat = (id) => {
    setActiveChatId(id);
    activeChatIdRef.current = id;
  };

  const suggestions = [
    {
      icon: faChartLine,
      text: t("salesThisWeek") || "How are my sales this week?",
    },
    { icon: faHandHoldingDollar, text: t("whoOwes") || "Who owes me money?" },
    {
      icon: faLightbulb,
      text: t("bestSelling") || "What is my best selling item?",
    },
    {
      icon: faTriangleExclamation,
      text: t("lossesMonth") || "What losses did I have this month?",
    },
    { icon: faArrowTrendUp, text: "Predict my sales for next month" },
    { icon: faBrain, text: "Give me business advice to grow my revenue" },
    { icon: faMobileScreen, text: "How do I use this app?" },
  ];

  const HOW_TO_USE_ANSWER = `Here's a quick guide to QuickDuka:

📊 **Dashboard** — Monthly totals and 6-month chart at a glance.
💰 **Sales** — Record every sale here.
🤝 **Credits** — Track customers who owe you money.
🛒 **Purchases** — Log what you buy for the business.
🧾 **Expenses** — Rent, electricity, transport, salaries, etc.
⚠️ **Losses** — Stolen, expired, or damaged stock.
📦 **Stock** — Your product catalogue with prices.
📈 **Reports** — Daily, monthly, yearly summaries + CSV download.
🕐 **History** — Full audit trail; restore deleted records anytime.

Ask me anything about your numbers!`;

  // ── Load conversations ────────────────────────────────────────────────
  useEffect(() => {
    if (!ownerUid) return;

    const q = query(
      collection(db, "aiChats"),
      where("ownerUid", "==", ownerUid),
      orderBy("updatedAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const convs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Keep ref in sync so sidebar-load effect can read without dep issues
        conversationsRef.current = convs;
        setConversations(convs);
      },
      (error) => {
        console.error("❌ aiChats snapshot error:", error.message);
        if (error.message?.includes("index")) {
          console.warn(
            "👉 You need to create a Firestore composite index.\n" +
              "   Go to Firebase Console → Firestore → Indexes → Add index:\n" +
              "   Collection: aiChats\n" +
              "   Fields: ownerUid (Ascending), updatedAt (Descending)\n" +
              "   Or click the link in the error above.",
          );
        }
      },
    );

    return unsub;
  }, [ownerUid]);

  // ── When sidebar chat is clicked, load its messages ───────────────────
  // ── FIX: dep array is now [activeChatId] only — constant size.
  //    We read conversations via conversationsRef instead of listing
  //    the state array as a dep (which changed size as Firestore loaded).
  useEffect(() => {
    if (!loadingFromSidebar.current) return;
    if (!activeChatId) {
      setMessages([]);
      loadingFromSidebar.current = false;
      return;
    }
    const found = conversationsRef.current.find((c) => c.id === activeChatId);
    if (found) {
      setMessages(found.messages || []);
    }
    loadingFromSidebar.current = false;
  }, [activeChatId]);  

  useEffect(() => {
    const timer = setTimeout(() => setShowTip(false), 300000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const startNewChat = () => {
    loadingFromSidebar.current = true;
    setActiveChat(null);
    setMessages([]);
    setInput("");
  };

  const selectChat = (id) => {
    loadingFromSidebar.current = true;
    setActiveChat(id);
    // Load messages immediately from the ref (always up to date)
    const found = conversationsRef.current.find((c) => c.id === id);
    if (found) setMessages(found.messages || []);
  };

  const deleteChat = async (e, chatId) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "aiChats", chatId));
      if (activeChatIdRef.current === chatId) startNewChat();
    } catch (err) {
      console.error("Delete chat failed:", err);
    }
  };

  // ── Save messages — uses ref so it always has the current chatId ──────
  const _saveMessages = useCallback(
    async (updatedMessages) => {
      if (!ownerUid) return;
      try {
        const currentId = activeChatIdRef.current;
        if (currentId) {
          await updateDoc(doc(db, "aiChats", currentId), {
            messages: updatedMessages,
            updatedAt: serverTimestamp(),
          });
        } else {
          // New conversation — create the doc first
          const newDoc = await addDoc(collection(db, "aiChats"), {
            ownerUid,
            userId: ownerUid,
            messages: updatedMessages,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          // Update ref and state — do NOT trigger the sidebar-load useEffect
          activeChatIdRef.current = newDoc.id;
          setActiveChatId(newDoc.id);
        }
      } catch (e) {
        console.error("❌ Save messages error:", e.message);
      }
    },
    [ownerUid],
  );

  // ── Send message ──────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput("");
    const newMessages = [...messages, { role: "user", text: userText }];
    setMessages(newMessages);
    setLoading(true);

    // ── Friendly greeting handling ─────────────────
    const isGreeting =
      /^(hi|hello|hey|yo|sasa|niaje|mambo|good morning|good evening)$/i.test(
        userText.trim(),
      );

    if (isGreeting) {
      const greetingReplies = [
        "Hello 👋 You're speaking to QuickDuka Assistant. How can I help with your business today?",
        "Hi 👋 You're speaking to QuickDuka Assistant. Need help checking your sales, profits, or debts?",
        "Hey 👋 You're speaking to QuickDuka Assistant. What would you like to know about your business?",
      ];

      const randomReply =
        greetingReplies[Math.floor(Math.random() * greetingReplies.length)];

      const updatedMessages = [
        ...newMessages,
        {
          role: "assistant",
          text: randomReply,
        },
      ];

      setMessages(updatedMessages);
      setLoading(false);

      await _saveMessages(updatedMessages);

      return;
    }

    // Local shortcut for how-to questions
    const isHowTo =
      /how.*(use|work|app|start|begin|navigate)/i.test(userText) ||
      /what.*(app|this|features|sections)/i.test(userText);

    if (isHowTo) {
      const updatedMessages = [
        ...newMessages,
        { role: "assistant", text: HOW_TO_USE_ANSWER },
      ];
      setMessages(updatedMessages);
      setLoading(false);
      await _saveMessages(updatedMessages);
      return;
    }

    try {
      const context = buildContext({
        sales,
        purchases,
        expenses,
        losses,
        credits,
      });

      const newLocal = `
You are QuickDuka Assistant — a smart and friendly business assistant for small businesses in Kenya.

PERSONALITY:
- Friendly
- Natural
- Professional
- Helpful
- Conversational but concise

RULES:
1. Reply in the same language as the user.
2. Use KES for all money amounts.
3. Never invent business figures.
4. Use only the provided business data.
5. Keep responses short and useful.
6. Give actionable business advice.
7. Predictions must include a short reason.
8. If information is missing, explain naturally.
9. Never sound robotic.
10. Never reply with phrases like:
   - "No relevant data available"
   - "No data to discuss"
   - "Nothing relevant found"

GOOD RESPONSE EXAMPLES:

User: hello
Assistant: Hello 👋 How can I help with your business today?

User: sales this month
Assistant: Your sales this month are KES 720. Honey is currently your top-selling item.

User: debts
Assistant: Mamake Brian still has an unpaid balance remaining.

BUSINESS DATA:
${JSON.stringify(context, null, 2)}
`;
      const systemPrompt = newLocal;

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        })),
      ];

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: apiMessages,
            temperature: 0.5,
            max_tokens: 300,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data?.error?.message || "Groq request failed");

      const replyText = data.choices?.[0]?.message?.content || "No response.";
      const prefillAction = parsePrefill(replyText);
      const displayText = replyText.replace(/```json[\s\S]*?```/g, "").trim();

      const updatedMessages = [
        ...newMessages,
        { role: "assistant", text: displayText, prefill: prefillAction },
      ];

      setMessages(updatedMessages);
      await _saveMessages(updatedMessages);
    } catch (err) {
      console.error("❌ Groq error:", err.message);
      const errMessages = [
        ...newMessages,
        {
          role: "assistant",
          text:
            t("aiError") || "Sorry, something went wrong. Please try again.",
        },
      ];
      setMessages(errMessages);
      await _saveMessages(errMessages);
    }

    setLoading(false);
  };;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* TIP POPUP */}
      {showTip && !open && (
        <div className="ai-tip-popup">
          <span>{t("chatWithAI") || "Chat with AI"}</span>

          <button onClick={() => setShowTip(false)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* FLOATING BUTTON */}
      <button className="ai-bubble" onClick={() => setOpen((v) => !v)}>
        <FontAwesomeIcon icon={open ? faTimes : faRobot} />

        <span className="ai-bubble-label">AI</span>
      </button>

      {/* MAIN PANEL */}
      {open && (
        <div className="ai-panel">
          {/* HEADER */}
          <div className="ai-panel-header">
            <div className="ai-panel-title">
              <FontAwesomeIcon icon={faRobot} style={{ marginRight: 8 }} />

              {t("QuickDuka Assistant") || "QuickDuka Assistant"}
            </div>

            <button className="ai-panel-close" onClick={() => setOpen(false)}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* BODY */}
          <div className="ai-body">
            {/* SIDEBAR */}
            <div className="ai-sidebar">
              <div className="ai-sidebar-title">
                {t("previousChats") || "Previous Chats"}
              </div>

              <button className="ai-sidebar-btn" onClick={startNewChat}>
                <FontAwesomeIcon icon={faPlus} />

                <span>{t("newChat") || "New Chat"}</span>
              </button>

              <div className="ai-chat-list">
                {conversations.length === 0 ? (
                  <div className="ai-chat-list-empty">No previous chats</div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`ai-chat-item ${
                        activeChatId === conv.id ? "active" : ""
                      }`}
                      onClick={() => selectChat(conv.id)}
                    >
                      <FontAwesomeIcon
                        icon={faMessage}
                        className="ai-chat-item-icon"
                      />

                      <div className="ai-chat-item-title">
                        {chatTitle(conv.messages)}
                      </div>

                      <button
                        className="ai-chat-delete-btn"
                        onClick={(e) => deleteChat(e, conv.id)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CHAT AREA */}
            <div className="ai-chat-area">
              {/* MESSAGES */}
              <div className="ai-messages">
                {messages.length === 0 ? (
                  <div className="ai-welcome">
                    <div className="ai-welcome-text">
                      <strong>Hello! 👋</strong>
                      <br />
                      Ask me anything about your business.
                    </div>

                    <div className="ai-suggestions">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          className="ai-suggestion-btn"
                          onClick={() => sendMessage(s.text)}
                        >
                          <FontAwesomeIcon icon={s.icon} />

                          <span>{s.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`ai-message ai-message-${msg.role}`}
                      >
                        <div className="ai-message-bubble">
                          <MessageText text={msg.text} />
                        </div>
                      </div>
                    ))}

                    {loading && (
                      <div className="ai-message ai-message-assistant">
                        <div className="ai-message-bubble ai-typing">
                          <FontAwesomeIcon
                            icon={faSpinner}
                            spin
                            style={{ marginRight: 8 }}
                          />

                          {t("thinking") || "Thinking..."}
                        </div>
                      </div>
                    )}

                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* INPUT */}
              <div className="ai-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  className="ai-input"
                  placeholder={
                    t("aiPlaceholder") || "Ask about your business..."
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />

                <button
                  className="ai-send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                >
                  {loading ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faPaperPlane} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}