import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`bg-slate-800 rounded-lg px-4 py-2 pr-11 outline-none focus:ring-2 focus:ring-blue-600 w-full ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white"
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
