import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

export type ButtonVariant = "primary" | "secondary" | "success" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-blue-600",
  secondary: "bg-slate-800",
  success: "bg-green-600",
  danger: "bg-red-900",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-xs px-2 py-1 rounded",
  md: "px-4 py-2 rounded-lg",
  lg: "px-6 py-3 rounded-lg",
};

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  // When set, renders as a react-router Link instead of a <button> - many of
  // the app's existing CTAs are actually navigation ("bg-blue-600 px-4 py-2
  // rounded-lg" applied straight to a <Link to="...">).
  to?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({ variant = "primary", size = "md", className = "", to, children, ...rest }: ButtonProps) {
  const classes = [VARIANT_CLASSES[variant], SIZE_CLASSES[size], "disabled:opacity-50", className].filter(Boolean).join(" ");

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
