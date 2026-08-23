/**
 * Fonte: 21st.dev — Hero Shutter Text, ID 9989
 * Autor: daiwiikharihar
 * URL: https://21st.dev/@daiwiikharihar/components/hero-shutter-text
 * Recuperado via MCP em 2026-08-13.
 *
 * Código preservado como referência. Confirmar licença antes de uso comercial.
 */
"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

interface HeroTextProps {
  text?: string;
  className?: string;
}

export default function HeroText({
  text = "IMMERSE",
  className = "",
}: HeroTextProps) {
  const [count, setCount] = useState(0);
  const characters = text.split("");

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center bg-white transition-colors duration-700 dark:bg-zinc-950 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)",
          backgroundSize: "clamp(20px, 5vw, 60px) clamp(20px, 5vw, 60px)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={count}
            className="flex w-full flex-wrap items-center justify-center"
          >
            {characters.map((char, index) => (
              <div
                key={`${char}-${index}`}
                className="group relative overflow-hidden px-[0.1vw]"
              >
                <motion.span
                  initial={{ opacity: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: index * 0.04 + 0.3, duration: 0.8 }}
                  className="text-[15vw] font-black leading-none tracking-tighter text-zinc-900 dark:text-white"
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>

                <motion.span
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "100%", opacity: [0, 1, 0] }}
                  transition={{
                    duration: 0.7,
                    delay: index * 0.04,
                    ease: "easeInOut",
                  }}
                  className="pointer-events-none absolute inset-0 z-10 text-[15vw] font-black leading-none text-indigo-600 dark:text-emerald-400"
                  style={{ clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)" }}
                >
                  {char}
                </motion.span>

                <motion.span
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: "-100%", opacity: [0, 1, 0] }}
                  transition={{
                    duration: 0.7,
                    delay: index * 0.04 + 0.1,
                    ease: "easeInOut",
                  }}
                  className="pointer-events-none absolute inset-0 z-10 text-[15vw] font-black leading-none text-zinc-800 dark:text-zinc-200"
                  style={{ clipPath: "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)" }}
                >
                  {char}
                </motion.span>

                <motion.span
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "100%", opacity: [0, 1, 0] }}
                  transition={{
                    duration: 0.7,
                    delay: index * 0.04 + 0.2,
                    ease: "easeInOut",
                  }}
                  className="pointer-events-none absolute inset-0 z-10 text-[15vw] font-black leading-none text-indigo-600 dark:text-emerald-400"
                  style={{ clipPath: "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)" }}
                >
                  {char}
                </motion.span>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-12 z-20 flex flex-col items-center gap-6">
        <motion.button
          type="button"
          aria-label="Repetir animação"
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setCount((value) => value + 1)}
          className="rounded-full bg-zinc-900 p-4 text-white shadow-2xl transition-colors duration-300 dark:bg-white dark:text-black"
        >
          <RefreshCw size={24} />
        </motion.button>
        <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-400 dark:text-zinc-500">
          Click to re-shutter
        </p>
      </div>
    </div>
  );
}

