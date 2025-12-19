import React, { useState } from "react";
import "../style/supportmodal.css";
import { FcCustomerSupport } from "react-icons/fc";
import axios from "axios";

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
    const [status, setStatus] = useState("");
    

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
    <div className="support-overlay" onClick={onClose}>
      <div
        className="support-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="support-header">
          <h2>
            <FcCustomerSupport size={30} /> Suporte
          </h2>
          <button className="support-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="support-body">
          <p className="support-description">
            Envie sua dúvida ou problema para o desenvolvedor.
          </p>

          <form className="support-form" onSubmit={handleSubmit}>
            <input type="text" name="name" placeholder="Seu nome" value={form.name} onChange={handleChange} required />
            <input type="email" name="email" placeholder="Seu email" value={form.email} onChange={handleChange} required />
            <input type="text" name="subject" placeholder="Assunto" value={form.subject} onChange={handleChange} required />
            <textarea name="message" placeholder="Mensagem" value={form.message} onChange={handleChange} required />

            <button
              type="submit"
              className="support-submit-btn"
              disabled={submitStatus === "loading"}
            >
              {submitStatus === "loading" ? "Enviando..." : "Enviar mensagem"}
            </button>
            {submitStatus !== "idle" && (
              <p className={`support-status ${submitStatus}`}>
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
