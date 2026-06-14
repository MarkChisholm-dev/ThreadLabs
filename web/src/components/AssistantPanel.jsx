import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askAssistant, getAssistantStatus } from "../api.js";

export default function AssistantPanel() {
  const [status, setStatus] = useState({ loading: true, enabled: false, model: "", error: "" });
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    getAssistantStatus()
      .then((info) => {
        setStatus({
          loading: false,
          enabled: Boolean(info?.enabled),
          model: String(info?.model || ""),
          error: "",
        });
      })
      .catch((err) => {
        setStatus({ loading: false, enabled: false, model: "", error: err.message || "Status check failed" });
      });
  }, []);

  async function handleAsk() {
    const text = String(prompt || "").trim();
    if (!text || running || !status.enabled) {
      return;
    }

    setRunning(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setPrompt("");

    try {
      const history = messages.slice(-8).map((row) => ({ role: row.role, content: row.content }));
      const data = await askAssistant({ message: text, history });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response" }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>AI Assistant (Optional)</h2>
        {status.loading ? <span className="meta">Checking...</span> : <span className="meta">{status.model || "Ollama"}</span>}
      </div>

      {!status.loading && !status.enabled ? (
        <p className="meta">
          Assistant is disabled. Set <strong>OLLAMA_ENABLED=true</strong> and run Ollama locally.
        </p>
      ) : null}
      {status.error ? <p className="error">{status.error}</p> : null}

      {status.enabled ? (
        <>
          <label>
            Ask for outfit help, packing lists, or styling suggestions
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="I have a white shirt, dark jeans, and black sneakers. Suggest 3 casual date-night looks."
            />
          </label>
          <div className="row action-row">
            <button type="button" disabled={running || !prompt.trim()} onClick={handleAsk}>
              {running ? "Thinking..." : "Ask Assistant"}
            </button>
            <button type="button" className="secondary-btn" onClick={() => setMessages([])} disabled={running || messages.length === 0}>
              Clear
            </button>
          </div>

          <div className="suggestion-list">
            {messages.map((row, idx) => (
              <article className="suggestion-card" key={`${row.role}-${idx}`}>
                <header>
                  <h3>{row.role === "user" ? "You" : "Assistant"}</h3>
                </header>
                {row.role === "assistant" ? (
                  <ReactMarkdown className="assistant-markdown" remarkPlugins={[remarkGfm]}>
                    {row.content}
                  </ReactMarkdown>
                ) : (
                  <p className="assistant-user-text">{row.content}</p>
                )}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
