/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1714",
        inkred: "#B3261E",
        oxblood: "#7A1B14",
        manila: "#F3E9D2",
        cream: "#FAF4E6",
        live: "#1FA86B",
        mode: {
          road: "#1A1714",
          train: "#1FA86B",
          flight: "#E0A100",
          ship: "#2A6FB0",
        },
        pickup: "#1FA86B",
        drop: "#B3261E",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["'Public Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'Space Mono'", "ui-monospace", "monospace"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "stamp-in": {
          "0%": { opacity: "0", transform: "scale(1.25) rotate(-10deg)" },
          "60%": { opacity: "1", transform: "scale(0.96) rotate(-3deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-4deg)" },
        },
        "live-ping": {
          "0%": { boxShadow: "0 0 0 0 rgba(31,168,107,0.5)" },
          "70%": { boxShadow: "0 0 0 10px rgba(31,168,107,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(31,168,107,0)" },
        },
        "draw": {
          from: { strokeDashoffset: "1000" },
          to: { strokeDashoffset: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "stamp-in": "stamp-in 0.45s cubic-bezier(0.2,0.8,0.2,1) both",
        "live-ping": "live-ping 1.8s infinite",
        "draw": "draw 2.2s ease-out forwards",
      },
    },
  },
  plugins: [],
};
