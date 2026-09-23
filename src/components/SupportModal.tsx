import React, { useState } from "react";
import { FcCustomerSupport } from "react-icons/fc";
import axios from "axios";
import { IoIosCloseCircleOutline } from "react-icons/io";

interface SupportModalProps {
  onClose: () => void;
}

type SubmitStatus = "idle" | "loading" | "success" | "error";

const SupportModal: React.FC<SupportModalProps> = ({ onClose }) => {

  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const BACKEND_URL =
  window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : "https://jarvis-backend-6xuu.onrender.com";

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitStatus("loading");
    setStatusMessage("Enviando mensagem...");

    try {
      const res = await axios.post(`${BACKEND_URL}/api/support`, form);

      setSubmitStatus("success");
      setStatusMessage(res.data.message || "Mensagem enviada com sucesso!");

      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      console.error(err);

      setSubmitStatus("error");
      setStatusMessage(
        err.response?.data?.error || "Erro ao enviar. Tente novamente."
      );
    }
  };

  return (
    <div className="jv-overlay" onClick={onClose}>
      <div className="jv-panel" onClick={(e) => e.stopPropagation()}>
        <div className="jv-scanline" />

        <header className="jv-header">
          <div>
            <span className="jv-status"><span className="jv-blink-dot" />ONLINE</span>
            <h1 className="jv-title"><FcCustomerSupport size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />SUPORTE</h1>
          </div>
          <button className="jv-close-btn" onClick={onClose} aria-label="Fechar Modal">
            <IoIosCloseCircleOutline size={26} />
          </button>
        </header>

        <div className="jv-scroll">
          <p className="jv-intro">
            Envie sua dúvida ou problema para o desenvolvedor. A mensagem vai direto para o
            e-mail cadastrado no sistema.
          </p>

          <form className="jv-form" onSubmit={handleSubmit}>
            <input type="text" name="name" placeholder="Seu nome" value={form.name} onChange={handleChange} required />
            <input type="email" name="email" placeholder="Seu email" value={form.email} onChange={handleChange} required />
            <input type="text" name="subject" placeholder="Assunto" value={form.subject} onChange={handleChange} required />
            <textarea name="message" placeholder="Mensagem" value={form.message} onChange={handleChange} required />

            <button
              type="submit"
              className="jv-btn"
              disabled={submitStatus === "loading"}
            >
              {submitStatus === "loading" ? "ENVIANDO..." : "ENVIAR MENSAGEM"}
            </button>

            {submitStatus !== "idle" && (
              <p className={`jv-form-status ${submitStatus}`}>
                {statusMessage}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupportModal;