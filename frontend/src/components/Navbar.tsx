"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import ConfirmDialog from "@/components/ConfirmDialog";

function NavLink({ href, label, active, primary }: { href: string; label: string; active: boolean; primary?: boolean }) {
  return (
    <Link href={href} className="relative text-sm px-4 py-2 rounded-full">
      {active && (
        <motion.div
          layoutId="navPill"
          className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/40 to-pink-500/40 border border-white/10"
          transition={{ type: "spring", stiffness: 350, damping: 22 }}
        />
      )}
      <span
        className={`relative z-10 transition-colors ${
          primary
            ? "font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400"
            : active
            ? "text-white font-medium"
            : "text-gray-400 hover:text-white"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

export default function Navbar() {
  const { isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [missedCount, setMissedCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    apiFetch("/api/appointments/notifications/unseen-count")
      .then((data: { count: number }) => setMissedCount(data.count))
      .catch(() => { });
  }, [isLoggedIn, pathname]);

  function handleConfirmLogout() {
    logout();
    setConfirmingLogout(false);
    router.push("/login");
  }

  return (
    <>
      <nav className="sticky top-0 z-40 glass border-b border-white/10">
        <div className="w-full px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-pink-400 to-orange-300 tracking-tight text-lg">
            BookApp
          </Link>
          <div className="flex items-center gap-1">
            {isLoggedIn && <NavLink href="/book" label="Book" active={pathname === "/book"} />}
            {isLoggedIn && <NavLink href="/chat" label="Chat" active={pathname === "/chat"} />}
            {isLoggedIn && <NavLink href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />}
            {isLoggedIn && (
              <div className="relative">
                <NavLink href="/notifications" label="Notifications" active={pathname === "/notifications"} />
                <AnimatePresence>
                  {missedCount > 0 && (
                    <motion.span
                      key={missedCount}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 10 }}
                      className="absolute -top-0.5 -right-0.5 bg-gradient-to-br from-pink-500 to-orange-400 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center pointer-events-none shadow-lg shadow-pink-500/50"
                    >
                      {missedCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
            {isLoggedIn ? (
              <button
                onClick={() => setConfirmingLogout(true)}
                className="text-sm px-3 py-1.5 rounded-full text-gray-400 hover:text-white transition-colors ml-1"
              >
                Log out
              </button>
            ) : (
              <div className="flex items-center gap-1 ml-1">
                <NavLink href="/login" label="Log in" active={pathname === "/login"} />
                <NavLink href="/register" label="Sign up" active={pathname === "/register"} primary />
              </div>
            )}
          </div>
        </div>
      </nav>

      <ConfirmDialog
        open={confirmingLogout}
        title="Log out?"
        message="You'll need to log in again to book or manage appointments."
        confirmLabel="Log out"
        tone="danger"
        onConfirm={handleConfirmLogout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </>
  );
}
