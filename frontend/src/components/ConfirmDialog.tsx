"use client";
import { AnimatePresence, motion } from "framer-motion";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmClass =
    tone === "danger" ? "bg-gradient-to-r from-red-600 to-orange-500 hover:brightness-110 text-white" : "btn-gradient text-white";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="glass rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h2 className="text-white font-semibold mb-2">{title}</h2>
            <p className="text-gray-300 text-sm mb-6">{message}</p>
            <div className="flex justify-end gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={onCancel}
                className="px-4 py-2 rounded-full border border-white/15 text-gray-300 hover:bg-white/5 transition"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={onConfirm}
                className={`px-4 py-2 rounded-full font-medium transition ${confirmClass}`}
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
