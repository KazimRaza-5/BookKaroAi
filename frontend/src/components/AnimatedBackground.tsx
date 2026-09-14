"use client";
import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#08070c]">
      <motion.div
        className="absolute w-[550px] h-[550px] rounded-full bg-violet-600/35 blur-[120px]"
        style={{ top: "-15%", left: "-10%" }}
        animate={{ x: [0, 70, -30, 0], y: [0, 50, -20, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[620px] h-[620px] rounded-full bg-pink-500/30 blur-[130px]"
        style={{ top: "10%", right: "-15%" }}
        animate={{ x: [0, -60, 30, 0], y: [0, -40, 50, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[480px] h-[480px] rounded-full bg-cyan-400/25 blur-[110px]"
        style={{ bottom: "-15%", left: "15%" }}
        animate={{ x: [0, 50, -40, 0], y: [0, -30, 30, 0], scale: [1, 1.15, 1, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[420px] h-[420px] rounded-full bg-orange-400/25 blur-[100px]"
        style={{ bottom: "5%", right: "10%" }}
        animate={{ x: [0, -40, 40, 0], y: [0, 30, -30, 0], scale: [1, 0.95, 1.1, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
